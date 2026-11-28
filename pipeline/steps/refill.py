"""Free water refill points near the trip's places, for the page's 装水 / Refill parts (ADR-20261128-water-refill). Free:
no Google call. Run via pipeline/resync.py (opt in: add "refill" to pipeline.json "steps", after any step that writes a
refill-*.json).
  1. OpenStreetMap (ODbL; the page credits it): drinking water, taps that give it, and shops that fill a bottle, one
     small Overpass query per group of places. Answers are kept in <trip>/.cache/refill-osm.json for 30 days, so a rerun
     asks nothing; --fresh asks again. A busy server is tried once more on a mirror, then the area keeps its last data.
  2. The trip's own refill-*.json files (a private source the planner pulls with a step of their own, kept in the
     gitignored trip folder), in the same spot shape (lib/refill.py).
  3. One list: the same spot from two sources counted once, only spots within pipeline.json refill.radius (default
     1000 m) of a place, sorted.
Writes refill.json with --write; otherwise prints a summary. pipeline.json "refill": {"osm": false} skips step 1;
{"overpass": [urls]} sets the servers asked, in order."""
import datetime, glob, json, os, sys, time, urllib.error, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.trip import S, TODAY, CACHE_DIR, cfg
from lib import refill as R

CONF = cfg('refill', {})
SERVERS = CONF.get('overpass') or ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
RADIUS = float(CONF.get('radius', 1000))
OFFLINE = os.environ.get('RELAXJER_OFFLINE') == '1'
FRESH = os.environ.get('RESYNC_FRESH') == '1' and not OFFLINE
KEEP_DAYS = 30
CF = CACHE_DIR + 'refill-osm.json'
UA = 'RelaxJer-pipeline/1 (trip page refresh; refill step)'

geo = json.load(open(S + 'geo.json'))['places'] if os.path.exists(S + 'geo.json') else {}
places = [(g['lat'], g['lng']) for _, g in sorted(geo.items()) if g.get('lat') is not None and g.get('lng') is not None]
if not places: sys.exit('refill: the trip has no pinned places yet (run pins and apply first)')
cache = json.load(open(CF)) if os.path.exists(CF) else {}


def ask(q):
    """one Overpass answer's elements, from the first server that gives one; None if none did"""
    for url in SERVERS:
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': UA})
            return json.loads(urllib.request.urlopen(req, timeout=40).read())['elements']
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as e:
            print(f'  {urllib.parse.urlsplit(url).hostname}: {getattr(e, "code", None) or type(e).__name__}; trying the next server' if url != SERVERS[-1] else
                  f'  {urllib.parse.urlsplit(url).hostname}: {getattr(e, "code", None) or type(e).__name__}')
        time.sleep(1)
    return None


osm, notes, asked = {}, [], 0  # osm by id: areas can overlap, and one element is one spot
if CONF.get('osm', True):
    for box in R.boxes(places):
        k = ','.join(str(x) for x in box)
        hit = cache.get(k)
        old = not hit or (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(hit['fetched'])).days > KEEP_DAYS
        if (old or FRESH) and not OFFLINE:
            if asked: time.sleep(1)  # one query at a time, politely
            asked += 1
            got = ask(R.query(box))
            if got is not None: hit = cache[k] = {'fetched': TODAY, 'elements': got}
            elif hit: notes.append(f'area {k}: OpenStreetMap busy, kept the data from {hit["fetched"]}')
            else: notes.append(f'area {k}: OpenStreetMap busy and nothing kept yet; run again later')
        elif not hit: notes.append(f'area {k}: offline, nothing kept yet')
        if hit: osm.update((s['id'], s) for s in map(R.from_osm, hit['elements']) if s)
    if asked:
        json.dump(cache, open(CF, 'w'), ensure_ascii=False, sort_keys=True)

local, problems = [], []
for f in sorted(glob.glob(S + 'refill-*.json')):
    name = os.path.basename(f)
    try: data = json.load(open(f))
    except ValueError as e: problems.append(f'{name}: not valid JSON ({e})'); continue
    got, bad = R.read_local(name, data)
    local += got; problems += bad
    print(f'{name}: {len(got)} spots' + (f', {len(bad)} left out' if bad else ''))

osm = [osm[k] for k in sorted(osm)]
spots, merged = R.merge(osm + local)
near = R.keep_near(spots, places, RADIUS)
by = {k: sum(1 for s in near if s['kind'] == k) for k in R.KINDS}
print(f'OpenStreetMap: {len(osm)} spots in {len(R.boxes(places)) if CONF.get("osm", True) else 0} areas ({asked} asked now, the rest from the cache)')
for n in notes + problems[:12]: print('  ' + n)
if len(problems) > 12: print(f'  … {len(problems) - 12} more left out')
print(f'refill: {len(near)} spots within {RADIUS:.0f} m of a place (taps {by["tap"]}, shops {by["shop"]}, indoor {by["shelter"]}); '
      f'{merged} listed twice, counted once; {len(spots) - len(near)} farther away left out')
out = {'checked': TODAY, 'spots': near}
if '--write' in sys.argv: json.dump(out, open(S + 'refill.json', 'w'), ensure_ascii=False, indent=1); print('wrote refill.json')
