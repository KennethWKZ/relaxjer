---
id: ADR-20261128-water-refill
date: 2026-11-28
title: 'Free Water Refill Points Hang Under Each Stop, from OpenStreetMap and Private Sources Kept in the Trip Folder'
domain: trip-data
status: accepted
decision: 'refill.json: OSM drinking water plus trip-local refill-*.json, merged by a free step; a pill per stop, a map kind, near me; winter hides outdoor taps.'
tags: [engine, design]
---

# Free Water Refill Points Hang Under Each Stop, from OpenStreetMap and Private Sources Kept in the Trip Folder

## Summary

Someone in a group often drinks a lot of water, and bottled water adds up over a week. The page now shows free places
to fill a bottle: under each stop a 装水 / Refill pill with the nearest one's distance opens the nearest three within
600 m (a tap or a shop, the walk, the hours that day, open or closed when the group is there), the map has a Refill kind
with its own pin, and the near-me finder has a Refill tab. The data is one generic side file, `refill.json`, written by
a new free pipeline step, `refill`, from OpenStreetMap and from any `refill-*.json` the trip folder holds. A source the
public repo must not carry gets in through a step of the trip's own, `trips/<slug>/pipeline/<name>.py`, which the
refresh now looks for before the repo's. In a cold place's winter (a pack's `refillWinter`) outdoor taps are left out
and counted, "N closed for winter". Asked for by Kenneth on 2026-11-28, with a feasibility check of the sources the same
day.

## Context

- Google's Places API has no drinking-water place type that we found (not confirmed against its full type table), so
  the pipeline's rule, "OpenStreetMap only for what Google can't give", points at OpenStreetMap: `amenity=drinking_water`,
  `drinking_water=yes` on another feature, `drinking_water:refill=yes` for shops, `seasonal=*` for winter.
- OpenStreetMap is thin in some places (on 2026-11-25 Geofabrik's taginfo counted 239 drinking-water nodes in a whole
  prefecture of Japan's north) and its public Overpass servers were at capacity during the check, so the step has to cache, try a mirror,
  and keep the last answer.
- A refill app's map had far more spots (69 in one tile around a city station) through a public, keyless tile endpoint,
  but its terms grant no reuse licence. Kenneth decided on 2026-11-28 that a trip may use such a source for its
  private, password-protected page only, through a trip-local script; the repo stays generic and names no such source.
- Outdoor fountains in cold cities are turned off for the winter: Sapporo's parks close theirs in early to mid November
  and reopen them in April (the park operators' notices, read 2026-11-28; `destinations/jp/knowledge.md`).
- `nearDrinks()` returned early when a trip had no drinks data, so a trip with toilets but no drinks (any Japan trip)
  lost every toilet pill too; the refill pill would have sat behind the same guard. Reproduced in an e2e test first,
  then fixed: each pill now shows on its own data.

## Decision

- **One generic file, `refill.json`** (`checked`, `spots[]`): each spot's `id`, `src`, `name`, `lat`, `lng`, `address`,
  `kind` (`tap`, `shop` or `shelter`), `indoor`, `seasonal`, `hours` (`days` "1" Monday … "7", `known`), `hours_note`,
  `water`, `how`, `site`, `added`, `credit` ([trip-format](../trip-format.md#water-refill-refilljson)). The build puts
  it in the page as `REFILL`; the contract checks its shape. Without it the page shows no refill part anywhere.
- **A free step, `pipeline/steps/refill.py`**, opt in by naming it: one small Overpass query per group of the trip's
  places (places within 3 km share a box, grown by 800 m), one at a time with a generic user agent, cached in the trip's
  `.cache/refill-osm.json` for 30 days, a mirror tried when the server is busy, the last answer kept when both fail. It
  merges every `refill-*.json` in the trip folder that follows the spot shape (an object with `spots`, or a list), counts
  a spot two sources list once (within 25 m and the same kind; two shops also by name), keeps the better listing (known
  hours, then known indoors, then a trip's own source) and fills its gaps from the other, adding OpenStreetMap's credit
  when OpenStreetMap filled one. It keeps spots within 1 km of a place and writes sorted output.
- **A trip's own step comes first.** `pipeline/resync.py` looks for `<trip>/pipeline/<name>.py` before the region pack,
  the country pack and `pipeline/steps/`, runs it the same way (`--write` on a writing run, the same environment plus
  `PYTHONPATH` with `pipeline/`), and stops the run when it fails. Step names are plain words, so a name can't reach
  outside the folder.
- **The page works out the rest** (`engine/src/core/refill.mjs`): what's within 600 m of a stop (a stop the group added
  too), whether a spot is open at the stop's time (now, on today's stops), and what winter shuts. A pack's
  `refillWinter: ['MM-DD', 'MM-DD']` (Sapporo's: 1 November to 30 April) shuts every outdoor tap not marked open all year
  on days inside it; a tap not known to be indoors counts as outdoors. Without a pack rule only a tap marked `seasonal`
  shuts, December to February (June to August south of the equator).
- **Where it shows:** a pill in the stop's row of nearby pills (the drop, 装水 / Refill, the nearest open one's
  distance, or a snowflake when winter shut them all), its sheet (three rows, a winter line, whose data it is and when it
  was checked), a Refill kind in the map's Filters sheet and its legend (pins only when picked, like toilets, and none for
  a tap shut on today's or the first day's date), its card on the map, and a Refill tab near me with a button beside
  Toilets near me. The drop's colour is a fixed azure, `#0a84c1`, the same in both themes, 4.1:1 on paper and 4.6:1 on
  night paper (DESIGN.md, nearby icons); the word and the shape carry the meaning.
- **Credit:** each spot carries its source's `credit`, shown with it; OpenStreetMap's links to its copyright page.

## Alternatives

| Option                                                       | Why not                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Call a refill app's API live from the page                   | Its endpoint answers only its own site (CORS), the page is offline-first, and its data has no reuse licence            |
| Put a private source's fetcher in the repo, behind a setting | The public repo would carry code for data it may not share; a trip-local step keeps it in the gitignored trip          |
| Google Places for refill points                              | No drinking-water type found; shops with water aren't tagged as such                                                   |
| Work out each stop's nearest spots in the pipeline (`near`)  | The page already knows every place and the stops the group adds; computing in the page keeps one rule and no staleness |
| Show outdoor taps in winter with a warning                   | A frozen fountain in snow is a wasted walk; leaving them out and counting them says the same in one line               |
| Treat a tap with no indoor flag as indoors                   | Most sources don't say; the safe side in a cold winter is to assume outdoors and say how many were left out            |

## Consequences

- **Security:** one more outside host for the pipeline (OpenStreetMap's Overpass and a mirror), from the planner's
  machine only; nothing new in the page's policy (the page makes no call for refill). A trip's own step runs Python
  from the trip folder, the planner's own files, with the same trust as its `data.js`; names are checked so a step
  can't name a path. No personal data: spots are places.
- **Licence:** OpenStreetMap is ODbL; the page credits it wherever its spots show. A private source's data stays in the
  gitignored trip folder and on the password-protected page, never in the repo or on a public host.
- **Operational:** an optional side file, a pipeline step, a pack export (`refillWinter`), documented in trip-format,
  the pipeline README, `destinations/README.md`, the guide and the `data-sync` skill. Coverage depends on the sources;
  in a cold winter most taps are left out, so a private source's step can set `indoor: true` where it knows a tap is
  inside (a station, a mall) to keep it.
- **Cost:** free: no Google call. A few Overpass queries per refresh, none on a rerun within 30 days. Tens of KB in the
  page for a few hundred spots.

## Read when

You're changing what hangs under a stop (drinks, rest, toilets, refill), the refill step or its sources, the map's
kinds, a pack's winter rule, or how the refresh finds a step.
