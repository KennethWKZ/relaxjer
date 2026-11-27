---
id: ADR-20261127-decide-option-route
date: 2026-11-27
title: 'A Decide Option Carries Its Own Route, Stored Apart from the Day’s'
domain: trip-data
tags: [engine]
status: accepted
decision: "A decide option may carry its own route; its legs are stored as <day>:<k>:<i> in geo.json, apart from the day's, and drawn on its card."
---

# A Decide Option Carries Its Own Route, Stored Apart from the Day’s

## Summary

A `decide` card's option may carry a `route`, the same legs as `DAYS[i].route`:
`opts: [{ k: 'b', …, route: [['hotel', 'falls', 'driving', '10:00'], ['falls', 'pond', 'driving']] }]`. The data
refresh asks Google for those legs like a day's and stores them in `geo.json` `legs` under `<day id>:<k>:<i>`
(`d3:b:0`), apart from the day's own `<day id>:<i>` (`d3:0`). The option's card draws them with the day route's line
(`routeLine`), each leg with its minutes, a walk at the group's pace (`GROUP_WALK`).

## Context

- An option such as "B: drive to the falls instead" needs its drive time as much as the day's route does, and planners
  wrote it into the option's text by hand, where a refresh never checks it.
- `Plan.storedLeg` finds a leg's stored time at its own key, else at any key of the day that joins the same two places
  the same way, so a reordered day keeps its times. That fallback read every key starting with `<day>:`, so an
  option's legs stored under the day's prefix would have been picked up as the day's, and the day's as an option's.

## Decision

- **Data.** `route` on a `decide` option, the same leg shape as a day's: `[from place, to place, mode, 'HH:MM'?,
minutes?]`. The contract checks it as it checks a day's route (known places, a known mode, the optional time and
  minutes). The option's `k` must be letters, digits, `_` or `-`, and unique among the day's options that have a
  route, since the key is built from it.
- **Keys.** A route's legs are stored under a prefix: the day's id for the day's own route, `<day>:<k>` for an
  option's (`Plan.legScope` in the engine, `legs_def` in `pipeline/lib/trip.py`). A day's leg key has one colon and an
  option's two. `storedLeg`'s fallback now reads only keys made of its prefix and a bare leg number, so a day never takes
  an option's leg, nor an option the day's or another option's, even when the option's `k` is a digit (`d3:1:0` is
  option 1's first leg; `d3:1` is the day's second).
- **When an option's leg sets off.** An option has no schedule to read, so the day's rule (a drive sets off at the
  schedule stop before its destination's) doesn't apply. A leg sets off at its own `'HH:MM'`, else at the nearest
  earlier leg's in the option's route, else at the option's first (`option_departures`). An option with no time at all
  takes the day route's documented defaults (09:30 first leg, 20:30 last, 13:30 between).
- **Page.** `renderBlock`'s `decide` case draws the option's route line under its list, labelled for the option
  ("Route for option B"). The day's own route card is unchanged. The trip's own minutes and Japan's no-transit rule
  ([ADR-20261126-own-leg-minutes](ADR-20261126-own-leg-minutes.md)) apply to an option's legs too.
- **Demo.** The Taipei demo's first-night option A has a two-leg route with the trip's own minutes: the demo's
  `geo.json` carries no Google legs (nothing is copied from Google), so own minutes are how its legs show a time.

## Alternatives

- **Key by the block's position, `<day>:<block>:<k>:<i>`.** Unique without a rule on `k`, but moving a card in the day
  would orphan its stored legs until the next paid refresh. Kept to `<day>:<k>:<i>` with the contract's uniqueness check.
- **A separate `geo.json` map, `optLegs`.** No key clash at all, but a second store for the same kind of record, read
  and written by two code paths in the engine and both pipeline steps. One `legs` map with a stricter fallback is less.
- **Use the day's leg when the option's matches it.** Cheaper, but an option's leg is usually the one the day doesn't
  take, and silently sharing would hide a leg that needs its own time.
- **Departure from the option's `when` text.** Free text in two languages; parsing it would guess.

## Consequences

- **Security:** none; no new key, host or stored field beyond more route legs.
- **Operational:** a refresh asks Google for each option's legs, and lists any it couldn't time with the day's; a
  planner should give an option's first leg its own `'HH:MM'`. Renaming an option's `k` drops its stored legs until the
  next refresh, as renaming a day's id would.
- **Cost:** one billed route call per option leg (two for a drive still ahead, with heavy traffic), cached like any
  other; the first refresh after adding a route asks only for its new legs.

## Read when

Adding a route to a `decide` option, changing `Plan.storedLeg` or `legScope`, the geo.json `legs` keys, or the
pipeline's `legs_def`, `leg_starts` or `option_departures`.
