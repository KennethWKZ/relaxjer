"""Taipei MRT / Danhai LRT / Airport MRT network for the page's offline "how to get there from here" hint.
The phone plans on this graph itself (walk to a station, ride, change, walk): no routing API and no key in the page.
Google first (the user's own key, from this machine): every station's position, name and place id (Places), and each line's name,
colour and end-to-end ride time (Routes, transit). Google has no "stops of a line" API, so the stop ORDER comes from
OpenStreetMap (Overpass, cached in <trip>/.cache/osm-mrt.json; --fresh re-downloads); a line is only trusted when Google's
end-to-end ride has the same number of stops. OSM is the fallback for anything Google does not return.
OSM has the Danhai LRT Blue Coast line with one stop only, so it is rebuilt here: trains run 紅樹林 → 濱海沙崙 on the
Green Mountain line track, then 臺北海洋大學 → 沙崙 → 淡水漁人碼頭 (CNA, 2020-11-14). Writes mrt.json with --write."""
import json, math, os, re, sys, urllib.parse, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../pipeline'))
from lib.trip import S, CACHE_DIR, DAYS, TODAY, utc_at
from lib import google as F
CACHE = CACHE_DIR + 'osm-mrt.json'
import opencc; T2S = opencc.OpenCC('t2s').convert
Q = '''[out:json][timeout:180];
( rel["route"="subway"](24.85,121.15,25.30,121.75); rel["route"="light_rail"](24.85,121.15,25.30,121.75); rel["route"="train"]["name"~"機場|Airport"](24.85,121.15,25.30,121.75); )->.r;
.r out body; node(r.r)->.n; .n out;
node["railway"~"station|stop"]["name"~"^(臺北海洋大學|台北海洋大學|沙崙|淡水漁人碼頭)$"](25.15,121.39,25.20,121.43); out;'''
if '--fresh' in sys.argv or not os.path.exists(CACHE):
    for url in ('https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):  # public mirrors time out now and then
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': Q}).encode(), headers={'User-Agent': 'taipei-trip-page/1.0 (personal trip plan)'})
            json.dump(json.loads(urllib.request.urlopen(req, timeout=240).read()), open(CACHE, 'w'), ensure_ascii=False); break
        except Exception as e: print('overpass', url.split('/')[2], 'failed:', str(e)[:80])
    else: sys.exit('all Overpass mirrors failed')
osm = json.load(open(CACHE))
nodes = {e['id']: e for e in osm['elements'] if e['type'] == 'node'}
rels = [e for e in osm['elements'] if e['type'] == 'relation']
norm = lambda n: re.sub(r'(?<!車)站$', '', n.replace('臺', '台').strip())  # 淡水站 → 淡水, but 台北車站 stays
# official line colours (Taipei Metro / Taoyuan Metro); OSM colour otherwise
LINE = {'R': ('淡水信义线', 'Tamsui–Xinyi', '#e3002c', 'mrt'), 'G': ('松山新店线', 'Songshan–Xindian', '#008659', 'mrt'), 'O': ('中和新芦线', 'Zhonghe–Xinlu', '#f8b61c', 'mrt'),
        'BL': ('板南线', 'Bannan', '#0070bd', 'mrt'), 'BR': ('文湖线', 'Wenhu', '#c48c31', 'mrt'), 'Y': ('环状线', 'Circular', '#ffdb00', 'mrt'),
        'A': ('机场捷运', 'Airport MRT', '#8246af', 'apt'), 'V': ('淡海轻轨', 'Danhai LRT', '#e8746a', 'lrt'), 'K': ('安坑轻轨', 'Ankeng LRT', '#c3b091', 'lrt'), 'LB': ('三莺线', 'Sanying', '#6db7d0', 'mrt')}
st = {}  # normalized name → station
def station(nid):
    n = nodes.get(nid); t = (n or {}).get('tags', {}); name = t.get('name')
    if not name: return None
    k = norm(name); s = st.setdefault(k, {'trad': k, 'en': '', 'pts': []})
    s['pts'].append((n['lat'], n['lon'])); s['en'] = s['en'] or re.sub(r'\s*Station$', '', t.get('name:en', ''))
    return k
lines = []
for e in rels:
    t = e['tags']; name = t.get('name', ''); ref = 'R' if '新北投' in name else t.get('ref') or ''
    seq = [station(m['ref']) for m in e['members'] if m['type'] == 'node' and m['role'].startswith('stop') and m['ref'] in nodes]
    seq = [x for i, x in enumerate(seq) if x and (i == 0 or x != seq[i - 1])]
    if len(seq) < 2 or ref not in LINE: continue
    zh, en, c, kind = LINE[ref]
    if '新北投' in name: zh, en, c, kind = '新北投支线', 'Xinbeitou branch', '#fd92a3', 'branch'
    if '小碧潭' in name: zh, en, c, kind = '小碧潭支线', 'Xiaobitan branch', '#cfdb00', 'branch'
    if ref == 'V': zh, en = '淡海轻轨 绿山线', 'Danhai LRT Green Mountain'
    if ref == 'A': (zh, en, kind) = ('机场捷运 直达车', 'Airport MRT express', 'apx') if '直達' in name or len(seq) <= 8 else ('机场捷运 普通车', 'Airport MRT commuter', 'apt')  # express skips stops
    key = (ref, zh, tuple(seq))
    if any(l['key'] == key for l in lines): continue
    lines.append({'key': key, 'ref': ref, 'zh': zh, 'en': en, 'c': c, 'k': kind, 'seq': seq})
# Blue Coast line, both directions
green = next(l for l in lines if l['ref'] == 'V' and l['seq'][0] == '紅樹林')
EN = {'台北海洋大學': 'Taipei University of Marine Technology', '沙崙': 'Shalun', '淡水漁人碼頭': "Tamsui Fisherman's Wharf"}
for nm in EN:  # not tagged in OSM yet: take the station's position from Google (company key, Mac only)
    if nm in st: continue
    r = F.text(f'淡海輕軌 {nm}站', bias=(25.18, 121.415), n=5).get('places', [])
    r = [p for p in r if nm in p['displayName']['text'] and (p.get('primaryType') or '') in ('light_rail_station', 'train_station', 'transit_station', 'subway_station', '')] or r[:1]
    if not r: sys.exit(f'missing LRT station: {nm}')
    loc = r[0]['location']; st[nm] = {'trad': nm, 'en': EN[nm], 'pts': [(loc['latitude'], loc['longitude'])]}
    F.save(); print('from Google:', nm, r[0]['displayName']['text'], r[0].get('primaryType'), loc)
blue = green['seq'][:green['seq'].index('濱海沙崙') + 1] + ['台北海洋大學', '沙崙', '淡水漁人碼頭']
for seq in (blue, blue[::-1]):
    lines.append({'key': ('V', 'blue', tuple(seq)), 'ref': 'V', 'zh': '淡海轻轨 蓝海线', 'en': 'Danhai LRT Blue Coast', 'c': '#3a8fd6', 'k': 'lrt', 'seq': seq})
used = sorted({s for l in lines for s in l['seq']})
idx = {k: i for i, k in enumerate(used)}
# ── Google: stations ──
from concurrent.futures import ThreadPoolExecutor
KIND_OF = {}
for l in lines:
    for x in l['seq']: KIND_OF.setdefault(x, l['k'])
STYPE = ('subway_station', 'light_rail_station', 'train_station', 'transit_station', 'tram_stop', 'transit_depot')
def g_station(k):
    s = st[k]; lat = sum(p[0] for p in s['pts']) / len(s['pts']); lng = sum(p[1] for p in s['pts']) / len(s['pts'])
    pre = '淡海輕軌' if KIND_OF[k] == 'lrt' and k not in ('紅樹林',) else '機場捷運' if KIND_OF[k] in ('apt', 'apx') and k not in ('台北車站', '三重', '新北產業園區') else '捷運'
    for q in (f'{pre}{k}站' if not k.endswith('車站') else f'{pre}{k}', f'{k}站'):
        for p in F.text(q, bias=(lat, lng), n=6).get('places', []):
            loc = p.get('location') or {}; n = p['displayName']['text'].replace('臺', '台')
            if (p.get('primaryType') or '') in STYPE and k.replace('車站', '') in n and F.dist((lat, lng), (loc['latitude'], loc['longitude'])) < 900:
                en = (F.details(p['id'], 'en').get('displayName') or {}).get('text', '')
                return k, {'lat': loc['latitude'], 'lng': loc['longitude'], 'gpid': p['id'], 'en': re.sub(r'\s*(MRT|LRT)?\s*Station$', '', en) or s['en'], 'src': 'google'}
    return k, {'lat': lat, 'lng': lng, 'gpid': None, 'en': s['en'], 'src': 'osm'}
with ThreadPoolExecutor(8) as ex: G = dict(ex.map(g_station, used))
# ── Google: each directed line end to end (transit): official name + colour, ride minutes; trusted only if the stop count matches OSM ──
RM = ','.join('routes.' + f for f in ('duration', 'legs.steps.travelMode', 'legs.steps.staticDuration', 'legs.steps.transitDetails.stopCount', 'legs.steps.transitDetails.headsign',
      'legs.steps.transitDetails.transitLine.name', 'legs.steps.transitDetails.transitLine.nameShort', 'legs.steps.transitDetails.transitLine.color', 'legs.steps.transitDetails.transitLine.textColor'))
def ep(k): g = G[k]; return {'placeId': g['gpid']} if g['gpid'] else {'location': {'latLng': {'latitude': g['lat'], 'longitude': g['lng']}}}
def g_line(i):
    l = lines[i]; n = len(l['seq']) - 1
    b = {'origin': ep(l['seq'][0]), 'destination': ep(l['seq'][-1]), 'travelMode': 'TRANSIT', 'computeAlternativeRoutes': True, 'departureTime': utc_at(DAYS[min(2, len(DAYS) - 1)]['date'], 10), 'languageCode': 'zh-TW',
         'transitPreferences': {'allowedTravelModes': ['SUBWAY', 'LIGHT_RAIL', 'TRAIN', 'RAIL']}}
    r = F.call('mrt', 'https://routes.googleapis.com/directions/v2:computeRoutes', b, RM)
    for ro in r.get('routes', []):
        tr = [x for x in ro['legs'][0].get('steps', []) if x.get('travelMode') == 'TRANSIT']
        if len(tr) == 1 and (tr[0].get('transitDetails') or {}).get('stopCount') == n:
            td = tr[0]['transitDetails']; tl = td.get('transitLine') or {}
            return i, {'min': round(int(tr[0]['staticDuration'].rstrip('s')) / 60, 1), 'name': tl.get('name'), 'short': tl.get('nameShort'), 'c': tl.get('color'), 'tc': tl.get('textColor'), 'head': td.get('headsign')}
    return i, None
with ThreadPoolExecutor(8) as ex: GL = dict(ex.map(g_line, range(len(lines))))
# OSM also has partial relations (a 4-stop 板南線): drop an unconfirmed line whose stops all sit on a confirmed line of the same ref
drop = {i for i, l in enumerate(lines) if not GL.get(i) and l['k'] != 'apx' and any(GL.get(j) and lines[j]['ref'] == l['ref'] and set(l['seq']) < set(lines[j]['seq']) for j in range(len(lines)))}
print('dropped partial OSM lines:', [(lines[i]['zh'], len(lines[i]['seq'])) for i in sorted(drop)])
lines = [l for i, l in enumerate(lines) if i not in drop]; GL = {k: v for k, v in zip([i for i in range(len(GL)) if i not in drop], [GL.get(i) for i in range(len(GL)) if i not in drop])}
GL = {n: g for n, g in enumerate(GL.values())}
F.save()
SPEED = {'mrt': 32, 'branch': 28, 'lrt': 18, 'apt': 45, 'apx': 70}  # km/h, only when Google did not confirm the line
out = {'src': f'Google Places + Routes (company key) · stop order OpenStreetMap · {TODAY}', 'st': [], 'ln': []}
for k in used:
    g = G[k]; out['st'].append([T2S(k), k, g['en'], round(g['lat'], 6), round(g['lng'], 6)])
for i, l in enumerate(lines):
    pts = [(G[x]['lat'], G[x]['lng']) for x in l['seq']]; hop = [F.dist(pts[j], pts[j + 1]) for j in range(len(pts) - 1)]
    g = GL.get(i); total = g['min'] if g else sum(h / 1000 / SPEED[l['k']] * 60 + 0.5 for h in hop)
    t = [round(total * h / sum(hop), 2) for h in hop]  # Google's end-to-end time, spread by distance
    row = {'ref': l['ref'], 'zh': l['zh'], 'en': l['en'], 'c': (g or {}).get('c') or l['c'], 'k': l['k'], 's': [idx[x] for x in l['seq']], 't': t, 'g': 1 if g else 0}
    if g and g.get('name'): row['gname'] = g['name']
    out['ln'].append(row)
print(f"{len(out['st'])} stations (Google {sum(1 for g in G.values() if g['src'] == 'google')}, OSM fallback {sum(1 for g in G.values() if g['src'] == 'osm')}) · {len(out['ln'])} directed lines, Google-confirmed {sum(l['g'] for l in out['ln'])}")
print('OSM-fallback stations:', [k for k, g in G.items() if g['src'] == 'osm'])
print('lines not confirmed by Google:', [(l['zh'], lines[i]['seq'][0], lines[i]['seq'][-1]) for i, l in enumerate(out['ln']) if not l['g']])
print('Google line names/colours:', sorted({(l.get('gname'), l['c']) for l in out['ln'] if l['g']}))
far = [(k, round(max(math.dist(p, st[k]['pts'][0]) for p in st[k]['pts']) * 111000)) for k in used if len(st[k]['pts']) > 1]
print('stations whose OSM stop points spread > 400 m (check):', [x for x in far if x[1] > 400])
if '--write' in sys.argv: json.dump(out, open(S + 'mrt.json', 'w'), ensure_ascii=False, separators=(',', ':')); print('wrote mrt.json')
