#!/usr/bin/env python3
"""Resync a trip page with the latest outside data, then rebuild it.

    uv run --project pipeline pipeline/resync.py --trip trips/<slug>            # dry run: fetch, print what would change
    uv run --project pipeline pipeline/resync.py --trip trips/<slug> --write    # apply to the trip's files, rebuild
    options: --reuse (answer from the Google cache, new calls only for misses)  --no-google  --no-weather  --no-links
             --no-build

Steps (the trip's pipeline.json "steps"; each is found in the trip's region pack, then its country pack, then here):
  Google first (the user's own key, ~/.config/relaxjer/google-places.key; OpenStreetMap only as backup):
    pins     planned-place pins + place ids from Google (old pins kept as backup)
    fetch    place details, hours, ratings, the trip's chains, nearest metro + walking time, each day's route legs
    apply    write them into geo.json, extra.json, wish-a/b.json
    drinks   drink stands + sit-down rest spots near every stop (destinations/tw)
    toilets  public ones, which places have their own, shops that lend theirs
    metro    the city's metro network for the offline hint (destinations/tw/regions/taipei)
    transit  bike-share and bus stops (destinations/tw/regions/taipei)
    shops    the trip's shopping list for the free day
  Weather: Open-Meteo daily forecast (free, no key) for pipeline.json "forecast_spots" on trip days within 16 days.
  Links: every website link in the data is fetched; broken ones are listed (not changed).
After --write: run the tests, check the page, then republish (docs/roadmap.md, "The live Taipei page")."""
import json, os, re, subprocess, sys, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
argv = sys.argv[1:]
if '--trip' not in argv: sys.exit(__doc__)
os.environ['RELAXJER_TRIP'] = os.path.abspath(argv[argv.index('--trip') + 1])
sys.path.insert(0, HERE)
from lib.trip import S, TRIP, DAYS, cfg
args = set(argv); WRITE = '--write' in args; PY = sys.executable
def step(t): print(f'\n── {t} ' + '─' * max(4, 60 - len(t)))
DEFAULT_STEPS = ['pins', 'fetch', 'apply', 'drinks', 'toilets', 'metro', 'transit', 'shops']
TITLE = {'pins': 'Google: planned-place pins + ids', 'fetch': 'Google: fetch', 'apply': 'Google: apply', 'drinks': 'Google: drink shops near every stop',
         'toilets': 'Google: toilets (public, own restroom, borrowable)', 'metro': 'Metro network (Google stations + ride times; stop order from OpenStreetMap)',
         'transit': 'Transport pins: bike share + bus stops', 'shops': 'Shopping places for the free day (Google)'}
TAIL = {'pins': 6, 'drinks': 4, 'toilets': 4, 'metro': 4, 'transit': 3, 'shops': 3}
def script(name):
    cc, region = TRIP.get('destination'), TRIP.get('region')
    for d in ([f'destinations/{cc}/regions/{region}/pipeline'] if cc and region else []) + ([f'destinations/{cc}/pipeline'] if cc else []) + ['pipeline/steps']:
        p = os.path.join(REPO, d, name + '.py')
        if os.path.exists(p): return p
    sys.exit(f'no pipeline step "{name}" for this trip (looked in its region and country packs, then pipeline/steps)')
if '--no-google' not in args:
    env = dict(os.environ, RESYNC_REUSE='1' if '--reuse' in args else '0')
    for name in cfg('steps', DEFAULT_STEPS):
        dry = '' if WRITE or name == 'fetch' else ' (dry run)'
        step(TITLE.get(name, name) + (' (cached)' if name == 'fetch' and '--reuse' in args else ' (fresh)' if name == 'fetch' else dry))
        r = subprocess.run([PY, script(name)] + (['--write'] if WRITE and name != 'fetch' else []), env=env, capture_output=True, text=True)
        out = r.stdout.strip().splitlines()
        if name == 'apply': print('\n'.join(out[:3])); print(f'  … {max(0, len(out) - 6)} more change lines …' if len(out) > 6 else ''); print('\n'.join(out[-3:]))
        elif name == 'fetch': print(r.stdout.strip() or r.stderr[-800:])
        else: print('\n'.join(out[-TAIL.get(name, 4):]) or r.stderr[-800:])
        if r.returncode: print(r.stderr[-1200:]); sys.exit(f'{name} failed')
if '--no-weather' not in args:
    step('Weather (Open-Meteo)')
    SPOTS = cfg('forecast_spots', {})
    DATES = [d['date'] for d in DAYS]
    fc = {'checked': None, 'days': {}}; d = {'time': ['']}
    for k, (la, ln) in SPOTS.items():
        u = f'https://api.open-meteo.com/v1/forecast?latitude={la}&longitude={ln}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code&timezone={urllib.parse.quote(TRIP["tz"], safe="")}&forecast_days=16'
        for attempt in range(4):  # the free API answers 503 now and then
            try: d = json.loads(urllib.request.urlopen(u, timeout=30).read())['daily']; break
            except (urllib.error.URLError, TimeoutError) as err:
                if attempt == 3: sys.exit(f'weather: Open-Meteo failed ({err}); rerun, or add --no-weather')
                import time; time.sleep(5 * (attempt + 1))
        for i, day in enumerate(d['time']):
            if day in DATES: fc['days'].setdefault(day, {})[k] = {'tmax': round(d['temperature_2m_max'][i]), 'tmin': round(d['temperature_2m_min'][i]), 'rain': d['precipitation_probability_max'][i], 'mm': d['precipitation_sum'][i], 'code': d['weather_code'][i]}
        fc['checked'] = d['time'][0]
    print(f"forecast reaches {d['time'][-1]}; trip days covered: {sorted(fc['days']) or 'none yet (forecasts cover 16 days)'}")
    if WRITE and SPOTS: json.dump(fc, open(S + 'forecast.json', 'w'), ensure_ascii=False, indent=1)
if '--no-links' not in args:
    step('Official links')
    urls = set(re.findall(r"https?://[^\s'\"<>）)]+", open(S + 'data.js').read()))
    for fn in ['extra.json', 'wish-a.json', 'wish-b.json']:
        if os.path.exists(S + fn): urls |= set(re.findall(r'"(?:site|url|source_url)": "(https?://[^"]+)"', open(S + fn).read()))
    urls = {u.rstrip('.,;') for u in urls if 'google.com/maps' not in u and 'googleapis' not in u}
    import ssl
    LAX = ssl.create_default_context(); LAX.check_hostname = False; LAX.verify_mode = ssl.CERT_NONE  # reachability only: some government sites use a CA Python lacks
    def check(u):
        try:
            q = urllib.parse.quote(u, safe=':/?&=%#+~@!$,;')
            req = urllib.request.Request(q, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15', 'Accept-Language': 'zh-TW,en'})
            code = urllib.request.urlopen(req, timeout=25, context=LAX).status
        except urllib.error.HTTPError as e: code = e.code
        except Exception as e: code = type(e).__name__
        return u, code
    with ThreadPoolExecutor(8) as ex: res = list(ex.map(check, sorted(urls)))
    bad = [(u, c) for u, c in res if c not in (200, 301, 302, 403, 405, 406, 429)]  # 403/405/406/429: bot blocks, fine in a browser
    print(f'{len(res)} links checked, {len(bad)} look broken')
    for u, c in bad: print(f'  {c}  {u}')
if WRITE and '--no-build' not in args:
    step('Build')
    keys = os.path.expanduser('~/.config/relaxjer/google.json')
    r = subprocess.run(['node', 'engine/build.mjs', '--trip', S, '--keys', keys if os.path.exists(keys) else 'none'], cwd=REPO, capture_output=True, text=True)
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-400:])
    print('\nNext: run the tests (pnpm test:all, pnpm parity), check the page, then republish to the same link.')
