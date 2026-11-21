---
id: ADR-20261121-world-stickers
date: 2026-11-21
title: 'Snow Light Path Is a Sticker Book: Candy Day Colours, Rounder Shapes, Die-Cut Stickers That Never Cover a Word'
domain: frontend
status: accepted
---

# Snow Light Path Is a Sticker Book: Candy Day Colours, Rounder Shapes, Die-Cut Stickers That Never Cover a Word

## Summary

Snow Light Path reads like a travel journal kept in the snow. Its seven day colours are candy: for each hue, as
saturated as sRGB allows at a lightness that still carries white text at 4.7:1. Its cards, chips and buttons are
rounder (24, 12 and 14 px, never a pill). The day's mark, the Today flag, the Now card's day number and the week tiles
are die-cut stickers (a white edge, a soft shadow, a small tilt), and stickers drawn for the world stand on the paper: a
penguin on the Now card's corner, and a snow bunny, mitten, heart or penguin in each day's drift, by turns. Each day's
picture is taped into its card with washi tape in the day's colour. A sticker is decoration: it never covers a word,
never takes a tap, never widens the page, and is hidden from screen readers. Everything is in the world's stylesheet
(`engine/src/themes/snowlight.css`); the engine adds no markup for it.

## Context

- The planner looked at the pastel pass and asked for it bolder and cuter: brighter colours, rounder shapes, more
  stickers. Pastels read as gentle, not cute.
- The day colours carry white text (the week tiles' marks, the Today flag, the whole-route tile, the Now card's day),
  so a day colour can't get lighter than about L 0.18 without failing 4.5:1; brighter has to come from saturation.
- The world's own rules stand: the ice crystal means a fixed time (so no snowflake ornament), nothing hangs or floats
  (so no star stickers), and the candle is the only bright warm light (so no amber or peach).
- Kenneth's default avoids pill buttons; the page's controls keep their 44 px targets and their selected states.
- The Now card must keep its buttons on an iPhone's first screen (390 × 664) on every day of a long trip.

## Decision

- **Candy day colours:** Soda `#2268f3`, Strawberry `#d4277d`, Melon `#128344`, Grape `#894df0`, Cocoa `#a7613b`,
  Lagoon `#137b9f`, Matcha `#647b11`: white text 4.7:1 or more, 4.5:1 or more on the light paper, 3.8:1 or more on the
  dark. Chips and route tiles take 15 % of the day colour, week rows 9 %, the day's card a stronger frost.
- **Rounder:** tokens `r-card`, `r-chip`, `r-btn`; 16 px for the Now card's go button, 18 px for week rows.
- **Die-cut stickers:** `sticker-edge` and `sticker-shadow`, with a tilt; the week tiles press flat with their row.
- **Drawn stickers:** plain SVG in the stylesheet as `data:` images (`--sticker-<name>`), the white edge and a soft
  shadow drawn in. The Now card's penguin is its `::before` (the first line keeps clear of it); a day's sticker is a
  layer of its card's `::before`, standing in the drift in 50 px kept clear below the card's last button.
- **Washi tape:** two strips on the picture's top corners, the `::before` and `::after` of the line after the picture.
- **Never:** a sticker over a word or a button, a snowflake or a star sticker, an emoji or a glyph for a sticker, a
  pill.

## Alternatives

- **Brighter, lighter colours with dark ink:** brighter, but the marks would turn dark on four of seven days, a bright
  magenta joined the set, and the white-on-colour sticker look was lost.
- **Stickers as engine markup:** easy to place anywhere, but the engine would grow decoration only one world uses;
  pseudo-elements keep it all in the world's stylesheet and the default world's page unchanged.
- **Snowflake and star stickers:** the obvious winter stickers, but they break the crystal's meaning and the Nothing
  Hangs rule.
- **Emoji stickers:** free, but they look different on every phone and aren't the world's drawing.

## Consequences

- Security: none; the stickers are CSS `data:` images the page's policy already allows.
- Operational: `tests/unit/worlds.test.mjs` checks the day colours' contrast; `tests/e2e/location.spec.mjs` keeps the
  Now card's buttons on the first screen (the stickers add no height); DESIGN.md holds the tokens and the Sticker Rule.
- Cost: about 6 KB of stickers in a Snow Light Path page.

## Read when

Changing Snow Light Path's colours, corners, stickers or washi tape, or adding decoration to any world's page.
