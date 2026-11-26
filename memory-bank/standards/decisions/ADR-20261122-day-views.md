---
id: ADR-20261122-day-views
date: 2026-11-22
title: 'One View per Tab, Planning Parts as Summary Buttons and Sheets, the Sections Button Always There, and a Live Sky a Trip Picks'
domain: engine
status: amended
decision: "Each tab is its own view with its own #address and Back step; a day's planning cards open as sheets from one-line summaries; TRIP.sky picks the sky."
---

# One View per Tab, Planning Parts as Summary Buttons and Sheets, the Sections Button Always There, and a Live Sky a Trip Picks

## Summary

The trip page shows one view at a time instead of one long page. Each header tab is a view: the overview (with the
week list), each day, and each section the tabs list (map, airport, entry, optional, wishlist, food, budget, weather,
checklist, priorities). The address names the view with the page's existing ids (`#d3`, `#budget`), and every way in
(a tab, the week list, the desktop's week rail, a day's previous / next buttons, the Sections menu, search, the Now
card, a link in a sheet) shows the right view first. Back and Forward step between views, each at the place the reader
left it. Under each view's title its planning parts (a day's decisions, tables, lists, budget, rain plan, what to wear,
tickets, where to eat, the wishlist on the way; the budget, airport and entry views' long parts) are summary buttons
with a one-line summary read from the data, each opening a sheet that scrolls on its own; Back closes it. A stop opens
its map, directions, local name and what's near it in its own sheet. The day's route legs become one line plus the
whole-route button. The Sections button is always there. A destination world with a sky (Snow Light Path) draws a
live sky: snow that falls by itself, following each day's forecast, in the header and a band at the top of each view
(behind the whole page on a desktop), with a Pause; `TRIP.sky` picks it (`live`, `globe`, `pile` or `off`). A page
built with `--preview` carries a panel for the planner to compare skies, weathers, the theme and the clock; a normal
build never does. This amends [ADR-20261121-world-motion](ADR-20261121-world-motion.md), which allowed no backdrop
that moves by itself.

## Context

- A real twelve-day trip's page was 89,761 px tall at 390 px (about 106 phone screens). Its day cards made 65,744 px
  of it, and 75–80 % of each card was planning blocks below a short timeline. The group scrolled past a day's decisions,
  tables and budgets to find the next stop.
- A demo (one view per tab, summary buttons that open sheets, three skies) brought each view to 0.7–2.1 screens. The
  planner tried it and approved it, with the live-weather sky (sky 1), and then asked for all three skies to be a
  per-trip choice, with the demo's settings panel kept as a planner's tool for future trips.
- The page is one file on a host with no server routes (`knowledge/hosting.md`), so views must live in the one page;
  jumps, search, copy and the map read every part of the trip, so every part must stay in the DOM.
- A sheet's close and a jump already take history steps (`19-back-button.js`), and the browser's own scroll
  restoration lost the reader's place on slow phones (`knowledge/engine-browser.md`).
- WCAG 2.2.2: anything moving by itself for more than 5 s needs a way to pause it. Snow over words costs contrast;
  snow behind them doesn't. A canvas loop costs battery, most on an older phone.

## Decision

- **Views.** `#app` keeps every section; all but the one on screen carry `data-off` and aren't drawn
  (`engine/src/app/20-views.js`). A view switch is its own history step (`{ tpView, view, vid }`, the address `#<id>`)
  and opens at the view's top; a jump into a view is one step too (`tpJump`), its view first, then the place, in its
  sheet when it lives in one (`landOn`, `goTo`). Every step's scroll is kept by its `vid` and put back on Back and
  Forward, for a moment while the view grows; the page restores every step itself (`history.scrollRestoration` is
  `manual` for good). A reload returns to the same view and place (`spotRestore`). A typed or outside `#…` is a new step
  that lands the same way. The lit tab is the view on screen (no scroll spy). The full-screen map lies over whichever
  view is on screen.
- **Between days.** Each day ends with big previous / next buttons (`.pager`, 68 px, the neighbour's date and title; the
  first day's previous is the overview, the last day's next the first section after the days). A quick sideways swipe on
  a day does the same, as a bonus: never the only way, and not on sideways scrollers or the globe's sky.
- **Planning parts.** A day's `blocks`, its tickets, food slots and wishlist on the way, and the free day's ideas, render
  as summary buttons under the day's card (`partsHTML`, `06-render-blocks.js`) and their sheets (`dialog.bsheet`, inside
  the view so ids, lazy lists and checkboxes keep working). The one-line summary is read from the block (`blockSum`): a
  decision's option count and price span, or the option it's settled on (`pick`); a table's rows and the span of the
  column with amounts in most of its rows, named by its heading and leaving out a total row (so a parking column or a
  trip total is never read as the price), else its column headings; a list's count and first item; a budget's group range and each person's share; a rain plan, `雨天方案` and its first
  item; a checklist's ticks, updated as they change. A block may carry its own line (`sum: [zh, en]`). The budget view
  keeps its total, the rate and the split inline and opens the shared costs, the per-day chart and cash in sheets; the
  airport view keeps its facts and the cost chart inline and opens the ways to the hotel, the route, the day's rule, the
  transit card and going home; the entry view leads with the entry ticks' progress and opens each rule and the lucky
  draw. A sheet comes up from the bottom on a phone (it follows a finger down and lets go with its speed: a spring,
  response 0.3, damping 0.82 back and 1 closing), and is a panel at the side from 1024 px. A part's sheet is built the
  first time it opens, or when search or a jump needs what's in it (the lazy lists' mechanism), so the first trip-sized
  page keeps its first-paint size (8,390 nodes for a real twelve-day trip, against 8,234 before views). A sheet is a
  phone's width either way, so a table in it lays out as on a phone, one card per row (a container query), and a sheet
  holding a single folded card opens it.
- **A stop's sheet.** Its map, directions, website and driver card, its local name, its shop box, and the food,
  wishlist and drinks near it open in its own sheet: the chevron, or a tap anywhere on the row. Today's current and next
  stops keep their Show-driver button in the plan (one tap, the first trip's lesson). Suggested optional plans stay on
  the string.
- **The day's route** is one line of places with the way between them (and its minutes), then the whole-route button(s).
- **The Sections button** shows on every view from the first screen, above the phone's home bar, and steps aside only
  over the map, while search is open, or where it would cover the day's next-day button. The Back pill, there only for
  a moment after a jump, never steps aside: it is the way back from the jump. Each view's foot leaves room under the
  pager for both floating buttons, so at the end of a day nothing covers either tile. Under a sheet both are covered
  anyway.
- **Desktop (1024 px and up).** A week rail on the left (the overview, each day with its mark, date, title and forecast,
  then the sections) takes the tab strip's place; the view sits in the 46rem column beside it; sheets open as a side
  panel.
- **The live sky.** A world's `.mjs` may export `sky` (Snow Light Path: `'live'`); a trip picks another with `TRIP.sky`
  (`core/sky.mjs` `MODES`; a world without a sky draws none whatever the trip says, and the build says so). `live`: what
  falls follows the view's day forecast (`forecast.json`, the day's `forecastSpot`; the overview and the other views
  take today's, else the first day's): heavy snow, light snow, snow showers in gusts, a few sunlit glints on a clear day,
  stars on a clear night. **With no forecast (a trip more than 16 days away, a refresh without weather) the sky is a
  light snowfall**: the world's own weather, gentle enough to read past, and it doesn't claim a forecast (the weather
  line says nothing then). `globe`: the same gentle snow whatever the weather; Shake (and a sideways swipe on the sky)
  whirls it up, and it settles over about five seconds; no device motion. `pile`: snow builds up on the band's drift
  and the date tabs (the rail and the view's card on a desktop), and a tapped tab knocks its snow off. `off`: no sky;
  the world's scroll-bound night stays. The sky's colours are one set per weather (`--wx-*`, light and dark), blending
  over 0.7 s when the view changes, its foot taking 8 % (12 % at night) of the day's colour. On a phone and a tablet it
  is the sticky header and a band at the top of each view (the date, the wish, the weather line with what to wear),
  ending in a drift of paper snow; snow is drawn on canvases behind the words. On a desktop it is behind the page, the
  view on a paper card, the snow in the margins. At most 110 flakes on a phone and 240 on a desktop; 30 frames a second
  when a frame takes over 9 ms; nothing runs while the page is hidden. A Pause in the header (`#skyBtn`, remembered per
  phone in `store` as `skyPaused`; at the end of the date tabs on a phone, so a six-character name still fits beside
  Install, search, the currency and the language); under reduced motion it holds still and the Pause is gone. With a live sky the
  world's scroll-bound backdrop and its closing sunrise step aside.
- **The preview panel.** `pnpm build --trip … --preview` writes `<name>-preview.html` only (never the standalone page a
  publish uploads, nor the artifact), with `engine/src/preview/` joined in: a dashed "Preview" chip in the header opens
  a panel to pick the sky style, a weather to preview (or follow the day), the snow on or off, the theme and the clock
  (now, Day 3 at 10:40, five days before). Its choices live in memory (`LOOK`, `01-storage.js`) for the visit: never in
  the trip's data, never saved, never synced. A normal build carries none of its code.

## Alternatives

- **Fold the long page (each block a closed `<details>`):** less code, but the page stays one long scroll of headings,
  the group still hunts for the next day, and Back can't return to "the day I was on".
- **One file per day:** the host serves one file per trip behind one password, and offline use needs everything in it.
- **Sheets on the address (`#d3-budget` opens the sheet, as in the demo):** shareable, but a sheet is a moment, not a
  place; an overlay's own history step closes it on Back already, and the page's ids already land inside sheets.
- **A pick the group taps on the phone (as in the demo):** livelier, but a second, per-phone truth beside the plan; the
  planner settles a decision in the data (`pick`), which every phone shows the same.
- **The preview panel behind a URL switch in every build:** one build fewer, but every published page would carry
  tooling a group member could stumble into; a separate file can't be published by the script.
- **Keep the sky on the scroll only:** no pause needed, but with short views there is little scroll to carry it, and the
  planner chose the live weather.
- **A weather default of a clear sky:** calmer, but a snow world with no snow reads as broken; no sky at all wastes the
  world.

## Consequences

- Security: none new. No new host, script or storage outside `store`; the sky is a canvas drawn from the page's own
  colours; the preview panel's code isn't in a page that can be published (`scripts/publish-trip.mjs` uploads only
  `-standalone.html`).
- Operational: `tests/e2e/views.spec.mjs` covers the previous / next buttons, every part's sheet (scrolls on its own,
  Back closes it), a stop's sheet, deep links into sheets, the Sections button's rules, the Now card's jump, the day's
  map over the view, the swipe, the desktop's rail and side panel, and no view wider than a phone in either language;
  `tests/e2e/navigation.spec.mjs` covers views by tab, Back and Forward with each view's place, deep links, the Back
  pill, the Sections menu, a reload and search; `tests/e2e/sky.spec.mjs` covers each sky's Pause (remembered after a
  reload) and reduced motion, the colour following the view, a hidden page, the globe settling, the piling snow, no sky,
  the default world, and the preview panel only with `--preview`. `tests/unit/core.test.mjs` covers `core/sky.mjs`;
  `tests/unit/worlds.test.mjs` the sky's colours against its inks; the contract rejects an unknown `TRIP.sky`, a `pick`
  that names no option and a `sum` in one language. Parity with an earlier commit differs by design.
- Cost: views make each screen shorter. Measured at 390 px on the same real trip: each day takes 2.3–5.1 phone
  screens, the overview 4.3, the other views 1–3, and its optional plans 14 (one long list, left for later), where the
  whole page was 106. The sky runs one canvas loop while the page is on screen, capped and slowed on an older phone,
  and none when paused, hidden or under reduced motion.

## Read when

Changing how the page moves between days and sections, what a view shows, a planning block's summary or sheet, the
Sections button, the desktop layout, a world's live sky or `TRIP.sky`, or the planner's preview build.

## Amendment 2026-11-22

The maintainer wants the sky's pause in the header's top row on phones too, beside search, with the trip's name making
the room instead of the pause moving to the end of the date tabs. A new optional
`TRIP.brandShort` is shown when the whole brand doesn't fit beside the buttons (measured on each render and whenever
the header's room changes; `brandFit` in `09-main-render.js`), and a header under 380 px with Install and the currency
steps the brush down once more, so a three-character short name stays whole at 360 px. The page title and the
home-screen name keep the whole brand.

## Amendment 2026-11-24

Below 1024 px, [ADR-20261124-bottom-app-bar](ADR-20261124-bottom-app-bar.md) replaces this decision's ways around: the
header's date tabs give way to a bottom bar (Today, Days, Map, More); the Sections button stays only on a desktop; the
sky's Pause leaves the header (and the top row the first amendment kept it in) for a row in More's settings, while a
desktop keeps it in the header; the piling snow builds up on the band's drift, with no date tabs left to catch it; and
the overview is named Today. A stop's suggested optional plans stay on the string, folded to their count on a phone.
The views, their addresses and history steps, the planning sheets and the skies stand as decided here.

## Amendment 2026-11-26

A stop's sheet is now built the first time it opens too, the same way as a part's sheet (`lazyKey` in `secDay`,
`07-sections.js`). The first trip had grown to about 9,400 nodes at first paint, over the 9,000 budget in
`tests/e2e/boot.spec.mjs`, and its stop sheets held about 2,900 of them; with them lazy, it paints about 6,600. Search,
a jump and the page-wide e2e audits fill them first (`lazyAll`, `lazyFor`, `fillAll`), and `pnpm parity` fills every
lazy list before it compares, so a sheet not built yet never reads as missing text.
