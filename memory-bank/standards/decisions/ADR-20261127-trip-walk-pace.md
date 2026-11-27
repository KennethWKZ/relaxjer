---
id: ADR-20261127-trip-walk-pace
date: 2026-11-27
title: 'A Trip Sets Its Group Walking Pace with TRIP.walkPace, the Seniors Pace When It Sets None'
domain: engine
status: accepted
decision: "TRIP.walkPace (a number from 1 to 2) scales every walking time the page shows; left out, the seniors' pace; 1 is Google's own time."
tags: [trip-data]
---

# A Trip Sets Its Group Walking Pace with TRIP.walkPace, the Seniors Pace When It Sets None

## Summary

Every walking time the page shows (stop cards, the add sheet, the metro planner, the nearby lists, the finder and
Google's own walking minutes) is counted at one group pace, `GROUP_WALK`. Until now that pace was a constant in the
engine: seniors walk 40 % longer than Google's fit adult. A trip now sets the pace in its data, `TRIP.walkPace`, a
multiplier on Google's walking time from 1 to 2. Left out, the page walks at the seniors' pace, so every trip and both
demos render exactly as before. A group of fit adults sets `walkPace: 1` and sees Google's own walking times.

## Context

- RelaxJer was built for a group with seniors, and the seniors' pace (AGENTS.md, Seniors) went into the engine as a
  constant in `engine/src/app/02-helpers.js`. One model for walking minutes
  (`tests/repo/engine-models.test.mjs`) came out of the first trip: three formulas had drifted apart, and only the add
  sheet counted the seniors' pace.
- Not every group has seniors. For a group of fit adults the page overstated every walk by 40 %: a 10-minute walk read
  as 14, which pushes the add sheet to suggest a taxi early and makes a day look further apart than it is.
- The engine reads nothing about one trip from a constant ([`patterns/engine.md`](../patterns/engine.md), Where code
  goes): a trip's own facts are trip fields, documented in `trip-format.md` and checked by the contract.

## Decision

- **The field:** `TRIP.walkPace`, a number from 1 to 2: how much longer the group takes to walk than Google's walking
  time. 1 is Google's own time (fit adults); 2 is twice it. Left out, the seniors' pace (`Way.DEFAULT_PACE`).
- **One place:** `engine/src/core/way.mjs` holds the default, the range (`PACE_MIN`, `PACE_MAX`), the check
  (`paceProblem`), the pace (`paceOf`) and the walking model (`walkMin`: metres in a straight line, 30 % longer on
  streets, 75 m a minute, at a pace). The page sets `GROUP_WALK = Way.paceOf(TRIP.walkPace)` once in `02-helpers.js`,
  and every walking time reads it, as before. `tests/repo/engine-models.test.mjs` keeps that: one formula (in Way), one
  assignment of `GROUP_WALK` (from the trip), one default number.
- **Checked twice:** the trip contract (`tests/support/trip-contract.mjs`) and the build (`engine/build.mjs`) both
  refuse a value that isn't a number in range, with the same message, so a typo (a number typed as text, a pace below 1) never
  reaches a page.
- **Words follow the pace:** the finder's footnote names the seniors' pace in Chinese only when the pace is above
  Google's own; at 1 it says an ordinary pace. The English footnote says "the group's pace" either way.
- **What stays:** the add sheet's taxi-first rule (a walk past 20 minutes at the group's pace offers a ride) and the
  finder's walk-or-drive choice read the same pace, so a fit group walks further before a taxi is offered. Ride minutes
  are never scaled. The pipeline stores Google's raw minutes and applies no pace, so a data refresh is unchanged.

## Alternatives

- **A count of seniors in the group (`TRIP.seniors`), the pace worked out from it.** Closer to how a planner describes
  the group, but it hides the number the page uses, and a group with one slow walker who isn't a senior has no way to
  say so. Rejected: the planner sets the pace, and the trip-intake questions (how many seniors, what limits walking)
  lead to it.
- **A switch (`TRIP.fitGroup: true`) between the two paces.** Simpler to write, but a group between the two (a toddler,
  a sprained ankle) can't say so, and a second value later would need a new field. Rejected for one number.
- **A per-person pace on the page, changed by the group.** Each phone could pick its own, but the times the group
  agrees on would differ between phones, and the plan is made by the planner before the trip. Rejected.
- **No range, any positive number.** Rejected: a pace under 1 makes the page promise walks faster than Google's, and
  one above 2 is a group that should be offered a taxi for most legs, which the planner says in the plan instead.

## Consequences

- **Security:** none. The field is a number in the trip's data, checked before the build; nothing new is sent or
  stored.
- **Operational:** a trip without the field renders exactly as before (`pnpm parity` shows no change for the demos). A
  planner who sets it should rebuild and republish the page; walking minutes, the add sheet's checks and the finder's
  walk-or-ride choice all move with it. The trip-intake skill asks about the group's walking and sets the field.
- **Cost:** none. The finder's Google call is the same one, and a fit group may switch a few of its asks from DRIVE to
  WALK, priced the same.

## Read when

- Changing how the page counts walking time, the taxi-first rule, or the finder's walk-or-ride choice.
- Planning a trip for a group without seniors, or one slower than the seniors' pace.
