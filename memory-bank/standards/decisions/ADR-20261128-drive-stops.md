---
id: ADR-20261128-drive-stops
date: 2026-11-28
title: 'A Long Drive Lists Its Rest Stops for Reference, Found Along Google’s Route Line and Folded Under the Row It Drives In'
domain: trip-data
status: accepted
decision: 'drive-stops.json: rest stops along each 90+ min drive from Places search along the route; folded under its row, never planned; Next by the clock.'
tags: [engine, design]
---

# A Long Drive Lists Its Rest Stops for Reference, Found Along Google’s Route Line and Folded Under the Row It Drives In

## Summary

A long drive (90 minutes or more on Google's time) gets its rest stops: service areas, parking areas, roadside
stations and petrol stations along the route, in order, with how far in, their kind and their hours that day. A data
refresh step finds them with Google's search along a route line and writes `drive-stops.json`; the page folds them
under the row the group is in while it drives, shut until tapped. They are for reference only, "in case we need one,
so we can see which is next": nothing is planned around them, no time moves, and the fold doesn't depend on a planned
break. On the day, while the drive is under way, the one ahead by the clock is marked Next. Asked for by Kenneth on
2026-11-28, with that correction: a planned service-area break was taken out of the first trip's long drive.

## Context

- The first trip drives three hours and more on one day, in winter. The group wants to know where the next toilet,
  food or petrol is without a planned stop that moves the day's times when skipped.
- Google's Places Text Search takes `searchAlongRouteParameters` (a route's encoded polyline) and ranks places by the
  detour from it; Compute Routes gives the polyline. Both are billed per call and go through the pipeline's cache and
  its 200-call stop (ADR-20261001-resync-cost-guard).
- A Japanese expressway service area often has twins across the road, one signed 上り and one 下り, and only the one on
  the car's side can be reached. 上り runs toward the road's legal start, Tokyo's way on most roads, "with some
  exceptions" (NEXCO East's FAQ; Sapporo to Otaru is 上り), so the words and the map's direction toward Tokyo can't
  reliably say which twin a drive passes (destinations/jp/knowledge.md, Driving).
- The page reads no location for this (the live location card is a separate, opt-in feature) and works offline.

## Decision

- **A generic step, `drive-stops`**, opted into by naming it after `apply`. For each day's driving leg whose stored
  Google time is `drive_stops.min_drive` minutes or more (90 by default), and only for the drive that time was asked
  for (the same `from`, `to`, `mode`), it asks Compute Routes once for a high-quality route line, then Places Text Search
  once per search the country pack lists in `driveStops` (Japan: サービスエリア, パーキングエリア, 道の駅, ガソリンスタンド;
  コンビニ only while fewer than four stops were found), in the trip's Google language and region. About six calls a
  drive, cached. A decide option's own route isn't searched.
- **What it keeps** (`pipeline/lib/drive_stops.py`, pure, tested offline): places open for business within 800 m of the
  road; the kind from the name (the pack's patterns), then Google's type, else the search; of a service area signed
  for one direction, only the one on the side the car keeps to (the pack's `side`, `left` in Japan), told from which
  side of the route line it sits, when it sits 30 m or more off the line; each facility once (its shop and food court
  are one stop); petrol stations 15 km apart, a 24-hour one first. Minutes in are the leg's own minutes shared out by
  distance. Hours are those of the drive's weekday: 24 hours, closed, or the times.
- **The direction filter reads the side of the road, not the direction words.** The pack names the words (上り, 下り) so
  a twin is recognised and labelled, and the side decides which twin stays. A rule from where a road starts would need
  a table of every expressway's legal start.
- **`drive-stops.json`**: `{ checked, src, legs: { "d5:0": { from, to, mode, min, km, stops: [{ name, kind, km, min,
lat, lng, h24?, shut?, hours?, dir?, rating?, reviews?, rating_checked? }] } } }`. The contract checks the shape and
  the order. A demo carries no rating.
- **The page:** under the row the group is in while it drives (the arrival row when it starts by the time the drive
  sets off, a "Drive to …" row; else the row before it, a "Leave for …" row), one toggle in the nearby options' style:
  "N stops on the way · M open 24 h", shut until tapped. Open: the drive's Google time and km, a winter callout naming
  the 24-hour stops (inside the city pack's `refillWinter`, else December to February north of the equator), the
  stops as spot rows (kind icon, name, kind, "≈ 1 h 14 min · 83.5 km in", hours that day or an Open 24 h badge,
  Directions there), a line saying they're for reference, and the data's source and date.
- **Next, by the clock:** on the day, from the drive's set-off (the end of the row before its arrival, the time the
  refresh asked Google for) until its minutes and half an hour more have passed, the first stop whose minutes in are
  still ahead is marked Next (`Drives.nextStop`), refreshed each minute with Now and Next. No location is read, so the
  fold says it's a guess from the time and that a slow road may not be there yet.
- **The Sapporo demo** gains a day's drive to Asahiyama Zoo and back (Day 5; the flight home moves to Day 6), with
  made-up stops, so the fold is on a published page and its tests run.

## Alternatives

| Option                                               | Why not                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Plan a break as a stop in the day                    | Kenneth's correction: a planned break moves the day's times when the group drives on; the stops are only a reference |
| Nearby Search around points sampled along the route  | Many more calls, and it can't rank by detour from the road; search along the route does both in one                  |
| Keep the twin by "上り is toward Tokyo" from the map | Wrong where a road's legal start isn't Tokyo's way (Sapporo to Otaru is 上り); the side of the road is always right  |
| Mark Next from the phone's location                  | Needs location on and a network for a fix; the clock works offline, and the fold says it's a guess                   |
| Show every petrol station and convenience store      | A three-hour drive has dozens; spaced petrol and stores only as a fallback keep the list readable                    |

## Consequences

- **Security:** none new. The step uses the user's own server key through `lib/google.py`; the page gets names,
  positions and hours, as for other places.
- **Operational:** one opt-in step, documented in the pipeline README, the `data-sync` skill, trip-format and the
  guide; a pack field (`driveStops`) for the searches. `trip-data.mjs` now passes the pack's plain data to the
  pipeline (`lib/trip.py` `PACK`). A country without `driveStops` gets none until its pack names its searches.
- **Cost:** about six calls a long drive (one Compute Routes at US$5 per 1,000, five Text Searches at US$35 per 1,000 for
  the hours and rating fields): about US$0.18 a drive at list price, before the free monthly amounts, once, then
  cached.

## Read when

You're changing the rest stops along a drive, the `drive-stops` step, how a stop row folds its extras, or what the page
marks while a drive is under way.
