---
version: 1
slug: "engine-src-style-css"
primary_target: "engine/src/style.css"
related_targets: []
---

## Scope

The trip page's destination world `snowlight` (data-world="snowlight" on the root element), switched on by a destination pack's `theme` export. Visitor mode: Operate (a travelling group checking the plan many times a day, outdoors in snow glare and in a dark hotel room). Taipei and the demo keep the sky-lantern world unchanged.

## Direction contract

THESIS: The day is a footpath through snow lit by small candles set in the ground. It refuses the hung sky lantern (Taiwan's mark) and the generic "winter theme" of blue gradients and falling-snow wallpaper that moves by itself: its sky behind the page is the trip's own night passing, and moves only with the scroll.

OWN-WORLD: Snow-white frosted paper with a faint cold blue cast; day panels are frosted snow cards whose lower edge is a soft snowbank; seven candy day colours (as saturated as white text allows) that stay apart; a sticker book: die-cut stickers drawn for the world (white edge, soft shadow, a tilt), washi tape on the pictures, rounder corners, never a pill; candle amber only in the flame of a candle mark and the "now" stop; fixed anchors are a six-armed ice crystal; the seal is a deep winter crimson. Dark: navy snowy night lit only by the ground candles.

STORY: The group sees at a glance which day they are in (its colour and activity mark), walks the path stop by stop, and knows what cannot move (the crystal).

FIRST VIEWPORT: Unchanged composition: now card, then the week list with each day's activity mark; the snow card leads each day.

FORM: seed: none (pinned) "Snow Light Path (Recommended)"; "the day's schedule string reads as a footpath in snow, each stop a small candle set in the snow… fixed anchors an ice crystal".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Motion

One first-open snowfall inside the now card (once per phone, none under reduced motion); flicker only on the current stop's candle; the week stickers press flat with their row. The pictures (day banners, the overview's scene) come alive while on screen, each activity its own way: steam and spreading rings on the onsen, curling steam off the bowl, the road trip's van and verge poles, waddling penguins, the rider and the skier leaning through their turn, the wave's spray, a train that runs in, waits and pulls away, the plane flying on past clouds, a stroller walking off down the town's canal path, the shopper's hop, and in snow country a lone spruce swaying in a windy snowfall; transform and opacity only, inside the picture, still under reduced motion (ADR-20261121-world-motion). The sky behind the page (dusk, night with stars and an aurora, falling snow, dawn, candles along the edges, a sunrise after the footer) follows the scroll only, never moves by itself, and is a still night under reduced motion or without scroll timelines. No backdrop-filter on day cards.

## Open

Which days carry which activity mark is trip data (DAYS[i].motif), proposed to the planner, not set by the engine.
