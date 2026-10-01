"""Transport pins near our places, for the map's YouBike and 公车 categories. Run via pipeline/resync.py.
  YouBike: the operator's own station list (apis.youbike.com.tw, all cities incl. New Taipei/Tamsui; Google has no
           dock data). The page fetches live bikes/docks for a station when it is tapped (same API, CORS open).
  Bus:     Google bus stops (the user's own key, from this machine) near every planned place, food and wishlist place.
Writes transit.json with --write; otherwise prints a summary."""
import json, os, re, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../pipeline'))
import opencc; T2S = opencc.OpenCC('t2s').convert
from lib.trip import S, TODAY, cfg
from lib import google as F
geo = json.load(open(S + 'geo.json'))['places']
extra = json.load(open(S + 'extra.json')); wish = json.load(open(S + 'wish-a.json'))['items'] + json.load(open(S + 'wish-b.json'))['items']
plan = [(g['lat'], g['lng']) for k, g in geo.items() if g.get('lat') and k not in set(cfg('skip_nearby', {}).get('transit', []))]
spots = [(float(f['lat']), float(f['lng'])) for f in extra.get('food', []) if f.get('lat')] + [(float(b['lat']), float(b['lng'])) for w in wish for b in w.get('branches', []) if b.get('lat')]
near = lambda ll, pts, r: any(F.dist(ll, p) <= r for p in pts)

# YouBike (operator data)
req = urllib.request.Request('https://apis.youbike.com.tw/json/station-yb2.json', headers={'User-Agent': 'Mozilla/5.0 (trip page build)'})
yb_all = json.loads(urllib.request.urlopen(req, timeout=60).read())
yb = []
for x in yb_all:
    if str(x.get('status')) != '1': continue
    ll = (float(x['lat']), float(x['lng']))
    if not (near(ll, plan, 700) or near(ll, spots, 300)): continue
    n = re.sub(r'^YouBike2\.0_', '', x.get('name_tw', '')).strip()
    yb.append({'no': x['station_no'], 'n_zh': T2S(n), 'n_trad': n, 'n_en': re.sub(r'^YouBike2\.0_', '', x.get('name_en', '')).strip(), 'lat': round(ll[0], 6), 'lng': round(ll[1], 6), 'cap': x.get('parking_spaces')})

# bus stops (Google)
M = 'places.id,places.displayName,places.location,places.primaryType,places.businessStatus'
def stops(ll, r, n):
    b = {'includedTypes': ['bus_stop', 'bus_station'], 'maxResultCount': n, 'rankPreference': 'DISTANCE', 'languageCode': 'zh-TW',
         'locationRestriction': {'circle': {'center': {'latitude': round(ll[0], 5), 'longitude': round(ll[1], 5)}, 'radius': float(r)}}}
    return F.call('bus', 'https://places.googleapis.com/v1/places:searchNearby', b, M).get('places', [])
bus = []; seen = set()
for ll, r, n in [(p, 400, 8) for p in plan] + [(p, 250, 4) for p in spots]:
    for p in stops(ll, r, n):
        if p['id'] in seen or p.get('businessStatus', 'OPERATIONAL') != 'OPERATIONAL': continue
        seen.add(p['id']); loc = p['location']; nm = p['displayName']['text']; pt = (loc['latitude'], loc['longitude'])
        if any(b['n_trad'] == nm and F.dist(pt, (b['lat'], b['lng'])) < 80 for b in bus): continue  # same stop, other side of the road
        bus.append({'n_zh': T2S(nm), 'n_trad': nm, 'lat': round(pt[0], 6), 'lng': round(pt[1], 6), 'gpid': p['id']})
F.save()
print(f'YouBike stations near our places: {len(yb)} (of {len(yb_all)} nationwide) · bus stops: {len(bus)}')
if '--write' in sys.argv: json.dump({'checked': TODAY, 'yb': yb, 'bus': bus}, open(S + 'transit.json', 'w'), ensure_ascii=False, separators=(',', ':')); print('wrote transit.json')
