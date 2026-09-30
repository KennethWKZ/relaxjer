---
paths:
  - 'engine/**'
---

# Engine

Read `memory-bank/standards/patterns/engine.md` (SSoT) and `knowledge/engine-browser.md`.

- `engine/src/app/NN-*.js` share one scope and load in file order. Pure logic goes in `engine/src/core/`, and
  country or city specifics in a pack. Trip specifics are trip data, never the engine.
- The engine looks up no place, site or day by a fixed name. A new setting is a trip field in `trip-format.md` plus a
  contract check.
- UI strings are `Z(zh, en)`, both languages always. State goes through `store`, never `localStorage` directly.
- Done means `pnpm test:all` green, parity at the known diffs while the first trip is live, and a UI change checked at
  390 px and desktop in Chromium and WebKit.
- A known-debt `test.fail()` that now passes gets deleted in the same change.
