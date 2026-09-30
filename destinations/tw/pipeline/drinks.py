"""Drink stands near every stop (bubble tea chains + Taiwan classics) and sit-down rest spots (teahouses, dessert, cafés),
from Google (the user's own key). Each shop gets cat "drink" (grab and go) or "rest" (sit down, cool off, dessert).
Writes drinks.json with --write; otherwise prints a summary. Run via pipeline/resync.py."""
import json, math, os, re, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../pipeline'))
os.environ.setdefault('RESYNC_REUSE', '1')
import opencc; T2S = opencc.OpenCC('t2s').convert
from lib.trip import S, HOTELS, TODAY, cfg
from lib import google as F
from lib import hours as A
geo = json.load(open(S + 'geo.json')); data_js = open(S + 'data.js').read()
# every place the schedule visits, plus the hotel
used = set(re.findall(r"place: '(\w+)'", data_js)) | set(HOTELS)
AREA = set(cfg('areas', []))  # districts and streets: search a wider circle
pts = {k: (geo['places'][k]['lat'], geo['places'][k]['lng']) for k in sorted(used) if k in geo['places'] and k not in set(cfg('skip_nearby', {}).get('drinks', []))}
QUERIES = ['手搖飲', '珍珠奶茶', '茶飲店', '冬瓜茶', '青草茶', '甘蔗汁', '酸梅湯', '古早味紅茶']
REST_Q = ['茶館', '茶藝館', '甜品', '豆花', '芋圓', '剉冰', '咖啡廳', '下午茶']
# brand → (simplified name, signature tip zh, tip en). Tips are the commonly recommended orders.
BRANDS = [
 ('幸福堂', '幸福堂', '黑糖珍珠鲜奶（现炒黑糖）', 'brown-sugar pearl fresh milk'),
 ('50嵐', '50岚', '1号（四季春+波霸）、珍波椰', 'No.1 (Four Seasons tea + pearls), pearl-coconut jelly'),
 ('可不可', '可不可熟成红茶', '熟成红茶、白玉欧蕾', 'aged black tea, pearl milk (白玉欧蕾)'),
 ('迷客夏', '迷客夏', '娜杯红茶拿铁、珍珠鲜奶', 'black-tea latte, pearl fresh milk'),
 ('五桐號', '五桐号', '杏仁冻五桐茶、芋泥', 'almond-jelly tea, taro'),
 ('麻古', '麻古茶坊', '芝芝葡萄果粒、杨枝甘露', 'cheese-foam grape, mango pomelo sago'),
 ('清心福全', '清心福全', '优多绿茶、珍珠奶茶', 'Yakult green tea, pearl milk tea'),
 ('珍煮丹', '珍煮丹', '黑糖珍珠鲜奶', 'brown-sugar pearl milk'),
 ('陳三鼎', '陈三鼎', '青蛙撞奶（黑糖珍珠鲜奶）', '"frog" brown-sugar pearl milk'),
 ('春水堂', '春水堂', '珍珠奶茶创始店之一，可坐下喝', 'one of the pearl-milk-tea originals; sit-down'),
 ('茶湯會', '茶汤会', '观音拿铁', 'Tieguanyin latte'),
 ('大苑子', '大苑子', '翡翠柳橙、芭乐柠檬', 'green tea with orange, guava lemon'),
 ('一沐日', '一沐日', '粉粿鲜奶', 'fen-guo jelly milk'),
 ('得正', '得正', '春乌龙、焙乌龙', 'oolong teas'),
 ('龜記', '龟记', '红柚翡翠、三韵红萱', 'grapefruit green tea'),
 ('萬波', '万波岛屿红茶', '黑糖珍珠鲜奶、柠檬红茶', 'brown-sugar pearl milk, lemon black tea'),
 ('老賴', '老赖茶栈', '冬瓜柠檬', 'winter-melon lemon'),
 ('CoCo', 'CoCo都可', '百香双响炮', 'passion fruit with pearls & coconut jelly'),
 ('鮮茶道', '鲜茶道', '黄金乌龙', 'golden oolong'),
 ('再睡5分鐘', '再睡5分钟', '珍珠奶茶', 'pearl milk tea'),
 ('幸福堂', '幸福堂', '黑糖珍珠鲜奶', 'brown-sugar pearl milk'),
 ('老虎堂', '老虎堂', '黑糖珍珠鲜奶', 'brown-sugar pearl milk'),
 ('烏弄', '乌弄', '黑糖珍珠、冬瓜', 'brown-sugar pearls, winter melon'),
 ('先喝道', '先喝道', '铁观音拿铁', 'Tieguanyin latte'),
 ('橘子工坊', '橘子工坊', '金萱双Q', 'Jinxuan tea with two jellies'),
 ('日出茶太', '日出茶太', '珍珠奶茶', 'pearl milk tea'),
 ('天仁', '天仁茗茶', '茶叶老店，买茶叶伴手礼也行', 'old tea house; tea leaves as gifts'),
 ('功夫', '功夫茶', '珍珠奶茶', 'pearl milk tea'),
 ('茶聚', '茶聚', '金萱奶茶', 'Jinxuan milk tea'),
 ('Mr. Wish', 'Mr. Wish', '鲜果茶', 'fresh fruit tea'),
 ('TEA TOP', '台灣第一味', '珍珠奶茶', 'pearl milk tea'),
]
CLASSIC = [('冬瓜', '冬瓜茶', 'winter-melon tea'), ('青草', '青草茶', 'herbal tea'), ('甘蔗', '甘蔗汁', 'sugar-cane juice'), ('酸梅', '酸梅汤', 'sour plum drink'), ('紅茶', '古早味红茶', 'old-style black tea'), ('豆漿', '豆浆', 'soy milk'), ('愛玉', '柠檬爱玉', 'lemon aiyu jelly')]
NOT_DRINK = re.compile(r'餐飲|餐廳|餐厅|麵|面店|飯|咖哩|牛排|火鍋|便當|小吃店|布丁|[Pp]udding|PUDDING|蛋糕|麻糬|名茶|茗茶|茶葉|茶叶|甜點|甜点|咖啡廳|咖啡館|[Cc]af[eé]|潤餅|茶館|茶馆|茶坊|茶樓|茶楼|茶舍|茶屋|專賣店|酒')
DRINKY = re.compile(r'茶|飲|奶|汁|冬瓜|青草|甘蔗|酸梅|愛玉|豆漿|tea|Tea|TEA|CoCo|Mr\. Wish')
SIT_TEA = re.compile(r'茶館|茶馆|茶坊|茶樓|茶楼|茶舍|茶屋|茶藝|茶室|茶空間|茶糧|tea ?house|茶寮', re.I)
SIT_DESSERT = re.compile(r'豆花|芋圓|芋圆|冰|甜品|甜點|甜點|甜湯|湯圓|布丁|[Pp]udding|麻糬|雪花|鬆餅|dessert|Dessert|DESSERT')
NOT_REST = re.compile(r'茗茶|名茶|茶葉|茶叶|專賣店|批發|便當|火鍋|牛排|燒肉|拉麵|漢堡|[Bb]urger|茶餐廳|茶餐厅')
def rest_kind(n, pt):
    if NOT_REST.search(n) or pt in ('tea_store', 'hotel', 'supermarket', 'convenience_store', 'grocery_store', 'bakery', 'store', 'food_store'): return None
    if pt == 'bar' or re.search(r'酒吧|酒室|[Bb]ar\b', n): return 'bar'
    if SIT_TEA.search(n) or pt == 'tea_house' and not DRINKY_STAND.search(n): return 'tea'
    if pt in ('dessert_shop', 'dessert_restaurant', 'ice_cream_shop') or SIT_DESSERT.search(n): return 'dessert'
    if pt in ('cafe', 'coffee_shop', 'brunch_restaurant') or re.search(r'咖啡|[Cc]af[eé]|[Cc]offee', n): return 'cafe'
    return None
DRINKY_STAND = re.compile(r'手搖|飲|饮|奶茶|鮮茶|冬瓜|青草|甘蔗|酸梅|果汁|[Bb]ubble|[Bb]oba')
def brand_of(n):
    if re.search(r'壱番屋|壹番屋|Brownies|Bakery|咖哩', n): return None  # CoCo curry / bakery, not CoCo tea
    for k, zh, tz, te in BRANDS:
        if k.lower() in n.lower(): return k, zh, tz, te
    return None
cand = {}; rest = {}
for pk, (lat, lng) in pts.items():
    rad = 700 if pk in AREA else 500
    by_type = F.call('near', 'https://places.googleapis.com/v1/places:searchNearby', {'includedTypes': ['cafe', 'coffee_shop', 'tea_house', 'dessert_shop', 'dessert_restaurant', 'ice_cream_shop'], 'maxResultCount': 20, 'rankPreference': 'DISTANCE', 'languageCode': 'zh-TW',
        'locationRestriction': {'circle': {'center': {'latitude': round(lat, 5), 'longitude': round(lng, 5)}, 'radius': float(rad)}}}, 'places.' + F.DET.replace(',', ',places.')).get('places', [])
    for q in [None] + REST_Q:  # sit-down spots: rated well by many people, open, close by
        for c in (by_type if q is None else F.text(q, bias=(lat, lng), n=20).get('places', [])):
            n = c['displayName']['text']; loc = c.get('location') or {}; pt = c.get('primaryType') or ''
            if not loc or c.get('businessStatus') != 'OPERATIONAL': continue
            k = rest_kind(n, pt) if not brand_of(n) or '春水堂' in n else None
            if '春水堂' in n: k = 'tea'
            if not k or (c.get('rating') or 0) < 4.0 or (c.get('userRatingCount') or 0) < 100: continue
            d = F.dist((lat, lng), (loc['latitude'], loc['longitude']))
            if d > rad: continue
            x = rest.setdefault(c['id'], {'c': c, 'near': {}, 'kind': k}); x['near'][pk] = round(d)
    for q in QUERIES + [b[0] if b[0] not in ('功夫', 'TEA TOP', 'Mr. Wish') else b[1] for b in BRANDS if b[0] not in ('天仁', '春水堂')]:
        r = F.text(q, bias=(lat, lng), n=20)
        for c in r.get('places', []):
            n = c['displayName']['text']; loc = c.get('location') or {}
            br = brand_of(n); pt = c.get('primaryType') or ''
            if br and br[0] == '春水堂': continue  # sit-down: listed under rest
            if not loc or c.get('businessStatus') != 'OPERATIONAL' or not (br or DRINKY.search(n)): continue
            if not br and loc and (c.get('rating') or 0) >= 4.0 and (c.get('userRatingCount') or 0) >= 100 and (NOT_DRINK.search(n) or pt in ('tea_house', 'dessert_shop', 'dessert_restaurant', 'cafe', 'brunch_restaurant', 'bar')):
                k = rest_kind(n, pt); d = F.dist((lat, lng), (loc['latitude'], loc['longitude']))
                if k and d <= rad: x = rest.setdefault(c['id'], {'c': c, 'near': {}, 'kind': k}); x['near'][pk] = round(d)
            if not br:  # not a known chain: must look like a drink stand, not a restaurant, coffee shop or tea-leaf seller
                if NOT_DRINK.search(n) or pt in ('restaurant', 'chinese_restaurant', 'taiwanese_restaurant', 'hotel', 'supermarket', 'convenience_store', 'grocery_store', 'coffee_shop', 'bakery', 'tea_store', 'dessert_restaurant', 'brunch_restaurant', 'bar', 'breakfast_restaurant'): continue
                if pt == 'cafe' and not re.search(r'茶|[Tt]ea', n): continue
                if re.search(r'咖啡|[Cc]offee', n) and not re.search(r'茶|[Tt]ea', n): continue
            d = F.dist((lat, lng), (loc['latitude'], loc['longitude']))
            if d > rad: continue
            if br and ((c.get('rating') or 0) < 3.5 or (c.get('userRatingCount') or 0) < 20): continue
            if not br and ((c.get('rating') or 0) < 4.0 or (c.get('userRatingCount') or 0) < 80): continue
            x = cand.setdefault(c['id'], {'c': c, 'near': {}}); x['near'][pk] = round(d)
# per stop: best 6, one branch per brand
def score(x): c = x['c']; return (c.get('rating') or 0) * math.log10(max(10, c.get('userRatingCount') or 0)) + (0.4 if brand_of(c['displayName']['text']) else 0)
keep = set()
for pk in pts:
    here = sorted([x for x in cand.values() if pk in x['near']], key=score, reverse=True); seen = set(); n_brand = 0
    for x in here:  # famous chains first: up to 3, one branch each
        b = brand_of(x['c']['displayName']['text'])
        if not b or b[0] in seen or n_brand >= 3: continue
        seen.add(b[0]); keep.add(x['c']['id']); n_brand += 1
    for x in here:  # then the best-rated local shops
        if len(seen) >= 7: break
        b = brand_of(x['c']['displayName']['text'])
        if b or x['c']['id'] in keep: continue
        seen.add(x['c']['id']); keep.add(x['c']['id'])
for c_id in list(rest):  # a shop that is already a drink stand stays a drink stand
    if c_id in cand: del rest[c_id]
keep_rest = set()
for pk in pts:  # per stop: best 4 sit-down spots, at most 2 of a kind and 1 bar
    here = sorted([x for x in rest.values() if pk in x['near']], key=score, reverse=True); kinds = {}
    for x in here:
        if sum(kinds.values()) >= 4: break
        if kinds.get(x['kind'], 0) >= (1 if x['kind'] == 'bar' else 2): continue
        kinds[x['kind']] = kinds.get(x['kind'], 0) + 1; keep_rest.add(x['c']['id'])
F.save()  # keep the searches even if a later step fails
def short(n):
    n = re.split(r'\s*[|｜]\s*|\s+I\s+', n)[0].strip()
    n = re.sub(r'-(?=[^-]*(?:推薦|必喝|飲料|手搖|外送))[^-]*$', '', n).strip()  # "-中山必喝飲料…"
    return n[:28]
KIND = {'tea': ('茶馆，可坐下慢慢喝', 'teahouse: sit and sip'), 'dessert': ('甜品，可坐', 'dessert, seats'), 'cafe': ('咖啡馆，可坐', 'café, seats'), 'bar': ('酒吧/茶酒', 'bar')}
out = []
for pid in list(keep) + list(keep_rest):
    x = cand.get(pid) or rest[pid]; c = x['c']; n = c['displayName']['text']; b = brand_of(n); rk = x.get('kind')
    cl = next((v for k, *v in CLASSIC if k in n), None) if not b else None
    en = F.details(pid, 'en'); days = A.parse_hours((c.get('regularOpeningHours') or {}).get('weekdayDescriptions'))
    hz, he = A.fmt_hours(days) if days else ('', '')
    out.append({'id': 'drink-' + pid[-10:], 'gpid': pid, 'name_trad': short(n), 'name_zh': T2S(short(n)), 'name_en': short((en.get('displayName') or {}).get('text', n)),
                'cat': 'rest' if rk else 'drink', 'kind': rk, 'brand': b[1] if b and not rk else None,
                'tip_zh': (b[2] if b else KIND[rk][0]) if rk else b[2] if b else (f'台湾经典：{cl[0]}' if cl else ''), 'tip_en': (b[3] if b else KIND[rk][1]) if rk else b[3] if b else (f'Taiwan classic: {cl[1]}' if cl else ''),
                'lat': round(c['location']['latitude'], 6), 'lng': round(c['location']['longitude'], 6), 'address_trad': A.clean_addr(c.get('formattedAddress')),
                'type': c.get('primaryType'), 'rating': c.get('rating'), 'reviews': c.get('userRatingCount'), 'hours_zh': hz, 'hours_en': he, 'week': days, 'closed_dates': A.closed_on_trip(days) if days else [],
                'near': x['near'], 'checked': TODAY})
out.sort(key=lambda d: (-(d['rating'] or 0), -(d['reviews'] or 0)))
F.save()
dr = [d for d in out if d['cat'] == 'drink']; rs = [d for d in out if d['cat'] == 'rest']
print(f'{len(pts)} stops · drinks: {len(dr)} (brands {len({d["brand"] for d in dr if d["brand"]})}, classics {sum(1 for d in dr if d["tip_zh"].startswith("台湾经典"))}) · rest spots: {len(rs)} {dict((k, sum(1 for d in rs if d["kind"] == k)) for k in KIND)}')
print('drinks per stop:', dict(sorted({pk: sum(1 for d in dr if pk in d['near']) for pk in pts}.items())))
print('rest per stop:', dict(sorted({pk: sum(1 for d in rs if pk in d['near']) for pk in pts}.items())))
if '--write' in sys.argv: json.dump(out, open(S + 'drinks.json', 'w'), ensure_ascii=False, indent=1); print('wrote drinks.json')
