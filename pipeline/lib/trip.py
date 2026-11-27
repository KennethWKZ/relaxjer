"""The trip a pipeline step works on: its folder, its data, its settings, and dates in its time zone.

The trip folder comes from RELAXJER_TRIP (resync.py sets it from --trip). Outputs are written straight into the trip
folder (geo.json, drinks.json, ...); caches go to <trip>/.cache/ (never committed: trips/ is gitignored).
The trip's data.js is evaluated by node (trip-data.mjs), the way the page's build reads it, not parsed by regex.
Trip-specific search settings (chains, shops, weather spots, stations) live in <trip>/pipeline.json."""
import datetime, json, os, re, subprocess, sys
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

def leg_time(date, i, n, at=None):
    """when a day's route leg i (of n) sets off, in UTC: the 'HH:MM' given (the leg's own, or for a drive the schedule's,
    leg_departures), else a plausible hour (09:30 first, 20:30 last, 13:30 between)"""
    if at: hh, mm = map(int, at.split(':'))
    else: hh, mm = (9 if i == 0 else 20 if i == n - 1 else 13), 30
    return utc_at(date, hh, mm)

def leg_parts(leg):
    """a route leg [from, to, mode, 'HH:MM'?, minutes?] as (from, to, mode, its own time or None, the trip's own minutes
    or None): the minutes are the planner's, for a leg Google can't time (a train in Japan)"""
    a, b, m, *rest = leg
    at = next((x for x in rest if isinstance(x, str)), None)
    own = next((x for x in rest if isinstance(x, (int, float)) and not isinstance(x, bool)), None)
    return a, b, m, at, own

def stop_clock(t):
    """a schedule stop's time as 'HH:MM': the end of a range ('~14:30–15:45' → '15:45'), or None for a label with no clock"""
    if isinstance(t, list): t = t[0] if t else ''
    m = re.findall(r'(\d{1,2}):(\d{2})', str(t or ''))
    return f'{int(m[-1][0]):02d}:{m[-1][1]}' if m else None

def leg_departures(day):
    """when each of a day's route legs sets off, read from its schedule: the time of the stop just before the first later
    stop at the leg's destination (a 'Drive to …' row, or the visit it leaves from; a range's end), or None when the
    schedule doesn't reach the destination or that stop has no clock time"""
    sched, out, cur = day.get('schedule') or [], [], -1
    for a, b, *_ in day.get('route') or []:
        k = next((j for j in range(cur + 1, len(sched)) if sched[j].get('place') == b), None)
        out.append(stop_clock(sched[k - 1].get('t')) if k else None)
        if k is not None: cur = k
    return out

def leg_ends(legs_def, key):
    """(from, to, mode) of the route leg a stored leg 'd3:1' was asked for, from the day's route at the refresh"""
    day, i = key.split(':')
    a, b, m = legs_def[day][int(i)][:3]
    return a, b, m
def missing_pins(legs_def, places):
    """the route legs that join a place with no pin in geo.json, as {'d4:0': ['orixSap'], ...}: Google can't be asked for
    a leg with no position at one end. A place gets its first pin by hand, a rough { lat, lng } (trip-customize), and
    pins.py then moves it onto Google's"""
    out = {}
    for day, ls in legs_def.items():
        for i, l in enumerate(ls):
            gone = [p for p in dict.fromkeys(l[:2]) if p not in places]
            if gone: out[f'{day}:{i}'] = gone
    return out

def cfg(key, default):
    return CONFIG.get(key, default)
