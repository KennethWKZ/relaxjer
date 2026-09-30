"""Toilets for every place on the page, from Google (the user's own key, from this machine). Run via pipeline/resync.py.
  1. public toilets (Google type public_bathroom) within 500 m of every planned place and the hotel,
     and within 300 m of every food / wishlist place, so "toilet near me" works wherever we are;
  2. whether each place itself has a restroom (+ wheelchair-accessible one): planned places, food,
     wishlist branches, drink stands and rest spots;
  3. where a planned place has no public toilet within 300 m: cafés, restaurants, malls and convenience
     stores nearby that Google says have a restroom (ask to borrow; buying something first helps).
Writes toilets.json with --write; otherwise prints a summary."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('RESYNC_REUSE', '1')
import opencc; T2S = opencc.OpenCC('t2s').convert
from lib.trip import S, TODAY, cfg
from lib import google as F
geo = json.load(open(S + 'geo.json'))['places']
extra = json.load(open(S + 'extra.json')); wish = json.load(open(S + 'wish-a.json'))['items'] + json.load(open(S + 'wish-b.json'))['items']
drinks = json.load(open(S + 'drinks.json')) if os.path.exists(S + 'drinks.json') else []
SKIP = set(cfg('skip_nearby', {}).get('toilets', []))  # airports and stations have their own
plan = {k: (g['lat'], g['lng']) for k, g in geo.items() if g.get('lat') and k not in SKIP}
PT = 'places.id,places.displayName,places.location,places.primaryType,places.businessStatus,places.regularOpeningHours.weekdayDescriptions'
def near(lat, lng, types, radius, n, extra_mask=''):
    b = {'includedTypes': types, 'maxResultCount': n, 'rankPreference': 'DISTANCE', 'languageCode': 'zh-TW',
         'locationRestriction': {'circle': {'center': {'latitude': round(lat, 5), 'longitude': round(lng, 5)}, 'radius': float(radius)}}}
    return F.call('wc', 'https://places.googleapis.com/v1/places:searchNearby', b, PT + extra_mask).get('places', [])
def has_rr(pid):  # [restroom, wheelchair restroom]: 1 / 0 / None (Google doesn't know)
    r = F.call('rr', f'https://places.googleapis.com/v1/places/{pid}', None, 'id,restroom,accessibilityOptions.wheelchairAccessibleRestroom', 'GET')
    if r.get('_err'): return [None, None]
    b = lambda v: None if v is None else int(bool(v))
    return [b(r.get('restroom')), b((r.get('accessibilityOptions') or {}).get('wheelchairAccessibleRestroom'))]
def short(n): return re.split(r'\s*[|｜]\s*', n)[0].strip()[:30]

# 1) public toilets, one entry per physical toilet (Google often has the same one in 3 languages)
wc = []
WC_CUE = re.compile(r'公廁|公厕|廁所|厕所|洗手間|洗手间|盥洗|化妝室|化妆室|toilet|restroom|bathroom|トイレ|화장실', re.I)
PRIVATE = re.compile(r'公司|股份|企劃|企划|補習|补习|健身|gym|辦公|办公|宿舍|社區|社区|住戶|住户|員工|员工|\d+樓[男女]', re.I)
def add_wc(p):  # Google's public_bathroom type also tags offices, gyms, a cram school's 9th floor: keep only real public toilets
    loc = p.get('location') or {}
    if not loc or p.get('businessStatus', 'OPERATIONAL') != 'OPERATIONAL': return None
    if not WC_CUE.search(p['displayName']['text']) or PRIVATE.search(p['displayName']['text']): return None
    ll = (loc['latitude'], loc['longitude']); n = p['displayName']['text']
    for i, w in enumerate(wc):
        if F.dist(ll, (w['lat'], w['lng'])) < 30:
            if re.search(r'[一-鿿]', n) and not re.search(r'[一-鿿]', w['n_trad']) or w['n_trad'] in ('廁所', '盥洗室', '公共廁所') and len(n) > len(w['n_trad']): w['n_trad'] = n  # prefer a Chinese, specific name
            return i
    wc.append({'n_trad': n, 'lat': round(ll[0], 6), 'lng': round(ll[1], 6), 'gpid': p['id']}); return len(wc) - 1
near_wc = {}
for k, (lat, lng) in plan.items():
    ids = []
    for p in near(lat, lng, ['public_bathroom'], 500, 10):
        i = add_wc(p)
        if i is not None and i not in [x[0] for x in ids]: ids.append([i, round(F.dist((lat, lng), (wc[i]['lat'], wc[i]['lng'])))])
    near_wc[k] = sorted(ids, key=lambda x: x[1])[:4]
spots = [(f.get('lat'), f.get('lng')) for f in extra.get('food', [])] + [(b.get('lat'), b.get('lng')) for w in wish for b in w.get('branches', [])]
for lat, lng in spots:
    if lat and lng:
        for p in near(float(lat), float(lng), ['public_bathroom'], 300, 5): add_wc(p)

# 2) does the place itself have a restroom
gp = {}
pids = [g.get('gpid') for g in geo.values()] + [f.get('gpid') for f in extra.get('food', [])] + [b.get('gpid') for w in wish for b in w.get('branches', [])] + [d.get('gpid') for d in drinks]
for pid in dict.fromkeys(p for p in pids if p): gp[pid] = has_rr(pid)

# 3) borrowable restrooms where public toilets are thin
BORROW = ['cafe', 'coffee_shop', 'restaurant', 'fast_food_restaurant', 'shopping_mall', 'department_store', 'convenience_store', 'book_store', 'tea_house']
borrow = {}
for k, (lat, lng) in plan.items():
    if sum(1 for _, d in near_wc[k] if d <= 300) >= 2: continue
    out = []
    for p in near(lat, lng, BORROW, 400, 20, ',places.restroom'):
        if not p.get('restroom') or p.get('businessStatus') != 'OPERATIONAL': continue
        loc = p['location']; d = round(F.dist((lat, lng), (loc['latitude'], loc['longitude'])))
        out.append({'n_trad': short(p['displayName']['text']), 'n_zh': T2S(short(p['displayName']['text'])), 'type': p.get('primaryType'), 'lat': round(loc['latitude'], 6), 'lng': round(loc['longitude'], 6), 'd': d, 'gpid': p['id']})
    borrow[k] = sorted(out, key=lambda x: x['d'])[:4]

GENERIC = re.compile(r'((fe)?male |wheelchair accessible |public )?(bathroom|toilet|restroom)s?|公[衆众共]トイレ|공[공용]화장실|廁所|厕所|盥洗室|公共廁所|公共厕所|公共廁所\(男女皆有\)|公共厕所\(男女皆有\)', re.I)
def names(n):  # generic or foreign-language names → "公厕（女）" / "Public toilet (women)"
    if not GENERIC.fullmatch(n.strip()): return T2S(n), n
    low = n.lower(); t = ('（女）', ' (women)') if 'female' in low else ('（男）', ' (men)') if re.search(r'\bmale\b', low) else ('（无障碍）', ' (accessible)') if 'wheelchair' in low else ('', '')
    return '公厕' + t[0], 'Public toilet' + t[1]
for w in wc: w['n_zh'], w['n_en'] = names(w['n_trad'])
out = {'checked': TODAY, 'wc': wc, 'near': near_wc, 'gp': gp, 'borrow': borrow}
F.save()
known = sum(1 for v in gp.values() if v[0] is not None)
print(f'public toilets: {len(wc)} · places checked for own restroom: {len(gp)} (Google knows {known}: yes {sum(1 for v in gp.values() if v[0] == 1)}, no {sum(1 for v in gp.values() if v[0] == 0)})')
print('plan places with no public toilet ≤300 m:', sorted(k for k, v in near_wc.items() if not any(d <= 300 for _, d in v)))
print('borrow lists:', {k: len(v) for k, v in borrow.items()})
if '--write' in sys.argv: json.dump(out, open(S + 'toilets.json', 'w'), ensure_ascii=False, indent=1); print('wrote toilets.json')
