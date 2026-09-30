"""Google Places / Routes calls with a response cache, shared by every step.

The key is the user's own (ADR 0003): ~/.config/relaxjer/google-places.key (mode 600), or RELAXJER_GOOGLE_KEY_FILE.
It runs from the user's machine only and never goes into a page.
Cache: <trip>/.cache/google-cache.json. With RESYNC_REUSE=1 (resync.py --reuse) a call already in the cache is not
made again. Saving merges into the file, so a fresh run keeps the answers of the other steps.
RELAXJER_OFFLINE=1 (tests): a call not in the cache raises instead of going to the network."""
import json, math, os, threading, time, urllib.error, urllib.request
from lib.trip import CACHE_DIR, cfg

KEY_FILE = os.environ.get('RELAXJER_GOOGLE_KEY_FILE') or os.path.expanduser('~/.config/relaxjer/google-places.key')
CF = CACHE_DIR + 'google-cache.json'
OUT = CACHE_DIR + 'google-out.json'
OFFLINE = os.environ.get('RELAXJER_OFFLINE') == '1'
CACHE = json.load(open(CF)) if os.path.exists(CF) and (os.environ.get('RESYNC_REUSE') == '1' or OFFLINE) else {}
LOCK = threading.Lock()
LANG, REGION = cfg('google', {}).get('language', 'zh-TW'), cfg('google', {}).get('region', 'TW')
_key = None
NEW = [0]  # calls made this run (not answered from the cache)

def key():
    global _key
    if _key is None:
        if not os.path.exists(KEY_FILE): raise SystemExit(f'no Google key at {KEY_FILE} (see docs/adr/0003-google-keys.md)')
        _key = open(KEY_FILE).read().strip()
    return _key

def call(tag, url, body=None, mask='', method='POST'):
    k = tag + '|' + json.dumps(body, sort_keys=True, ensure_ascii=False) + '|' + url + '|' + mask
    with LOCK:
        if k in CACHE: return CACHE[k]
    if OFFLINE: raise RuntimeError(f'offline and not cached: {tag} {url}')
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
    with LOCK: CACHE[k] = r; NEW[0] += 1
    return r

def save():
    """write the cache, keeping what other steps stored"""
    old = json.load(open(CF)) if os.path.exists(CF) else {}
    os.umask(0o077); json.dump({**old, **CACHE}, open(CF, 'w'), ensure_ascii=False)

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
def route(o, d, mode, when):
    b = {'origin': {'location': {'latLng': {'latitude': o[0], 'longitude': o[1]}}}, 'destination': {'location': {'latLng': {'latitude': d[0], 'longitude': d[1]}}}, 'travelMode': mode, 'languageCode': LANG}
    if mode == 'TRANSIT': b['departureTime'] = when
    return call('route', 'https://routes.googleapis.com/directions/v2:computeRoutes', b, 'routes.duration,routes.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.distanceMeters,routes.legs.steps.transitDetails.transitLine.name,routes.legs.steps.transitDetails.transitLine.nameShort,routes.legs.steps.transitDetails.stopCount,routes.legs.steps.transitDetails.headsign,routes.legs.steps.transitDetails.stopDetails.departureStop.name,routes.legs.steps.transitDetails.stopDetails.arrivalStop.name,routes.legs.steps.transitDetails.transitLine.vehicle.type')
def dist(a, b): return 6371000 * math.hypot(math.radians(b[1]-a[1]) * math.cos(math.radians((a[0]+b[0])/2)), math.radians(b[0]-a[0]))
