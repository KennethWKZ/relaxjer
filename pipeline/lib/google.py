"""Google Places / Routes calls with a response cache, shared by every step.

The key is the user's own (ADR-20260930-google-keys): ~/.config/relaxjer/google-places.key (mode 600), or RELAXJER_GOOGLE_KEY_FILE.
It runs from the user's machine only and never goes into a page.
Cache: <trip>/.cache/google-cache.json. Every call is paid for, so a call already in the cache is answered from it, and
a re-run pays only for what's new (ADR-20261001-resync-cost-guard). RESYNC_FRESH=1 (resync.py --fresh) starts from an
empty cache instead; saving merges into the file, so the answers of the other steps stay.
RESYNC_FRESH_DRIVES=1 (resync.py --fresh-drives) asks again only the traffic-aware drives, so a refresh near the trip
gets newer traffic predictions while every other answer stays cached.
Without RESYNC_PAID=1 (resync.py --yes: the planner agreed to the cost) a step stops after MAX_NEW new calls, and what
it fetched is saved on the way out. On the way out a step also reports its new calls and their list price on stderr
(REPORT), and resync.py prints that under the step.
RELAXJER_OFFLINE=1 (tests): a call not in the cache raises instead of going to the network."""
import atexit, json, math, os, threading, time, urllib.error, urllib.request
from lib.trip import CACHE_DIR, cfg

KEY_FILE = os.environ.get('RELAXJER_GOOGLE_KEY_FILE') or os.path.expanduser('~/.config/relaxjer/google-places.key')
CF = CACHE_DIR + 'google-cache.json'
OUT = CACHE_DIR + 'google-out.json'
OFFLINE = os.environ.get('RELAXJER_OFFLINE') == '1'
FRESH = os.environ.get('RESYNC_FRESH') == '1' and not OFFLINE
FRESH_DRIVES = os.environ.get('RESYNC_FRESH_DRIVES') == '1'
PAID = os.environ.get('RESYNC_PAID') == '1'
MAX_NEW = 200  # new calls one step may make without the planner's go: about US$7 at most, at list price
CACHE = json.load(open(CF)) if os.path.exists(CF) and not FRESH else {}
LOCK = threading.Lock()
LANG, REGION = cfg('google', {}).get('language', 'zh-TW'), cfg('google', {}).get('region', 'TW')
_key = None
NEW = [0]  # calls made this run (not answered from the cache)
ASKED = [0]  # calls started this run, counted before they go out, so threads can't overshoot MAX_NEW
SAVED = [0]  # NEW when the cache was last written
NEW_USD = [0.0]  # list price of NEW
ASKED_AGAIN = set()  # cached calls asked again this run (fresh=True), so a second identical call reads the new answer
REPORT = 'RESYNC_GOOGLE_NEW_CALLS'  # the stderr line resync.py reads: '<REPORT> <calls> <US$>'

class TooMany(SystemExit):
    """a SystemExit, so a step's `except Exception` can't swallow it"""

def key():
    global _key
    if _key is None:
        if not os.path.exists(KEY_FILE): raise SystemExit(f'no Google key at {KEY_FILE} (see memory-bank/standards/decisions/ADR-20260930-google-keys.md)')
        _key = open(KEY_FILE).read().strip()
    return _key

# a key or quota problem, a busy server, no network: not an answer worth keeping (Google doesn't bill these)
AGAIN = {401, 403, 429, 500, 502, 503, 504, 'net'}
def failed(r): return isinstance(r, dict) and r.get('_err') in AGAIN

def call(tag, url, body=None, mask='', method='POST', fresh=False):
    """fresh: ask Google again even when the cache holds an answer (once per run)"""
    k = tag + '|' + json.dumps(body, sort_keys=True, ensure_ascii=False) + '|' + url + '|' + mask
    with LOCK:
        # a failed call is asked again, so a run the quota stopped finishes on the next one; a 404 (gone) is an answer
        again = fresh and k not in ASKED_AGAIN and not OFFLINE
        if k in CACHE and not again and (OFFLINE or not failed(CACHE[k])): return CACHE[k]
        if OFFLINE: raise RuntimeError(f'offline and not cached: {tag} {url}')
        if not PAID and ASKED[0] >= MAX_NEW:
            raise TooMany(f'stopped: this step needs more than {MAX_NEW} Google calls the cache doesn\'t hold. What it fetched '
                          'is kept. Paying for the rest is the planner\'s call: they add --yes to the same command.')
        ASKED[0] += 1
        if fresh: ASKED_AGAIN.add(k)
    h = {'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': mask}
    if body is not None: h['Content-Type'] = 'application/json'
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
            r = json.loads(urllib.request.urlopen(req, timeout=40).read()); break
        except urllib.error.HTTPError as e:
            r = {'_err': e.code, '_msg': e.read().decode()[:200]}
            if e.code in (429, 500, 503): time.sleep(2 + attempt * 3); continue
            break
        except Exception as e:
            r = {'_err': 'net', '_msg': str(e)[:120]}; time.sleep(2)
    with LOCK: CACHE[k] = r; NEW[0] += 1; NEW_USD[0] += cost(k)
    return r

def save():
    """write the cache, keeping what other steps stored"""
    old = json.load(open(CF)) if os.path.exists(CF) else {}
    os.umask(0o077); json.dump({**old, **CACHE}, open(CF, 'w'), ensure_ascii=False)
    SAVED[0] = NEW[0]

@atexit.register
def _keep_paid_answers():
    """a step that stops early (TooMany, an error, Ctrl-C) still keeps the answers it paid for"""
    if NEW[0] != SAVED[0]: save()

@atexit.register
def _report_new_calls():
    """runs before _keep_paid_answers (atexit is last in, first out), so a step that stopped early still reports"""
    import sys
    if os.environ.get('RESYNC_REPORT') == '1': print(f'{REPORT} {NEW[0]} {NEW_USD[0]:.4f}', file=sys.stderr)

# list price per 1,000 calls, by product and the dearest field a call asks for (Google's price list, checked 2026-10-01).
# The free monthly amounts come off the bill; an estimate leaves them out, so it errs high.
PRICE = {'text': {'ids': 0, 'essentials': 32, 'pro': 32, 'enterprise': 35, 'atmosphere': 40},
         'nearby': {'ids': 32, 'essentials': 32, 'pro': 32, 'enterprise': 35, 'atmosphere': 40},
         'details': {'ids': 0, 'essentials': 5, 'pro': 17, 'enterprise': 20, 'atmosphere': 25},
         'routes': 5, 'routes_traffic': 10, 'other': 40}  # routes_traffic: Compute Routes Pro (traffic-aware), checked 2026-10-07
TIER = {**dict.fromkeys(['id', 'name', 'attributions', 'nextPageToken'], 'ids'),
        **dict.fromkeys('displayName businessStatus googleMapsUri googleMapsLinks primaryType primaryTypeDisplayName '
                        'accessibilityOptions utcOffsetMinutes iconBackgroundColor iconMaskBaseUri containingPlaces '
                        'subDestinations pureServiceAreaBusiness'.split(), 'pro'),
        **dict.fromkeys('rating userRatingCount regularOpeningHours currentOpeningHours regularSecondaryOpeningHours '
                        'currentSecondaryOpeningHours nationalPhoneNumber internationalPhoneNumber websiteUri priceLevel '
                        'priceRange'.split(), 'enterprise'),
        **dict.fromkeys('restroom goodForChildren goodForGroups goodForWatchingSports reviews reviewSummary editorialSummary '
                        'generativeSummary neighborhoodSummary takeout delivery dineIn curbsidePickup reservable '
                        'outdoorSeating liveMusic menuForChildren allowsDogs parkingOptions paymentOptions fuelOptions '
                        'evChargeOptions evChargeAmenitySummary routingSummaries'.split(), 'atmosphere')}
ORDER = ['ids', 'essentials', 'pro', 'enterprise', 'atmosphere']

def cost(k):
    """list price in US$ of asking one cached call again"""
    url, mask = k.rsplit('|', 2)[-2:]
    if 'routes.googleapis.com' in url: return PRICE['routes_traffic' if 'TRAFFIC_AWARE' in k else 'routes'] / 1000
    kind = 'text' if 'places:searchText' in url else 'nearby' if 'places:searchNearby' in url else 'details' if '/v1/places/' in url else 'other'
    if kind == 'other': return PRICE['other'] / 1000
    fields = [f.removeprefix('places.').split('.')[0] for f in mask.split(',') if f]
    tier = max((TIER.get(f, 'atmosphere' if f.startswith('serves') else 'essentials') for f in fields), key=ORDER.index, default='ids')
    return PRICE[kind][tier] / 1000

def estimate(keys):
    """(calls, US$ at list price) for asking these cached calls again"""
    keys = list(keys)
    return len(keys), sum(map(cost, keys))

DET = 'id,displayName,formattedAddress,location,regularOpeningHours.weekdayDescriptions,rating,userRatingCount,businessStatus,nationalPhoneNumber,googleMapsUri,primaryType'
def details(pid, lang=None): return call('det', f'https://places.googleapis.com/v1/places/{pid}?languageCode={lang or LANG}', None, DET, 'GET')
def text(q, bias=None, rect=None, n=20, page=None):
    b = {'textQuery': q, 'languageCode': LANG, 'regionCode': REGION, 'pageSize': n}
    if bias: b['locationBias'] = {'circle': {'center': {'latitude': bias[0], 'longitude': bias[1]}, 'radius': 400.0}}
    if rect: b['locationRestriction'] = {'rectangle': {'low': {'latitude': rect[0], 'longitude': rect[1]}, 'high': {'latitude': rect[2], 'longitude': rect[3]}}}
    if page: b['pageToken'] = page
    return call('txt', 'https://places.googleapis.com/v1/places:searchText', b, 'places.' + DET.replace(',', ',places.') + ',nextPageToken')
def nearby(lat, lng, types, radius):
    return call('near', 'https://places.googleapis.com/v1/places:searchNearby', {'includedTypes': types, 'maxResultCount': 3, 'rankPreference': 'DISTANCE', 'languageCode': LANG, 'locationRestriction': {'circle': {'center': {'latitude': round(lat, 5), 'longitude': round(lng, 5)}, 'radius': radius}}}, 'places.id,places.displayName,places.location,places.types')
def route(o, d, mode, when, traffic=None):
    """traffic: 'BEST_GUESS' or 'PESSIMISTIC' asks a drive's predicted time at `when` (Compute Routes Pro); without it the request, and its cache key, stay as before"""
    b = {'origin': {'location': {'latLng': {'latitude': o[0], 'longitude': o[1]}}}, 'destination': {'location': {'latLng': {'latitude': d[0], 'longitude': d[1]}}}, 'travelMode': mode, 'languageCode': LANG}
    if mode == 'TRANSIT': b['departureTime'] = when
    if mode == 'DRIVE' and traffic: b.update(departureTime=when, routingPreference='TRAFFIC_AWARE_OPTIMAL', trafficModel=traffic)
    return call('route', 'https://routes.googleapis.com/directions/v2:computeRoutes', b, fresh=FRESH_DRIVES and mode == 'DRIVE' and bool(traffic), mask='routes.duration,routes.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.distanceMeters,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.nameShort,routes.legs.steps.transitDetails.stopCount,routes.legs.steps.transitDetails.headsign,routes.legs.steps.transitDetails.stopDetails.departureStop.name,routes.legs.steps.transitDetails.stopDetails.arrivalStop.name,routes.legs.steps.transitDetails.transitLine.vehicle.type')
def dist(a, b): return 6371000 * math.hypot(math.radians(b[1]-a[1]) * math.cos(math.radians((a[0]+b[0])/2)), math.radians(b[0]-a[0]))
