"""Apply <trip>/.cache/google-out.json to the trip's files: hours, trip-day closures, ratings, addresses, pins,
status, the chains' branch lists (pipeline.json "chains"), nearest metro, route-leg times. Dry run unless --write.
Run via pipeline/resync.py."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['RESYNC_FRESH'] = '0'  # apply reads what fetch just fetched, even in a --fresh run
import opencc; T2S = opencc.OpenCC('t2s').convert
from lib.trip import S, PLACES, HOTEL_OF, ROLES, TODAY, cfg
from lib import google as F
from lib.hours import parse_hours, fmt_hours, closed_on_trip, clean_addr, merge_addr
o = json.load(open(F.OUT))
e = json.load(open(S + 'extra.json')); wa = json.load(open(S + 'wish-a.json')); wb = json.load(open(S + 'wish-b.json')); geo = json.load(open(S + 'geo.json'))
def st_name(n, kind): n = T2S(n); return n if n.endswith('站') else n + '站'
def mrt_obj(key, lat, lng):
    m = o['mrt'].get(key)
    if not m:  # nothing walkable: name the nearest MRT anyway, marked as not walkable
        r = F.nearby(lat, lng, ['subway_station'], 5000.0)
        if not r.get('places'): return None
        st = r['places'][0]; sl = (st['location']['latitude'], st['location']['longitude'])
        return {'zh': st_name(st['displayName']['text'], 'mrt'), 'en': (F.details(st['id'], 'en').get('displayName') or {}).get('text', ''), 'km': round(F.dist((lat, lng), sl) / 1000, 1), 'walk': False, 'lat': round(sl[0], 6), 'lng': round(sl[1], 6)}
    mm = m['m'] if m['m'] is not None else m['crow']
    return {'zh': st_name(m['name'], m['kind']), 'en': o['station_en'].get(m['id'], ''), 'min': max(1, round(m['s'] / 60)), 'm': mm, 'walk': mm <= 1500, 'train': m['kind'] == 'train', 'lat': round(m['lat'], 6), 'lng': round(m['lng'], 6)}
log = []
def bi(w): return min(max(int(w.get('best') or 0), 0), len(w['branches']) - 1)
def apply_place(t, g, key, is_food):
    z = g['zh']; ch = []
    days = parse_hours((z.get('regularOpeningHours') or {}).get('weekdayDescriptions'))
    if days and not t.get('hours_lock'):  # hours_lock: pop-ups etc. keep their own hours, not the building's
        hz, he = fmt_hours(days)
        if t.get('hours_zh') != hz: ch.append('hours')
        t['hours_zh'], t['hours_en'] = hz, he; t['closed_dates'] = closed_on_trip(days); t.pop('hours_check', None)
    loc = z.get('location')
    if loc: t['lat'], t['lng'] = round(loc['latitude'], 6), round(loc['longitude'], 6); t['geo_precision'] = 'place'
    na = merge_addr(t.get('address_trad'), z.get('formattedAddress'))
    if na != t.get('address_trad'): ch.append('addr'); t['address_trad'] = na
    if is_food and z.get('rating'):
        t['rating'], t['reviews'], t['rating_source'], t['rating_checked'] = z['rating'], z.get('userRatingCount'), 'Google Maps', TODAY
    st = z.get('businessStatus')
    if st == 'CLOSED_TEMPORARILY': t['paused'] = True; ch.append('PAUSED')
    elif st == 'CLOSED_PERMANENTLY': ch.append('CLOSED')
    else: t.pop('paused', None)
    t['gpid'] = z['id']
    mo = mrt_obj(key, t['lat'], t['lng']) if t.get('lat') else None
    if mo: t['mrt'] = mo
    return ch, st
# food
FOOD = {f['name_trad']: f for f in e['food']}; dead = []
for nm, g in o['food'].items():
    if 'zh' not in g: continue
    ch, st = apply_place(FOOD[nm], g, 'food|' + nm, True)
    if st == 'CLOSED_PERMANENTLY': dead.append(nm)
    if ch: log.append(f'food {nm}: {",".join(ch)}')
for f in e['food']:
    if f['name_trad'] not in o['food'] and f.get('lat'):
        mo = mrt_obj('food|' + f['name_trad'], float(f['lat']), float(f['lng']))
        if mo: f['mrt'] = mo
e['food'] = [f for f in e['food'] if f['name_trad'] not in dead]
# wishlist branches
W = {w['id']: w for d in (wa, wb) for w in d['items']}
for key, g in o['branch'].items():
    wid, lab = key.split('|', 1); w = W[wid]
    b = next((x for x in w['branches'] if x['label_zh'] == lab), None)
    if not b or 'zh' not in g: continue
    ch, st = apply_place(b, g, 'branch|' + key, False)
    if st == 'CLOSED_PERMANENTLY': b['_dead'] = True
    if ch: log.append(f'branch {wid}/{lab[:8]}: {",".join(ch)}')
# rebuild the trip's chains from Google's full branch list, nearest to the first night's hotel first
H0 = HOTEL_OF[ROLES['arrive']]; HOTEL = (geo['places'][H0]['lat'], geo['places'][H0]['lng'])
for chain, prefix, prefix_en, label0 in [(c['id'], c['prefix'], c['prefix_en'], c.get('default_label', '')) for c in cfg('chains', [])]:
    w = W[chain]; best = w['branches'][bi(w)]
    have = {b.get('gpid') for b in w['branches'] if b.get('gpid')}
    new = []
    for pid, c in o['chains'][chain].items():
        z = c['zh']
        if z.get('businessStatus') != 'OPERATIONAL': continue
        if pid == best.get('gpid'): continue
        lab = re.sub(prefix, '', z['displayName']['text']).strip() or label0
        lab_en = re.sub(prefix_en, '', (c['en'].get('displayName') or {}).get('text', '')).strip()
        b = {'label_zh': T2S(lab), 'label_en': lab_en if lab_en and not re.search(r'[一-鿿]', lab_en) else T2S(lab), 'address_trad': clean_addr(z.get('formattedAddress')), 'address_en': (c['en'].get('formattedAddress') or '').replace(', Taiwan', ''),
             'maps_query': z['displayName']['text'] + ' ' + clean_addr(z.get('formattedAddress')), 'gpid': pid}
        apply_place(b, {'zh': F.details(pid)}, 'chain|' + chain + '|' + pid, False)
        b['_km'] = F.dist(HOTEL, (b['lat'], b['lng'])) / 1000
        new.append(b)
    new.sort(key=lambda b: b['_km'])
    for b in new: b.pop('_km')
    old = [b['label_zh'] for b in w['branches']]
    w['branches'] = [best] + new; w['best'] = 0
    log.append(f'chain {chain}: {len(old)} -> {len(w["branches"])} branches ({", ".join(b["label_zh"] for b in w["branches"])})')
for w in W.values():
    if not w.get('branches'): continue
    live = [b for b in w['branches'] if not b.pop('_dead', False)]
    if len(live) != len(w['branches']): log.append(f'removed closed branch in {w["id"]}'); best = w['branches'][bi(w)]; w['branches'] = live or w['branches']; w['best'] = live.index(best) if best in live else 0
    bb = w['branches'][bi(w)]
    g = next((v for k, v in o['branch'].items() if k.startswith(w['id'] + '|') and v.get('zh', {}).get('id') == bb.get('gpid')), None)
    if g and g['zh'].get('rating'): w['rating'], w['reviews'], w['rating_source'], w['rating_checked'] = g['zh']['rating'], g['zh'].get('userRatingCount'), 'Google Maps', TODAY
# itinerary places: Google ID, hours, nearest MRT (pins stay: ours mark entrances)
PLZH = {k: p['name'][0] for k, p in PLACES.items()}
NO_HOURS = set(cfg('no_hours', []))  # districts and streets: a building's hours say nothing about them
STATIONS = set(cfg('stations', []))  # places that are themselves a station or terminal
for k, g in o['place'].items():
    p = geo['places'][k]
    if 'zh' in g:
        p['gpid'] = g['zh']['id']
        days = parse_hours((g['zh'].get('regularOpeningHours') or {}).get('weekdayDescriptions'))
        if days and k not in NO_HOURS: p['hours_zh'], p['hours_en'] = fmt_hours(days); p['closed_dates'] = closed_on_trip(days)
    if k in STATIONS or re.search(r'站|航[厦廈]', PLZH.get(k, '')): p.pop('mrt', None); continue  # the place is itself a station
    mo = mrt_obj('place|' + k, p['lat'], p['lng'])
    if mo: p['mrt'] = mo
# route legs
MODE_ZH = {'SUBWAY': '捷运', 'HEAVY_RAIL': '火车', 'BUS': '公车', 'COMMUTER_TRAIN': '火车', 'RAIL': '火车', 'LIGHT_RAIL': '轻轨', 'TRAM': '轻轨'}
legs = {}
for k, r in o['legs'].items():
    rt = (r.get('routes') or [None])[0]
    if not rt: continue
    steps = rt['legs'][0]['steps']; rides = [s['transitDetails'] for s in steps if s.get('transitDetails')]
    walk_s = sum(int(s.get('staticDuration', '0s')[:-1] or 0) for s in steps if s['travelMode'] == 'WALK')
    legs[k] = {'min': round(int(rt['duration'][:-1]) / 60), 'km': round(rt.get('distanceMeters', 0) / 1000, 1), 'walk': round(walk_s / 60),
               'rides': [{'line': T2S(x['transitLine'].get('name') or x['transitLine'].get('nameShort', '')), 'line_en': x['transitLine'].get('nameShort', ''), 'from': T2S(x['stopDetails']['departureStop']['name']), 'to': T2S(x['stopDetails']['arrivalStop']['name']), 'stops': x.get('stopCount'), 'kind': x['transitLine'].get('vehicle', {}).get('type', '')} for x in rides]}
    if r.get('_asWalk'): legs[k]['asWalk'] = True
    if r.get('_bad'): legs[k]['bad'] = round(int(r['_bad'][:-1]) / 60)  # the same drive in heavy traffic (Google's pessimistic prediction)
geo['legs'] = legs; geo['legs_checked'] = TODAY
if '--write' in sys.argv:
    F.save()  # lookups made while applying (far-away metro)
    json.dump(e, open(S + 'extra.json', 'w'), ensure_ascii=False, indent=1); json.dump(wa, open(S + 'wish-a.json', 'w'), ensure_ascii=False, indent=1); json.dump(wb, open(S + 'wish-b.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(geo, open(S + 'geo.json', 'w'), ensure_ascii=False, indent=1)
print(f'{len(log)} changed | removed closed food: {dead}')
for l in log: print(' ', l[:170])
print('legs:', {k: (v['min'], [x['line'] for x in v['rides']]) for k, v in list(legs.items())[:8]})
print('place mrt:', {k: (p.get('mrt') or {}).get('zh') for k, p in list(geo['places'].items())[:12]})
