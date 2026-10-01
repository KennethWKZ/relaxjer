---
id: ADR-20261001-day-split
date: 2026-10-01
title: 'A Day Can Split: Part of the Group Takes Its Own Plan, Hung Where the String Forks'
domain: data
status: accepted
---

# A Day Can Split: Part of the Group Takes Its Own Plan, Hung Where the String Forks

## Summary

A day's data can hold a `split`: one or some of the group leave the plan for a few hours (on the first trip, a senior
rides the riverside on Day 5 while the rest shop) and come back at a stop of the day. The page hangs it, folded, on
the day's string where it forks, with its go / wait / skip rule, a switch between up to four plans, and a note on
the stop where they rejoin. Decided by Kenneth on 2026-10-01, after a design brief made with the impeccable skill.

## Context

- The page had a single timeline per day. Optional sights were never scheduled (the Optional section), and added
  stops were everyone's plan.
- Nothing said "one of us does this instead, then comes back here". A rider who splits off needs a rule for going at
  all, more than one plan to pick from on the day, where to get and return a bike, and when to be back.

## Decision

- **A trip field, `DAYS[i].split`** (`trip-format.md`, "A day that splits"), checked by the trip contract. Its fields:
  - `at` (where it forks) and `who` (never a family relationship);
  - the `go` rows (go / wait / stop);
  - `options`: 1–4 plans, each with a `join` stop and optional distances, times, bike docks, directions, a route
    line, a rule and extra rows.
- **On the page:**
  - A fork row on the string, with a dashed knot in the day's colour (it can move, so never the seal).
  - The plan's name and who takes it, as on a stop.
  - A fold-out with the rule, a segmented switch, and each plan's rows.
  - Live bike counts at its docks, fetched only when it opens, through the pack's bike share.
  - A directions link, and "Route on the map", which draws the line dashed in the day's colour on either map engine.
  - On phones the fold-out uses the full width, like the meal options. The rejoin stop shows "Rejoining here: One of
    us (Regular)", worded so it reads for one rider or several.
- **Times are the plan's own**: a push-back doesn't move them.
- **The switch is per phone** (`store` key `splitPick`). It's a view, not plan data, so it isn't synced.
- **Route lines come from a free router** (OpenStreetMap bike routing), stored in the trip's data, so the page draws
  them with no Google call and no cost.

## Alternatives

| Option                                       | Why not                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| A second timeline column for the split group | The page is one column (DESIGN.md); two strings side by side don't fit at 390 px |
| An entry in the Optional section             | Optional items aren't tied to a time or a rejoin point                           |
| Added stops on that day                      | They're everyone's plan once synced, with no rule and no alternatives            |

## Consequences

- **Security:** nothing new reaches the network until the fold-out opens. Then the page asks the bike-share host the
  pack already allows. The directions link is an ordinary link.
- **Operational:**
  - The split's numbers are the planner's, so a data change means a rebuild.
  - Route lines are estimates and are marked "≈". A plan that's a visit (a `place`, `rows`) needs no engine change.
- **Cost:** none. The router and the bike-share counts are free, and nothing calls Google.

## Read when

You're planning a day where part of the group goes its own way, changing how a day's schedule is drawn, or touching
the map's route lines.
