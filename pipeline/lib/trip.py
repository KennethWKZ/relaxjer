"""The trip a pipeline step works on: its folder, its data, its settings, and dates in its time zone.

The trip folder comes from RELAXJER_TRIP (resync.py sets it from --trip). Outputs are written straight into the trip
folder (geo.json, drinks.json, ...); caches go to <trip>/.cache/ (never committed: trips/ is gitignored).
The trip's data.js is evaluated by node (trip-data.mjs), the way the page's build reads it, not parsed by regex.
Trip-specific search settings (chains, shops, weather spots, stations) live in <trip>/pipeline.json."""
import datetime, json, os, subprocess, sys
from zoneinfo import ZoneInfo

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/'
_dir = os.environ.get('RELAXJER_TRIP')
if not _dir: sys.exit('no trip: run through pipeline/resync.py --trip trips/<slug>, or set RELAXJER_TRIP')
TRIP_DIR = os.path.abspath(_dir) + '/'
S = TRIP_DIR  # the trip's data files
CACHE_DIR = os.path.abspath(os.environ.get('RELAXJER_CACHE_DIR') or TRIP_DIR + '.cache') + '/'  # tests point this elsewhere
os.makedirs(CACHE_DIR, mode=0o700, exist_ok=True)

def _load():
    r = subprocess.run(['node', REPO + 'pipeline/trip-data.mjs', TRIP_DIR], capture_output=True, text=True)
    if r.returncode: sys.exit('could not read the trip data:\n' + r.stderr[-800:])
    return json.loads(r.stdout)

T = _load()
TRIP, DAYS, PLACES, FLIGHTS = T['TRIP'], T['DAYS'], T['PLACES'], T['FLIGHTS']
ROLES, HOTEL_OF = T['roles'], T['hotels']
HOTELS = list(dict.fromkeys(HOTEL_OF.values()))
CONFIG = json.load(open(S + 'pipeline.json')) if os.path.exists(S + 'pipeline.json') else {}
# the date written as "checked" on refreshed data; RELAXJER_TODAY pins it (tests, reruns)
TODAY = os.environ.get('RELAXJER_TODAY') or datetime.date.today().isoformat()
TZ = ZoneInfo(TRIP['tz'])
# each trip date's weekday, Monday = 0 (Google's opening hours are Mon…Sun)
WEEKDAY = {d['date']: datetime.date.fromisoformat(d['date']).weekday() for d in DAYS}
FLIGHT_DATE = next((d['date'] for d in DAYS if d['id'] == ROLES['flight']), None)

def utc_at(date, hh, mm=0):
    """a local time on a trip date, as Google wants it: '2027-03-15T02:00:00Z' for 10:00 in Taipei"""
    local = datetime.datetime.fromisoformat(f'{date}T{hh:02d}:{mm:02d}:00').replace(tzinfo=TZ)
    return local.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

def cfg(key, default):
    return CONFIG.get(key, default)
