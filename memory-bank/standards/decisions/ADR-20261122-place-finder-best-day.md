---
id: ADR-20261122-place-finder-best-day
date: 2026-11-22
title: 'The Place Finder Suggests the Nearest Day With Room, From the Page’s Own Data, and Asks Google Only on a Tap'
domain: engine
status: accepted
decision: "A place finder ranks each day's stops by straight-line distance to the place, counting only stops a new stop can follow."
---

# The Place Finder Suggests the Nearest Day With Room, From the Page’s Own Data, and Asks Google Only on a Tap

## Summary

A place searched on the map (from the page's own places or from Google) opens in a finder beside the map: each trip
day's nearest stop, with the straight-line distance and the walk or taxi there from the engine's own estimates, and the
day it fits best, one tap from the add sheet on that day, right after that stop. The best day is the one in the
nearest distance band (a short walk, a short ride, a ride, far), and within a band the one with room after its stop,
then the nearer; never a day the place is closed, a day that already holds it, or a day that's over. The rule is pure
code in `engine/src/core/fit.mjs` (`Fit.fitDays`), unit-tested. One details view serves every place, built from the
trip's data; with the planner's key, Google's rating, hours and photos come only when someone taps for them, once per
place per page view. Asked for by Kenneth on 2026-11-22.

## Context

The planner wanted to search any place on the map and see where it fits the trip: how far it is from the planned stops,
and which day suits it. The page already had a map search (the page's places, and Google's text search with a key), an
add sheet with a getting-there check (`Plan.legCheck`, walking ×1.4, `taxiMin`, the offline metro planner), and Google's
rating and photos on food and wishlist cards only. In the add sheet a tapped result went straight to the time picker,
with no way back to the list. Google bills per call, and the page must work offline and without a key.

## Decision

- **Nearest stop per day:** the straight-line distance (`Fit.distKm`, now the page's `km`) from the place to each stop
  of the day that a new stop can follow (`Plan.roomAfter`), and to each stop added on this phone. Hotel rows are left
  out (the hotel is near every day's end), and so are stops already over today.
- **Room after a stop:** its minutes until the next timed stop that day (an hour counted for a stop with no end), or until
  21:00 when nothing timed follows (`Fit.freeAfter`). A stop has room with 90 minutes or more, or when it starts in the
  day's free time (`freeFrom`); a day with four added stops (the add sheet's caution) has none.
- **The best day:** among days still ahead, not closed for the place (`closed_dates`, a weekly `closed`, or Google's
  hours once fetched) and not already holding it, the lowest band (0.7, 3 and 8 km), then room, then distance. Past 8 km
  it's still offered, with a warning that the place may need half a day of its own.
- **Estimates only:** distances are straight lines, times come from `legModes` (walk at the group's pace, taxi first
  for long legs, the metro where the city's data has it). No routing or distance API is called.
- **Add:** the add sheet opens on the chosen day at `gapContext`'s time after that stop, so its getting-there check,
  clash and deadline warnings apply as for any added stop.
- **One details view** (`placeDetailsHTML`, 21-place-finder.js) for any place: our photo, kind, the trip's rating and
  its source, the day's hours, the address, Map, Directions, Add. The add sheet shows the same head when a place is
  picked from its list, over the list, with its own history step: Back returns to the list as it was.
- **Google only on a tap:** "Rating & photos" on stops, Optional cards, map cards and places on day cards uses the
  Place Details fields already requested (memoised per page view). A place with no Google id is found by Text Search
  asking for ids only, which Google doesn't charge for (checked 2026-11-22). Opening a place from the add sheet's list
  counts as that tap. Nothing is fetched on load.
- **Trip-agnostic Google:** searches lean to the trip's country (`TRIP.destination`) and answer in English or the
  country pack's `googleZh` (Taiwan: Traditional; Japan: Simplified), never a fixed one; `tests/repo/engine-trip-agnostic.test.mjs` holds it.
- **The map's results keep their view:** Google's results stay while location fixes and the page's own filter calls
  update distances and counts; only a new query, Back, or a category or day the person picks changes it.

## Alternatives

- **Score by travel minutes instead of distance bands.** More exact on paper, but the minutes are estimates too, and
  bands keep the rule explainable in one line ("the nearest day, preferring free time").
- **Ask Google Routes or Distance Matrix for real times.** Paid per element, needs the network, and would run for every
  day on every search. Rejected: the page's own estimates are good enough to choose a day.
- **Rank by free time first.** A free afternoon across the city would beat a stop next door. Rejected: distance decides,
  room only breaks ties within a band.
- **Open the finder as a bottom sheet.** It would cover the map it points at. Rejected: it takes the results' place
  above the map, so the pin shows below it.
- **Fetch Google's details for every result.** One paid call per row. Rejected: only the place someone opens.

## Consequences

- **Security:** no new hosts; the page's policy already allows Google's Maps library when built with a key. The finder
  reads only the trip's data and the phone's own location, which never leaves the phone.
- **Operational:** a stop the trip uses for travel (a train leg) can be the nearest anchor; the finder names the stop,
  so the person sees what it follows and can pick another day from the list. The 0.7 / 3 / 8 km bands and the 90-minute
  room are constants in `fit.mjs`, changed there with their tests.
- **Cost:** none without a key. With one: Place Details and Photos only on a tap, as before; the id lookups are free.

## Read when

Changing the place finder, its best-day rule or its bands, the place details view, the add sheet's list and preview,
or any Google search the page makes.
