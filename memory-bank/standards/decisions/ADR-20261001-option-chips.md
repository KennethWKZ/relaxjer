---
id: ADR-20261001-option-chips
date: 2026-10-01
title: 'An Optional Plan Can Be Suggested at a Stop, and Opens Over the Day'
domain: data
status: accepted
---

# An Optional Plan Can Be Suggested at a Stop, and Opens Over the Day

## Summary

An optional plan (`OPTIONAL[i]`) can name the stops it suits (`near: [{ day, place }]`). Each of those stops shows a
"Nearby options" row with a chip per plan and the distance, and a tap opens the plan's card in the sheet, over the
day. Decided by Kenneth on 2026-10-01, for the first trip's Day 2 ideas (one after a memorial hall, two after lunch).

## Context

- Optional plans lived only in the Optional section. A stop could point at one through `link: '#opt-…'`, which
  jumped there: one plan per stop, and the reader lost their place in the day.
- The day already shows nearby wishlist places under a stop as chips, and wishlist and food cards already open in
  the sheet.

## Decision

- **A trip field, `OPTIONAL[i].near`**, plus `short` (the chip's name), in `trip-format.md` ("Optional plans"),
  checked by the trip contract: the day must exist and have a stop at that place.
- **On the page:** the row and chip of the nearby wishlist (`.stop-near`, a dashed chip), with the list icon and
  "顺路可选 / Nearby options", after the stop's meal chips. The chip carries the distance from the stop.
- **A tap opens the card in the sheet**, with "Show in the list" on to the Optional section. Any in-page link to an
  option's id now does the same, as wishlist and food links do.
- **A plan whose place is closed that day** (`geo.json` `closed_dates`) shows no chip there.
- **The card gains its place's hours and nearest station** from `geo.json`, in the section and in the sheet.

## Alternatives

| Option                            | Why not                                                        |
| --------------------------------- | -------------------------------------------------------------- |
| Keep `link: '#opt-…'` on the stop | One plan per stop, and it jumps away from the day              |
| Schedule the plan as a stop       | It isn't the plan: a stop reads as everyone going              |
| Match plans to stops by distance  | A nearby plan isn't always one the planner would suggest there |

## Consequences

- **Security:** none. Nothing new reaches the network.
- **Operational:** a plan's stops are the planner's data; renaming a stop's place needs its `near` updated, and the
  contract catches a stale one.
- **Cost:** none.

## Read when

You're adding optional plans to a trip, or changing how a stop's chips or the sheet work.
