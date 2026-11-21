---
id: ADR-20261117-destination-themes
date: 2026-11-17
title: 'A Destination Pack May Dress the Page in Its Own World; Days May Carry an Activity Mark'
domain: engine
status: amended
---

# A Destination Pack May Dress the Page in Its Own World; Days May Carry an Activity Mark

## Summary

A pack that exports `theme: '<name>'` puts the page in that destination world: the build adds
`engine/src/themes/<name>.css` after the stylesheet, sets `data-world="<name>"` on `<html>`, uses the world's paper for
the browser bar and the installed app, and, when the trip has no `img/icon/`, draws the home-screen and tab icons from
`engine/src/themes/<name>.mjs`. A trip whose pack names no theme carries none of it: the default world (the sky lanterns)
renders as before. Each day may also name an activity mark (`DAYS[i].motif`, one of a fixed list) that the week list and
the day's card show. First world: Snow Light Path (`snowlight`), picked by the Sapporo pack. This resolves DESIGN.md's
open question on re-theming.

## Context

- The page's look was one world, sky lanterns, made for the first trip in Taiwan. For a winter trip to Hokkaido the
  planner asked for a look that fits the place and the season, and for the icon, the background and the browser's tab
  to follow it, and for each day to show what the group does (snowboarding, a hot spring, the zoo).
- Lanterns are the Taiwan trip's mark; the Hokkaido look must show none.
- The operated layer (type, targets, layout, fixed-time meaning, states) is what the group relies on and is tested; it
  must not change per destination.
- The engine holds no country, city or trip constant; destination facts live in packs.

## Decision

- **Who picks:** the pack, with `export const theme = '<name>'`; the city's pack overrides the country's. A country
  may be too varied for one world (a Tokyo summer isn't snow), so Japan names none and Sapporo names `snowlight`.
- **What a world is:** two files in `engine/src/themes/`: `<name>.css`, every rule under
  `:root[data-world='<name>']` (tokens, then ornament), and `<name>.mjs` with `paper: { light, dark }` and an optional
  `iconPaint(u, v, mark)`, with the `iconMarks` it can draw beside its emblem. A world re-tints and re-draws; it never changes the type scale, targets, layout or what a control does.
- **Byte-identical default:** the build adds the world's CSS, attribute and script only when a pack names one, and
  the engine's markup is unchanged without one, so a Taiwan or demo page renders the same text as before (`pnpm
parity`). Class names stay (`.lantern`, `.stop-knot`); DESIGN.md names a world's parts by what they show.
- **Icons:** drawn by code, not by an image tool: `engine/icons.mjs` samples `iconPaint` 4 × 4 per pixel and writes a
  PNG with Node's zlib (no browser, no `sips`, works in CI), with `Software` and `Source` text chunks saying where it came
  from. A trip's own `img/icon/` always wins. The icon also carries the trip's leading activity: `core/motif.mjs`
  `leadMotif` picks the mark on the most days among the world's `iconMarks` (ties to the first; a flying day decides
  nothing the world can't draw), and the PNG's `Mark` text chunk names it. Snow Light Path draws only `snowboard` so
  far: another mark is a reviewed change with a picture, not a guess.
- **Illustrations:** a world may ship `engine/src/themes/<world>-art/<motif>.svg` and `hero.svg`, hand-drawn SVG
  (no generated or stock art, so the public repo can carry them). The build embeds only the ones the trip's days use,
  each as a `data:` image so their ids never meet, and refuses one that runs, loads or links anything
  (`tests/unit/worlds.test.mjs`). A day card opens with its activity's banner; the overview with the scene.
- **Activity marks:** `DAYS[i].motif` names one of `engine/src/core/motif.mjs` `names` (snowboard, ski, onsen, zoo,
  city, sea, snow, train, plane, shop, food), each a 24 px icon in the page's stroke style and a `[zh, en]` name. The
  trip contract refuses anything else. Nothing is read from a day's text. Any world shows it on the day's card; a
  destination world also shows it in the week list where the default world draws a lantern.
- **Motion in a world:** one first-open moment a world may draw (`--world-hello`; Snow Light Path: a 2.4 s snowfall
  over the now card, once per phone, never under reduced motion), and its own ornament motion only on state (the
  current stop's candle). No background motion. _Amended by
  [ADR-20261121-world-motion](ADR-20261121-world-motion.md): a world's pictures may move, only inside the picture,
  only while it's on screen, never under reduced motion; the activity marks also gain `drive`._

## Alternatives

- **Trip-level theme (`TRIP.theme`):** more flexible, but every trip to the same place would repeat it, and the planner
  would have to know the world names. Kept open: a trip override can be added later without changing packs.
- **Re-theme with CSS variables only, no ornament:** a Hokkaido page with recoloured lanterns is still lanterns.
- **Icons rendered with `sips` or a headless browser:** `sips` is macOS only; a browser makes every build depend on
  Playwright's Chromium.
- **Guessing the activity from the day's title:** fragile across two languages, and a wrong icon misleads; the planner
  names it.

## Consequences

- Security: none. A world's CSS and icon are engine files; the page's policy is unchanged (`data:` images were allowed).
- Operational: a new world is two files plus a pack line; `tests/unit/worlds.test.mjs` checks every world's scoping,
  day-colour contrast (4.5:1 for their ink, 3:1 on both papers) and icon, and `tests/e2e/world.spec.mjs` runs a world
  page built from the trip under test. Packs that name a world need a unit test line in `packs.test.mjs`.
- Cost: none; the icon renders in under a second at build.

## Read when

Adding or changing a destination world, a pack's `theme`, the activity marks, or how the build picks home-screen icons.
