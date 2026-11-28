"""Rest stops along each long drive, for the page's 沿途休息 / Stops on the way fold (ADR-20261128-drive-stops). Reference
only: the page lists them, never plans one or moves a time. Run via pipeline/resync.py, after apply (it reads the drive
times apply wrote into geo.json); a trip opts in by adding "drive-stops" to pipeline.json "steps".
  1. The long drives: each day's driving leg whose Google time (geo.json legs, typical traffic) is pipeline.json
     drive_stops.min_drive minutes or more (default 90). A decide option's own route isn't searched.
  2. Its road: one Compute Routes call for the route line (high quality, so a service area's side of the road shows).
  3. Along it: one Places Text Search per search in the destination pack's driveStops (service areas, parking areas,
     roadside stations, petrol stations; convenience stores only while fewer were found), with
     searchAlongRouteParameters, in the trip's Google language and region. About 5 calls a drive, all cached through
     lib/google.py, so a rerun pays nothing.
  4. lib/drive_stops.py keeps the open ones near the road, a service area's twin on the side the car keeps to, each
     facility once and petrol stations spaced out, and writes how far in (km, and minutes at Google's pace), its kind,
     and its hours on the drive's day (24 h, closed, or the times).
Writes drive-stops.json with --write; otherwise prints a summary. pipeline.json "drive_stops": {"min_drive": 90,
"off_m": 800, "fuel_gap_km": 15, "search": [...]} overrides the defaults and the pack's searches."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.trip import S, DAYS, PACK, TODAY, WEEKDAY, cfg
from lib import google as F
from lib import drive_stops as D
from lib.hours import parse_hours

CONF = {**(PACK.get('driveStops') or {}), **cfg('drive_stops', {})}
SEARCH = CONF.get('search') or []
MIN_DRIVE = float(CONF.get('min_drive', 90))
if not SEARCH: sys.exit("drive-stops: nothing to search for: the destination pack has no driveStops and pipeline.json no drive_stops.search")
geo = json.load(open(S + 'geo.json')) if os.path.exists(S + 'geo.json') else {}
LEGS, PLACES = geo.get('legs') or {}, geo.get('places') or {}


def road(a, b):
    """the drive's route line, encoded, from Compute Routes (cached)"""
    r = F.call('stops-route', D.ROUTE_URL, D.route_body(a, b, F.LANG), D.ROUTE_MASK)
    return ((r.get('routes') or [{}])[0].get('polyline') or {}).get('encodedPolyline')


def along(poly, s):
    """one search's places along the route line (cached)"""
    return F.call('stops-along', D.ALONG_URL, D.along_body(poly, s, F.LANG, F.REGION), D.ALONG_MASK).get('places') or []


def cand(p, asked, weekday):
    days = parse_hours((p.get('regularOpeningHours') or {}).get('weekdayDescriptions'))
    loc = p.get('location') or {}
    name = (p.get('displayName') or {}).get('text', '')
    return {'id': p.get('id'), 'name': name, 'lat': loc.get('latitude'), 'lng': loc.get('longitude'),
            'kind': D.kind_of(name, p.get('types'), asked, CONF.get('names')), 'status': p.get('businessStatus'),
            'hours': D.day_hours(days, weekday), 'rating': p.get('rating'), 'reviews': p.get('userRatingCount')}


out, report = {}, []
for d in DAYS:
    for i, leg in enumerate(d.get('route') or []):
        a, b, mode = leg[:3]
        k = f"{d['id']}:{i}"
        t = LEGS.get(k) or {}
        # only the drive this leg was timed for: a reordered day keeps no stops for the wrong road
        if mode != 'driving' or (t.get('from'), t.get('to')) != (a, b) or (t.get('min') or 0) < MIN_DRIVE: continue
        if a not in PLACES or b not in PLACES: continue
        poly = road(PLACES[a], PLACES[b])
        if not poly: report.append(f'  {k} {a}→{b}: Google gave no route line'); continue
        pts, found = D.decode(poly), []
        keep = lambda: D.pick(found, pts, t['min'], CONF.get('dir'), CONF.get('side', 'left'), float(CONF.get('off_m', 800)), float(CONF.get('fuel_gap_km', 15)))
        for s in SEARCH:
            if s.get('fewer') and len(keep()) >= s['fewer']: continue  # a fallback (convenience stores): only when few were found
            found += [cand(p, s['kind'], WEEKDAY.get(d['date'])) for p in along(poly, s)]
        stops = keep()
        for s in stops:
            if 'rating' in s: s['rating_checked'] = TODAY
        out[k] = {'from': a, 'to': b, 'mode': 'driving', 'min': t['min'], 'km': t.get('km'), 'stops': stops}
        where = ', '.join('%s %s km' % (s['kind'], s['km']) for s in stops)
        report.append(f"  {k} {a}→{b} {t['min']} min: {len(stops)} stops ({where})")
F.save()
print(f"drive-stops: {len(out)} long drive{'' if len(out) == 1 else 's'} (≥ {MIN_DRIVE:g} min)")
for line in report: print(line)
if '--write' in sys.argv:
    os.umask(0o077)
    json.dump({'checked': TODAY, 'src': 'Google Maps', 'legs': dict(sorted(out.items()))}, open(S + 'drive-stops.json', 'w'), ensure_ascii=False, indent=1)
