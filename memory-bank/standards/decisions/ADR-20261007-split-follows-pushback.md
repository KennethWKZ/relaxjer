---
id: ADR-20261007-split-follows-pushback
date: 2026-10-07
title: 'A Push-Back Moves a Split Day’s Fork and Rejoin; Each Plan Keeps Its Own Times'
domain: engine
status: accepted
---

# A Push-Back Moves a Split Day’s Fork and Rejoin; Each Plan Keeps Its Own Times

## Summary

On a day that splits, pushing the rest of the day back now moves the fork (`DAYS[i].split.at`) and each plan's rejoin
like any flexible stop, and the day's banner says where the push ends. The times inside each plan (pick-up, return by,
the ride) stay as planned. Asked for by Kenneth on 2026-10-07 after the pre-departure ux-verifier pass. It amends
[ADR-20261001-day-split](ADR-20261001-day-split.md), which kept every split time fixed.

## Context

- With +30 min on the first trip's split day, the stop before the fork ran to 15:30 while the fork still said 15:00, so
  part of the group would leave in the middle of a stop.
- The rejoin dinner moved to 19:00, but the split card still said 18:30, and the rejoin stop lost its "Rejoining here"
  note: it was looked up by its shown time, which had moved.
- The banner said "+30 min" and nothing about where the push stopped when no fixed stop followed.
- A plan's own times are often deadlines from outside the group: a rental shop's return time, a bike dock's last
  return, a booked pick-up.

## Decision

- **The fork moves like a flexible stop:** by every push-back that starts at or before it with no fixed stop in between
  (`shiftAt`). It shows its new time with "was" under it, and it hangs after the stops that now start by then.
- **The rejoin follows its stop:** a plan's `join` still names the stop's planned time (the contract checks that), the
  lookup uses the planned time, and the card shows the stop's pushed time.
- **The plan's own times stay as planned,** and the card says so once it has moved: "The times inside each plan
  (pick-up, return by) stay as planned."
- **The banner names the end of the push:** the next fixed stop, or "to the end of the day".

## Alternatives

| Option                                       | Why not                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Keep every split time fixed (the 1 Oct rule) | The fork and the rejoin then disagree with the stops around them, and the rejoin note disappears |
| Move everything, plan times included         | A return-by time or a shop's hours doesn't move because the group is late                        |
| Make the fork `fixed`                        | A push-back would then stop at the fork, and the stops after it couldn't follow                  |

## Consequences

- **Data:** no new field; `join` keeps naming the stop's planned time.
- **Page:** the fork and the rejoin read the same time as the stops around them after a push-back.
- **Security and cost:** none.

## Read when

You're changing how a push-back moves times (`applyShifts`, `shiftAt` in `engine/src/app/07-sections.js`) or how a
split day draws its fork, plans or rejoin.
