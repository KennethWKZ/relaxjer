import json, os, unittest
from unittest import mock
from lib import trip, hours, google

class Trip(unittest.TestCase):
    def test_reads_the_trip_the_way_the_page_does(self):
        self.assertEqual(trip.DAYS[0]['date'], '2027-03-13')
        self.assertEqual(trip.ROLES, {'arrive': 'd1', 'leave': 'd6', 'flight': 'd7', 'free': 'd6'})
        self.assertEqual(trip.HOTELS, ['hotel'])
        self.assertEqual(len(trip.PLACES['hotel']['name']), 2)  # [zh, en], as the page reads it
        self.assertTrue(any(d.get('route') for d in trip.DAYS))  # day routes come from the data, not the engine

    def test_weekdays_and_flight_day(self):
        self.assertEqual(trip.WEEKDAY['2027-03-13'], 5)  # a Saturday
        self.assertEqual(trip.FLIGHT_DATE, '2027-03-19')

    def test_local_times_go_to_google_in_utc(self):
        self.assertEqual(trip.utc_at('2027-03-15', 10), '2027-03-15T02:00:00Z')  # 10:00 in Taipei
        self.assertEqual(trip.utc_at('2027-03-15', 9, 30), '2027-03-15T01:30:00Z')

    def test_a_leg_sets_off_at_its_own_time_or_a_plausible_one(self):
        self.assertEqual(trip.leg_time('2027-03-15', 1, 3, '18:00'), '2027-03-15T10:00:00Z')  # the leg's own 'HH:MM' wins
        self.assertEqual(trip.leg_time('2027-03-15', 0, 3), '2027-03-15T01:30:00Z')  # first leg 09:30
        self.assertEqual(trip.leg_time('2027-03-15', 1, 3), '2027-03-15T05:30:00Z')  # between 13:30
        self.assertEqual(trip.leg_time('2027-03-15', 2, 3), '2027-03-15T12:30:00Z')  # last leg 20:30

class Hours(unittest.TestCase):
    WEEK = ['星期一: 休息', '星期二: 11:00 – 20:00', '星期三: 11:00 – 20:00', '星期四: 11:00 – 20:00', '星期五: 11:00 – 20:00', '星期六: 10:00 – 14:00, 17:00 – 21:00', '星期日: 24 小時營業']

    def test_google_week_to_days(self):
        d = hours.parse_hours(self.WEEK)
        self.assertEqual(d, ['closed', '11:00–20:00', '11:00–20:00', '11:00–20:00', '11:00–20:00', '10:00–14:00,17:00–21:00', '24h'])
        self.assertIsNone(hours.parse_hours(self.WEEK[:6]))  # a missing day: no hours rather than wrong ones

    def test_days_to_text(self):
        zh, en = hours.fmt_hours(hours.parse_hours(self.WEEK))
        self.assertEqual(en, 'Tue–Fri 11:00–20:00; Sat 10:00–14:00, 17:00–21:00; Sun 24 h; closed Mon')
        self.assertIn('周一休', zh)

    def test_closed_trip_days_skip_the_flight_only_day(self):
        mondays_off = ['closed', 'x', 'x', 'x', 'x', 'x', 'x']
        self.assertEqual(hours.closed_on_trip(mondays_off), ['2027-03-15'])
        fridays_off = ['x', 'x', 'x', 'x', 'closed', 'x', 'x']  # 19 Mar is the flight-only day
        self.assertEqual(hours.closed_on_trip(fridays_off), [])

    def test_addresses(self):
        self.assertEqual(hours.clean_addr('103台灣臺北市大同區光能里民生西路425號'), '臺北市大同區民生西路425號')
        self.assertEqual(hours.merge_addr('臺北市大同區民生西路425號（2樓）', '103台灣臺北市大同區民生西路425號'), '臺北市大同區民生西路425號（2樓）')

class Google(unittest.TestCase):
    def test_offline_refuses_a_call_it_has_not_seen(self):
        with self.assertRaises(RuntimeError): google.details('ChIJnotcached')

    def test_cached_answers_come_back_and_saving_merges(self):
        k = 'det|null|https://places.googleapis.com/v1/places/ChIJcached?languageCode=zh-TW|' + google.DET
        google.CACHE[k] = {'id': 'ChIJcached', 'displayName': {'text': '示范'}}
        self.assertEqual(google.details('ChIJcached')['displayName']['text'], '示范')
        json.dump({'other|step': {'x': 1}}, open(google.CF, 'w'))
        google.save()
        saved = json.load(open(google.CF))
        self.assertIn('other|step', saved); self.assertIn(k, saved)

    URL = 'https://places.googleapis.com/v1/places/{}?languageCode=zh-TW'

    def online(self, asked, **patch):
        """Google faked: every call answers with the place id it asked for, and is noted in `asked`"""
        class Answer:
            def __init__(self, url): self.url = url
            def read(self): return json.dumps({'id': self.url.split('/')[-1].split('?')[0]}).encode()
        def urlopen(req, timeout): asked.append(req.full_url); return Answer(req.full_url)
        return mock.patch.multiple(google, OFFLINE=False, key=lambda: 'k', ASKED=[0], **patch), \
            mock.patch.object(google.urllib.request, 'urlopen', urlopen)

    def test_a_call_that_failed_is_asked_again_and_a_place_that_is_gone_is_not(self):
        busy, gone = (f'det|null|{self.URL.format(p)}|{google.DET}' for p in ('ChIJbusy', 'ChIJgone'))
        google.CACHE[busy] = {'_err': 429, '_msg': 'quota'}  # a run the quota stopped
        google.CACHE[gone] = {'_err': 404, '_msg': 'not found'}  # a place Google no longer has: pins.py re-pins it
        asked = []
        a, b = self.online(asked)
        with a, b:
            self.assertEqual(google.details('ChIJbusy'), {'id': 'ChIJbusy'})
            self.assertEqual(google.details('ChIJgone')['_err'], 404)
        self.assertEqual(asked, [self.URL.format('ChIJbusy')])
        self.assertEqual(google.details('ChIJbusy'), {'id': 'ChIJbusy'})  # and the answer is kept

    def test_a_step_stops_after_its_new_calls_unless_the_planner_said_yes(self):
        asked = []
        a, b = self.online(asked, MAX_NEW=2, PAID=False)
        with a, b:
            google.details('ChIJnew1'); google.details('ChIJnew2')
            with self.assertRaises(google.TooMany) as stop: google.details('ChIJnew3')
            self.assertIn('--yes', str(stop.exception.code))
            self.assertEqual(google.details('ChIJnew1'), {'id': 'ChIJnew1'})  # answers it has still come from the cache
        self.assertEqual(len(asked), 2)
        a, b = self.online(asked, MAX_NEW=2, PAID=True)
        with a, b: google.details('ChIJnew3')
        self.assertEqual(len(asked), 3)

    def test_the_estimate_prices_each_call_by_the_dearest_field_it_asks_for(self):
        k = lambda url, mask: f'x|null|{url}|{mask}'
        text, near = 'https://places.googleapis.com/v1/places:searchText', 'https://places.googleapis.com/v1/places:searchNearby'
        calls = [
            k(text, 'places.id'),  # ids only: free
            k(text, 'places.' + google.DET.replace(',', ',places.')),  # rating, hours: Text Search Enterprise
            k(near, 'places.id,places.displayName,places.location'),  # Nearby Search Pro
            k(self.URL.format('ChIJx'), 'id,restroom'),  # Place Details Enterprise + Atmosphere
            k('https://routes.googleapis.com/directions/v2:computeRoutes', 'routes.duration'),  # Compute Routes Essentials
        ]
        n, usd = google.estimate(calls)
        self.assertEqual(n, 5)
        self.assertAlmostEqual(usd, (0 + 35 + 32 + 25 + 5) / 1000)

    def test_a_drive_with_traffic_asks_for_the_planned_hour_and_bills_as_pro(self):
        seen = []
        fake = lambda tag, url, body=None, mask='', method='POST', fresh=False: seen.append((url, body, mask)) or {}
        with mock.patch.object(google, 'call', fake):
            google.route((25.0, 121.5), (25.1, 121.6), 'DRIVE', '2027-03-15T10:00:00Z', 'PESSIMISTIC')
            google.route((25.0, 121.5), (25.1, 121.6), 'DRIVE', '2027-03-15T10:00:00Z')
        (url, traffic, mask), (_, plain, _) = seen
        self.assertEqual((traffic['routingPreference'], traffic['trafficModel'], traffic['departureTime']), ('TRAFFIC_AWARE_OPTIMAL', 'PESSIMISTIC', '2027-03-15T10:00:00Z'))
        self.assertNotIn('departureTime', plain)  # without traffic the request, and the cache key of every past answer, stay as they were
        key = lambda body: 'route|' + json.dumps(body, sort_keys=True, ensure_ascii=False) + '|' + url + '|' + mask
        self.assertAlmostEqual(google.cost(key(traffic)), 10 / 1000)  # Compute Routes Pro
        self.assertAlmostEqual(google.cost(key(plain)), 5 / 1000)  # Compute Routes Essentials

    def test_fresh_drives_asks_again_only_a_drive_with_traffic_once_and_counts_what_it_cost(self):
        a_, b_, when = (25.031, 121.561), (25.041, 121.571), '2027-03-15T10:00:00Z'
        asked = []
        a, b = self.online(asked)
        with a, b:  # an earlier run: both answers are in the cache
            google.route(a_, b_, 'DRIVE', when, 'BEST_GUESS'); google.route(a_, b_, 'DRIVE', when)
        self.assertEqual(len(asked), 2)
        asked.clear()
        a, b = self.online(asked, FRESH_DRIVES=True, NEW=[0], NEW_USD=[0.0], ASKED_AGAIN=set())
        with a, b:
            google.route(a_, b_, 'DRIVE', when, 'BEST_GUESS')  # a drive with traffic: asked again
            google.route(a_, b_, 'DRIVE', when, 'BEST_GUESS')  # the same drive later in the run: the new answer, no second call
            google.route(a_, b_, 'DRIVE', when)  # no traffic asked: stays cached
            self.assertEqual(len(asked), 1)
            self.assertEqual(google.NEW[0], 1)
            self.assertAlmostEqual(google.NEW_USD[0], 10 / 1000)  # Compute Routes Pro

    def test_a_place_with_no_google_id_is_searched_by_its_maps_name(self):
        import contextlib, io, runpy, sys
        asked = []
        def text(q, bias=None, **kw): asked.append(q); return {'places': [{'id': 'ChIJ' + q, 'primaryType': 'tourist_attraction'}]}
        def details(pid, lang=None): return {'id': pid, 'location': {'latitude': 25.0, 'longitude': 121.5}, 'displayName': {'text': pid}}
        out = io.StringIO()
        with mock.patch.object(google, 'text', text), mock.patch.object(google, 'details', details), \
                mock.patch.object(sys, 'argv', ['pins.py']), contextlib.redirect_stdout(out):
            runpy.run_path(os.path.join(trip.REPO, 'pipeline', 'steps', 'pins.py'), run_name='__main__')
        self.assertIn(trip.PLACES['t101']['maps'], asked)  # the demo pins nothing by hand: every place is searched once
        self.assertEqual(len(asked), len(set(asked)))
        self.assertIn('t101: place id None', out.getvalue())

class Resync(unittest.TestCase):
    def run_resync(self, *flags, cache=None):
        import subprocess, sys, tempfile
        d = tempfile.mkdtemp(prefix='relaxjer-resync-test-')
        if cache is not None: json.dump(cache, open(os.path.join(d, 'google-cache.json'), 'w'))
        env = dict(os.environ, RELAXJER_CACHE_DIR=d)
        return subprocess.run([sys.executable, os.path.join(trip.REPO, 'pipeline', 'resync.py'), '--trip', trip.TRIP_DIR, *flags,
                               '--no-weather', '--no-links', '--no-build'], env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True)

    def test_fresh_says_what_it_costs_and_stops_without_a_yes(self):
        k = 'txt|{}|https://places.googleapis.com/v1/places:searchText|places.rating'
        r = self.run_resync('--fresh', cache={k: {'places': []}})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('all 1 calls in the cache: about US$0', r.stdout)
        self.assertIn('stopped before asking Google anything', r.stderr)
        self.assertNotIn('── Google', r.stdout)  # no step ran

    def test_a_trip_with_no_cache_yet_asks_first_too(self):
        r = self.run_resync()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('no Google cache yet', r.stdout)
        self.assertIn('stopped before asking Google anything', r.stderr)

    def test_distance(self):
        self.assertAlmostEqual(google.dist((25.0, 121.5), (25.01, 121.5)), 1112, delta=2)

class Steps(unittest.TestCase):
    def test_each_google_step_reports_its_new_calls_and_resync_reads_them(self):
        import subprocess, sys
        env = dict(os.environ, RESYNC_REPORT='1')
        code = 'from lib import google; google.NEW[0] = 2; google.NEW_USD[0] = 0.02'
        r = subprocess.run([sys.executable, '-c', code], cwd=os.path.join(trip.REPO, 'pipeline'), env=env, capture_output=True, text=True)
        self.assertIn(f'{google.REPORT} 2 0.0200', r.stderr)  # printed as the step exits
        r = subprocess.run([sys.executable, '-c', code], cwd=os.path.join(trip.REPO, 'pipeline'), capture_output=True, text=True)
        self.assertNotIn(google.REPORT, r.stderr)  # only inside a resync run
        spec = os.path.join(trip.REPO, 'pipeline', 'resync.py')
        src = open(spec).read().split("if '--no-google' not in args:")[0].replace("if '--trip' not in argv: sys.exit(__doc__)", '')
        ns = {'__file__': spec}; sys.argv = ['resync.py', '--trip', trip.TRIP_DIR]; exec(src, ns)
        self.assertEqual(ns['REPORT'], google.REPORT)
        self.assertEqual(ns['new_calls'](f'a warning\n{google.REPORT} 18 0.1800\n'), ((18, 0.18), 'a warning'))
        self.assertEqual(ns['new_calls']('')[0], None)  # a step that never asked Google

    def test_every_step_resolves_for_a_taiwan_trip(self):
        import importlib.util, sys
        spec = importlib.util.spec_from_file_location('resync_mod', os.path.join(trip.REPO, 'pipeline', 'resync.py'))
        src = open(spec.origin).read().split("if '--no-google' not in args:")[0].replace("if '--trip' not in argv: sys.exit(__doc__)", '')
        ns = {'__file__': spec.origin}; sys.argv = ['resync.py', '--trip', trip.TRIP_DIR]; exec(src, ns)
        where = {n: os.path.relpath(ns['script'](n), trip.REPO) for n in ns['DEFAULT_STEPS']}
        self.assertEqual(where['drinks'], 'destinations/tw/pipeline/drinks.py')
        self.assertEqual(where['metro'], 'destinations/tw/regions/taipei/pipeline/metro.py')
        self.assertEqual(where['fetch'], 'pipeline/steps/fetch.py')

if __name__ == '__main__': unittest.main()
