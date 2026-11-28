"""Free water refill points in one shape, from OpenStreetMap and from the trip's own refill-*.json files
(ADR-20261128-water-refill). Pure: no network and no trip globals, so pipeline/tests feeds it fixtures; steps/refill.py
does the fetching and the writing.

A spot: {id, src, name, lat, lng, address, kind, indoor, seasonal, hours, hours_note, water, how, site, added, credit}
  kind      'tap' (a fountain or a tap), 'shop' (a shop or café that fills a bottle) or 'shelter' (a public indoor place)
  indoor    True / False / None (not known). A shop or a shelter is indoor
  seasonal  True: shut for winter (OSM seasonal=*), False: open all year, None: not known (the pack's winter rule decides)
  hours     {'days': {'1'..'7': [['HH:MM', 'HH:MM'], ...]}, 'known': bool} or None; '1' is Monday, an empty list closed
The page works out which spots are near a stop, which are shut for winter on a day and which are open now
(engine/src/core/refill.mjs)."""
import math, re

KINDS = ('tap', 'shop', 'shelter')
FIELDS = ('id', 'src', 'name', 'lat', 'lng', 'address', 'kind', 'indoor', 'seasonal', 'hours', 'hours_note', 'water', 'how', 'site',
          'added', 'credit')
OSM_CREDIT = '© OpenStreetMap contributors'
SAME_M = 25  # two spots this close, of the same kind, are one spot that two sources list


def dist(a, b):
    """metres between two (lat, lng) points"""
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def boxes(points, join_m=3000, pad_m=800):
    """the areas to ask OpenStreetMap about: the trip's places grouped where they sit within join_m of each other, each
    group's bounding box grown by pad_m, as (south, west, north, east) rounded to 4 places, in a stable order. A day trip
    40 km out gets its own small box instead of one box over the whole region."""
    pts = sorted({(round(la, 5), round(lo, 5)) for la, lo in points})
    group = list(range(len(pts)))
    def root(i):
        while group[i] != i: group[i] = group[group[i]]; i = group[i]
        return i
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            if dist(pts[i], pts[j]) <= join_m: group[root(i)] = root(j)
    out = {}
    for i, p in enumerate(pts): out.setdefault(root(i), []).append(p)
    res = []
    for ps in out.values():
        s, n = min(p[0] for p in ps), max(p[0] for p in ps)
        w, e = min(p[1] for p in ps), max(p[1] for p in ps)
        dlat = pad_m / 111320
        dlng = pad_m / (111320 * max(0.2, math.cos(math.radians((s + n) / 2))))
        res.append((round(s - dlat, 4), round(w - dlng, 4), round(n + dlat, 4), round(e + dlng, 4)))
    return sorted(res)


def query(box):
    """the Overpass query for one area: drinking water, taps that give it, and places that fill a bottle"""
    b = ','.join(str(x) for x in box)
    return (f'[out:json][timeout:25];(nwr["amenity"="drinking_water"]({b});nwr["drinking_water"~"^(yes|customers)$"]({b});'
            f'nwr["drinking_water:refill"="yes"]({b});nwr["man_made"="water_tap"]["drinking_water"="yes"]({b});'
            f'nwr["amenity"="water_point"]["drinking_water"="yes"]({b}););out center tags;')


DAY = {'Mo': 0, 'Tu': 1, 'We': 2, 'Th': 3, 'Fr': 4, 'Sa': 5, 'Su': 6}
TIME = r'\d{1,2}:\d{2}-\d{1,2}:\d{2}'


def _clock(t):
    h, m = t.split(':')
    return f'{int(h):02d}:{m}'


def _days(part):
    """'Mo-Fr,Su' → [0, 1, 2, 3, 4, 6], or None when it isn't a plain weekday list"""
    out = []
    for bit in part.split(','):
        bit = bit.strip()
        if re.fullmatch(r'[A-Z][a-z]-[A-Z][a-z]', bit) and bit[:2] in DAY and bit[3:] in DAY:
            a, b = DAY[bit[:2]], DAY[bit[3:]]
            out += [(a + k) % 7 for k in range((b - a) % 7 + 1)]
        elif bit in DAY: out.append(DAY[bit])
        else: return None
    return out


def opening_hours(s):
    """the common forms of OSM's opening_hours as a spot's hours, else None: '24/7', 'Mo-Fr 09:00-18:00; Sa,Su 10:00-17:00',
    '08:00-12:00,13:00-17:00' (every day), 'Mo off', and a holiday rule ('PH off'), which is left out. A later rule wins
    for its days, as in OSM."""
    s = (s or '').strip()
    if not s: return None
    if s == '24/7': return {'days': {str(i): [['00:00', '24:00']] for i in range(1, 8)}, 'known': True}
    days = {str(i): [] for i in range(1, 8)}
    for rule in [r.strip() for r in s.split(';') if r.strip()]:
        m = re.fullmatch(rf'(?:(.+?)\s+)?(off|closed|{TIME}(?:\s*,\s*{TIME})*)', rule)
        if not m: return None
        part, times = m.group(1), m.group(2)
        if part and re.fullmatch(r'(PH|SH)(,(PH|SH))*', part): continue  # holidays: the page doesn't know them
        idx = _days(part) if part else list(range(7))
        if idx is None: return None
        ranges = [] if times in ('off', 'closed') else [[_clock(a), _clock(b)] for a, b in (t.split('-') for t in re.split(r'\s*,\s*', times))]
        for i in idx: days[str(i + 1)] = ranges
    return {'days': days, 'known': True}


SHOP_AMENITY = {'cafe', 'restaurant', 'fast_food', 'pub', 'bar', 'ice_cream', 'food_court'}
INDOOR_AMENITY = {'library', 'townhall', 'community_centre', 'social_centre'}


def from_osm(el):
    """an Overpass element as a spot, or None for one that's private, out of use or not drinking water"""
    t = el.get('tags') or {}
    lat = el.get('lat', (el.get('center') or {}).get('lat'))
    lng = el.get('lon', (el.get('center') or {}).get('lon'))
    if lat is None or lng is None: return None
    if t.get('access') in ('private', 'no') or t.get('drinking_water') == 'no' or t.get('disused') == 'yes': return None
    amenity = t.get('amenity')
    if t.get('shop') or amenity in SHOP_AMENITY or t.get('drinking_water:refill') == 'yes' or t.get('drinking_water') == 'customers':
        kind = 'shop'
    elif amenity in INDOOR_AMENITY: kind = 'shelter'
    else: kind = 'tap'
    where = t.get('indoor'), t.get('location')
    indoor = (True if kind != 'tap' or where[0] in ('yes', 'room', 'area', 'corridor') or where[1] in ('indoor', 'inside', 'underground')
              else False if where[0] == 'no' or where[1] in ('outdoor', 'outside') else None)
    sea = t.get('seasonal')
    seasonal = None if not sea else False if sea == 'no' or 'winter' in sea else True  # 'yes', 'summer', 'spring;summer;autumn'
    oh = t.get('opening_hours')
    hours = opening_hours(oh)
    site = t.get('website') or t.get('contact:website') or t.get('url')
    return {
        'id': f"osm-{el['type'][0]}{el['id']}", 'src': 'osm', 'name': t.get('name') or None,
        'lat': round(float(lat), 6), 'lng': round(float(lng), 6), 'address': t.get('addr:full') or None,
        'kind': kind, 'indoor': indoor, 'seasonal': seasonal, 'hours': hours, 'hours_note': oh if oh and not hours else None,
        'water': [], 'how': (t.get('description') or '')[:140] or None, 'site': site if site and re.match(r'https?://', site) else None,
        'added': None, 'credit': OSM_CREDIT,
    }


CLOCK = re.compile(r'^([01]?\d|2\d|3[0-5]):[0-5]\d$')  # up to 35:59: a range that runs past midnight


def _hours(h):
    """a trip file's hours, checked: the spot shape's, or None (with False when it was there but unreadable)"""
    if h is None: return None
    if not isinstance(h, dict) or not isinstance(h.get('days'), dict): return False
    days = {}
    for k, v in h['days'].items():
        if k not in {str(i) for i in range(1, 8)} or not isinstance(v, list): return False
        rs = []
        for r in v:
            if not (isinstance(r, list) and len(r) == 2 and all(isinstance(x, str) and CLOCK.match(x) for x in r)): return False
            rs.append([_clock(r[0]), _clock(r[1])])
        days[k] = rs
    return {'days': days, 'known': bool(h.get('known'))}


def _text(v): return v.strip() if isinstance(v, str) and v.strip() else None


def clean(s, src, credit):
    """a spot from a trip's own refill-*.json, checked and trimmed to the spot shape: (spot, None) or (None, why). Its id
    is prefixed with its source, so two sources can't clash; fields of the source's own (a category, its nearest place)
    are left out, since the page works those out."""
    if not isinstance(s, dict): return None, 'not an object'
    sid = s.get('id')
    if not isinstance(sid, (str, int)) or isinstance(sid, bool) or str(sid) == '': return None, 'no id'
    lat, lng = s.get('lat'), s.get('lng')
    if not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in (lat, lng)) or not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, f'{sid}: lat and lng must be numbers'
    kind = s.get('kind') or 'tap'
    if kind not in KINDS: return None, f'{sid}: kind "{kind}" must be one of {", ".join(KINDS)}'
    src = _text(s.get('src')) or src
    hours = _hours(s.get('hours'))
    water = [w.strip() for w in s.get('water') or [] if isinstance(w, str) and w.strip()]
    added = s.get('added') if isinstance(s.get('added'), str) and re.fullmatch(r'\d{4}(-\d{2}-\d{2})?', s.get('added')) else None
    site = _text(s.get('site'))
    flag = lambda k: s.get(k) if isinstance(s.get(k), bool) else None
    sid = str(sid)
    return {
        'id': sid if sid.startswith(f'{src}-') else f'{src}-{sid}', 'src': src, 'name': _text(s.get('name')),
        'lat': round(float(lat), 6), 'lng': round(float(lng), 6), 'address': _text(s.get('address')),
        'kind': kind, 'indoor': True if kind != 'tap' else flag('indoor'), 'seasonal': flag('seasonal'),
        'hours': hours or None, 'hours_note': _text(s.get('hours_note')),  # hours it can't read are left out, never guessed
        'water': water, 'how': _text(s.get('how')), 'site': site if site and re.match(r'https?://', site) else None,
        'added': added, 'credit': _text(s.get('credit')) or credit,
    }, None


def read_local(name, data):
    """a trip's refill-<src>.json (an object with `spots`, or a bare list) as (spots, problems). The source is the file
    name's part after refill-, unless a spot names its own `src`; the credit is the spot's, else the file's, else the source."""
    src = re.sub(r'^refill-|\.json$', '', name) or 'local'
    spots = data.get('spots') if isinstance(data, dict) else data
    credit = (_text(data.get('credit')) if isinstance(data, dict) else None) or src
    if not isinstance(spots, list): return [], [f'{name}: no "spots" list']
    out, bad = [], []
    for s in spots:
        c, why = clean(s, src, credit)
        if c: out.append(c)
        else: bad.append(f'{name}: {why}')
    return out, bad


def _rank(s):
    """which of two listings of one spot to keep: known hours, then whether it's indoors is known, then a trip's own source
    over OpenStreetMap (it's usually the richer one), then the id, so the pick is stable"""
    return (0 if s['hours'] and s['hours'].get('known') else 1, 0 if s['indoor'] is not None else 1, 1 if s['src'] == 'osm' else 0, s['id'])


def _same(a, b):
    if dist((a['lat'], a['lng']), (b['lat'], b['lng'])) > SAME_M: return False
    if (a['kind'] == 'shop') != (b['kind'] == 'shop'): return False
    if a['kind'] == 'shop' and a['name'] and b['name']: return a['name'].casefold() == b['name'].casefold()
    return True


def merge(spots):
    """every source's spots as one list: listings of the same spot (within 25 m, the same kind; two shops also by name) are
    one, keeping the better listing and filling its gaps (indoor, seasonal, name, address) from the other. A gap filled from
    OpenStreetMap adds its credit. Sorted by id, so a rerun writes the same file. Returns (spots, how many were merged)."""
    kept, merged = [], 0
    for s in sorted(spots, key=_rank):
        twin = next((k for k in kept if _same(k, s)), None)
        if not twin:
            kept.append(dict(s))
            continue
        merged += 1
        took = False
        for f in ('indoor', 'seasonal', 'name', 'address'):
            if twin[f] is None and s[f] is not None: twin[f] = s[f]; took = took or s['src'] == 'osm'
        if took and 'openstreetmap' not in (twin['credit'] or '').lower(): twin['credit'] = f"{twin['credit']} · {OSM_CREDIT}"
    return sorted(kept, key=lambda s: s['id']), merged


def keep_near(spots, places, radius_m):
    """the spots within radius_m of any of the trip's places (lat, lng): the rest would only weigh down the page"""
    return [s for s in spots if any(dist((s['lat'], s['lng']), p) <= radius_m for p in places)]
