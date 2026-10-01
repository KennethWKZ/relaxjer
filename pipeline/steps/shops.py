"""Shopping places for the free-time day, from Google (the user's own key, from this machine): position, place id,
rating, opening hours on the day, distance from that night's hotel. The searches are the trip's own list,
pipeline.json "shops": [[search, kind, why zh, why en, tax refund 'yes' | 'no' | 'some'], …].
Writes shops.json with --write. Run via pipeline/resync.py."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import opencc; T2S = opencc.OpenCC('t2s').convert
from lib.trip import S, HOTEL_OF, ROLES, cfg
from lib import google as F
from lib.hours import parse_hours, clean_addr
geo = json.load(open(S + 'geo.json'))['places']; H = HOTEL_OF[ROLES['free']]; hotel = (geo[H]['lat'], geo[H]['lng'])
SHOPS = [tuple(x) for x in cfg('shops', [])]
out = []
for q, kind, zh, en, trs in SHOPS:
    r = F.text(q, bias=hotel, n=3).get('places', [])
    if not r: print('not found:', q); continue
    p = r[0]; d = F.details(p['id']); e = F.details(p['id'], 'en')
    days = parse_hours((d.get('regularOpeningHours') or {}).get('weekdayDescriptions'))
    loc = d['location']; ll = (loc['latitude'], loc['longitude'])
    out.append({'id': 'shop-' + p['id'][-10:], 'gpid': p['id'], 'kind': kind, 'name_trad': d['displayName']['text'], 'name_zh': T2S(d['displayName']['text']), 'name_en': (e.get('displayName') or {}).get('text', ''),
                'lat': round(ll[0], 6), 'lng': round(ll[1], 6), 'addr': clean_addr(d.get('formattedAddress')), 'rating': d.get('rating'), 'reviews': d.get('userRatingCount'),
                'week': days, 'why_zh': zh, 'why_en': en, 'trs': trs, 'from_hotel': round(F.dist(hotel, ll))})
F.save()
for x in out: print(x['name_zh'], x['kind'], x['from_hotel'], 'm', (x['week'] or [''] * 7)[3])
if '--write' in sys.argv: json.dump(out, open(S + 'shops.json', 'w'), ensure_ascii=False, indent=1); print('wrote shops.json')
