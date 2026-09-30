---
id: ADR-20260930-test-strategy
date: 2026-09-30
title: 'Test Strategy: Characterise First, Then Split'
domain: testing
status: accepted
---

# Test Strategy: Characterise First, Then Split

## Summary

Tests come before any code moves, and they run on a synthetic demo trip, never on a real family's data. Four tiers,
from repo hygiene in under a second to Playwright characterisation in Chromium and WebKit at 390 px and desktop, plus a
release gate on push. How to write a test that fits this lives in
[`../patterns/testing.md`](../patterns/testing.md).

## Context

The engine was one 250 KB IIFE with no seams to import from. The brief asked for tests before any code moved, run on a
synthetic trip. 39 legacy Playwright (Python) suites existed, but only about 10 asserted anything. They needed the
Taiwan data, `/tmp` copies and a server on port 8123.

## Decision

### Tiers

| Tier    | What                                                                                                     | Tool                                                     | Runs           |
| ------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------- |
| 0       | Repo hygiene and agent config (`tests/repo`), the trip contract (`tests/contract`), units (`tests/unit`) | `node:test`, no dependencies                             | pre-commit, CI |
| 1       | Characterisation of the page on the demo trip (`tests/e2e`)                                              | `@playwright/test`: Chromium + WebKit × 390 px + 1280 px | local, CI      |
| 2       | Unit tests for modules pulled out of `app.js` (flights, shifts, clashes, costs, packs)                   | `node:test` (part of tier 0's run)                       | pre-commit, CI |
| 3       | The same contract and trip-agnostic e2e on a real trip                                                   | `TRIP_DIR=…` + `--grep-invert @demo`                     | local only     |
| Release | No real trip's details in anything that would be published (`tests/release`)                             | `node:test` + a history scan                             | pre-push hook  |

Real-device checks stay a manual pass in the `verify-page` skill: real Chrome, an iPhone for Safari. Tier 1's WebKit is
Playwright's build, which is close to iOS Safari but not identical.

### Harness (`tests/support/`)

- **Build with the engine's own build, never a copy of it.** `stage.mjs` runs
  `engine/build.mjs --trip <trip> --out .cache/stage --keys none` in a bare environment.
  - `--keys none` matters: a bare environment isn't enough, because Node still finds the home folder, and with it
    `~/.config/relaxjer/google.json`. Tests always get the free MapLibre/SVG map.
  - `LEGACY_ENGINE_DIR` switches to the old single-trip repo for comparisons. Its build files are copied into
    `.cache/stage/` and built there, so the old repo is never written to.
- **Offline by default.** The fixture aborts every request that isn't the local server, and records it. The page must
  render and work without outside network.
- **Pinned clock** through the engine's own override, `localStorage <storageKey>now = "YYYY-MM-DD HH:MM"` in the trip's
  time zone. The Playwright clock isn't faked: the engine's 2 s scroll holds measure real time.
- **Any page error or console error fails the test.** "Failed to load resource" from blocked hosts is exempt.

### Demo trip (`examples/demo-trip/`)

- A fictional group of five, one week in Taipei.
- Hotel, flights (`XX` airline code), stalls and prices are invented; landmarks are public.
- Nothing is copied from Google: a contract test forbids `gpid`, `rating`, `reviews` and Google photo URLs in examples.
- A 4-day variant is generated from it (`tests/support/short-trip.mjs`, `pnpm test:e2e:short`), so the trip-agnostic
  suite also proves any trip length and a hotel change mid-trip.

## Alternatives

| Option                             | Why not                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Keep the 39 legacy Python suites   | Only about 10 asserted anything; they needed real Taiwan data, `/tmp` copies and port 8123 |
| Split the engine first, test after | Nothing would prove the split kept behaviour; the quality bar lives in small details       |
| Test on the real Taipei data in CI | A real family's data can't enter a public CI; the demo carries the same shapes             |
| Fake the Playwright clock          | The engine's scroll holds measure real time; a fake clock hides real timing bugs           |

## Legacy suite port map

| Ported (tier 1)                                                                                                                                                                                                                                                                                               | Next                                                                                                                                                                                                                                                                                                                          | Dropped                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lazy (lists built on open, offline notice) · overflow + squeeze + review2 (layout) · langstay (language keeps place) · tabs/tabmotion/land (instant jumps, glow) · cvback (Back pill) · flt (flight delay) · late (push-back core) · mine + gap (own stops, clash, share import) · tocwc (Sections menu part) | hashland2 + slowmap (deep links under a slow map) · wkjump + cvrerender (scroll stability) · langstay2 (place inside open lists) · blank (no blank flash) · jump (search into closed details) · d6 (departure-day budget) · mapsearch · transit · spots · wc · shopbox · chip · home (install: Chromium CDP) · perf (budgets) | hashland, langspot, lazy2, livelang (superseded or obsolete) · cvdiff, cvscroll (screenshot dumps, not tests) · gmrec2 (needs live Google; replace with a stubbed Maps test) · addstop (live Google search; stub it) |

## Consequences

- Tier 1 caught real bugs in the live page on its first run: two phone overflows, WebKit tab jumps landing off-screen,
  and group figures without a per-person share (story index, "First trip").
- The demo first mirrored the legacy data shape and was rewritten once when the trip schema landed (story step 3). The
  same specs stayed green across it, which proved the schema adapter.
- **Not covered yet**
  - The Google Maps path: the key is never staged. Add a stubbed `google.maps` test.
  - The live-location "running late" prompt. Geolocation emulation now drives the location card
    (`tests/e2e/location.spec.mjs`), but not the late prompt itself.
  - Dark mode.
  - `prefers-reduced-motion`.

## Read when

You're adding a test, deciding which tier a check belongs in, or wondering why a test needs no network or a real key.
