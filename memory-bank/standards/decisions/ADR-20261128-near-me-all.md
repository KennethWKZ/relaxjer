---
id: ADR-20261128-near-me-all
date: 2026-11-28
title: 'Near Me Gets an All Tab of What’s Open Now, and a Far Wishlist Chip Says the Metro or the Drive'
domain: engine
status: accepted
decision: 'Near me: an All tab (every food and drink place, open now by its hours), remembered per phone; a wishlist chip past 1.2 km shows metro, drive or far.'
tags: [design]
---

# Near Me Gets an All Tab of What’s Open Now, and a Far Wishlist Chip Says the Metro or the Drive

## Summary

Find food near me opened on one meal at a time, so "what can we eat or drink right here, right now?" took a tab per
meal. It gains an **All** tab: every place to eat or drink at once, nearest first, with what's shut right now left out
and counted. The phone remembers All once picked. And a wishlist chip more than a short walk from a meal stop said only
"on today's route · 5.0 km"; it now says how to get there: "MRT · ≈ 20 min" from the stop's station to the place's, a
drive on a day that goes by car, or "Far · 5.0 km". Asked for by Kenneth on 2026-11-28.

## Context

- Near me lists each meal's food slots and wishlist food, the drinks, the rest spots, toilets and refill, one tab each,
  and hides a place closed that day by its closed dates. It never read the hours, so a place shut at the moment showed.
- Hours come in two shapes: Google's week on drinks (`week`: Mon…Sun, `24h`, `closed` or ranges) and the English line
  the data refresh writes on food and wishlist branches ("Daily 11:00–21:00", "Mon–Fri …; closed Tue").
- The data refresh writes each place's and each wishlist branch's nearest station (`mrt`: name, walk minutes and metres,
  whether it's walkable, a train or the metro, its position). Google gives no transit times in Japan, and the offline
  metro planner exists only where the trip has a network file (Taipei).
- The engine counts walks, taxis and distances in one model each (`walkMinM`, `taxiMin`, `Fit.distKm`;
  `tests/repo/engine-models.test.mjs`).

## Decision

- **An All tab, first** in near me's tabs. It lists the food slots and wishlist food of every meal and the drinks and
  rest spots, each once, nearest first, the wishlist's tag kept. A place shut right now by its hours (`Opening.openAt` on
  `Opening.weekOf`: Google's week, else the English line) is left out and counted, "N closed now"; an hours line it can't
  read stays in, never closed. Toilets and refill keep their own tabs.
- **Which tab opens:** the meal for the hour, as before, until the phone picks All; then All, until it picks a meal
  again (store `nearTab`: `all` or `meal`). A remembered meal would be the wrong one hours later, so the meal itself isn't
  kept.
- **A far wishlist chip** (`Reach.reach`): within 1.2 km it keeps its distance. Past it, on a day whose route drives and
  takes no transit, "Drive · ≈ N min" (the taxi model); else, when the stop's place (or for a meal row without one, the
  last place the day reached) and the wishlist branch both have a walkable station and they differ, the metro (or
  "Train" when either is a train station): the walk in and the walk out at the group's pace and a ride between the two
  stations, five minutes' wait then about 25 km/h on their straight-line distance; else "Far · 5.0 km". All are
  estimates for a chip. A tap opens the card, which names the station.

## Alternatives

| Option                                                 | Why not                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Remember the last tab as it was                        | A meal picked at lunch would open the next morning on lunch; All is the choice that holds             |
| Hide a place whose hours can't be read                 | Hand-written hours ("ask at the desk") would vanish though the place is likely open; unknown stays in |
| The offline metro planner for the chip                 | It needs the city's network file, which only Taipei has; two stations and a distance work everywhere  |
| Ask Google for the transit time when the chip is built | No transit times in Japan, needs a network, and is billed; the chip is an estimate                    |

## Consequences

- **Security:** none new; no location leaves the phone, and nothing is fetched.
- **Operational:** two pure modules (`engine/src/core/opening.mjs`, `reach.mjs`) with unit tests; near me and the chip
  code call them. A trip refreshed by the pipeline has the stations already; a hand-made trip without `mrt` gets "Far".
- **Cost:** none.

## Read when

You're changing near me's tabs, how a place counts as open now, or what a wishlist chip says about getting there.
