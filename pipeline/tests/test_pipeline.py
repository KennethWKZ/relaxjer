import json, os, unittest
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

    def test_distance(self):
        self.assertAlmostEqual(google.dist((25.0, 121.5), (25.01, 121.5)), 1112, delta=2)

class Steps(unittest.TestCase):
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
