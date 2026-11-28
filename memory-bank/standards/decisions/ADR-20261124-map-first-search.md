---
id: ADR-20261124-map-first-search
date: 2026-11-24
title: 'The Map View Is Map-First: Results and the Place Finder Lie Over the Map, a Sheet on a Phone and a Panel on a Wide Screen'
domain: design
status: amended
decision: 'Search results and the finder lie over the map (sheet or side panel); a picked place is framed with the group and marked, no line; filters behind one button.'
tags: [engine]
---

# The Map View Is Map-First: Results and the Place Finder Lie Over the Map, a Sheet on a Phone and a Panel on a Wide Screen

## Summary

Searching or listing on the Map view never hides the map. The view is the search, one row of category chips and the
map, sized to fit between the header and the foot of the screen. The results and the place finder lie in a pane over
the map: on a narrow stage a sheet at the map's foot with three heights (peek, half, full), on a wide one a panel down
the map's left. A tapped result marks its pin and brings it into the part of the map the pane leaves open, framed with
where the group is (the phone, or the plan's stop or the hotel), so the two show together. The map draws no line to it
and gives no distance: a straight line isn't the way a group walks, and the finder's Directions, right under the
place's name, opens the real route. How far it is by road, the finder asks Google
([ADR-20261124-finder-google-distance](ADR-20261124-finder-google-distance.md)). The day and the area move behind one button that opens a sheet, and the intro
line shrinks to one short sentence. Asked for by the group's feedback on 2026-11-24, after the results and then the
finder pushed the map below the fold on phones and on a desktop. Making the picked place "more obvious so that they
can know what the direction, distance" was asked for the same day.

## Context

- The results (`#mapres`) and the finder (`#mapfind`) rendered as blocks above the map stage. At 390 px the map already
  started about 330 px down, under the intro line and three rows of chips (areas, days, categories); nine results
  pushed it off the screen. At 1280 × 800 two results put the map's top at about y 690.
- [ADR-20261122-place-finder-best-day](ADR-20261122-place-finder-best-day.md) put the finder in the results' place
  above the map and rejected a bottom sheet because it "would cover the map it points at". With the map below the list,
  the pin was out of sight anyway, which is what the group reported.
- Map apps settled this long ago: the map fills the screen, the search sits over it, and the results live in a sheet
  (phone) or a side panel (desktop) whose camera aims past it. The group knows that pattern.
- An app bar at the foot of the screen is being built on another branch; it exposes its height as `--chrome-bottom`.
- A picked place landed at street zoom (16–17) with a thin dashed line from the phone's dot, which was then almost always
  off screen: the line left the map with no direction. A line with a distance, a compass direction and a walking time
  on it was built and dropped the same day: a straight line crosses rivers, rail lines and highways that the group
  has to walk around, so its numbers mislead, and a real route (Google's Routes API) would cost a call per tap and a
  key change for what Directions already gives.

## Decision

- **The stage:** `#mapstage` holds the search row (field and List), one chip row (the day and area button, then the
  categories) and the map's box (`#mapbox`). The box is `100dvh` less the header (`--bar-h`), the app bar
  (`var(--chrome-bottom, 0px)`) and the rows above it, so once the stage sits under the header the whole map shows.
  Opening the pane brings it there (`stageInView`, an instant scroll; Back restores the place).
- **The pane** (`#mappane`, 16-map.js) holds the results and the finder, over the map inside its box. Its mode is a
  container query on the stage, not the screen: below 640 px a sheet, from 640 px a panel `min(360px, 50%)` wide. So a
  desktop's column, a tablet and a full-screen map each get the layout their width suits.
- **The sheet's heights:** peek (its head and the first line), half (42 % of the map, at least a row more than peek,
  and for the finder down to its links, Directions among them, as long as 140 px of map stay open)
  and full (all but a 12 px strip). Its head follows a finger and settles on the nearest height with the flick carried
  over (`springTo`, 20-views.js); two chevron buttons do the same by tap and keyboard, greyed out at their ends; the
  close button shuts the pane. Every gesture has a visible tap equivalent (affordances rule 21). It opens at its last
  height, never as a sliver; under reduced motion it moves at once.
- **The camera aims past the pane:** a picked place lands in the middle of the open part (`paneAim`: MapLibre's
  `easeTo` offset, Google's `panBy` after `panTo`), and fitting pins or an area pads for it (`panePad`). The map's own
  controls and its message ride above the sheet and clear the panel (`--pane-cover`, `--pane-left`).
- **A tapped result:** a sight, shop, food, drink or wishlist place opens the finder in the pane at half height, its pin
  marked without a popup (the finder is its card). Transport and toilets lower the sheet to a peek and open the pin's
  popup. Back returns to the list where it was and at the height it had; the finder keeps its own history step.
- **The picked place on the map** (21-place-finder.js `frameFrom`, `destMark`, `nameSide`; both maps use them):
  - **Framed with where the group is:** the phone when its location is known and near the trip (`meLL`, not
    `farAway()`), else the plan's stop under way on a trip day or the hotel: `nearAnchor()` (24-near-me.js), the same
    start Food near me takes without location. The camera fits both into the open part (`framePad`: room for the
    place's name, more on the right where the map's buttons are, always the pane's cover), at zoom 17 at most so two
    close points don't zoom absurdly (MapLibre's `fitBounds` `maxZoom`; Google's `fitBounds`, then back to 17 and
    centred in the open part past it). Next door (under 100 m) or with nothing to frame it with, it aims at the place as
    before. It frames once, on the tap; a later location fix never moves the camera.
  - **Its mark:** its pin (or a Google result's own marker) grows onto a paper disc ringed in ink, its name beside it,
    kept on the map (`nameSide`: the pin sits at the frame's edge, so the name goes in from it), and one ink halo rings
    out as it lands (none under reduced motion; the ring is the static cue).
  - **No line and no distance on the map,** not even the old dashed line from the phone to a picked pin: a straight line
    isn't the way a group walks. **Directions** (with Details and Map) sits right under the place's name in the finder,
    in sight at the sheet's half height on a small phone, and opens the real route in the phone's maps app. The
    finder's own distances to each day's stops stay as they were, noted as straight-line estimates.
  - **Cleared** when the finder closes (Back, ✕, a new search, a filter, a redraw): `map.unpick()` drops the mark and
    the pin it had picked.
  - **A pin tapped on the map** (a toilet, a station, any pin, outside the finder) gets the ring and the halo, with its
    popup as before. No name beside it: the popup names it, and a label beside the pin covered the popup's buttons or
    ran off the map's edge. It is framed with the phone only when the phone's location is on and near the trip (`meNear`); without
    it the camera stays put, so browsing pins never jumps the map to the hotel on every tap. Never a line, for the
    same reason as above: the old dashed line from the phone to a tapped pin is gone too (asked for on the same day,
    after "will a line for toilets and stations but not for search results confuse the group?": the same place
    would have behaved two ways, and blue dashes read as a walking route).
- **The pane's head** carries its title: the count of places, "Google results", or, for the finder, Back to results.
  The results' own head keeps the sort.
- **Filters:** one button before the categories names the day the map shows (in the day's colour) and opens a sheet with
  every day and every area as wrapped buttons; a pick applies at once and closes it, before the map has loaded too.
- **Full screen** is the same stage as a fixed layer over the page (z-index 50). Below 1024 px it ends at the top of the
  bottom bar (`bottom: var(--chrome-bottom)`, [ADR-20261124-bottom-app-bar](ADR-20261124-bottom-app-bar.md)), so the bar
  stays one tap away; elsewhere only the safe area stays clear at its foot.
- **Copy:** the intro line is "Colour is the day; shape is the type." The rest it said is in the controls' own labels.

## Alternatives

- **Keep the list above the map and cap its height.** The map still starts below the list and the chips, and the pin
  of a tapped place is out of sight. Rejected: it moves the problem, not the map.
- **A results page that swaps with the map (List / Map toggle).** Simple, but the group can't see the place and the map
  together, which is the whole point of searching on a map. Rejected.
- **The search inside the sheet (Apple Maps).** Saves a row, but the field moves with the sheet and sits under the
  phone's keyboard at the map's foot. Rejected: the field stays above the map, where the thumb and the keyboard expect
  it.
- **The sheet's head as one button that taps through the heights.** One control fewer, but a target that answers to a
  tap and a drag breaks affordances rule 21. Rejected for two chevrons beside it.
- **A line to the place labelled with its distance, compass direction and walking time** (built, then dropped on
  2026-11-24). It answered "which way, how far" at a glance, but a straight line crosses what the group has to walk
  around, so its distance and minutes read as a route and aren't one. Rejected: no line, and Directions for the way.
- **A real route from Google's Routes API, drawn and labelled.** Right distances, but a paid call on every tap, the
  browser key opened to one more API, and the page's policy opened to one more host, for what Directions already shows
  in the maps app the group knows. Rejected for now.
- **Keep street zoom and only mark the pin.** The place shows, but not where it is from the group. Rejected for framing
  both.
- **Switch modes by the screen's width.** A full-screen map on a tablet and a desktop's column differ by 600 px at the
  same screen width. Rejected for the container query.

## Consequences

- **Security:** none from this decision. No new hosts, data or storage; the pane's height is page state, not stored. The
  framing is worked out on the phone from the page's own data. The finder's distance by road does send a start to
  Google: [ADR-20261124-finder-google-distance](ADR-20261124-finder-google-distance.md).
- **Operational:** the stage's height formula assumes the rows above the map are about 120 px; a new row there means
  changing the 140 px in `.map-box`. The bottom bar sets `--chrome-bottom` on `:root`; the map's
  height and the full-screen layer's foot both read it, so a change to the bar's height needs no change here. The e2e tests use a MapLibre stand-in (`tests/support/maplibre-stub.mjs`) to check the marked pin, the camera's
  aim and frame, and that no line is drawn, offline; the drawn map is still checked by eye in WebKit (`verify-page`).
  Google's map frames and marks from the same helpers, but no test can load it without a key: a change there is
  checked on the free map and mirrored in `18-map-google.js` by hand.
- **Cost:** none from this decision; Google is asked only on a tap. The finder's distance by road is one paid search per
  place opened: [ADR-20261124-finder-google-distance](ADR-20261124-finder-google-distance.md).

## Read when

Changing the Map view's layout, its search, the list pane or the place finder's placement, a picked place's framing or
mark, the day and area filters, the full-screen map, or anything that sits at the foot of
the screen over the map.

## Amendment 2026-11-28

[ADR-20261128-progressive-disclosure](ADR-20261128-progressive-disclosure.md): the categories left the chip row over the
map for the Filters sheet, beside the days and the areas, with what the pins mean at its foot; the button names the kind
after the day when one is picked. The intro line ("Colour is the day; shape is the type.") moved into that sheet. With
one day picked, the other days' pins stay on the map, quieter, instead of hiding.
