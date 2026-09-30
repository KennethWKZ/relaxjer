# ADR 0002: Test strategy: characterise first, then split

- Status: accepted (2026-09-30)

## Context

The engine is one 250 KB IIFE with no seams to import from. The brief asks for tests before any code moves, run on a
synthetic trip, never on a real family's data. 39 legacy Playwright (Python) suites exist, but only about 10 assert
anything. They need the Taiwan data, `/tmp` copies and a server on port 8123.

## Decision

### Tiers

| Tier | What | Tool | Runs |
|---|---|---|---|
| 0 | Repo hygiene (`tests/repo`) and the trip contract (`tests/contract`) | `node:test`, no dependencies | pre-commit, CI |
| 1 | Characterisation of the page on the demo trip (`tests/e2e`) | `@playwright/test`: Chromium + WebKit × 390 px + 1280 px | local, CI |
| 2 | Unit tests for modules pulled out of `app.js` (flights, shifts, clashes, costs, transit planner) | `node:test` | from roadmap step 2 |
| 3 | The same contract and trip-agnostic e2e on a real trip | `TRIP_DIR=…` + `--grep-invert @demo` | local only, never CI |
| Release | No real trip's details in `engine/` (`tests/release`) | `node:test` | pre-push hook |

Real-device checks stay a manual pass in the `verify-page` skill: real Chrome, an iPhone for Safari. Tier 1 WebKit is
Playwright's build, which is close to iOS Safari but not identical.

### Harness (`tests/support/`)

- **Build with the engine's own build, never a copy of it.** `stage.mjs` runs
  `engine/build.mjs --trip <trip> --out .cache/stage --keys none` in a bare environment.
  - `--keys none` matters: a bare environment isn't enough, because Node still finds the home folder, and with it
    `~/.config/relaxjer/google.json`. Tests always get the free MapLibre/SVG map.
  - `LEGACY_ENGINE_DIR` switches to the old single-trip repo for comparisons. Its build files are copied into
    `.cache/stage/` and built there, so the old repo is never written to.
- **Offline by default.** The fixture aborts every request that isn't the local server and records it. The page must
  render and work without outside network.
- **Pinned clock** through the engine's own override, `localStorage tp5.now = "YYYY-MM-DD HH:MM"` (Asia/Taipei).
  The Playwright clock isn't faked: the engine's 2 s scroll holds measure real time.
- **Any page error or console error fails the test.** "Failed to load resource" from blocked hosts is exempt.

### Conventions

- **`@demo` tag** marks tests that depend on the demo's ids, times or strings. Everything else must pass on any trip.
  That's the check that the tests characterise the engine, not the demo: on 2026-09-30 the 15 trip-agnostic tests
  passed on the real Taipei data in all 4 projects.
- **Known debt is a failing test, not a comment** (`tests/e2e/trip-settings.spec.mjs` holds the ones step 3 paid).
  - `test.fail(true, reason)` states the behaviour we want where the legacy engine lacks it.
  - When a refactor step fixes it, Playwright reports "expected to fail but passed", and the marker gets deleted.
- **Contracts with the outside world** get exact tests. The `#add=` share-link format is one: links already sent to a
  group chat must keep importing.
- **Selectors are the legacy ones**, from the suite survey. When the markup changes, change the helpers in
  `tests/support/page.mjs`, not the invariants.

### Demo trip (`examples/demo-trip/`)

- A fictional group of five, one week in Taipei (13–19 Mar 2027).
- Hotel, flights (`XX` airline code), stalls and prices are invented; landmarks are public.
- Nothing is copied from Google: a contract test forbids `gpid`, `rating`, `reviews` and Google photo URLs in examples.
- It uses the legacy data shape ("v0") and carries a marked `LEGACY_SLOTS` block, because the legacy engine hard-codes
  the first trip's place ids in its day routes. Both go away in roadmap step 3.

## Legacy suite port map

| Ported now (tier 1) | Next | Dropped |
|---|---|---|
| lazy (lists built on open, offline notice) · overflow + squeeze + review2 (layout) · langstay (language keeps place) · tabs/tabmotion/land (instant jumps, glow) · cvback (Back pill) · flt (flight delay) · late (push-back core) · mine + gap (own stops, clash, share import) · tocwc (Sections menu part) | hashland2 + slowmap (deep links under a slow map) · wkjump + cvrerender (scroll stability) · langstay2 (place inside open lists) · blank (no blank flash) · jump (search into closed details) · d6 (departure-day budget) · mapsearch · transit · spots · wc · shopbox · chip · home (install: Chromium CDP) · perf (budgets) | hashland, langspot, lazy2, livelang (superseded or obsolete) · cvdiff, cvscroll (screenshot dumps, not tests) · gmrec2 (needs live Google; replace with a stubbed Maps test) · addstop (live Google search; stub it) |

## Consequences

- Tier 1 already caught real bugs in the live page (roadmap § Findings).
  - Two phone overflows.
  - WebKit tab jumps landing off-screen.
  - Group figures without a per-person share.
- The demo mirrors the legacy shape, so it'll be rewritten once when the trip schema lands. It is accepted cost: the
  schema adapter can be proven by keeping these same specs green.
- **Not covered yet**
  - The Google Maps path: the key is never staged. Add a stubbed `google.maps` test.
  - The live-location "running late" prompt, which needs geolocation emulation.
  - Dark mode.
  - `prefers-reduced-motion`.
