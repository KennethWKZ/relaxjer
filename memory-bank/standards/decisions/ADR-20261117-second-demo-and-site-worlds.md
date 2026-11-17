---
id: ADR-20261117-second-demo-and-site-worlds
date: 2026-11-17
title: 'A Second Live Demo in Sapporo, and the Landing Page Picks Its World by the Visitor and the Season, Never by a Trip'
domain: hosting
status: accepted
---

# A Second Live Demo in Sapporo, and the Landing Page Picks Its World by the Visitor and the Season, Never by a Trip

## Summary

GitHub Pages now carries two synthetic live demos: Taipei in the default world at `/relaxjer/demo/`, and Sapporo in
Snow Light Path at `/relaxjer/demo/sapporo/` (`examples/demo-sapporo`). `pages.yml` builds both with no key and no sync
file, each with its own demo clock, and `tests/repo/site.test.mjs` holds it to exactly those two folders. The landing
page gains a world switch (Lanterns, Snow): a visitor's choice is remembered in their browser, and with no choice it
opens in Snow from December to February by the visitor's own clock, in Lanterns otherwise. It never follows the
maintainer's trips. Chosen by Kenneth on 2026-11-17 over a landing page that takes the look of his latest trip. Amends
[ADR-20261002-live-demo-on-pages](./ADR-20261002-live-demo-on-pages.md).

## Context

The engine gained destination worlds and a Japan pack
([ADR-20261117-destination-themes](./ADR-20261117-destination-themes.md),
[ADR-20261117-native-layer](./ADR-20261117-native-layer.md)). The only public demo was Taipei, so nothing a visitor
could open showed the second world, the native layer or the Sapporo pack. Story step 7 asked for a second destination
and a second demo. The maintainer also asked whether the landing page could switch to the theme of his latest trip.

## Decision

- **A second synthetic demo, `examples/demo-sapporo`:** five winter days for a group of six, two of them slower
  walkers; public landmarks, an invented hotel, flights (`XX 801`, `XX 802`), restaurants and prices; nothing from
  Google; dates only in date fields, so the live demo moves them into the visitor's year like Taipei's. It shows a
  split day, the Japanese names with romaji, the Snow Light Path look and the day marks. Every demo-only contract
  check (`tests/contract/demo-trip.test.mjs`) now runs on both folders (`DEMO_TRIPS` in `tests/support/stage.mjs`).
- **`--demo-clock` takes either demo folder by path** and still refuses any other trip.
- **Pages builds both:** Taipei's clock stays the one the e2e suite pins (`DEMO_CLOCK` reads the first one in
  `pages.yml`); Sapporo's is Day 3 mid-morning, inside its booked ski lesson.
- **The landing page's world is the visitor's:** a switch, a remembered choice, and a season default. Its sky keeps the
  same scroll-linked day in both worlds; Snow puts candles in snow at the foot where Lanterns has lanterns.

## Alternatives

- **The landing page follows the latest trip's world:** rejected. A public page whose look changes with the maintainer's
  next trip tells anyone watching where he is going and roughly when, which is exactly what the release
  gate and the topics rule keep out of public view.
- **Publish the real trip, or a copy of it, as the second demo:** never. A real trip carries hotels, dates and names;
  the demo stays synthetic by contract.
- **Screenshots of a Sapporo page instead of a second live demo:** cheaper, but a visitor can't touch it, and the
  second world would have no live check on the same engine.

## Consequences

- **Security:** nothing new leaves a real trip. Both demos are synthetic by contract, built with no key and no sync file,
  and the workflow test refuses any other `--trip`. The world switch stores one word in the visitor's own browser.
- **Operational:** Pages builds two pages instead of one. Both demos must stay green on every engine change: their
  contract runs in tier 0, and Pages fails to build if either does.
- **Cost:** none; GitHub Pages and Actions are free for the public repo.
- `@demo` e2e tests still mean the Taipei demo; the Sapporo demo is covered by its contract and the world tests.
- A third demo is a reviewed change to `DEMO_TRIPS`, `--demo-clock`'s list, `pages.yml` and its test.

## Read when

Adding or changing a live demo, the Pages workflow, or how the landing page picks its look.
