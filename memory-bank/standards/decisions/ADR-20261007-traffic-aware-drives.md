---
id: ADR-20261007-traffic-aware-drives
date: 2026-10-07
title: 'A Drive Still Ahead Gets Google’s Typical and Heavy-Traffic Times, at the Hour the Leg Sets Off'
domain: data
status: accepted
---

# A Drive Still Ahead Gets Google’s Typical and Heavy-Traffic Times, at the Hour the Leg Sets Off

## Summary

A day's route leg can name the time it sets off, as an optional fourth element: `['falls', 'shop', 'driving', '18:00']`.
For a driving leg whose departure is still ahead, `pnpm resync` asks Google twice at that time, for its typical
(`BEST_GUESS`) and heavy-traffic (`PESSIMISTIC`) prediction, and `geo.json` keeps both (`min` and `bad`). Every other
leg, and every drive already past, sends the same request as before. Asked for by Kenneth on 2026-10-07, to check a
chartered van's evening drive against the end of its hours.

## Context

- **Driving legs ignored traffic.** `route()` sent no departure time for a drive, so Google answered with a no-traffic
  time. The first trip's evening van leg came back at 45 min without traffic; at its real hour on a weekday Google
  predicts 60, and 86 in heavy traffic. The difference decides whether a charter runs into overtime.
- **Every leg was asked at a guessed hour**: 09:30 for the first of the day, 20:30 for the last, 13:30 between. An
  evening drive in the middle of the day's legs was asked at lunchtime.
- Google predicts traffic only for a departure that hasn't happened yet (`departureTime` in the past is allowed for
  transit only), and traffic-aware routing bills as Compute Routes Pro: US$10 per 1,000 against US$5 (price list,
  checked 2026-10-07; 5,000 a month free).

## Decision

- **A leg's own time.** `DAYS[i].route` legs take an optional `'HH:MM'`. `lib/trip.py` `leg_time()` uses it, else
  the old guessed hour. The contract accepts it.
- **Traffic for a drive still ahead.** `steps/fetch.py` asks `TRAFFIC_AWARE_OPTIMAL` with `BEST_GUESS` and
  `PESSIMISTIC` at the leg's time. `steps/apply.py` writes `min` (typical) and `bad` (heavy traffic).
- **Nothing else changes.** Transit, walking and cycling legs, and drives already past, send the old request, so
  their cached answers keep their keys and cost nothing to re-read.
- **The estimate knows the price.** `cost()` prices a traffic-aware call at the Pro rate.

## Alternatives

| Option                                       | Why not                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `TRAFFIC_AWARE` with one call                | One typical time hides the risk the planner asked about: whether the van runs over     |
| Traffic for every mode                       | Google predicts traffic for driving only; transit has its own timetable                |
| A one-off script outside the pipeline        | It would bypass the cost guard, and the next trip would rediscover the gap             |
| Take the time from the day's schedule string | Stops and legs don't map one to one (a pickup, a split), so the leg names its own time |

## Consequences

- **Cost:** two Pro calls per drive still ahead, about US$0.02 a leg; a week-long trip has a handful.
- **Freshness:** a prediction made far ahead leans on historical traffic. A refresh in the trip's last week asks
  again only if the leg or its time changed, since the answer is cached; `--fresh` asks everything again.
- **Security:** nothing new leaves the machine: the same server key and the same two coordinates per leg, plus a
  time.
- **Page:** the engine shows `min` as before. `bad` is in the data for the planner and the agents; showing it on the
  page would be a separate engine change.

## Read when

You're touching a route leg's request in `pipeline/lib/google.py` or `pipeline/steps/fetch.py`, a day's `route` in the
trip format, or checking a timed drive (a charter, an airport run) against a deadline.
