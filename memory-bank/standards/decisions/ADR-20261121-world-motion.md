---
id: ADR-20261121-world-motion
date: 2026-11-21
title: "A World's Pictures May Move: Parts of the Drawing Itself, Only on Screen; Its Sky Follows the Scroll; Nothing Moves Under Reduced Motion"
domain: design
status: amended
decision: 'A moving part of a picture is a top-level group with data-actor, and splitArt returns the still drawing plus each moving part as its own SVG.'
tags: [engine]
---

# A World's Pictures May Move: Parts of the Drawing Itself, Only on Screen; Its Sky Follows the Scroll; Nothing Moves Under Reduced Motion

## Summary

A destination world's pictures (its day banners and the overview's scene) may move, and the world may draw a sky
behind the whole page that follows the scroll. A part of a picture that moves is a group in the drawing,
`<g data-actor="<part>" data-box="x y w h">`; the build cuts it out into a picture of its own (`engine/world-art.mjs`)
and the page lays it back over the rest at that box, so the picture at rest is the drawing as drawn. The world's
stylesheet moves each part by transform and opacity, only while its picture is on screen (`.is-live`, set by an
IntersectionObserver in `11-scroll-spy.js`), and never under reduced motion. In Snow Light Path every activity's
picture has a motion of its own: steam and spreading rings on the onsen, curling steam off the bowl, a van on the road,
waddling penguins, the rider and the skier leaning through their turn, a wave, a train that runs in, waits and pulls
away, a plane flying on past clouds, someone strolling down the town's canal path, a shopper's hop, and a lone spruce
swaying in a windy snowfall. A world's `backdrop` (in its `.mjs`) names fixed layers the build lays before the header
and a closing scene after the footer; the stylesheet ties them to the scroll alone (`animation-timeline`), so scrolling
down the trip is a night passing behind the cards, from dusk to a sunrise, and nothing in it moves by itself. The
activity marks gain `drive` (a road trip). On a phone the overview's scene narrows to a strip, and to a ribbon on a trip
day, so Now and Next with their buttons stay on an iPhone's first screen. This amends the "Motion in a world" line of
[ADR-20261117-destination-themes](ADR-20261117-destination-themes.md), which allowed no background motion.

## Context

- The planner asked for the snow world to feel livelier and cuter, like trip pages made by hand: small moving things,
  such as a van driving on the road trip day, then for every activity's picture to move its own way, readable on a
  phone (not one vehicle everywhere), and for the sky the landing page draws behind its words ("scrolling, you see
  lanterns and the sun until sunrise behind"): the trip's night passing as the group scrolls down it.
- Snow country's tree was bare and broad, and read like a roadside poplar; a "lone tree in a snowfield" day calls for
  the single conical spruce standing alone on a white hill.
- ADR-20261117-destination-themes allowed a world one first-open moment and motion on state only (the candle under
  way), and no background motion, so nothing would move behind what the group reads.
- The pictures are already decoration with no text over them (`aria-hidden`), embedded as `data:` images so their ids
  never meet. CSS can't reach inside an image, and an animation inside an SVG image can't be paused off screen or
  stopped by the page's own reduced-motion rule.
- Animating parts of a big inline SVG repaints the whole drawing every frame on a phone; moving a separate image by
  transform runs on the compositor.
- Most of the page's words sit on the page paper, not in a card, so anything drawn behind the page sits behind words.
  WCAG 2.2.2 asks that anything moving by itself for more than 5 s can be paused; a backdrop moved only by the
  reader's own scroll doesn't move by itself.
- On a real twelve-day winter trip in this world, the overview's scene (168 px at 390 px wide) pushed the Now card's
  buttons to 727 px, past the 664 px an iPhone shows under Safari's bars (`tests/e2e/location.spec.mjs`).
- Driving days had no mark of their own; the closest, `snow`, is snow country, not the road.

## Decision

- **A moving part lives in the drawing.** One SVG per picture stays the source and the still frame. A part that moves is
  a top-level group with `data-actor` and the box it moves in, in the drawing's units. `splitArt` returns the drawing
  without those groups and each group as its own SVG, framed by its box and carrying only the `<defs>` it uses, with its
  box in % of the drawing. The build embeds them (`window.WORLD_ACTORS`, by mark), and `worldArt` lays each one over
  the picture as an `<img class="art-actor" data-actor="<mark>-<part>">` at its box. The engine knows no part by name.
- **Every activity's picture has a part of its own that moves**, distinct from the others and large enough to read on
  a 358 px banner (`tests/unit/worlds.test.mjs` fails a banner with none). The overview's scene has none.
- **The stylesheet moves them, within these rules:**
  - transform and opacity only, inside the picture's clipped box; nothing on the page around it moves or shifts;
  - only while the picture is on screen (`.is-live`); scrolled away, its animations are removed;
  - all of it under `@media (prefers-reduced-motion: no-preference)`: with reduced motion asked for, every part rests
    where it's drawn and is visible;
  - a part that arrives once (the plane) is out of sight until its picture first comes into view, comes in once, and
    is marked `data-arrived`; a part that comes and goes in a loop (the train, the stroller) rests where it's drawn
    whenever it doesn't move;
  - the candles in the pictures never flicker: a flicker means "the stop under way".
- **Snow falls** in a world's open-air scenes as two sheets of flakes on the picture's `::before` and `::after`,
  switched on per scene by `--snowfall`; snow country's snow is heavier and blown sideways.
- **The sky behind the page follows the scroll, and nothing else.** _Amended by
  [ADR-20261122-day-views](ADR-20261122-day-views.md): a world may also draw a live sky that moves by itself
  (`sky` in its `.mjs`, picked per trip by `TRIP.sky`): snow falling behind the words in the header and a band at the top
  of each view (the whole page behind the column on a desktop), with a Pause in the header that the phone remembers,
  still and without the Pause under reduced motion, stopped while the page is hidden. With a live sky this scroll-bound
  backdrop steps aside; with `TRIP.sky: 'off'` it stays as below._ A world's `.mjs` may export `backdrop` (`layers`,
  and `end` for a closing scene). The build lays `<div class="world-sky" aria-hidden="true">` with one `<i>` per layer
  before the header, and `<div class="world-end" aria-hidden="true">` after the footer; a page without a world, or a
  world without a backdrop, carries none of it. The layers are fixed, behind everything (`z-index: -1`), take no taps,
  and move only by opacity and transform on `scroll(root)` (the closing scene's sun on its own view timeline), under
  `@supports (animation-timeline: scroll())` and no-preference; without them the sky is a still night. Its colours
  stay inside bounds that keep every text colour on the page paper at 4.5:1 (by day lighter than L 0.8, at night darker
  than L 0.044); what is bright (a star at night, a flake) shows in full only in the lanes outside the text
  column and faintly over it, and the bright sunrise sits in the closing scene, where there are no words.
- **The overview's scene holds no moving part.** Below 600 px it crops to a 640 × 150 strip, and to a 640 × 88 ribbon
  when the Now card shows a trip day (`:has(.now-day)`), and a crop would cut a part off where it's drawn.
- **`drive`** joins the activity marks: a van icon in the page's stroke style, "公路旅行" / "Road trip", and a banner in
  Snow Light Path.

## Alternatives

- **Animations inside the SVG images (SMIL or CSS in the file):** no extra images, but the page can't pause them off
  screen, and an image doesn't follow the page's own reduced-motion and theme switches reliably across browsers.
- **Inline SVG with page CSS on its groups:** full control, but every frame repaints the whole drawing on the main
  thread, and the ids of two days with the same mark would meet.
- **Sprites drawn separately and pasted over the pictures:** simpler to place, but they read as stickers on a drawing
  instead of the drawing coming alive, and keep two sources for one picture.
- **One shared motion for every picture (snowfall, or the van):** cheaper, but the planner found it samey; each
  activity's own movement tells the day at a glance.
- **A sky that drifts on its own (time-based):** livelier, but it moves behind words by itself, needs a pause control
  (WCAG 2.2.2) and costs battery while the group just reads. (Taken up later with those costs met: a Pause, snow behind
  the words only, stopped while hidden, a frame cap: [ADR-20261122-day-views](ADR-20261122-day-views.md).)
- **The sky only in the margins:** no words over it at all, but a phone has 16 px margins, so the group would never see
  it; bounded colours behind the words give the same contrast.
- **Hiding the overview's scene on a phone on a trip day:** frees the most room, but the first screen loses the world
  the planner asked to feel more of; a ribbon keeps it at 49 px.

## Consequences

- Security: none. The moving parts are cut from the same plain SVG the build already checks (no script, image,
  handler or outside link) and go in as `data:` images; the sky is CSS and `data:` images the page's policy allows.
- Operational: `tests/unit/worlds.test.mjs` checks the split, that every banner has a moving part, every part a motion
  rule and every rule a part, that picture motion sits under no-preference and `.is-live`, that the overview's scene has
  no parts, and that the sky's colours keep every text colour at 4.5:1 and its motion sits on the scroll alone.
  `tests/e2e/world.spec.mjs` checks that a picture runs only on screen and holds still under reduced motion, that the
  sky sits behind everything, never widens the page, has no animation on a clock and holds still under reduced motion,
  and `tests/e2e/demo.spec.mjs` that the Sapporo demo's plane arrives once. The scene's strip and ribbon keep
  `location.spec.mjs`'s first-screen check inside 664 px on every day of that twelve-day trip (652 px at most).
- Cost: a few kilobytes per moving part and for the sky; a picture runs a handful of composited layers only while on
  screen, and the sky six fixed layers that change only while the reader scrolls.

## Read when

Adding or changing a world's pictures, a moving part, a world's motion, its sky behind the page, or what the overview
shows above Now and Next on a phone.
