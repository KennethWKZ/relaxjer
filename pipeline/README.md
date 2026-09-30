# pipeline/

Refreshes a trip's data from outside sources, then rebuilds its page:

```sh
pnpm resync --trip trips/<slug>            # dry run: fetch, print what would change
pnpm resync --trip trips/<slug> --write    # write the trip's files, rebuild the page
#   --reuse (answer from the cache; new calls only for misses)  --no-google  --no-weather  --no-links  --no-build
```

Needs [uv](https://docs.astral.sh/uv/) (it installs Python 3.13 and the two dependencies, `opencc` and `pillow`) and
node. Google calls use **your own key** ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)): `~/.config/relaxjer/google-places.key` (mode 600), with Places API
(New) and Routes API on. It runs from your machine only and never goes into a page.

| Where                                        | What                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `resync.py`                                  | runs the trip's steps (`pipeline.json` "steps"), the weather forecast and the link check                                          |
| `steps/`                                     | generic steps: `pins`, `fetch`, `apply` (Google details, hours, ratings, nearest metro, route legs), `toilets`, `shops`, `images` |
| `destinations/<cc>/pipeline/`                | country steps: `tw/drinks.py` (tea-shop chains, Taiwan classics, sit-down spots)                                                  |
| `destinations/<cc>/regions/<city>/pipeline/` | city steps: `taipei/metro.py` (the MRT / LRT network), `taipei/transit.py` (YouBike, bus stops)                                   |
| `lib/`                                       | the trip (read through `trip-data.mjs`, the way the page's build reads it), Google calls + cache, opening hours                   |
| `tests/`                                     | offline tests on the demo trip (`pnpm test:pipeline`)                                                                             |

A step is looked up in the trip's region pack, then its country pack, then `steps/`. What a trip searches for (its
chains, shopping list, weather spots, which places are stations or districts) is in `trips/<slug>/pipeline.json`.
Caches go to `trips/<slug>/.cache/`, gitignored with the rest of the trip.

**Google's terms** limit how long Places content may be kept and shown. The cache and the trip files keep it; that is
your call for your own private trip page ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)). Don't publish a trip's data.

Moved from the first trip's repo on 2026-10-01. On the same inputs its output is byte-identical to the old scripts',
except where old bugs were fixed: two places the old regex skipped, the hotel's hand-checked Google id (it was
overwritten by the inn next door), and the drink list's order (it changed with Python's hash seed on every run).
