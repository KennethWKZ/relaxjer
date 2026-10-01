"""Planned places: Google first. Every place in geo.json gets its Google place id and Google's position; the old pin
(OpenStreetMap / Nominatim / address) is kept as `alt` and only used when Google has nothing. The id comes from
PLACES[k].gpid when set (hand-checked), else geo.json, else a Google text search: pipeline.json "pin_queries", or for a
place with no id yet (one just added) its Google Maps name, PLACES[k].maps. An id whose place type makes no sense (a car
park for an airport terminal) is searched again when the place has a pin query. --write to save."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.trip import S, PLACES, cfg
from lib import google as F
G = json.load(open(S + 'geo.json'))
curated = {k: p['gpid'] for k, p in PLACES.items() if p.get('gpid')}
# what to search when a place has no usable id (its name as Google Maps shows it)
QUERY = cfg('pin_queries', {})
BAD = {'parking_lot', 'parking', 'premise', 'inn'}  # a terminal is not a car park; the hotel is not the inn next door
log = []
for k, g in G['places'].items():
    pid = curated.get(k) or g.get('gpid'); d = F.details(pid) if pid else {}
    # a place just added has no id: search its Google Maps name, before the other steps search around its pin
    q = QUERY.get(k) or (None if pid else (PLACES.get(k) or {}).get('maps'))
    if q and (not pid or (d.get('primaryType') or '') in BAD or d.get('_err')):
        r = F.text(q, bias=(g['lat'], g['lng']), n=5).get('places', [])
        r = [p for p in r if (p.get('primaryType') or '') not in BAD] or r
        if r: pid = r[0]['id']; d = F.details(pid)
    loc = d.get('location')
    if not loc: log.append(f'{k}: no Google place, keeping {g.get("src")} pin'); continue
    old = (g['lat'], g['lng']); new = (round(loc['latitude'], 6), round(loc['longitude'], 6))
    moved = round(F.dist(old, new))
    if g.get('src') != 'google': g['alt'] = {'lat': g['lat'], 'lng': g['lng'], 'src': g.get('src')}
    if pid != g.get('gpid'): log.append(f'{k}: place id {str(g.get("gpid"))[-8:]} → {pid[-8:]} ({(d.get("displayName") or {}).get("text")})')
    g['gpid'] = pid; g['lat'], g['lng'] = new; g['src'] = 'google'
    if moved > 60: log.append(f'{k}: pin moved {moved} m to Google ({(d.get("displayName") or {}).get("text")})')
F.save()
print('\n'.join(log) or 'no changes')
print(f"places on Google: {sum(1 for g in G['places'].values() if g.get('src') == 'google')}/{len(G['places'])}")
if '--write' in sys.argv: json.dump(G, open(S + 'geo.json', 'w'), ensure_ascii=False, indent=1); print('wrote geo.json')
