---
created: 2026-10-01
updated: 2026-10-02
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
                         pnpm build --trip trips/<slug> [--keys …] [--sync …]
                                      │    engine/src/shell.html + style.css + app/NN-*.js (one scope)
                                      │    + core/*.mjs + Pack (country ⊕ city) + trip data + photos/icons
                                      │    + the page's Content-Security-Policy, and the sync file's keys and planner hash if --sync
                                      ▼
                         trips/<slug>/dist/<fileName>-standalone.html   (+ <fileName>.html, <fileName>-mymaps.kml)
                                      │
                         tests: contract (TRIP_DIR), trip-agnostic e2e, parity, real browser
                                      ▼
                         ht-ml.app behind a password ──▶ the group's phones
                                                          state in localStorage under TRIP.storageKey
                                                          update bar when the live build id differs
                                                          with --sync: each phone ◀──▶ the planner's own Firebase
                                                          database over HTTPS (set up with pnpm sync init)
```

## Components

| Component                                               | Role                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine/build.mjs`                                      | Reads a trip folder, evaluates `data.js` in a VM, merges the destination and region packs into `Pack`, joins the sections, inlines everything, writes the page's Content-Security-Policy, embeds the sync file's keys and planner hash when given `--sync`, stamps a build id, writes the three outputs |
| `engine/src/app/NN-*.js`                                | The page's sections in load order (storage, helpers, time, render parts, sections, wishlist, now/next, scroll spy, search, share, maps, Back, transit, location, events, menu, near me, theme, group sync…). One shared scope; `00-open` and `99-close` wrap them                                       |
| `engine/src/core/*.mjs`                                 | Pure logic the sections call: `time` (clock, ranges), `money` (shares, currency), `plan` (day roles, hotels by day, storage key), `sync` (what a phone shares, merging). Unit-tested                                                                                                                    |
| `engine/src/style.css`, `shell.html`                    | The design system (`DESIGN.md`) and the page shell with `{{placeholders}}`                                                                                                                                                                                                                              |
| `destinations/<cc>/pack.mjs`, `regions/<city>/pack.mjs` | Pure modules: what the page knows about a country and a city. The city overrides the country                                                                                                                                                                                                            |
| `destinations/**/pipeline/*.py`                         | Country and city pipeline steps (Taiwan drinks, the Taipei metro, YouBike, buses)                                                                                                                                                                                                                       |
| `pipeline/resync.py`, `steps/`, `lib/`                  | Runs the steps a trip lists in `pipeline.json`, then the forecast and link checks. Reads the trip the way the build does. Caches in the trip's `.cache/`                                                                                                                                                |
| `scripts/sync/`                                         | Group sync for a trip, on the planner's own Firebase database: its rules, `pnpm sync` (rules, init, planner, end, status), the rules' emulator test                                                                                                                                                     |
| `tests/support/`                                        | The harness: a staged build (`--keys none`), a static server with a stand-in sync database, offline fixtures, page helpers, the trip contract, parity, the short-trip generator                                                                                                                         |

## Invariants

- **The engine names no place or site.** Every id it uses comes from the trip's data, and the contract checks that each
  exists.
- **Packs and core modules are pure:** no imports, no DOM, no trip globals, named exports only. The build inlines them.
- **Offline first.** Without network the page renders, keeps its state, and says it's offline; it never offers a reload
  while offline.
- **Keys go in only when asked.** Without `--keys` the page uses MapLibre and carries no key. Tests always build with
  `--keys none`.
- **A published page keeps its `fileName` and `storageKey`** across rebuilds, so links and saved state carry over. A
  page with group sync also keeps its `--sync` file: a new one is a new database.
- **The phone stays the source of truth.** Group sync saves a change on the phone first, queues it, and sends it when
  there's a connection; what the group sends is checked and merged, the newest version per record winning. A page built
  without `--sync` behaves as before ([ADR-20261001-group-sync](./decisions/ADR-20261001-group-sync.md)).
- **Roles are the page's, not the database's.** With group sync, a phone changes only the stops it added and a planner
  phone (one that gave the planner code, whose hash the build bakes in) changes any. A planner can also block a phone:
  every phone then drops what that phone writes (`Sync.dropBlocked`). The `who:`, `role:` and `block:` records say so, but the database sees only ciphertext, so this guards against mistakes, not against someone who has the
  page ([ADR-20261002-sync-planners](./decisions/ADR-20261002-sync-planners.md)).
- **The page polices itself.** Its inline scripts run by hash and it may reach only the hosts it uses, so the host
  needs to set no headers ([ADR-20261001-page-csp](./decisions/ADR-20261001-page-csp.md)).
- **The build id is the page's version.** The page compares it with the live copy's to offer an update, and a publish
  is verified by finding the new id on the live URL.
