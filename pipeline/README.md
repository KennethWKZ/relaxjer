# pipeline/

Refreshes a trip's data from outside sources, then rebuilds its page:

```sh
pnpm resync --trip trips/<slug>            # dry run: print what would change, writing no trip file (Google is still asked)
pnpm resync --trip trips/<slug> --write    # write the trip's files, rebuild the page
#   --fresh (ask Google again for everything)  --fresh-drives (ask again only the drives still ahead, for newer traffic)
#   --yes (the planner agrees to pay)  --no-google  --no-weather  --no-links  --no-build
```

The rebuild after `--write` uses `~/.config/relaxjer/google.json` and the trip's group-sync file
(`~/.config/relaxjer/sync/<slug>.json`) when they exist, so a trip keeps its Google map and its sync.

Google bills every call, so a run answers from the trip's cache, asks only what's new or what failed, and stops a step
after 200 new calls without `--yes`. `--fresh`, or a trip with no cache yet, prints what it would cost (a week-long
trip: a few thousand calls, about US$130 at list price) and needs a yes
([ADR-20261001-resync-cost-guard](../memory-bank/standards/decisions/ADR-20261001-resync-cost-guard.md)). Never refresh
to test a key ([`guides/google-maps.md`](../guides/google-maps.md), step 5).

Every Google step prints `new Google calls: N` with their list price, and the run ends with the total, so a planner sees
what a refresh asked Google for. `--fresh-drives` asks again only each traffic-aware drive whose departure is still
ahead (two calls a drive, Compute Routes Pro), for newer traffic predictions in the trip's last week; everything else
comes from the cache, so it stays under the 200-call stop
([ADR-20261007-traffic-aware-drives](../memory-bank/standards/decisions/ADR-20261007-traffic-aware-drives.md)).
Staying under the stop means it never asks for a yes: its calls go out the moment it runs, dry run included, so the
planner agrees to its price first. Its answers are then in the cache, and a plain `--write` applies them for free.

Needs [uv](https://docs.astral.sh/uv/) (it installs Python 3.13 and the two dependencies, `opencc` and `pillow`) and
node. Google calls use **your own key** ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)): `~/.config/relaxjer/google-places.key` (mode 600), with Places API
(New) and Routes API on. It runs from your machine only and never goes into a page.

| Where                                        | What                                                                                                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resync.py`                                  | runs the trip's steps (`pipeline.json` "steps"), the weather forecast and the link check                                                                                                                                   |
| `steps/`                                     | generic steps: `pins`, `fetch`, `apply` (Google details, hours, ratings, nearest metro, route legs), `toilets`, `shops`; `refill` (free: OpenStreetMap and the trip's own files, no Google); `images` runs by hand (below) |
| `trips/<slug>/pipeline/`                     | the trip's own private steps ([below](#a-private-step-in-the-trip-folder)), gitignored with the trip                                                                                                                       |
| `destinations/<cc>/pipeline/`                | country steps: `tw/drinks.py` (tea-shop chains, Taiwan classics, sit-down spots)                                                                                                                                           |
| `destinations/<cc>/regions/<city>/pipeline/` | city steps: `taipei/metro.py` (the MRT / LRT network), `taipei/transit.py` (YouBike, bus stops)                                                                                                                            |
| `lib/`                                       | the trip (read through `trip-data.mjs`, the way the page's build reads it), Google calls + cache, opening hours                                                                                                            |
| `tests/`                                     | offline tests on the demo trip (`pnpm test:pipeline`)                                                                                                                                                                      |

A step is looked up in the trip's own `pipeline/` folder, then its region pack, then its country pack, then `steps/`. Without `"steps"`, a trip runs
Taiwan's list (`pins`, `fetch`, `apply`, `drinks`, `toilets`, `metro`, `transit`, `shops`), so a trip anywhere else names
its own. What a trip searches for (its
chains, shopping list, weather spots, which places are stations or districts) is in `trips/<slug>/pipeline.json`.
Caches go to `trips/<slug>/.cache/`, gitignored with the rest of the trip.

**Google's terms** limit how long Places content may be kept and shown. The cache and the trip files keep it; that is
your call for your own private trip page ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)). Don't publish a trip's data.

Moved from the first trip's repo on 2026-10-01. On the same inputs its output is byte-identical to the old scripts',
except where old bugs were fixed: two places the old regex skipped, the hotel's hand-checked Google id (it was
overwritten by the inn next door), and the drink list's order (it changed with Python's hash seed on every run).

## `pipeline.json`

What one trip searches for, in `trips/<slug>/pipeline.json` (written at `trip-intake`). Every key is optional. A
synthetic example:

```json
{
  "steps": ["pins", "fetch", "apply", "drinks", "toilets", "metro", "transit", "shops"],
  "google": { "language": "zh-TW", "region": "TW" },
  "area": [24.95, 121.45, 25.2, 121.65],
  "chains": [{ "id": "demo-dumplings", "queries": ["Demo Dumplings Taipei"], "must": ["Demo Dumplings"], "prefix": "示范小笼包", "prefix_en": "Demo Dumplings", "default_label": "Main" }],
  "pin_queries": { "hotel": "Sample Inn Zhongshan Taipei" },
  "stations": ["tpe1", "a1"],
  "no_hours": ["dihua"],
  "areas": ["dihua"],
  "skip_nearby": { "toilets": ["tpe1"], "drinks": ["tpe1"], "transit": ["tpe1"] },
  "shops": [["Demo Mart Zhongshan", "grocery", "示范：零食和伴手礼", "Demo: snacks and gifts", "yes"]],
  "forecast_spots": { "taipei": [25.05, 121.52], "beitou": [25.14, 121.5] }
}
```

| Key              | What it does                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `steps`          | the steps to run, in order (Taiwan's list when left out)                                                                                                                                             |
| `google`         | the language and region Google answers in (default `zh-TW`, `TW`)                                                                                                                                    |
| `area`           | `[south, west, north, east]`: where to look for every branch of a chain (chains need it)                                                                                                             |
| `chains`         | chains whose branches the page lists: `id` (a wishlist entry's id), `queries`, the names a branch `must` contain (a list), the `prefix` / `prefix_en` stripped from a branch's name, `default_label` |
| `pin_queries`    | `{ place key: Google search }`, used when a place has no Google id yet, the lookup fails, or the id is a car park, a building or an inn (a hand-checked id goes in `PLACES[k].gpid`)                 |
| `stations`       | place keys that are themselves a station or terminal (no "nearest station" for them)                                                                                                                 |
| `no_hours`       | place keys that are districts or streets: a building's hours say nothing about them                                                                                                                  |
| `areas`          | district and street place keys: drinks and rest spots are searched in a wider circle                                                                                                                 |
| `skip_nearby`    | `{ step: [place keys] }`: places that don't need that step's nearby search (an airport has its own toilets)                                                                                          |
| `shops`          | the shop box: `[search, kind, why zh, why en, tax refund]`, the refund `'yes'`, `'no'` or `'some'`, searched near the hotel; names come from Google                                                  |
| `forecast_spots` | `{ spot: [lat, lng] }` for the weather forecast; a day reads `DAYS[i].forecastSpot`, else `TRIP.forecastSpot`                                                                                        |
| `refill`         | the `refill` step: `radius` (metres from a place a spot may be, default 1000), `osm: false` (only the trip's own `refill-*.json`), `overpass` (the OpenStreetMap servers asked, in order)            |

The refresh's steps expect `geo.json`, `extra.json`, `wish-a.json` and `wish-b.json` in the trip folder; an empty
wishlist is `{ "items": [] }`. A food slot or a wishlist branch with `hours_lock: true` keeps its own hours instead of Google's (a pop-up inside a
building).

## Water refill (`refill`)

A free step, opt in by naming it in `steps` ([ADR-20261128-water-refill](../memory-bank/standards/decisions/ADR-20261128-water-refill.md)).
It asks OpenStreetMap (ODbL; the page credits "© OpenStreetMap contributors") for drinking water, taps that give it and
shops that fill a bottle, one small Overpass query per group of the trip's places, one at a time. Answers are kept in
`.cache/refill-osm.json` for 30 days, so a rerun asks nothing; `--fresh` asks again; a busy server is tried on a mirror,
then the area keeps its last answer and says so. It then merges every `refill-*.json` in the trip folder (a private
source, written by a step of the trip's own, below), counts a spot two sources list once, keeps the spots within
`refill.radius` of a place, and writes `refill.json` ([the spot shape](../memory-bank/standards/trip-format.md#water-refill-refilljson))
with `--write`. Which spots are near a stop, open then, or shut for winter is the page's to work out. Put it after the
step that writes a `refill-*.json`: `"steps": [..., "refill-<src>", "refill"]`.

## A private step in the trip folder

A source the public repo must not carry (one without a licence to share its data, or a planner's own list) is pulled by
a step of the trip's own: `trips/<slug>/pipeline/<name>.py`, gitignored with the rest of the trip, named in
`pipeline.json` `steps` like any other. The trip's folder is looked in first, so a trip's step of the same name as a repo
step replaces it for that trip. Step names are lower-case letters, digits, `-` and `_`.

- **Run the same way:** `python <step> [--write]` (`--write` only on a writing run), from the repo, in the run log under
  its name with its last lines. It reads the trip through `lib/` (`from lib.trip import S, TRIP, PLACES, CACHE_DIR, cfg`),
  writes into `S` (the trip folder) only with `--write`, and keeps its cache in `CACHE_DIR`.
- **Its environment:** the caller's, plus `RELAXJER_TRIP` (the trip folder), `RESYNC_FRESH` (`1` with `--fresh`),
  the cost guard's two flags (the planner's yes to pay, and fresh drives; read by `lib/google.py`), `RESYNC_REPORT=1`, and
  `PYTHONPATH` with `pipeline/`, so `from lib…` imports work from the trip folder.
- **A non-zero exit stops the run** with "<name> failed" and the step's last error lines; the steps after it don't run.
- A step that calls Google goes through `lib/google.py`'s `call()` like the repo's, so the cost guard and the cache hold.
- `--no-google` skips every step, a trip's own included.

## Photos and icons, by hand

- `RELAXJER_TRIP=trips/<slug> uv run --project pipeline pipeline/steps/images.py` writes 720 px copies of the
  trip's photos into `img/lite/`, which the build prefers. It needs `cwebp` (`brew install webp`).
- Photos are `img/<id>.webp` (and a square `img/<id>-sq.webp`), each listed in `img/credits.json` with its credit; the
  build drops a credit whose file is missing.
- Where they come from: Wikimedia Commons, through its API, licensed CC0, public domain, CC BY or CC BY-SA. Never
  Google, never a generated image, never a photo whose subject is a stranger's face. Prefer the season of the trip
  (snow for a winter trip). Crop to 960 × 640 and a 320 × 320 square. Each `credits.json` entry has `id`,
  `subject_en`, `subject_zh`, `commons_title`, `source_url`, `author`, `license`, `license_url`, `original_width` and
  `original_height`, copied from the file's own page. Check the file's title and description name the place you meant:
  look-alike landmarks are common. Then run `images.py` above, and list the ids in each day's `photos`.
- The home-screen icon is `img/icon/icon-192.png` and `icon-512.png` (`icon-32` and `icon-180` for browsers and
  iPhones). No step makes them yet: render the trip's brand lettering at those sizes.
