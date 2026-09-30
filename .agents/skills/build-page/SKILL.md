---
name: build-page
description: Build a RelaxJer trip page — one self-contained, offline-friendly HTML file — from a trip folder, with or without the user's Google browser key. Use when someone asks to build, rebuild or regenerate a trip page, or before verifying or publishing one. Covers the build flags, outputs, the build id, and what a published page must keep across rebuilds.
---

# Build page: `pnpm build`

```sh
pnpm build --trip examples/demo-trip                                    # the demo, never with a key
pnpm build --trip trips/<slug>                                          # a real trip on the free MapLibre map
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json   # with the user's own browser key + Map ID
#   --out <dir>   default <trip>/dist
```

## What it writes

In `<out>` (default `trips/<slug>/dist/`, gitignored):

| File                         | What                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `<fileName>-standalone.html` | **the page to publish**: one file, photos and icons inlined |
| `<fileName>.html`            | the same page without inlined images                        |
| `<fileName>-mymaps.kml`      | a Google My Maps export of the trip's places                |

`<fileName>` is `TRIP.fileName` (default `trip`). The build prints its size and whether a key went in. Read that line:
a page meant for anyone outside the group must say no key.

## Rules

- **Keys only when asked.** Without `--keys` the page carries no key. Build the demo, and any page shared publicly,
  without one. Never pass a key file inside the repo.
- **A published page keeps `TRIP.fileName` and `TRIP.storageKey`** across rebuilds. Changing them breaks the link's file
  name and loses the group's saved state (checklist, language, rate, added stops, flight delay).
- **Every build gets a new build id** (`<meta name="relaxjer-build">`, 12 hex characters). The page uses it to offer an
  update to phones holding an older copy, and `publish-htmlapp` uses it to prove the live page is the new one. Note it
  after each build:

  ```sh
  grep -o 'relaxjer-build" content="[0-9a-f]*' trips/<slug>/dist/*-standalone.html
  ```

- Nothing under `dist/` is ever committed (`.gitignore`, the pre-commit guard).

## If it fails

- `usage: … --trip <dir with data.js>`: the folder has no `data.js`.
- `! <file> is not valid JSON`: a side file is broken; the build falls back to empty data for it. Fix the file.
- `TRIP.brushFont: a Google Fonts family name`: use a family name like `Ma Shan Zheng`.
- A page error: stage the trip's page by running its e2e tests once, then probe it. The probe loads
  `.cache/pages/trip.html` offline and prints each error with the engine line it came from:

  ```sh
  TRIP_DIR=trips/<slug> pnpm exec playwright test --grep-invert @demo
  node tests/support/probe.mjs [hash] [width]
  ```

## Next

`verify-page`, then `publish-htmlapp`.
