"""The refill step (ADR-20261128-water-refill) and the trip's own steps, offline: OpenStreetMap's answers come from a
cache the test writes, never the network."""
import json, os, shutil, subprocess, sys, tempfile, unittest
from lib import trip, refill as R


def dump(obj, *path):
    with open(os.path.join(*path), 'w') as f: json.dump(obj, f)


def load(*path):
    with open(os.path.join(*path)) as f: return json.load(f)


def write(text, *path):
    with open(os.path.join(*path), 'w') as f: f.write(text)


def read(*path):
    with open(os.path.join(*path)) as f: return f.read()

# an Overpass answer near the demo trip's places, made up: a fountain that shuts for winter, a café that fills a bottle,
# a tap in a library, a private tap (left out), a way with its centre, and a tap a trip file lists too
OVERPASS = [
    {'type': 'node', 'id': 101, 'lat': 25.04475, 'lon': 121.52985, 'tags': {'amenity': 'drinking_water', 'seasonal': 'yes'}},
    {'type': 'node', 'id': 102, 'lat': 25.0431, 'lon': 121.5283, 'tags': {'amenity': 'cafe', 'name': 'Demo Café', 'drinking_water:refill': 'yes',
                                                                          'opening_hours': 'Mo-Fr 08:00-18:00; Sa,Su 09:00-17:00; PH off'}},
    {'type': 'node', 'id': 103, 'lat': 25.0463, 'lon': 121.5263, 'tags': {'amenity': 'library', 'drinking_water': 'yes', 'opening_hours': 'Tu-Su 09:00-21:00'}},
    {'type': 'node', 'id': 104, 'lat': 25.0450, 'lon': 121.5290, 'tags': {'amenity': 'drinking_water', 'access': 'private'}},
    {'type': 'way', 'id': 105, 'center': {'lat': 25.0379, 'lon': 121.4994}, 'tags': {'man_made': 'water_tap', 'drinking_water': 'yes', 'location': 'outdoor'}},
    {'type': 'node', 'id': 106, 'lat': 25.03455, 'lon': 121.56520, 'tags': {'amenity': 'drinking_water', 'indoor': 'yes', 'opening_hours': 'odd rule text'}},
]
# a trip's own refill-<src>.json, in the shape a private pull writes: its own fields (category, nearest place) included
LOCAL = {'source': 'a private pull', 'fetched': '2027-02-20', 'radius_m': 800, 'spots': [
    {'id': 'a1', 'name': 'Demo Shop', 'lat': 25.0485, 'lng': 121.5179, 'address': 'Demo Road 1', 'kind': 'shop', 'category_id': 4,
     'hours': {'days': {str(d): [['07:00', '23:00']] for d in range(1, 8)}, 'known': True}, 'hours_note': None,
     'water': ['浄水', '冷水'], 'how': 'Ask at the counter', 'site': 'https://example.org/spot/a1', 'added': '2026-06-01',
     'credit': 'Demo source', 'near': 'tpmain', 'near_m': 90, 'src': 'demo'},
    {'id': 'a2', 'name': None, 'lat': 25.03456, 'lng': 121.56521, 'address': None, 'kind': 'tap', 'category_id': 0, 'hours': None,
     'hours_note': None, 'water': ['水道水'], 'how': None, 'site': None, 'added': '2026-01-10', 'credit': 'Demo source',
     'near': 't101', 'near_m': 110, 'src': 'demo'},  # the same tap as OSM's node 106, listed by both
    {'id': 'a3', 'lat': 25.04, 'lng': 121.5, 'kind': 'fountain', 'credit': 'Demo source'},  # a kind the page doesn't know
    {'id': 'a4', 'lat': 'north', 'lng': 121.5},  # no position
    {'id': 'a5', 'lat': 25.0500, 'lng': 121.5160, 'kind': 'tap', 'hours': {'days': {'1': [['9am', '5pm']]}, 'known': True}},  # hours it can't read
]}


class Pure(unittest.TestCase):
    def test_places_near_each_other_share_one_small_area(self):
        b = R.boxes([(25.05, 121.52), (25.06, 121.53), (25.21, 121.69)])  # two in town, one 25 km out
        self.assertEqual(len(b), 2)
        s, w, n, e = b[0]
        self.assertTrue(s < 25.05 and n > 25.06 and w < 121.52 and e > 121.53)  # grown by the padding
        self.assertLess(n - s, 0.05)  # a small box, not the region
        self.assertEqual(R.boxes([(25.06, 121.53), (25.05, 121.52), (25.21, 121.69)]), b)  # the order of places doesn't matter
        q = R.query(b[0])
        for tag in ('"amenity"="drinking_water"', '"drinking_water:refill"="yes"', '"man_made"="water_tap"', 'out center tags'):
            self.assertIn(tag, q)

    def test_opening_hours_read_the_common_forms_only(self):
        oh = R.opening_hours('Mo-Fr 08:00-18:00; Sa,Su 9:00-17:00; PH off')
        self.assertEqual(oh['days']['1'], [['08:00', '18:00']])
        self.assertEqual(oh['days']['7'], [['09:00', '17:00']])
        self.assertTrue(oh['known'])
        self.assertEqual(R.opening_hours('24/7')['days']['4'], [['00:00', '24:00']])
        self.assertEqual(R.opening_hours('10:00-14:00,17:00-21:00')['days']['3'], [['10:00', '14:00'], ['17:00', '21:00']])
        both = R.opening_hours('Mo-Su 10:00-20:00; We off')
        self.assertEqual((both['days']['3'], both['days']['4']), ([], [['10:00', '20:00']]))  # a later rule wins for its days
        self.assertEqual(R.opening_hours('Fr-Mo 10:00-16:00')['days']['7'], [['10:00', '16:00']])  # a span over the weekend
        for odd in ('sunrise-sunset', 'Mo-Fr 08:00-18:00 "ring the bell"', 'Jan-Mar 10:00-16:00', ''):
            self.assertIsNone(R.opening_hours(odd), odd)

    def test_osm_elements_become_spots(self):
        got = {s['id']: s for s in map(R.from_osm, OVERPASS) if s}
        self.assertNotIn('osm-n104', got)  # private
        fountain, cafe, library, tap = got['osm-n101'], got['osm-n102'], got['osm-n103'], got['osm-w105']
        self.assertEqual((fountain['kind'], fountain['seasonal'], fountain['indoor']), ('tap', True, None))
        self.assertEqual((cafe['kind'], cafe['indoor'], cafe['name']), ('shop', True, 'Demo Café'))
        self.assertEqual(cafe['hours']['days']['6'], [['09:00', '17:00']])
        self.assertEqual((library['kind'], library['hours']['days']['1']), ('shelter', []))  # closed on Monday
        self.assertEqual((tap['lat'], tap['lng'], tap['indoor']), (25.0379, 121.4994, False))  # a way's centre; outdoors
        self.assertEqual((got['osm-n106']['hours'], got['osm-n106']['hours_note']), (None, 'odd rule text'))  # kept as words, never guessed
        self.assertTrue(all(s['credit'] == R.OSM_CREDIT and s['src'] == 'osm' for s in got.values()))
        self.assertEqual(R.from_osm({'type': 'node', 'id': 1, 'lat': 1, 'lon': 1, 'tags': {'amenity': 'drinking_water', 'seasonal': 'no'}})['seasonal'], False)

    def test_a_trips_own_file_is_checked_and_trimmed_to_the_spot_shape(self):
        spots, bad = R.read_local('refill-demo.json', LOCAL)
        ids = [s['id'] for s in spots]
        self.assertEqual(ids, ['demo-a1', 'demo-a2', 'demo-a5'])  # prefixed with the source, so two sources can't clash
        self.assertEqual(len(bad), 2)
        self.assertIn('kind "fountain"', bad[0]); self.assertIn('lat and lng', bad[1])
        shop = spots[0]
        self.assertEqual(set(shop), set(R.FIELDS))  # its own fields (category_id, near, near_m) are left out
        self.assertEqual((shop['kind'], shop['indoor'], shop['water'], shop['credit']), ('shop', True, ['浄水', '冷水'], 'Demo source'))
        self.assertEqual(shop['hours']['days']['3'], [['07:00', '23:00']])
        self.assertEqual((spots[2]['hours'], spots[2]['credit']), (None, 'demo'))  # unreadable hours dropped; the credit falls back to the source
        self.assertEqual(R.read_local('refill-x.json', [{'id': 7, 'lat': 1.5, 'lng': 2.5}])[0][0]['id'], 'x-7')  # a bare list works too
        self.assertEqual(R.read_local('refill-x.json', {'nope': 1}), ([], ['refill-x.json: no "spots" list']))

    def test_the_same_spot_from_two_sources_is_counted_once(self):
        osm = [s for s in map(R.from_osm, OVERPASS) if s]
        local, _ = R.read_local('refill-demo.json', LOCAL)
        spots, merged = R.merge(osm + local)
        self.assertEqual(merged, 1)
        twin = next(s for s in spots if abs(s['lat'] - 25.03455) < 0.0001)
        # neither has known hours, so whether it's indoors decides: OSM knows (indoor=yes), and keeps it
        self.assertEqual((twin['id'], twin['indoor']), ('osm-n106', True))
        self.assertEqual([s['id'] for s in spots], sorted(s['id'] for s in spots))  # stable order
        a = {'id': 'x-1', 'src': 'x', 'kind': 'tap', 'lat': 25.0, 'lng': 121.5, 'name': None, 'address': None, 'indoor': None,
             'seasonal': None, 'hours': {'days': {}, 'known': True}, 'credit': 'X'}
        b = dict(a, id='osm-n9', src='osm', hours=None, seasonal=True, name='Fountain', credit=R.OSM_CREDIT, lat=25.00005)
        (one,), n = R.merge([b, a])
        self.assertEqual((one['id'], one['seasonal'], one['name'], n), ('x-1', True, 'Fountain', 1))  # known hours win; gaps filled
        self.assertEqual(one['credit'], f'X · {R.OSM_CREDIT}')  # OpenStreetMap filled a gap, so it's credited
        shop = dict(a, kind='shop', name='Tea A'); other = dict(shop, id='x-2', name='Tea B', lat=25.00005)
        self.assertEqual(len(R.merge([shop, other])[0]), 2)  # two shops side by side stay two

    def test_only_spots_near_a_place_are_kept(self):
        near = {'lat': 25.0, 'lng': 121.5}; far = {'lat': 25.02, 'lng': 121.5}  # ~2.2 km apart
        self.assertEqual(R.keep_near([near, far], [(25.0005, 121.5)], 1000), [near])


class Step(unittest.TestCase):
    """steps/refill.py on a copy of the demo trip, with OpenStreetMap answered from the cache and a refill-demo.json"""

    def setUp(self):
        self.trip = tempfile.mkdtemp(prefix='relaxjer-refill-trip-')
        for f in ('data.js', 'geo.json', 'extra.json', 'wish-a.json'):
            shutil.copy(os.path.join(trip.TRIP_DIR, f), self.trip)
        self.cache = tempfile.mkdtemp(prefix='relaxjer-refill-cache-')
        dump(LOCAL, self.trip, 'refill-demo.json')
        places = [(g['lat'], g['lng']) for g in load(self.trip, 'geo.json')['places'].values() if g.get('lat') is not None]
        self.boxes = [','.join(str(x) for x in b) for b in R.boxes(places)]
        dump({k: {'fetched': '2027-02-25', 'elements': OVERPASS} for k in self.boxes}, self.cache, 'refill-osm.json')

    def tearDown(self):
        shutil.rmtree(self.trip, ignore_errors=True); shutil.rmtree(self.cache, ignore_errors=True)

    def run_step(self, *flags, offline=True):
        env = dict(os.environ, RELAXJER_TRIP=self.trip, RELAXJER_CACHE_DIR=self.cache, RELAXJER_OFFLINE='1' if offline else '0',
                   RELAXJER_TODAY='2027-03-01')
        return subprocess.run([sys.executable, os.path.join(trip.REPO, 'pipeline', 'steps', 'refill.py'), *flags], env=env,
                              capture_output=True, text=True, timeout=60)

    def test_a_dry_run_writes_nothing_and_says_what_it_found(self):
        r = self.run_step()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('refill-demo.json: 3 spots, 2 left out', r.stdout)
        self.assertIn('0 asked now', r.stdout)  # all from the cache
        self.assertIn('1 listed twice, counted once', r.stdout)
        self.assertFalse(os.path.exists(os.path.join(self.trip, 'refill.json')))

    def test_write_makes_the_file_the_page_reads(self):
        r = self.run_step('--write')
        self.assertEqual(r.returncode, 0, r.stderr)
        out = load(self.trip, 'refill.json')
        self.assertEqual(out['checked'], '2027-03-01')
        ids = [s['id'] for s in out['spots']]
        self.assertEqual(ids, sorted(ids))
        self.assertIn('demo-a1', ids); self.assertIn('osm-n102', ids); self.assertNotIn('osm-n104', ids)
        self.assertTrue(all(set(s) == set(R.FIELDS) for s in out['spots']))
        first = read(self.trip, 'refill.json')
        self.run_step('--write')
        self.assertEqual(read(self.trip, 'refill.json'), first)  # a rerun writes the same bytes

    def test_offline_with_nothing_kept_says_so_and_still_merges_the_trips_files(self):
        os.remove(os.path.join(self.cache, 'refill-osm.json'))
        r = self.run_step('--write')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('offline, nothing kept yet', r.stdout)
        self.assertEqual({s['src'] for s in load(self.trip, 'refill.json')['spots']}, {'demo'})

    def test_a_trip_can_skip_openstreetmap(self):
        dump({'refill': {'osm': False}}, self.trip, 'pipeline.json')
        r = self.run_step('--write')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(all(s['src'] == 'demo' for s in load(self.trip, 'refill.json')['spots']))


class TripSteps(unittest.TestCase):
    """a trip's own step (<trip>/pipeline/<name>.py): found first, run like the others, and its failure stops the run"""

    def setUp(self):
        self.trip = tempfile.mkdtemp(prefix='relaxjer-own-step-')
        for f in ('data.js', 'geo.json', 'extra.json', 'wish-a.json'):
            shutil.copy(os.path.join(trip.TRIP_DIR, f), self.trip)
        os.makedirs(os.path.join(self.trip, 'pipeline'))
        self.cache = tempfile.mkdtemp(prefix='relaxjer-own-step-cache-')
        dump({'x|step': {}}, self.cache, 'google-cache.json')  # a trip with a cache: no cost prompt

    def tearDown(self):
        shutil.rmtree(self.trip, ignore_errors=True); shutil.rmtree(self.cache, ignore_errors=True)

    def step(self, name, body):
        write(body, self.trip, 'pipeline', name + '.py')

    def resync(self, steps, *flags):
        dump({'steps': steps}, self.trip, 'pipeline.json')
        env = dict(os.environ, RELAXJER_CACHE_DIR=self.cache)
        return subprocess.run([sys.executable, os.path.join(trip.REPO, 'pipeline', 'resync.py'), '--trip', self.trip, *flags,
                               '--no-weather', '--no-links', '--no-build'], env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=120)

    def test_a_trips_own_step_is_found_first_and_runs_like_the_others(self):
        # it imports lib/ like the repo's steps, reads the trip, and gets the same flags and environment
        self.step('own-pull', "import json, os, sys\nfrom lib.trip import S, TRIP\nopen(S + 'own.json', 'w').write(json.dumps({'argv': sys.argv[1:], "
                  "'trip': os.environ['RELAXJER_TRIP'], 'tz': TRIP['tz'], 'fresh': os.environ.get('RESYNC_FRESH')}))\nprint('own step ran')\n")
        self.step('shops', "print('the trip\\'s own shops step')\n")  # the same name as a repo step: the trip's wins
        r = self.resync(['own-pull', 'shops'], '--write')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('── own-pull', r.stdout)  # in the run log like any step
        self.assertIn('own step ran', r.stdout)
        self.assertIn("the trip's own shops step", r.stdout)
        got = load(self.trip, 'own.json')
        self.assertEqual((got['argv'], os.path.realpath(got['trip']), got['fresh']), (['--write'], os.path.realpath(self.trip), '0'))
        self.assertTrue(got['tz'])

    def test_a_failing_trip_step_stops_the_run(self):
        self.step('broken', "import sys\nprint('half way')\nsys.exit('the source answered 503')\n")
        self.step('after', "print('should not run')\n")
        r = self.resync(['broken', 'after'])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('broken failed', r.stderr)
        self.assertNotIn('should not run', r.stdout)

    def test_a_step_name_is_a_plain_word(self):
        r = self.resync(['../../etc/x'])
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('lower-case letters', r.stderr)


if __name__ == '__main__': unittest.main()
