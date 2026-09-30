---
created: 2026-10-01
updated: 2026-10-01
---

# System Architecture

How a trip becomes a page. Where each folder sits is in
[ADR-20260930-repo-layout](./decisions/ADR-20260930-repo-layout.md); the data fields are in
[`trip-format.md`](./trip-format.md).

## The flow

```
requirements.md ──trip-intake──▶ trips/<slug>/            data.js, *.json, img/, pipeline.json
                                      │    ▲
                                      │    └── pnpm resync ◀── Google (user's server key), Open-Meteo, OSM, link checks
                                      ▼                          steps: region pack → country pack → pipeline/steps/
                         pnpm build --trip trips/<slug> [--keys …]
                                      │    engine/src/shell.html + style.css + app/NN-*.js (one scope)
                                      │    + core/*.mjs + Pack (country ⊕ city) + trip data + photos/icons
                                      ▼
                         trips/<slug>/dist/<fileName>-standalone.html   (+ <fileName>.html, <fileName>-mymaps.kml)
                                      │
                         tests: contract (TRIP_DIR), trip-agnostic e2e, parity, real browser
                                      ▼
                         ht-ml.app behind a password ──▶ the group's phones
                                                          state in localStorage under TRIP.storageKey
                                                          update bar when the live build id differs
```

## Components

| Component                                               | Role                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/build.mjs`                                      | Reads a trip folder, evaluates `data.js` in a VM, merges the destination and region packs into `Pack`, joins the sections, inlines everything, stamps a build id, writes the three outputs                                                            |
| `engine/src/app/NN-*.js`                                | The page's sections in load order (storage, helpers, time, render parts, sections, wishlist, now/next, scroll spy, search, share, maps, Back, transit, location, events, menu, near me, theme…). One shared scope; `00-open` and `99-close` wrap them |
| `engine/src/core/*.mjs`                                 | Pure logic the sections call: `time` (clock, ranges), `money` (shares, currency), `plan` (day roles, hotels by day, storage key). Unit-tested                                                                                                         |
| `engine/src/style.css`, `shell.html`                    | The design system (`DESIGN.md`) and the page shell with `{{placeholders}}`                                                                                                                                                                            |
| `destinations/<cc>/pack.mjs`, `regions/<city>/pack.mjs` | Pure modules: what the page knows about a country and a city. The city overrides the country                                                                                                                                                          |
| `destinations/**/pipeline/*.py`                         | Country and city pipeline steps (Taiwan drinks, the Taipei metro, YouBike, buses)                                                                                                                                                                     |
| `pipeline/resync.py`, `steps/`, `lib/`                  | Runs the steps a trip lists in `pipeline.json`, then the forecast and link checks. Reads the trip the way the build does. Caches in the trip's `.cache/`                                                                                              |
| `tests/support/`                                        | The harness: a staged build (`--keys none`), a static server, offline fixtures, page helpers, the trip contract, parity, the short-trip generator                                                                                                     |

## Invariants

- **The engine names no place or site.** Every id it uses comes from the trip's data, and the contract checks that each
  exists.
- **Packs and core modules are pure:** no imports, no DOM, no trip globals, named exports only. The build inlines them.
- **Offline first.** Without network the page renders, keeps its state, and says it's offline; it never offers a reload
  while offline.
- **Keys go in only when asked.** Without `--keys` the page uses MapLibre and carries no key. Tests always build with
  `--keys none`.
- **A published page keeps its `fileName` and `storageKey`** across rebuilds, so links and saved state carry over.
- **The build id is the page's version.** The page compares it with the live copy's to offer an update, and a publish
  is verified by finding the new id on the live URL.
