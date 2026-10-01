---
name: verify-page
description: Verify a RelaxJer trip page before calling a change done or publishing it — the test tiers, the trip contract, trip-agnostic e2e on a real trip, parity with the live page, then a real-browser pass at 390 px and desktop in Chromium and WebKit, walking the group's journeys as a senior would. Use after any engine, style, data or pack change, after a data refresh, and before every publish.
---

# Verify page

Tests first, then eyes. Report what actually ran: a skipped step is named as skipped, never implied as passed. The
read-only `ux-verifier` agent can run steps 3–4 for you in Claude Code.

## 1. Tests

```sh
pnpm test:all                                                        # tier 0 + tier 1 (Chromium, WebKit × 390 px, desktop) + the short trip
TRIP_DIR=trips/<slug> pnpm test                                      # the contract on this trip
TRIP_DIR=trips/<slug> pnpm exec playwright test --grep-invert @demo  # every trip-agnostic e2e on this trip
```

While the first trip is live, the maintainer also runs parity on an engine change, which should show only the known
diffs (anyone can compare with an earlier commit: `pnpm parity --ref <commit> --trip trips/<slug>`):

```sh
pnpm parity --live <legacy repo> --trip trips/<slug>
```

The sync specs are tagged `@demo`, so `--grep-invert @demo` skips them on a real trip. If the trip has group sync, build
it with `--sync` and do the two-phone check by hand in step 4 (journeys 9 and 10).

A failure is a finding, not noise. WebKit desktop flakes about once in 140 runs under full load; re-run that one test
alone once, and if it fails again, it's real.

## 2. Build the page you'll look at

`build-page`: the demo for engine changes, the trip itself for data changes. Serve the folder over HTTP, because some
features need a real origin: `node tests/support/serve.mjs trips/<slug>/dist 8124` (localhost only, no caching), then
open `http://127.0.0.1:8124/<fileName>-standalone.html`.

## 3. Real-browser pass

Use a real Chrome where the agent has one (Claude Code: the ccs-browser tools; otherwise Playwright), and Playwright
WebKit for iPhone behaviour.

- **Widths:** 390 × 844 and 1280 × 800.
- **Themes and languages:** light and dark; both UI languages (English runs longer).
- **Look for:** anything wider than the screen, squeezed or clipped text, colour-only meaning, shifting layout, page
  or console errors.
- **Affordances** (`memory-bank/standards/patterns/affordances.md`), measured:
  - targets at least 44 px, with 8 px between them (rules 1, 3);
  - every `summary` has a chevron (11);
  - a sideways scroller shows there is more (14);
  - selected states use two cues (16);
  - the focus ring reaches 3:1 on every surface, lanterns included (19);
  - labels at 4.5:1, icons and borders at 3:1 (24).

  Then the squint test, by eye (25).

- **Compare:** a screenshot next to the same part of the page before the change, and fix alignment, spacing and style
  drift (`DESIGN.md`).

## 4. Walk the group's journeys

At 390 px, one-handed, as a senior would (`knowledge/group-ux.md`):

1. What's next: the Now/Next card, on a trip day (pin the clock with `localStorage <storageKey>now = "YYYY-MM-DD HH:MM"`).
2. Getting to the next stop: the route, the map, the "show the driver" card.
3. Where to eat nearby, and a toilet.
4. The rain plan.
5. The budget: every group figure has its per-person share, in both currencies.
6. The airport: the options, and the leave-by time.
7. Follow a link, then come back: the Back pill, the place kept.
8. Offline: turn the network off and reload from the home-screen copy.
9. A person removes a stop by mistake: Undo on the toast puts it back. With group sync, find it under "Recently
   removed" after the toast is gone, and tap Put back.
10. With group sync, a phone with no name: the welcome sheet asks once on the first open; Not now leaves the bar under
    the header, and its Add name opens Group sync. Then a second phone sees who added a stop, can't change it, and a
    planner phone can. A planner blocks that second phone: its stops go, its bar says it's blocked, Undo brings it all
    back, and Unblock sends what waited.

11. Add a stop from a "+": the getting-there check (walk, taxi, metro), a time too early ("Use HH:MM"), a clash with a
    fixed time, and Undo after removing it.
12. A day that splits: the fork, its rule, switching plans, the route on the map, the rejoin stop.
13. An optional plan's "Nearby options" chip opens its card over the day, and closing it keeps your place.
14. Push the day back from a stop: flexible stops move, fixed ones hold, and the banner says what moved. Type a flight
    delay, then Back to booked.
15. The header: search in the other language, the theme (light, dark, follow the phone), the language switch keeping
    your place, the Sections menu, and Install.

Count taps and long scrolls. A dead end, a back trap, a tiny target or squeezed text is a bug: fix it, or file it in
the story index's "Known issues".

## 5. iPhone

Scroll, jumps, install, location and the update bar get a WebKit pass, and, when the change touches them, a real iPhone
too. Playwright's WebKit is close to iOS Safari, not identical. The home-screen copy has its own storage, so with group
sync it is another phone: it needs its own name, and the planner code if it should be a planner.

## Done when

Every step above ran and passed, or its failure is fixed or named. The report lists what ran, at which widths and in
which browsers.
