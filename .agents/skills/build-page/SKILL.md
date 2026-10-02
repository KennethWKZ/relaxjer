---
name: build-page
description: Build a RelaxJer trip page — one self-contained, offline-friendly HTML file — from a trip folder, with or without the user's Google browser key. Use when someone asks to build, rebuild or regenerate a trip page, or before verifying or publishing one. Covers the build flags, outputs, the build id, and what a published page must keep across rebuilds.
---

# Build page: `pnpm build`

```sh
pnpm build --trip examples/demo-trip                                    # the demo, never with a key
pnpm build --trip trips/<slug>                                          # a real trip on the free MapLibre map
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json   # with the user's own browser key + Map ID
pnpm build --trip trips/<slug> --keys … --sync ~/.config/relaxjer/sync/<slug>.json   # with group sync (sync-setup skill)
#   --out <dir>   default <trip>/dist
#   --demo-clock "2027-03-15 10:05"   the live demo only (pages.yml): opens at that moment of the trip and runs on,
#                                     moved into the visitor's own year;
#                                     it opens in English, says it's a demo, never asks for location;
#                                     the build refuses it for any other trip
```

## What it writes

In `<out>` (default `trips/<slug>/dist/`, gitignored):

| File                         | What                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| `<fileName>-standalone.html` | **the page to publish**: one file, photos and icons inlined                 |
| `<fileName>.html`            | the page's body only (no head, policy, build id or icons): never publish it |
| `<fileName>-mymaps.kml`      | a Google My Maps export of the trip's places, one layer per day             |
| `mymaps/NN-<layer>.kml`      | the same, one file per layer (My Maps imports one layer at a time)          |

`<fileName>` is `TRIP.fileName` (default `trip`). The build prints its size and whether a key went in. Read that line:
a page meant for anyone outside the group must say no key.

## Rules

- **Keys only when asked.** Without `--keys` the page carries no key. Build the demo, and any page shared publicly,
  without one. Never pass a key file inside the repo.
- **A published page keeps `TRIP.fileName` and `TRIP.storageKey`** across rebuilds. Changing them breaks the link's file
  name and loses the group's saved state (checklist, language, rate, added stops, pushed-back times, flight delay).
- **A page with group sync keeps the same `--sync` file** across rebuilds. A new one (`pnpm sync init --force`) is a new
  database: every phone starts over. Leaving `--sync` out turns sync off for the next copy. The build prints
  `group sync yes (planner code set|not set)` or `group sync no`; check it. A trip that should have planners must say
  `planner code set`. The planner code's hash lives in the sync file and is baked in at build, so a new code
  (`pnpm sync planner`) needs a rebuild and a republish.
- **The page carries its own Content-Security-Policy** ([ADR-20261001-page-csp](../../../memory-bank/standards/decisions/ADR-20261001-page-csp.md)).
  A new outside host in the engine needs a line in `engine/build.mjs`; a pack's hosts come from its code.
- **Every build gets a new build id** (`<meta name="relaxjer-build">`, 12 hex characters). The page uses it to offer an
  update to phones holding an older copy, and `publish-htmlapp` uses it to prove the live page is the new one. Note it
  after each build:

  ```sh
  grep -o 'relaxjer-build" content="[0-9a-f]*' trips/<slug>/dist/*-standalone.html
  ```

- **`SHARE_URL`**, set in the environment at build, is the live page's address: Copy link and the share links point at
  it. Without it they use the address the page was opened at.
- **Photos and the home-screen icon** come from the trip's `img/` (`img/credits.json`, `img/icon/`); a page without
  icons still installs, with the browser's default icon (`pipeline/README.md` § Photos and icons).
- Nothing under `dist/` is ever committed (`.gitignore`, the pre-commit guard).

## If it fails

- `usage: … --trip <dir with data.js>`: the folder has no `data.js`.
- `! <file> is not valid JSON`: a side file is broken; the build falls back to empty data for it. Fix the file.
- `TRIP.brushFont: a Google Fonts family name`: use a family name like `Ma Shan Zheng`.
- `! brush font: couldn't fetch …`: the build puts the brush face into the page, and fetches it once from Google Fonts
  (then keeps it in `.cache/fonts/`). It had no network and no copy kept, so the page letters in the system Kaiti
  faces. Build again online before you publish.
- A page error: stage the trip's page by running its e2e tests once, then probe it. The probe loads
  `.cache/pages/trip.html` offline and prints each error with the engine line it came from:

  ```sh
  TRIP_DIR=trips/<slug> pnpm exec playwright test --grep-invert @demo
  node tests/support/probe.mjs [hash] [width]
  ```

## Next

`verify-page`, then `publish-htmlapp`.
