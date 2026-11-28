---
id: ADR-20261124-grouped-lists
date: 2026-11-24
title: 'The Lists That Go Somewhere Are Grouped Lists: One Card per Group, Full-Width Rows Split by Inset Hairlines, Each Ending in What It Does'
domain: design
status: amended
decision: 'The rail, Days, More and the Sections sheet are grouped lists: cards of 52 px rows split by inset hairlines, each row ending in ›, a value with ⌃⌄, or nothing.'
tags: [engine]
---

# The Lists That Go Somewhere Are Grouped Lists: One Card per Group, Full-Width Rows Split by Inset Hairlines, Each Ending in What It Does

## Summary

Every list on the trip page that takes the reader to a part of the trip, and the settings beside them, is one component:
an inset grouped list, as in iOS's Settings. The desktop's week rail, the Days sheet, More on a phone and a tablet, and
the desktop's Sections sheet each show one rounded card per group ("Each day", "Trip info" or "Everything else",
"Settings", "Amounts and rate"), white on a Fog Grey ground (at night, a step lighter than the dark ground). Inside a
card the rows are full width, one column at every screen size, at least 52 px tall, and split by a hairline that starts
where the words start. Each row leads with its mark (an icon on a tinted tile, or the day's own lantern or world mark)
and ends in what it does: › for a row that goes somewhere else, the value and ⌃⌄ for a choice that changes in place,
nothing for an action. The part of the trip on screen keeps a lit row with two cues. Affordances rule 3 (8 px between
neighbouring targets) gets an explicit exception for these rows. The two filled buttons at the top of More and the
Sections sheet (Find food near me, Toilets nearby) and the Sections sheet's Now and Next rows stay as they were.

## Context

- One action, "go to a section or a day", was drawn three ways: the rail's tinted cards with a bordered icon square and
  a chevron; the Days sheet's rows with a chevron; and More's and the Sections sheet's two-up pale tiles (`.toc-sec`,
  `.toc-day`: Fog Grey on paper, about 1.1:1, no chevron, a bare icon).
- In sunlight the pale tiles read as labels, not buttons (affordances rule 25), and rule 12 says something that goes
  elsewhere gets a right chevron. Two columns also squeezed long English names ("Food & drinks", a day's title) at
  390 px.
- The settings in More were the same pale tiles with "Theme: Light" run into one label, so a reader couldn't tell a row
  that changes a value from one that opens something, and Install and the reset row were link buttons of another shape.
- The group is on iPhones and Android phones, many of them seniors. A grouped list with chevrons is the list every one
  of their phones' own settings uses; it needs no learning.
- Rule 3 asks for 8 px between neighbouring targets. A grouped list puts rows edge to edge with a hairline between
  them, as every platform list does.

## Decision

- **One component** (`style.css` `.gl`, `.gl-h`, `.rl`; `04-render-nav.js` `railRow`, `pickRow`, `actRow`, `rlTile`,
  `dayRow`). The rail (`renderRail`), Days (`renderDays`), More and the Sections sheet (`renderToc`) all draw their rows
  with it. Tokens in `:root`: `--gl-ground`, `--gl-card`, `--gl-tile`, `--gl-press`, `--gl-sep`, `--gl-end`, `--gl-r`,
  `--gl-pad` (DESIGN.md).
- **Groups.** A card per group, its heading above it at the Label size in Ink 3. The ground is `--gl-ground`: Fog Grey
  behind white cards in the light theme, the page's own dark behind cards one step lighter at night. On a desktop the
  rail becomes a Fog Grey panel holding the cards, like the sidebar of iPadOS's Settings.
- **Rows.** Full width, one column at every size, 52 px or more (rule 2), 14 px in from the card's edges (12 px in the
  300 px rail). A 34 px lead column holds the mark: a section's icon on a 32 px tile tinted 8 % toward ink (12 % at
  night), or a day's lantern (its world's mark in a destination world) in the day's colour, as before. Then the name and the lines under it: a day keeps two lines, its
  date (Day N and the Today flag) and its title, with the forecast on the right. The hairline between two rows starts
  where the words start (`--gl-pad` + 34 + 12 px) and runs to the card's edge; it sits 1 px above its row so the card's
  clip hides the first one, whichever rows a width shows.
- **The end of a row says what it does** (rule 12), and it's the same rule in every list:
  - **› goes somewhere:** a day, a section, Today; Group sync, which opens its own sheet.
  - **A value and ⌃⌄ changes here:** Theme ("Theme · Match system ⌃⌄") and which maps app. ⌃⌄ is iOS's mark for a
    pop-up choice: a tap moves to the next value, in place, and a toast says which. A right chevron there would promise
    a page that doesn't exist; a bare value would look like a label.
  - **Nothing for an action:** Pause the snow, Add to the home screen, and the reset row. An action's words and icon are
    link blue, and red for the reset, since it takes things away (Undo still follows it, as before).
- **The lit row** (rule 16): the part of the trip on screen has a 15 % tint of its colour (the day's lantern, else ink),
  a 2 px ring of that colour mixed 55 % with ink, so every lantern reaches 3:1 against the row and the card in both
  themes, and its name at 800. The hairlines beside it hide, and it takes the card's corner radius.
- **Feedback and focus:** on touch-down the row turns `--gl-press` and its mark sinks to 0.9 at once; only the release
  eases back over 160 ms (rule 17). The focus ring is the 3 px Focus Blue, drawn 3 px inside the row (negative offset),
  so the card's clip never cuts it; it is 3:1 or more on the card in both themes (rule 19).
- **Settings.** More and the Sections sheet share them: "Settings" (Theme on a phone, the sky's Pause below 1024 px,
  which maps app, Group sync), then "Amounts and rate" as a card of its own holding its segmented choice and rate field,
  then a card of the page's own actions (Install, then the reset row last), each card drawn only when it has a row.
- **The Sections sheet (a desktop)** follows the rail's order: Now and Next, the two nearby buttons, Today, Each day,
  Everything else, the settings. The old "Back to Today" row at its foot became the Today row at the top.
- **Rule 3's exception** (affordances.md): full-width rows of a list, 52 px or more, separated by a hairline, may sit
  edge to edge. The rows are tall, the full width is the target, and the hairline marks the boundary; a gap would break
  the card into tiles again. Every other neighbouring target keeps 8 px.
- **Kept:** the Now and Next rows (only their fill follows the card colour, so they stand on the new ground) and the two
  filled nearby buttons, which act rather than go.

## Alternatives

- **Keep the two-up tiles and add chevrons:** the names still squeeze at 390 px, a chevron on a half-width tile reads
  as decoration, and the Days sheet and the rail would still be a different component.
- **8 px gaps between full-width rows (separate cards per row):** what the rail had. It adds 8 px a row for nothing a
  hairline doesn't already say, and reads as a stack of buttons rather than one list.
- **A › on the choice rows too, opening a picker:** a second sheet for two or three values; more taps for a setting the
  group changes once.
- **A switch for the sky's Pause:** the row is a pressed toggle named for what a tap does next, shared with the
  desktop's header button; a switch would show the opposite state to the button beside it.
- **Coloured icon tiles, as iOS:** on this page a colour means "this day" (a lantern) or the region's data (a metro
  line). Section tiles stay neutral; only days carry colour.

## Consequences

- Security: none. No new storage, host or permission; the rows draw from data already in the page.
- Operational: `tests/e2e/affordances.spec.mjs` measures every grouped list a width shows (Days and More below 1024 px;
  the rail and the Sections sheet from 1024 px): rows of 52 px or more, as wide as their card, each ending in ›, ⌃⌄ or
  nothing as its kind says, hairlines that start where the words do, the lit row's tint, weight and 3:1 ring on all
  seven lanterns in both themes, the focus ring inside the card at 3:1, and the press on touch-down. Rule 3's test skips
  `.gl` rows. `auditList` and `rowLook` in `tests/support/page.mjs` hold the measures; `LIST` the selectors. The
  landing page's postcards still draw the old Sections sheet: redrawing them is a follow-up (`.claude/rules/docs.md`).
- Cost: a few hundred bytes of CSS and markup; one new icon (`i-updown`).

## Read when

Changing the rail, Days, More, the Sections sheet or the settings in them; adding a row that goes somewhere or a new
setting; or deciding whether a list's rows may sit edge to edge.

## Amendment 2026-11-28

The Days sheet's rows are now folds, not links ([ADR-20261128-progressive-disclosure](ADR-20261128-progressive-disclosure.md)):
each day is the same row (its mark, its date and Day number, its title, the forecast) ending in ⌄, which turns when it
opens in place, and one day is open with its stops and a row into the day (that row ends in ›). The rail, More, the
Sections sheet and the settings stay as decided here.
