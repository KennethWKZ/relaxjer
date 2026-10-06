"""Fetch everything the trip page needs from Google (the user's own key, from this machine only): place details,
ratings, hours, status, every branch of the trip's chains (pipeline.json "chains"), nearest metro + walking time, and
each day's route-leg times. Writes <trip>/.cache/google-out.json for apply.py. Run via pipeline/resync.py."""
import datetime, json, os, re, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.trip import S, PLACES, DAYS, cfg, leg_time
from lib.google import CACHE, OUT, details, text, nearby, route, dist, save
e = json.load(open(S + 'extra.json')); wa = json.load(open(S + 'wish-a.json')); wb = json.load(open(S + 'wish-b.json')); geo = json.load(open(S + 'geo.json'))
out = {'food': {}, 'branch': {}, 'place': {}, 'chains': {}, 'mrt': {}, 'legs': {}}
# 1) details for every food place and wishlist branch (branches without an ID: text search near our pin)
jobs = []
for f in e['food']:
    if f.get('gpid'): jobs.append(('food', f['name_trad'], f['gpid'], None))
for d in (wa, wb):
    for w in d['items']:
        for b in w['branches']:
            key = w['id'] + '|' + b['label_zh']
            if b.get('gpid'): jobs.append(('branch', key, b['gpid'], None))
            elif b.get('lat'): jobs.append(('branch', key, None, (float(b['lat']), float(b['lng']), (b.get('maps_query') or f"{w['name_trad']} {b.get('address_trad','')}"))))
# 2) itinerary places: text search by name + address near our pin
PL = {k: {'zh': p['name'][0], 'maps': p['maps'], 'trad': p.get('trad')} for k, p in PLACES.items()}
for k, g in geo['places'].items():
    p = PL.get(k)
    # the pin step (pins.py) is the authority on a place's Google id: use it; search by name only when there is none
    if p and g.get('gpid'): jobs.append(('place', k, g['gpid'], None))
    elif p: jobs.append(('place', k, None, (g['lat'], g['lng'], p['maps'] if re.search(r'[路街號]', p['maps']) and not p['trad'] else (p['trad'] or p['zh']))))
def run(job):
    kind, key, pid, near = job
    if not pid:
        r = text(near[2], bias=(near[0], near[1]), n=5)
        best = None
        for c in r.get('places', []):
            dd = dist((near[0], near[1]), (c['location']['latitude'], c['location']['longitude']))
            if best is None or dd < best[0]: best = (dd, c)
        lim = 500 if kind == 'place' else 250
        if not best or best[0] > lim: return kind, key, {'_nomatch': best and round(best[0])}
        pid = best[1]['id']
    return kind, key, {'zh': details(pid), 'en': details(pid, 'en')}
with ThreadPoolExecutor(8) as ex:
    for kind, key, r in ex.map(run, jobs): out[kind][key] = r
# 3) every branch of the trip's chains (pipeline.json "chains"), inside its search area ("area": [s, w, n, e])
RECT = tuple(cfg('area', [0, 0, 0, 0]))
for chain, qs, must in [(c['id'], c['queries'], c['must']) for c in cfg('chains', [])]:
    found = {}
    for q in qs:
        tok = None
        for _ in range(3):
            r = text(q, rect=RECT, page=tok)
            for c in r.get('places', []):
                if any(m in c['displayName']['text'] for m in must): found[c['id']] = c
            tok = r.get('nextPageToken')
            if not tok: break
    out['chains'][chain] = {pid: {'zh': c, 'en': details(pid, 'en')} for pid, c in found.items()}
# 4) nearest MRT (else train station) + walking time, for every point with coordinates
pts = {}
for f in e['food']:
    if f.get('lat'): pts['food|' + f['name_trad']] = (float(f['lat']), float(f['lng']))
for d in (wa, wb):
    for w in d['items']:
        for b in w['branches']:
            if b.get('lat'): pts['branch|' + w['id'] + '|' + b['label_zh']] = (float(b['lat']), float(b['lng']))
for k, g in geo['places'].items(): pts['place|' + k] = (g['lat'], g['lng'])
for chain, bs in out['chains'].items():
    for pid, c in bs.items(): pts['chain|' + chain + '|' + pid] = (c['zh']['location']['latitude'], c['zh']['location']['longitude'])
def mrt(item):
    k, (lat, lng) = item
    r = nearby(lat, lng, ['subway_station'], 1500.0); kind = 'mrt'
    if not r.get('places'): r = nearby(lat, lng, ['light_rail_station'], 1500.0); kind = 'mrt'  # a light rail stop at the door beats a metro 4 km away
    if not r.get('places'): r = nearby(lat, lng, ['train_station'], 3000.0); kind = 'train'
    if not r.get('places'): return k, None
    st = r['places'][0]; sl = (st['location']['latitude'], st['location']['longitude'])
    w = route((lat, lng), sl, 'WALK', None); rr = (w.get('routes') or [{}])[0]
    return k, {'kind': kind, 'id': st['id'], 'name': st['displayName']['text'], 'lat': sl[0], 'lng': sl[1], 'm': rr.get('distanceMeters'), 's': int(rr.get('duration', '0s')[:-1] or 0), 'crow': round(dist((lat, lng), sl))}
with ThreadPoolExecutor(8) as ex:
    for k, r in ex.map(mrt, pts.items()): out['mrt'][k] = r
stations = {v['id'] for v in out['mrt'].values() if v}
with ThreadPoolExecutor(8) as ex: en = dict(zip(stations, ex.map(lambda i: (details(i, 'en').get('displayName') or {}).get('text'), stations)))
out['station_en'] = en
# 5) each day's route legs, at the leg's own time (a 4th 'HH:MM') or a plausible one; a drive still ahead gets Google's typical and heavy-traffic times
LEGS = {d['id']: [tuple(l) for l in d['route']] for d in DAYS if d.get('route')}  # each day's route (memory-bank/standards/trip-format.md)
DATES = {d['id']: d['date'] for d in DAYS}
MODE = {'transit': 'TRANSIT', 'walking': 'WALK', 'driving': 'DRIVE', 'bicycling': 'BICYCLE'}
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def leg(item):
    (day, i), (a, b, m, *at) = item
    when = leg_time(DATES[day], i, len(LEGS[day]), at[0] if at else None)  # in the trip's time zone
    ga, gb = geo['places'][a], geo['places'][b]
    if m == 'driving' and when > NOW:  # Google predicts traffic only for a departure still ahead
        r = route((ga['lat'], ga['lng']), (gb['lat'], gb['lng']), 'DRIVE', when, 'BEST_GUESS')
        r['_bad'] = ((route((ga['lat'], ga['lng']), (gb['lat'], gb['lng']), 'DRIVE', when, 'PESSIMISTIC').get('routes') or [{}])[0]).get('duration')
    else: r = route((ga['lat'], ga['lng']), (gb['lat'], gb['lng']), MODE[m], when)
    if m == 'bicycling' and not r.get('routes'): r = route((ga['lat'], ga['lng']), (gb['lat'], gb['lng']), 'WALK', None); r['_asWalk'] = True
    return (day, i), r
items = [((d, i), l) for d, ls in LEGS.items() for i, l in enumerate(ls)]
with ThreadPoolExecutor(6) as ex:
    for k, r in ex.map(leg, items): out['legs'][f'{k[0]}:{k[1]}'] = r
out['_legs_def'] = LEGS
save(); os.umask(0o077); json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
errs = [k for k, v in CACHE.items() if isinstance(v, dict) and v.get('_err')]
print('food', len(out['food']), '| branch', len(out['branch']), 'nomatch', sum(1 for v in out['branch'].values() if '_nomatch' in v), '| place', len(out['place']), 'nomatch', sum(1 for v in out['place'].values() if '_nomatch' in v))
print('chains', {k: len(v) for k, v in out['chains'].items()}, '| mrt points', len(out['mrt']), 'none', sum(1 for v in out['mrt'].values() if not v), '| stations', len(stations), '| legs', len(out['legs']))
print('API errors:', len(errs), [CACHE[k].get('_msg', '')[:80] for k in errs[:3]])
