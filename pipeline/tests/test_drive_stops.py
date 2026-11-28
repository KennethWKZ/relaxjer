"""The drive-stops step (ADR-20261128-drive-stops), offline: the route line and the searches along it come from a Google
cache the test writes, keyed the way lib/google.py keys a call, never the network."""
import json, math, os, shutil, subprocess, sys, tempfile, unittest
from lib import trip, drive_stops as D

SAPPORO = os.path.join(trip.REPO, 'examples', 'demo-sapporo')
HOTEL, ZOO = (43.0610, 141.3540), (43.7684, 142.4799)  # the Sapporo demo's day drive (d5:0 there, d5:1 back)
JA = {'dir': {'up': '上り', 'down': '下り'}, 'names': {'sa': 'サービスエリア|(?<![A-Za-z])SA(?![A-Za-z])', 'pa': 'パーキングエリア|(?<![A-Za-z])PA(?![A-Za-z])', 'roadside': '道の駅'}}


def encode(pts):
    """Google's polyline encoding, the inverse of D.decode"""
    out, plat, plng = [], 0, 0
    for lat, lng in pts:
        for v, p in ((round(lat * 1e5), plat), (round(lng * 1e5), plng)):
            d = v - p; d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20: out.append(chr((0x20 | (d & 0x1f)) + 63)); d >>= 5
            out.append(chr(d + 63))
        plat, plng = round(lat * 1e5), round(lng * 1e5)
    return ''.join(out)


def line(a, b, n=12):
    return [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]


def beside(a, b, f, metres, side):
    """a point f of the way from a to b, `metres` off the line to the left or the right of the way a → b runs"""
    lat, lng = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
    k = math.cos(math.radians(lat))
    dx, dy = (b[1] - a[1]) * k, b[0] - a[0]  # east, north
    n = math.hypot(dx, dy); sgn = 1 if side == 'left' else -1
    ox, oy = -dy / n * sgn, dx / n * sgn  # the left normal
    deg = metres / 111195
    return lat + oy * deg, lng + ox * deg / k


def week(today):
    """Google's Japanese weekday lines, the same every day"""
    return [f'{d}曜日: {today}' for d in '月火水木金土日']


def found(pid, name, at, types=(), status='OPERATIONAL', hours='24 時間営業', reviews=10):
    return {'id': pid, 'displayName': {'text': name}, 'location': {'latitude': at[0], 'longitude': at[1]}, 'types': list(types),
            'businessStatus': status, 'regularOpeningHours': {'weekdayDescriptions': week(hours)}, 'rating': 4.0, 'userRatingCount': reviews}


def answers(a, b):
    """what each search finds along the drive a → b: the same places both ways (a service area's two twins sit across
    the road from each other, so the one kept changes with the way the drive runs)"""
    north = beside(HOTEL, ZOO, 0.40, 60, 'left')  # signed 下り, on the left of the drive out
    return {
        'sa': [found('sa-down', 'デモ北SA（下り）', north),
               found('sa-up', 'デモ北SA（上り）', beside(HOTEL, ZOO, 0.40, 60, 'right')),
               found('sa-down-shop', 'デモ北SA（下り）ショッピングコーナー', beside(HOTEL, ZOO, 0.401, 70, 'left'), reviews=3),
               found('sa-both', 'デモ南SA', beside(HOTEL, ZOO, 0.20, 40, 'right'), hours='7時00分～22時00分'),
               found('sa-gone', 'デモ閉鎖SA（下り）', beside(HOTEL, ZOO, 0.30, 50, 'left'), status='CLOSED_PERMANENTLY')],
        'pa': [found('pa-down', 'デモPA（下り）', beside(HOTEL, ZOO, 0.70, 50, 'left')),
               found('pa-up', 'デモPA（上り）', beside(HOTEL, ZOO, 0.70, 50, 'right'))],
        'roadside': [found('road', '道の駅 デモ', beside(HOTEL, ZOO, 0.55, 300, 'right'), types=['tourist_attraction'], hours='9時00分～17時00分')],
        'fuel': [found('fuel-a', 'デモ石油 A', beside(HOTEL, ZOO, 0.10, 100, 'left'), types=['gas_station']),
                 found('fuel-b', 'デモ石油 B', beside(HOTEL, ZOO, 0.12, 120, 'right'), types=['gas_station'], hours='定休日'),
                 found('fuel-c', 'デモ石油 C', beside(HOTEL, ZOO, 0.90, 80, 'right'), types=['gas_station'], hours='6時30分～21時00分'),
                 found('fuel-far', 'デモ石油 遠い', beside(HOTEL, ZOO, 0.50, 1500, 'left'), types=['gas_station'])],
    }


def dump(obj, *path):
    with open(os.path.join(*path), 'w') as f: json.dump(obj, f, ensure_ascii=False)


def load(*path):
    with open(os.path.join(*path)) as f: return json.load(f)


class Pure(unittest.TestCase):
    def test_a_route_line_decodes_and_encodes_back(self):
        self.assertEqual(D.decode('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)])  # Google's own example
        pts = line(HOTEL, ZOO)
        back = D.decode(encode(pts))
        self.assertEqual(len(back), len(pts))
        self.assertTrue(all(abs(x - y) < 2e-5 for p, q in zip(back, pts) for x, y in zip(p, q)))  # to Google's five decimals

    def test_a_stop_is_placed_along_the_line_with_its_side(self):
        pts = line(HOTEL, ZOO); cum = D.along(pts)
        self.assertAlmostEqual(cum[-1] / 1000, 120, delta=3)  # as the crow flies
        m, off, side = D.place(pts, cum, beside(HOTEL, ZOO, 0.25, 80, 'left'))
        self.assertAlmostEqual(m / cum[-1], 0.25, delta=0.01)
        self.assertAlmostEqual(off, 80, delta=3)
        self.assertEqual(side, 'left')
        self.assertEqual(D.place(pts, cum, beside(HOTEL, ZOO, 0.25, 80, 'right'))[2], 'right')

    def test_kind_comes_from_the_name_then_the_type_then_the_search(self):
        self.assertEqual(D.kind_of('砂川SA（上り）', [], 'pa', JA['names']), 'sa')
        self.assertEqual(D.kind_of('輪厚パーキングエリア', [], 'sa', JA['names']), 'pa')
        self.assertEqual(D.kind_of('道の駅 デモ', ['tourist_attraction'], 'sa', JA['names']), 'roadside')
        self.assertEqual(D.kind_of('デモ石油', ['gas_station'], 'store', JA['names']), 'fuel')
        self.assertEqual(D.kind_of('USA Mart', ['convenience_store'], 'fuel', JA['names']), 'store', 'SA inside a word is no service area')
        self.assertEqual(D.kind_of('?', [], 'roadside', {}), 'roadside')

    def test_direction_words_and_a_twins_shared_name(self):
        self.assertEqual(D.dir_of('デモSA（上り）', JA['dir']), 'up')
        self.assertEqual(D.dir_of('デモSA（下り線）', JA['dir']), 'down')
        self.assertIsNone(D.dir_of('デモSA', JA['dir']))
        self.assertEqual(D.base('デモSA（上り）', JA['dir']), D.base('デモSA (下り)', JA['dir']))

    def test_hours_on_the_drives_day(self):
        days = ['24h', 'closed', '07:00–22:00', '10:00–14:00,17:00–21:00', 'by appointment', '24h', '24h']
        self.assertEqual(D.day_hours(days, 0), {'h24': True})
        self.assertEqual(D.day_hours(days, 1), {'shut': True})
        self.assertEqual(D.day_hours(days, 2), {'hours': '07:00–22:00'})
        self.assertEqual(D.day_hours(days, 3), {'hours': '10:00–14:00, 17:00–21:00'})
        self.assertEqual(D.day_hours(days, 4), {}, 'words it can’t read: no hours')
        self.assertEqual(D.day_hours(['7:00–9:30'] * 7, 0), {'hours': '07:00–09:30'})
        self.assertEqual(D.day_hours(None, 2), {})

    def test_the_pick_keeps_this_sides_twin_one_place_per_facility_and_spaced_out_petrol(self):
        from lib.hours import parse_hours
        pts = line(HOTEL, ZOO)
        cands = [{'id': p['id'], 'name': p['displayName']['text'], 'lat': p['location']['latitude'], 'lng': p['location']['longitude'],
                  'kind': D.kind_of(p['displayName']['text'], p['types'], k, JA['names']), 'status': p['businessStatus'],
                  'hours': D.day_hours(parse_hours(p['regularOpeningHours']['weekdayDescriptions']), 2), 'reviews': p['userRatingCount']}
                 for k, ps in answers(HOTEL, ZOO).items() for p in ps]
        out = D.pick(cands, pts, 125, JA['dir'], 'left')
        self.assertEqual([s['name'] for s in out], ['デモ石油 A', 'デモ南SA', 'デモ北SA（下り）', '道の駅 デモ', 'デモPA（下り）', 'デモ石油 C'])
        self.assertEqual([s['km'] for s in out], sorted(s['km'] for s in out))
        north = out[2]
        self.assertEqual((north['kind'], north['dir'], north['h24']), ('sa', 'down', True))
        self.assertAlmostEqual(north['min'], 125 * 0.4, delta=2)  # the leg's minutes, shared out by distance
        self.assertEqual(out[1]['hours'], '07:00–22:00')
        self.assertNotIn('dir', out[3])
        # the way back: the 上り twins are on the car's side now
        back = D.pick(cands, list(reversed(pts)), 130, JA['dir'], 'left')
        self.assertIn('デモ北SA（上り）', [s['name'] for s in back])
        self.assertNotIn('デモ北SA（下り）', [s['name'] for s in back])
        # a road where cars keep right keeps the other twin
        self.assertIn('デモ北SA（上り）', [s['name'] for s in D.pick(cands, pts, 125, JA['dir'], 'right')])
        self.assertEqual(D.pick(cands, pts[:1], 125, JA['dir']), [], 'no line, no stops')


class Step(unittest.TestCase):
    """steps/drive-stops.py on a copy of the Sapporo demo, Google answered from the cache"""

    def setUp(self):
        self.trip = tempfile.mkdtemp(prefix='relaxjer-drive-trip-')
        for f in ('data.js', 'geo.json', 'extra.json', 'wish-a.json'):
            shutil.copy(os.path.join(SAPPORO, f), self.trip)
        dump({'google': {'language': 'ja', 'region': 'JP'}}, self.trip, 'pipeline.json')
        self.cache = tempfile.mkdtemp(prefix='relaxjer-drive-cache-')
        self.write_cache()

    def write_cache(self, skip=()):
        conf = json.loads(subprocess.run(['node', os.path.join(trip.REPO, 'pipeline', 'trip-data.mjs'), self.trip], capture_output=True, text=True).stdout)['pack']['driveStops']
        cache = {}
        key = lambda tag, body, url, mask: tag + '|' + json.dumps(body, sort_keys=True, ensure_ascii=False) + '|' + url + '|' + mask
        place = lambda p: {'lat': p[0], 'lng': p[1]}
        for a, b in ((HOTEL, ZOO), (ZOO, HOTEL)):
            poly = encode(line(a, b))
            cache[key('stops-route', D.route_body(place(a), place(b), 'ja'), D.ROUTE_URL, D.ROUTE_MASK)] = {'routes': [{'polyline': {'encodedPolyline': poly}, 'distanceMeters': 141200}]}
            found_by = answers(a, b)
            for s in conf['search']:
                if s['kind'] in skip or s['kind'] not in found_by: continue
                cache[key('stops-along', D.along_body(poly, s, 'ja', 'JP'), D.ALONG_URL, D.ALONG_MASK)] = {'places': found_by[s['kind']]}
        dump(cache, self.cache, 'google-cache.json')

    def tearDown(self):
        shutil.rmtree(self.trip, ignore_errors=True); shutil.rmtree(self.cache, ignore_errors=True)

    def run_step(self, *flags):
        env = dict(os.environ, RELAXJER_TRIP=self.trip, RELAXJER_CACHE_DIR=self.cache, RELAXJER_OFFLINE='1', RELAXJER_TODAY='2027-01-30')
        return subprocess.run([sys.executable, os.path.join(trip.REPO, 'pipeline', 'steps', 'drive-stops.py'), *flags], env=env,
                              capture_output=True, text=True, timeout=60)

    def test_a_dry_run_writes_nothing_and_says_what_it_found(self):
        r = self.run_step()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('2 long drives', r.stdout)
        self.assertIn('d5:0 hotel→zoo 125 min: 6 stops', r.stdout)
        self.assertFalse(os.path.exists(os.path.join(self.trip, 'drive-stops.json')))

    def test_write_makes_the_file_the_page_reads_and_a_rerun_writes_the_same(self):
        r = self.run_step('--write')
        self.assertEqual(r.returncode, 0, r.stderr)
        out = load(self.trip, 'drive-stops.json')
        self.assertEqual(out['checked'], '2027-01-30')
        self.assertEqual(list(out['legs']), ['d5:0', 'd5:1'])
        there, back = out['legs']['d5:0'], out['legs']['d5:1']
        self.assertEqual((there['from'], there['to'], there['mode'], there['min']), ('hotel', 'zoo', 'driving', 125))
        self.assertIn('デモ北SA（下り）', [s['name'] for s in there['stops']])
        self.assertIn('デモ北SA（上り）', [s['name'] for s in back['stops']])
        self.assertTrue(all(s['rating_checked'] == '2027-01-30' for s in there['stops']))
        with open(os.path.join(self.trip, 'drive-stops.json')) as f: first = f.read()
        self.run_step('--write')
        with open(os.path.join(self.trip, 'drive-stops.json')) as f: self.assertEqual(f.read(), first)

    def test_convenience_stores_are_asked_only_when_few_stops_were_found(self):
        # offline, a call the cache lacks fails the step: with six stops found, the store search is never asked
        self.assertEqual(self.run_step().returncode, 0)
        self.write_cache(skip=('sa', 'pa', 'roadside'))  # only petrol stations found now: two, so the stores are asked
        r = self.run_step()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('offline and not cached', r.stderr)

    def test_a_short_drive_or_a_reordered_day_is_not_searched(self):
        dump({'google': {'language': 'ja', 'region': 'JP'}, 'drive_stops': {'min_drive': 200}}, self.trip, 'pipeline.json')
        r = self.run_step()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('0 long drives', r.stdout)
        geo = load(self.trip, 'geo.json'); geo['legs']['d5:0']['to'] = 'teine'; dump(geo, self.trip, 'geo.json')
        dump({'google': {'language': 'ja', 'region': 'JP'}}, self.trip, 'pipeline.json')
        r = self.run_step()
        self.assertIn('1 long drive (', r.stdout)  # only the way back: the time stored for d5:0 was for another drive
