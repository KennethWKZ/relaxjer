---
id: ADR-20261128-progressive-disclosure
date: 2026-11-28
title: 'The Page Shows a Glance Layer and Hides the Rest: Folds for Lists, Icon Tiles for Single Parts, One-Line Stops'
domain: design
status: amended
decision: 'Glance layer open (Now/Next, hotel, week, day card, one-line stops); lists fold with a count; single parts are icon tiles; one money number.'
tags: [engine, trip-data]
supersedes: [ADR-20261127-stop-detail-fold]
---

# The Page Shows a Glance Layer and Hides the Rest: Folds for Lists, Icon Tiles for Single Parts, One-Line Stops

## Summary

The trip page stops printing everything at once. What the group needs at a glance stays open, one line each: Now and
Next, tonight's hotel, the week, a day's card and its string of stops. Everything else is one tap away, through one of
two kinds of disclosure, each for its kind of content. A list you scan (the backups, the trip's facts, the days in
Days, the places on the map) is a **fold**: a big heading with its count and a chevron that turns, opened in place. A
single thing you open and close (a day's route, its costs, its rain plan, a decision, the flights) is a **tile**: a
32 px icon over a short word, which opens the sheet that part already had. Money on the glance layer is one number:
each person's share, in the currency this phone reads, marked "about". Asked for by Kenneth on 2026-11-28 after the
Sapporo demo at 390 px: "Why is our layout so full of text? People see so many words and think it's complicated.
Airbnb and Wanderlog look clean: details are hidden until you press expand." It replaces the dense-but-calm direction
in `DESIGN.md`, and [ADR-20261127-stop-detail-fold](ADR-20261127-stop-detail-fold.md).

## Context

- At 390 px a day showed its money four ways (each person, in two currencies, and the group, in two), a text chain of
  its route with mode icons, two long "Whole route 1/2 · hotel → …" buttons and three icon buttons on its card, then
  "Plans and details" as nine full-width summary buttons with a heading and a sentence each, then a schedule where
  every stop had a two-line time range, a note and an identical lantern knot. Today's facts were a key/value table of
  sentences (the hotel's address in two scripts, a note, and a phone line that read "undefined" when the hotel had
  none), and the location ask was a paragraph and two buttons.
- The group opens the page tens of times a day for one answer each time. The answer was there, but buried; the
  planner's sentences, written once, were read by nobody on the tenth open.
- Kenneth sent eleven screenshots of Airbnb's trip view and Wanderlog's itinerary. What we took from them, in our own
  look (the lanterns, the day colours and the seal stay): sections collapsed by default with a big heading and a
  chevron; "bookings & attachments" as a row of big icons with small words; a day collapsed to its date and title,
  with only one open; the ⋯ that holds what's rarely used; one big number on a money view; a hint shown in full once
  and as one line after.
- Affordances rule 13 says what most readers need is never folded away, and PRODUCT.md says seniors use the page. So
  the glance layer is chosen by what a reader needs on most opens, and every icon keeps its word.

## Decision

- **The glance layer stays open.** Today: Now and Next (or the countdown), tonight's hotel, the week, one line a day. A
  day: its card and its string of stops. Nothing else is open by default.
- **Folds for lists you scan** (a native `details`, so the page's search finds what's inside and opens it, and a reload
  reopens what was open: `spotSave`): Today's trip facts and backups (`foldHTML`), the budget's notes, the hotel's
  address, the map's places by day, and the days in Days. A fold's heading is big, says what's inside, carries its count
  and a chevron that turns.
- **Tiles for single parts** (`partsHTML`, `partBtn`; `.parts.tiles`, `.tile`): a 32 px icon over a word at the Label
  size (0.8125rem, never smaller, so it follows the phone's text size), in a grid that wraps, never a sideways scroller;
  a small count for a part that holds a list. Four to a row on a phone, five when there are exactly five, and on a wider
  screen as many as split them into even rows, so no tile is left alone on a row. A tile opens the sheet the part
  already had; the sentence that summed it up moved to the top of that sheet. A day shows two rows at most on a phone:
  past eight parts, seven tiles and a More tile whose sheet lists every part with its heading and its line. A tile that
  goes to another view (Today's Airport, Entry, Checklist, Budget) is a link that looks like the others: no corner
  mark, the tile is the cue. Its word
  is the block's `tile: [zh, en]`, else its heading when that's short (five characters, sixteen in English), else the
  word for its kind.
- **A day's card** is its picture, its date big with its number small, its wish (the brush identity), its title, one
  line of icon facts (time on the way, each person's share, the forecast where no sky shows it, a rain plan) and ⋯. The
  route chain, the whole-route buttons and the day's focus moved into the Route tile's sheet; copy for chat, copy link
  and the map moved into ⋯'s sheet, with their words.
- **A stop is one line**: its start time, its kind on the string (a meal, a ride, a walk, a sight, the hotel, a flight,
  shopping; read from the stop, or the data's `icon`), its name, and a chevron. A fixed time keeps the seal-red diamond
  and a second line with the seal and its range. A note the group must act on (`todo: true`: wear a hat, book ahead,
  be on time) stays as a short second line. Two lines at most. Opened in place, a stop shows its whole time, its note
  and longer note, where a split rejoins, its actions as labelled icons (map, directions, show the driver, Add after)
  and its sheet (nearby and more). Nothing sits on the string between stops: the "+" that stood under every stop moved
  into the opened stop as Add after, and the day's Add a stop stays at the schedule's foot. In Snow Light Path the kind
  sits on a ring as in the default world, and only the stop under way keeps a candle. A clash after a push-back stays
  visible: it asks the group to act.
- **One number for money on the glance layer** (`Money.glanceShare`): the middle of the range divided by the group,
  rounded as converted figures round, in the currency the phone reads, marked 约 / ≈ and 估 / est. where the plan marks
  an estimate. The range, the group's figure and the other currency stay in the sheets (Spend, the budget view).
- **Labels stay; sentences go.** Every icon keeps its word, the place actions too (`placeActs`: Map, Directions, Show
  driver, Call, Copy name, each an icon over its word). The copy and link buttons that were icon-only on a phone have
  their words in ⋯'s sheet.
- **Today's hotel** is a card: its name, its dates and nights, and a row of labelled icons; the address folds under it.
  Its phone shows only when the data has one (it printed "undefined" before).
- **Repeated hints: in full once, one row after, gone for good on ✕** (`Plan.hintForm`, `hint(id)`, `store` `hints`,
  never synced). The location ask shows what it does, where the position stays and its button the first time on this
  phone; every later opening it is one row (a pin, "Late alerts", Turn on, ✕). The header's Install shows with its word
  the first time this phone can install; every later opening it is a row in More's settings, and the header keeps the
  brand, search, the currency and the language. ✕ puts the location ask away for good; Location stays in More's
  settings while it's off. There is no rain notice to shrink: the rain plan is a fact on the day's card and a tile. The
  group-sync name bar stays (it already is one line, its Later waits a day, and without a name the group can't tell who
  changed what); running late, a clash and a blocked device are states to act on, not hints.
- **A day row reads the same everywhere** (the week, Days, the rail, Sections, the map's list): its mark, its date with
  the seal's small diamond when it holds a fixed time, its short name (`days[].short`; without one, the first place of
  its route and how many: `Plan.shortFromTitle`) on one line, and its forecast (icon and high) on the right only while
  the day is inside the forecast the page already has. The name gives way to an ellipsis; the forecast never does. The
  full route is in the opened day.
- **Days** lists every day as one line (its mark, short date, Day number and short name, a turning chevron), one of them
  open with its stops one line each and a row into the day. The open one is the day on screen, else today; **before
  the trip, the first day; after it, none** (the list is the trip's summary then, and nobody needs one day). No row of
  date chips: with each day one line, every day fits the sheet without scrolling sideways, and a chip row would bring
  back the sideways scroller [ADR-20261124-bottom-app-bar](ADR-20261124-bottom-app-bar.md) took away.
- **The map's places by day** fold the same way, the same day open, a closed day's name on one line. **Another day's
  pins stay drawn, quieter** (their picture at 40 % and smaller, under the day's own: MapLibre writes the marker's own
  opacity) while one day is picked; they were hidden before. No accepted decision named hiding them; the list and its
  count keep to the picked day. **One Filters button** over the map holds the day, the kind and the area, and what the
  pins mean, in its sheet; the chip row and the intro line are gone (amends
  [ADR-20261124-map-first-search](ADR-20261124-map-first-search.md)).
- **Repeated hints shrink**: the countdown is one number, one line and one action (the to-dos coming due are a count on
  its button); empty and status lines are one line.

### What we took from the references, and what we didn't

| Reference                                            | Taken                                                       | Not taken, and why                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Headings of a few big words; the rest under ⋯        | A day's date big, its number small, its title quieter; ⋯    |                                                                                   |
| Sections collapsed by default, big heading, chevron  | Folds (`details.fold`) with a count                         |                                                                                   |
| "Bookings & attachments": big icons, small words     | Tiles; Today's Flights, Airport, Entry, Checklist, Budget   |                                                                                   |
| Itinerary: one day open, the others one line         | Days and the map's list                                     |                                                                                   |
| Two lines at most on a closed row                    | Stops, the week, Days                                       | A date in a circle: the time column already anchors a stop                        |
| A jump list of names and dates only                  | Days: a date and a title per day                            | The rail and Sections keep their one line under a name; each row is one line now  |
| A sticky row of date chips above the days            |                                                             | A sideways scroller to reach a day (bottom-bar ADR); every day already fits       |
| ⋯ opening a sheet of icon + label rows               | A day's ⋯ (copy, link, map); the More tile                  |                                                                                   |
| One big number on the money tab                      | The fact line's one share; the budget leads with its total  | Pill actions: the budget's parts are tiles, like every other view                 |
| A hint in full once, one line after                  | The location ask and Install: full once, one row after      | Kept for each hint on this phone, not per day; ✕ is for good, Settings keeps it   |
| A countdown: one number, one line, one action        | Before the trip: the number, the flight's line, Checklist   | The to-do list itself: a count on the button                                      |
| Empty states in one line                             | They already were; kept                                     |                                                                                   |
| A trip header: title, dates with a calendar, icons   | Today's band: a calendar, the dates, the Day number         | The group's size moved into Trip facts; the header's icons already had words      |
| Header actions as icons                              | Install leaves the header after its first showing, for More | Currency and language stay worded buttons: the group uses them daily              |
| Their look: white cards, brand purple, illustrations |                                                             | RelaxJer keeps its own world (lanterns or Snow Light Path, day colours, the seal) |

## Alternatives

| Option                                                  | Why not                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Keep the summary buttons and shorten their sentences    | Still nine full-width cards a day; the shape, not the words, made the wall                                             |
| Fold everything, the schedule too                       | The string of stops is what the group opens the page for (rule 13); folding it costs a tap on every open               |
| Icon-only tiles (no words)                              | Seniors use the page (PRODUCT.md, affordances rule 9); "Rain plan" and "Spend" aren't conventional glyphs              |
| A sideways scroller of tiles, as some apps do           | Rule 14 and 15: nothing reached only sideways; a wrapping grid shows every tile                                        |
| Collapse a stop to its name and open its sheet on a tap | Its note is usually what's needed; a sheet for one line is a dialog too many (the reason stop-detail-fold rejected it) |
| Show each person's range, not one number                | Two figures per line is what made the card read as a table; the range is one tap away in Spend                         |

## Consequences

- **Security:** none. No new host or permission; one more key in the phone's own storage (`hints`), never synced. A stop's open state is kept for the page view only; a
  reload reopens open folds through the existing `reloadSpot`.
- **Operational:** four optional trip fields, checked by the contract: a stop's `todo` (needs a note) and `icon` (one
  of `Plan.stopKinds`), a block's `tile` (at most 6 characters in Chinese and 16 in English), and a day's `short` (at
  most 10 and 24). A trip without them renders with the page's own words and kinds. trip-intake and trip-customize
  write `short` for every day. The hints a phone has seen or put away live in its own storage (`hints`); clearing the
  site's data shows them in full again. `DESIGN.md` is rewritten around the glance layer; the e2e specs that
  read the old summary buttons, the always-visible notes and the copy buttons on the card now open the tile, the stop
  or ⋯ first. The landing page's phone screenshots are retaken; its drawn postcards still show the old day card, a
  known issue in the story index until they are redrawn (`.claude/rules/docs.md`).
- **Cost:** a few kilobytes of CSS and markup, three icons (`i-bed`, `i-sight`, `i-phone`). Fewer nodes at first
  paint: the stops' notes and actions are drawn but folded, and the tiles are smaller than the buttons they replace.

## Read when

You're adding anything a day, Today, Days or the map shows; deciding whether something is open, a fold or a tile;
adding a hint or a banner the page repeats; writing a stop's note, `todo` or `icon`, a block's `tile` or a day's `short`;
or changing how money shows on the glance layer or a day's row.

## Amendment 2026-11-28

An opened stop's labelled icons end in **Skip** (跳过) on every stop but a flight or the lodging, and a stop whose
place is closed that day says so under its name with Skip beside it
([ADR-20261128-skip-planned-stops](ADR-20261128-skip-planned-stops.md)). A day's skipped stops are a fold, the kind for a
list: one row on the string at the schedule's foot, "N skipped", with its count and a chevron that turns, each inside
with Put back. Right after a skip, the stop stays greyed where it was with the suggestion to move the next stops
earlier, until it's taken or declined.
