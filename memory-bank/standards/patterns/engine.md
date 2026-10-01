---
created: 2026-10-01
updated: 2026-10-01
---

# Engine

How to change `engine/` and `destinations/`. The shape of the system is in
[`../system-architecture.md`](../system-architecture.md), and the browser lessons behind many of these rules in
[`../../../knowledge/engine-browser.md`](../../../knowledge/engine-browser.md).

## Where code goes

| Change                                                                       | Put it in                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Logic with no DOM and no trip globals (a sum, a date rule, a plan rule)      | `engine/src/core/*.mjs`, with a unit test in `tests/unit/core.test.mjs`                                    |
| Something one country or city has (a tax refund, a taxi meter, a bike share) | its pack, `destinations/<cc>/pack.mjs` or `regions/<city>/pack.mjs`, tested in `tests/unit/packs.test.mjs` |
| Something one trip has (a name, a place, a date, a note)                     | the trip's data ([`../trip-format.md`](../trip-format.md)), never the engine                               |
| Rendering, events, page behaviour                                            | the matching section `engine/src/app/NN-*.js`                                                              |
| Look and feel                                                                | `engine/src/style.css`, within `DESIGN.md`'s tokens ([`frontend.md`](./frontend.md))                       |

A new place, site or day id in the engine is a bug: the engine looks up nothing by a fixed name. Add a trip field or a
pack export instead, document it in `trip-format.md`, and have the contract check it.

## Sections

- `engine/src/app/NN-*.js` are fragments of one script. The build joins them in file order inside `00-open.js` /
  `99-close.js`, so they share one scope: a name defined in `02-helpers.js` is used everywhere after it.
- Load order matters. A new fragment takes the number of the neighbour it depends on, plus one. Don't renumber the
  others without a reason.
- ESLint turns `no-undef` and `no-unused-vars` off for these files, because per-file checks only see the split. The
  e2e suite fails on any page error instead, so a misspelt cross-fragment name shows up there.
- UI strings are `Z(zh, en)` for now (story step 4 moves them to locale files). Every string needs both.
- The page saves state through `store` (`01-storage.js`), under the trip's storage key. Never write `localStorage`
  directly.

## Core modules and packs

- Pure: no imports, no DOM, no trip globals, named exports only. The build inlines them (`Pack` is the country merged
  with the city, the city winning).
- Amounts in a pack are in its country's currency; the trip's own currency settings stay in `TRIP.currency`.
- Every export the engine reads is optional, and the page leaves the feature out when a pack lacks it.
- A new export is documented in `destinations/README.md` ("What the engine reads from `Pack`").

## Before you call an engine change done

1. `pnpm test` (tier 0) and `pnpm test:e2e` (tier 1), or `pnpm test:all` for both plus the short trip.
2. `pnpm parity --live <legacy repo> --trip trips/<slug>` while the first trip is live: only the known diffs
   ([ADR-20261001-live-page-on-relaxjer](../decisions/ADR-20261001-live-page-on-relaxjer.md)).
3. A UI change: a real-browser pass at 390 px and desktop, in Chromium and WebKit ([`frontend.md`](./frontend.md)).
4. Page errors of the last build, with engine line numbers: `node tests/support/probe.mjs [hash] [width]`.
5. If a known-debt test now passes, delete its `test.fail()` in the same change.

## Traps (from the first trip)

- `content-visibility: auto` needs scroll anchoring that holds. `CSS.supports('overflow-anchor', 'auto')` isn't enough,
  because WebKit says yes, so section skipping is for Chromium-family browsers only (`.cv-ok`, `01-storage.js`). It also
  clips children that bleed out with negative margins, and `innerText` of a skipped section is `''`.
- WebKit reports `overflow-anchor` support but doesn't hold a jump's target while skipped sections draw. Every jump,
  deep links included, re-lands for about 1.2 s (`holdLanding()`), and stops on touch, another jump, or Back.
- A full redraw keeps the reader's place: anchor on an element near the top, reopen `<details>` by their nearest id,
  carry the old section heights over, and hold for 2 s.
- Google `AdvancedMarker` content must be a `div`, not a `button`, or clicks recurse.
- The place sheet strips ids from its copy, so use `data-` attributes inside sheets.
- The first `render()` runs at the end of `25-theme.js`, before later fragments (`26-sync.js`) have run. Anything it
  calls from a later fragment must be a `function` declaration (hoisted), and must not touch that fragment's `const` or
  `let` (still in its temporal dead zone); keep such state in `01-storage.js`.
- `26-sync.js` wraps `store.set`: a write to a shared key (`Sync.KEYS`, which includes `people` and `roles`) is queued
  for the group, and every stop that leaves `mine`, including one a remote removal took, is logged into `syncGone`
  (Recently removed). Write remote changes back with its `quiet` flag, or they echo.
- The role helpers (`syncMeta`, `syncIsPlanner`, `ownsStop`, `canEditStop`) are `function` declarations in `26-sync.js`
  that sections 07, 22 and 23 call, so the hoisting rule above applies to them.
- With group sync, every removal goes through `mineSet` and offers Undo (`undoPutBack`), and every entry point that
  edits or removes a stop checks `canEditStop` first. Only stops are guarded: shifts, flight changes and ticks aren't
  ([ADR-20261002-sync-planners](../decisions/ADR-20261002-sync-planners.md)).
