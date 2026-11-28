"""Rest stops along a long drive (ADR-20261128-drive-stops), the pure half of steps/drive-stops.py: decode Google's route
line, place a found stop along it (how far in, how far off, which side), tell its kind, pick the twin of a service area
on the side the car keeps to, thin the petrol stations, and write each stop in the page's shape. No network, no trip
globals: steps/drive-stops.py asks Google and passes the answers in, and the tests feed fixtures."""
import math, re

KINDS = ('sa', 'pa', 'roadside', 'fuel', 'store')
ROUTE_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'
ROUTE_MASK = 'routes.polyline.encodedPolyline,routes.distanceMeters'
ALONG_URL = 'https://places.googleapis.com/v1/places:searchText'
ALONG_MASK = ('places.id,places.displayName,places.location,places.types,places.businessStatus,'
              'places.regularOpeningHours.weekdayDescriptions,places.rating,places.userRatingCount')


def route_body(a, b, lang):
    """the Compute Routes request for a drive's route line, high quality so a service area's side of the road shows"""
    return {'origin': {'location': {'latLng': {'latitude': a['lat'], 'longitude': a['lng']}}},
            'destination': {'location': {'latLng': {'latitude': b['lat'], 'longitude': b['lng']}}},
            'travelMode': 'DRIVE', 'polylineQuality': 'HIGH_QUALITY', 'languageCode': lang}


def along_body(poly, search, lang, region):
    """the Text Search request for one of the pack's searches along a route line"""
    body = {'textQuery': search['q'], 'languageCode': lang, 'regionCode': region, 'pageSize': 20,
            'searchAlongRouteParameters': {'polyline': {'encodedPolyline': poly}}}
    if search.get('type'): body['includedType'] = search['type']
    return body
TYPE_KIND = {'gas_station': 'fuel', 'convenience_store': 'store'}  # Google's place types the page knows as a kind
GROUPED = ('sa', 'pa', 'roadside')  # one facility, many Google places (its food court, its shop, its fuel): kept once


def decode(poly):
    """Google's encoded polyline → [(lat, lng), …]"""
    pts, i, lat, lng = [], 0, 0, 0
    while i < len(poly or ''):
        vals = []
        for _ in (0, 1):
            shift = res = 0
            while True:
                b = ord(poly[i]) - 63; i += 1
                res |= (b & 0x1f) << shift; shift += 5
                if b < 0x20: break
            vals.append(~(res >> 1) if res & 1 else res >> 1)
        lat += vals[0]; lng += vals[1]
        pts.append((lat / 1e5, lng / 1e5))
    return pts


def _xy(p, o):
    """metres east and north of o (flat earth: a few hundred km at most)"""
    return (math.radians(p[1] - o[1]) * math.cos(math.radians(o[0])) * 6371000, math.radians(p[0] - o[0]) * 6371000)


def along(pts):
    """the metres from the start to each point of the line"""
    out = [0.0]
    for a, b in zip(pts, pts[1:]):
        x, y = _xy(b, a); out.append(out[-1] + math.hypot(x, y))
    return out


def place(pts, cum, p):
    """where a stop sits against the route line: (metres in, metres off the line, 'left' | 'right' of the way it runs)"""
    best = None
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        bx, by = _xy(b, a); px, py = _xy(p, a)
        seg = bx * bx + by * by
        t = 0.0 if not seg else max(0.0, min(1.0, (px * bx + py * by) / seg))
        dx, dy = px - t * bx, py - t * by
        off = math.hypot(dx, dy)
        if best is None or off < best[1]:
            best = (cum[i] + t * math.sqrt(seg), off, 'left' if bx * py - by * px > 0 else 'right')
    return best or (0.0, float('inf'), 'left')


def kind_of(name, types, asked, names):
    """a found place's kind: its name first (サービスエリア, 道の駅 … from the pack's `names`), then its Google type, else
    the kind it was searched for"""
    for k, pat in (names or {}).items():
        if k in KINDS and re.search(pat, name or ''): return k
    for t in types or []:
        if t in TYPE_KIND: return TYPE_KIND[t]
    return asked


def dir_of(name, words):
    """'up' or 'down' when the name carries the expressway's direction word (上り, 下り), else None"""
    for k in ('up', 'down'):
        w = (words or {}).get(k)
        if w and w in (name or ''): return k
    return None


def base(name, words):
    """a service area's name without its direction word and brackets, so its two twins share one: 砂川SA（上り） → 砂川SA"""
    n = name or ''
    for w in (words or {}).values(): n = n.replace(w, '')
    return re.sub(r'[\s（）()［］\[\]・線]+', '', n)


def day_hours(days, weekday):
    """a stop's hours on the drive's weekday from lib.hours.parse_hours' week: {'h24': True}, {'shut': True},
    {'hours': '07:00–22:00'} (more than one range joined with ', '), or {} when unknown"""
    h = days[weekday] if days and weekday is not None and 0 <= weekday < len(days) else None
    if h == '24h': return {'h24': True}
    if h == 'closed': return {'shut': True}
    if h and re.fullmatch(r'\d{1,2}:\d{2}–\d{1,2}:\d{2}(,\d{1,2}:\d{2}–\d{1,2}:\d{2})*', h):
        return {'hours': re.sub(r'(?<!\d)(\d):', r'0\1:', h).replace(',', ', ')}  # 7:00 → 07:00, as the page writes times
    return {}


def pick(cands, pts, leg_min, words=None, side='left', off_m=800, fuel_gap_km=15, twin_m=30):
    """the stops a long drive lists, in order along the way. `cands`: what the searches found, each
    {id, name, lat, lng, kind, status?, hours: {…}, rating?, reviews?}. Kept: open for business, within off_m of the line.
    A service area signed for one direction is kept only on the side the car keeps to (when it sits twin_m or more off
    the line; nearer, its side can't be told and it stays); its twin across the road goes. The places of one facility
    (a service area's shop and food court) are kept once, the shortest name. Petrol stations at least fuel_gap_km apart,
    a 24 h one first. Minutes in are the leg's own minutes shared out by distance (Google's pace, typical traffic)."""
    if len(pts) < 2: return []
    cum = along(pts); total = cum[-1] or 1.0
    seen, rows = set(), []
    for c in cands:
        if not c.get('id') or c['id'] in seen or c.get('status') not in (None, 'OPERATIONAL'): continue
        seen.add(c['id'])
        m_in, off, at = place(pts, cum, (c['lat'], c['lng']))
        if off > off_m: continue
        d = dir_of(c['name'], words) if c['kind'] in ('sa', 'pa') else None
        if d and off >= twin_m and at != side: continue  # the twin across the expressway
        rows.append({**c, 'm': m_in, 'off': off, 'dir': d})
    # one facility, many places: same kind and direction within 600 m, or the same name without its direction word
    kept = []
    for r in sorted(rows, key=lambda r: (len(r['name']), -(r.get('reviews') or 0), r['id'])):
        if r['kind'] in GROUPED and any(k['kind'] == r['kind'] and k['dir'] == r['dir'] and (abs(k['m'] - r['m']) < 600 or (r['kind'] != 'roadside' and base(k['name'], words) == base(r['name'], words))) for k in kept):
            continue
        kept.append(r)
    kept.sort(key=lambda r: (r['m'], r['id']))
    out, last_fuel = [], None
    fuel = sorted((r for r in kept if r['kind'] == 'fuel'), key=lambda r: (r['m'], not (r.get('hours') or {}).get('h24'), r['id']))
    keep_fuel = set()
    for r in fuel:
        if last_fuel is None or r['m'] - last_fuel >= fuel_gap_km * 1000:
            keep_fuel.add(r['id']); last_fuel = r['m']
    for r in kept:
        if r['kind'] == 'fuel' and r['id'] not in keep_fuel: continue
        s = {'name': r['name'], 'kind': r['kind'], 'km': round(r['m'] / 1000, 1), 'min': round(leg_min * r['m'] / total),
             'lat': round(r['lat'], 6), 'lng': round(r['lng'], 6), **(r.get('hours') or {})}
        if r['dir']: s['dir'] = r['dir']
        if r.get('rating') is not None: s['rating'], s['reviews'] = r['rating'], r.get('reviews')
        out.append(s)
    return out
