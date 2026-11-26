---
id: ADR-20261126-own-leg-minutes
date: 2026-11-26
title: 'A Leg Google Can’t Time Shows the Trip’s Own Minutes, and Japan’s Transit Is Never Asked'
domain: trip-data
tags: [engine]
status: accepted
decision: "A route leg may end with the trip's own minutes, shown only when Google has no time for it; Japan's transit is never asked."
---

# A Leg Google Can’t Time Shows the Trip’s Own Minutes, and Japan’s Transit Is Never Asked

## Summary

A day's route leg may end with a whole number of minutes, the planner's own door-to-door time for a leg Google can't
time: `['station', 'airport', 'transit', 37]` or `['station', 'airport', 'transit', '11:40', 37]`. The route line shows
it only when `geo.json` has no Google time for that leg. The pipeline no longer asks Google for transit in a region
where Google has none (`NO_TRANSIT` in `pipeline/lib/google.py`, Japan), and every refresh lists the legs left without
a Google time.

## Context

- On the first Japan trip, every transit leg the refresh asked for came back empty (18 calls, all `{}`), while drives
  and walks in the same places came back fine. Nothing in the request was wrong.
- Google's coverage FAQ for the Directions and Distance Matrix APIs says transit directions cover "all Google Transit
  partners, except those in Japan", and the Routes API behaves the same (a Stack Overflow answer of 2024-11-20 quoting
  it, and a public issue on an open-source maps tool of 2026-04-18; checked 2026-11-26). Japan's timetables in Google
  Maps are licensed for the app only.
- So the route line showed a train icon with no minutes for a long-distance express and an airport train: the legs a
  group most needs a time for.

## Decision

- **The trip states it.** A route leg's optional last element is whole minutes (1–600), after the optional `'HH:MM'`.
  `Plan.storedLeg` returns Google's stored leg when there is one, else `{ min, own: true }` from the leg. The contract
  checks the shape.
- **The pipeline doesn't ask.** `fetch` skips a transit leg when the trip's Google region is in `NO_TRANSIT`, so no call
  is billed for an answer that can't come. `apply` prints each leg with no Google time, with the trip's own minutes or a
  prompt to add them, and `resync` always shows those lines.
- The minutes come from the operator's timetable (JR, the city subway), and the line, fare and source go in the stop's
  note, as for any other fact.

## Alternatives

- **The legacy Directions API as a fallback.** It has the same Japan exclusion, and new projects can't enable it.
- **A Japanese route-search API (NAVITIME, Jorudan, ekitan).** Paid, a second key for every planner, and terms written
  for apps rather than a page built once. Not worth it for the few train legs a trip has.
- **Deriving the minutes from the schedule's times.** Those include waiting, shopping and buffers; the route line would
  show 100 minutes for an 85-minute train.
- **Changing the leg to walking or driving.** Right for a short leg that is really a walk (and the planner should do it
  then), wrong for a train.

## Consequences

- **Security:** none; no new key or host.
- **Operational:** a planner adds minutes by hand and keeps them current with the timetable; the refresh's "legs Google
  gave no time" list shows any leg still without them.
- **Cost:** fewer Google calls on a Japan trip (each transit leg was a billed call returning nothing).

## Read when

Adding a train, ferry or bus leg in a country where Google gives no transit route, or changing `storedLeg`, the
`route` contract check or the fetch step's legs.
