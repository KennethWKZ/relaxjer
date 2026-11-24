---
id: ADR-20261124-bottom-app-bar
date: 2026-11-24
title: 'A Bottom Bar on Phones and Tablets: Today, Days, Map and More Replace the Date Strip, the Sections Button and the Header Pause'
domain: design
status: accepted
decision: 'Below 1024 px a bottom bar (Today, Days, Map, More) replaces the date strip and the Sections button, and the sky’s Pause moves into More.'
tags: [engine]
---

# A Bottom Bar on Phones and Tablets: Today, Days, Map and More Replace the Date Strip, the Sections Button and the Header Pause

## Summary

Below 1024 px, on a phone and a tablet alike, installed or opened in a browser, the trip page has an app's bottom bar:
**Today** (the first view: Now and Next, before the trip the countdown and its to-dos, then the week), **Days** (a sheet
listing every day), **Map** (the map view) and **More** (a sheet with the planning sections, food and toilets nearby,
and the settings). The header's sideways date strip, the floating Sections button (目录) and the sky's Pause in the
header go; the Pause is a row in More's settings. The Back pill stays, just above the bar. The bar reserves its height
as `--chrome-bottom` on `:root`, set in CSS by media query, and everything else that floats at the foot sits on it. A
desktop (1024 px and up) keeps its rail, the Sections button and the header's Pause. This amends
[ADR-20261122-day-views](ADR-20261122-day-views.md), whose views, addresses, history steps, sheets and skies stand.

## Context

- The group installs the page on their phones and uses it as an app. They reported that the phone view had too much
  on it. At 390 px the demo's header was 162 px tall: the brand row, a search row that never hid (the row is a flex box,
  which outranks the browser's own `[hidden]`, so it stood on every screen since the first commit and the search button
  changed nothing), and a strip of 18 tabs (7 days and 11 other parts) 1,091 px wide in a 390 px window.
- People didn't realise the strip scrolled to the right. The edge fade (affordances rule 14) wasn't enough: the
  sections after the days were out of sight on every phone, and a 12-day trip's strip is wider still.
- An installed iPhone web app has no browser Back button. The page's own controls are the only way back.
- WCAG 2.2.2: anything that moves by itself for more than 5 s needs a way to pause it that people can reach.
- Another branch (`fix/map-search-journey`) is reworking the map view's search at the same time; its sheets must clear
  whatever this one puts at the foot of the screen, without measuring it.

## Decision

- **Where.** Below 1024 px: phones and tablets, one layout whether the page runs from the home screen or in a browser.
  At 1024 px and up the week rail does the bar's job, so a desktop is unchanged (the rail, the Sections button, the
  header's Pause).
- **The bar** (`#tabbar`, `04-render-nav.js` `renderBar` / `barMark`; `style.css`): fixed to the foot, on the header's
  glass, four items of equal width, each an icon over a short label (今天 / 日程 / 地图 / 更多, Today / Days / Map /
  More) in one stroke style: a calendar page carrying today's date, a list of day tiles, the folded map, three dots.
  Each item is a quarter of the width and the bar's height (56 px at the default text size), so every target clears
  the 52 px walking size. The lit item fills its icon's tile and goes bold, two cues: Today on Today, Days on any day (in
  that day's lantern colour, which means "this day"), Map on the map, More on every other section. A trip without a
  map view has three items.
- **Taps follow the views.** Today and Map are links to `#top` and `#map`: a view switch, its own history step, opening at
  the view's top; tapping the lit one scrolls its view to the top. Days and More open modal sheets, each its own history
  step that Back closes; a row in them closes the sheet, then opens its view as a new step. So Back after any bar tap
  returns to the previous view at the place the reader left it.
- **Today is the overview's name** everywhere it's offered (the bar, the rail, the Sections menu, the first day's
  Previous), one name per destination.
- **Days** (`#days`, `23-sections-menu.js` `renderDays`): every day as one full-width row, as the rail draws them: its
  mark, its short date and weekday, its Day number, Today flagged, its title and forecast; the day on screen is lit, and
  the list opens with it (else today) in sight. It scrolls down, never sideways.
- **More** (`#toc` drawn in mode `more`): Food and Toilets nearby, then every planning section with its icon (Airport,
  Entry, Optional, Wishlist, Food, Budget, Weather, Checklist, Priorities: whatever the trip has, the map aside), then
  Settings: the theme (on a phone), the sky's Pause, which maps app, amounts and rate, group sync, the reset row, Install.
- **The sky's Pause** is More's settings row below 1024 px (`data-sky-toggle`), the same switch as the desktop header's
  `#skyBtn`: pressed while paused, named for what a tap does next, remembered on the phone (`skyPaused`). It stays in
  reach: the bar stands on every view; what covers it (a sheet, the full-screen map's layer ends at the bar's top and
  leaves it usable) closes with one tap or Back, so the Pause is never more than two taps away from any screen where
  the snow is falling. Under reduced motion nothing moves and the row isn't drawn; while the page is hidden the sky
  stops.
- **The floating buttons.** The Sections button (目录) goes below 1024 px: Today holds its Now and Next, Days its days,
  More its sections, nearby rows and settings. The Back pill stays: after a jump (a search hit, a link inside a sheet,
  Now and Next) it's the one tap back to where the reader was, and an installed iPhone app has no other. It sits at the
  left, 12 px above the bar; the toast sits 12 px above the bar too, and above the pill while the pill is up, so it never
  covers the way back.
- **Layers.** Modal sheets (the part sheets, the place and add-stop sheet, Days, More, the driver card) open in the top
  layer over the bar, as a phone's own sheets cover its tab bar; each keeps its own home-bar inset. The full-screen map
  ends at the bar's top (`bottom: var(--chrome-bottom)`), so its controls sit above the bar and Today, Days and More
  stay one tap away from it. The search results stop above the bar.
- **`--chrome-bottom`**, the contract with the map's sheets: on `:root`, `0px` where there's no bar (1024 px and up),
  else `calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))`, with `--tabbar-h: calc(41px + 0.9375rem)`, so the
  bar grows with the phone's text size. Set in CSS by media query, never measured by a script. Anything fixed to the
  foot sits on it; each view's foot keeps `--chrome-bottom` plus 76 px free, for the Back pill.
- **The tablet** (600 to 1023 px) gets the bar, its four items kept together in the middle (8.5rem each) rather than
  spread across the width. The strip's hidden scroll is the same there (the demo needs 1,091 px), a tablet in portrait
  is held like a big phone with the thumbs at the foot, the rail and the 46rem column don't fit beside each other under
  1,024 px, and one layout below the desktop's means two layouts to keep right, not three.
- **The header** keeps the name, Install, Search, the theme (600 px and up), the currency and the language. The search
  row shows only while searching, in the brand row's place. At 390 px the header is now 54 px.
- **Short dates** in a day's heading and its day bar, and in Days: a calendar mark and "3/15 周一" for "3月15日 周一"; the
  weekday keeps its 周, since a bare 一 reads as a dash. The whole date is there for screen readers. English stays
  "Mon 15 Mar".
- **A stop's nearby options fold** (the optional plans a trip suggests at a stop, which stay on the string): a 44 px row
  with the count ("2 nearby options") and a chevron, closed on a phone and open from 600 px; a tap opens or closes it,
  remembered per stop for the page view only, never stored. The same complaint: on a phone the chips pushed the next
  stop down.
- **The piling snow** (`TRIP.sky: 'pile'`) builds up on the band's drift on a phone and a tablet, and on the ground, the
  rail and the view's card on a desktop. With no date tabs, nothing is knocked off by a tap.

## Alternatives

- **Keep the strip with a stronger cue (arrows, a peeking tab, a wrap to two rows):** still sideways for the sections,
  or 100 px more header on every screen, and the Sections button still doubling it.
- **A Days menu in the header:** out of the thumb's reach, and it leaves the sections, the map and the settings where
  they were.
- **The bar only when installed (`display-mode: standalone`):** two layouts on the same phone, doubled tests, and a
  browser tab has the same thumb.
- **A fifth item for the Pause, or the Pause kept in the header:** five labels crowd a 360 px phone, and the header's
  room went to the name; the setting changes rarely, so it lives with the other settings, in reach.
- **Keep 目录 above the bar:** a second way to the same places, covering the content's right edge.
- **Sheets that stop above the bar:** a modal sheet makes the bar inert anyway; the sheet would lose 90 px and the bar
  would show through the scrim, a layer that does nothing.
- **A full-screen map that covers the bar:** the reader would need its ✕ or Back to reach anything else, and the map's
  sheets would need a second rule for that layer.
- **Measuring the bar in a script for `--chrome-bottom`:** a frame late after every rotation and text-size change, and
  the other branch can't rely on a value a script may not have set yet.

## Consequences

- Security: none new. No new storage key, host or permission; the bar draws from the trip's data already in the page.
- Operational: `tests/e2e/bottom-bar.spec.mjs` covers the bar's items at phone width and none on a desktop, Days
  (every day, today marked, opening the one picked), More (every planning section and the settings), Back after a bar
  tap, and nothing at the foot overlapping the bar (the toast, the Back pill, the full-screen map, every sheet over it,
  a view's last row clear of both); `tests/e2e/sky.spec.mjs` finds the Pause where a reader does (`skyPause` in
  `tests/support/page.mjs`) and checks the pile on the drift; `tests/e2e/optional.spec.mjs` a stop's nearby options folded to their count and opened on a tap; `goToView` and `openSections` reach views and menus
  through the bar below 1024 px. The landing page's postcards still draw the old header strip and the Sections button:
  redrawing them is a follow-up (`.claude/rules/docs.md`). The map branch's sheets read `--chrome-bottom`.
- Cost: measured on the demo at 390 px, the header went from 162 px to 54 px and the bar takes 56 px plus the home bar,
  so each screen shows about 50 px more of the trip; the page carries one more sheet and four links, a few hundred
  bytes.

## Read when

Changing how a phone or a tablet gets around the trip (the bar, Days, More), anything fixed to the foot of the screen,
the sky's Pause, the floating buttons, the header's rows, or the breakpoint between the bar and the rail.
