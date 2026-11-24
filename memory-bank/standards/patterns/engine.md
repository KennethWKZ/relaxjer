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
- Text people read goes through `fmt()` (trip text: `**bold**`, per-person shares) or `escText()`; bare `esc()` is for
  attributes, ids and URLs. Both keep a number range and a phone number on one line, which bare `esc()` doesn't
  (`knowledge/engine-browser.md`, Layout).
- An event handler acts on something drawn: `tests/repo/engine-wiring.test.mjs` fails on a `[data-…]` the event code
  waits for that nothing renders. Remove the handler with the markup.
- The page saves state through `store` (`01-storage.js`), under the trip's storage key. Never write `localStorage`
  directly.
- One view on screen at a time (`20-views.js`, [ADR-20261122-day-views](../decisions/ADR-20261122-day-views.md)): every
  section stays in `#app`, the others carry `data-off`. Anything that takes the reader somewhere goes through the views:
  `goView(id)` for a whole view, `goTo` / `landOn(el)` for a place inside one (its view first, then its sheet when it
  sits in a `dialog.bsheet`, then the scroll). Never `scrollIntoView` an element in another view, and never set
  `history.scrollRestoration` back to `auto`: each history step keeps its own view and scroll. Below 1024 px the bottom
  bar (`renderBar`, `barMark` in `04-render-nav.js`; [ADR-20261124-bottom-app-bar](../decisions/ADR-20261124-bottom-app-bar.md))
  is the way in: Today and Map are links to their views, Days and More open sheets (`renderDays`, `renderToc('more')`),
  so every tap is a step Back undoes.
- A planning part is a summary button plus a sheet (`partsHTML` in `06-render-blocks.js`). Its summary is read from
  the data, generic (never a trip's names); a block's own `sum` replaces it. A part's sheet is a closed list: it's
  built the first time it opens, or when search or a jump needs it (`lazyFill`, `lazyFor`), so code that reads inside
  a sheet must not assume it's drawn, and the page-wide e2e audits fill them first (`fillAll`).
- A world's sky (`24-sky.js`, `core/sky.mjs`) reads the mode from `html[data-sky]` (the build's `TRIP.sky` or the
  world's own) and never draws when it is `off`. Its Pause is the header's `#skyBtn` on a desktop and More's
  `[data-sky-toggle]` row below 1024 px; `skyBtnSync` keeps both in step. The preview build's choices go through `LOOK` (`01-storage.js`), never
  through `store`.

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
   Against a commit from before 2026-10-02, `pnpm parity --ref` also shows `[en] #_title`: in English the tab's title
   is the trip's English name now, not its brush name. That one is meant.
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
- `26-sync.js` wraps `store.set`: a write to a shared key (`Sync.KEYS`, which includes `people`, `roles` and `blocks`)
  is queued for the group, and every stop that leaves `mine`, including one a remote removal took, is logged into
  `syncGone` (Recently removed). Write remote changes back with its `quiet` flag, or they echo.
- What a blocked phone writes is dropped where records come in (`Sync.dropBlocked`, a block it writes for itself
  included), never later in the page, so no section has to check for blocks.
- The role helpers (`syncMeta`, `syncIsPlanner`, `syncIsBlocked`, `ownsStop`, `canEditStop`) are `function` declarations
  in `26-sync.js` that sections 07, 22 and 23 call, so the hoisting rule above applies to them.
- With group sync, every removal goes through `mineSet` and offers Undo (`undoPutBack`), and every entry point that
  edits or removes a stop checks `canEditStop` first. Only stops are guarded: shifts, flight changes and ticks aren't
  ([ADR-20261002-sync-planners](../decisions/ADR-20261002-sync-planners.md)).

## Decisions behind these rules

Each rule above rests on a decision. The decision and its reasons live in its ADR; this list is only the index.

- [ADR-20261007-split-follows-pushback](../decisions/ADR-20261007-split-follows-pushback.md): A split fork moves like a flexible stop: push-backs before it shift it, and its rejoin keeps its stop planned time.
- [ADR-20261117-native-layer](../decisions/ADR-20261117-native-layer.md): A pack sets the native language and the 'please take us here' card text, and the engine reads them from the pack, never a constant.
- [ADR-20261122-currency-switch](../decisions/ADR-20261122-currency-switch.md): Currency conversion happens while the text is drawn, in one pure function that reads each amount's own symbol, so NT$ is never read as $.
- [ADR-20261122-day-views](../decisions/ADR-20261122-day-views.md): Each view is a section shown or hidden with data-off, and a view switch is its own history step with an #id address.
- [ADR-20261122-place-finder-best-day](../decisions/ADR-20261122-place-finder-best-day.md): A place finder ranks each day's stops by straight-line distance to the place, counting only stops a new stop can follow.
