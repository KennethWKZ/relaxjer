---
id: ADR-20261001-live-page-on-relaxjer
date: 2026-10-01
title: "The First Trip's Live Page Is Built by RelaxJer"
domain: hosting
status: accepted
---

# The First Trip's Live Page Is Built by RelaxJer

## Summary

Kenneth chose to switch the group's live Taipei page to RelaxJer's build before the trip. The legacy single-trip repo
(taipei-travel) is kept only as a fallback until the trip ends, then archived. Since story step 5 the data refresh runs
here too (`pnpm resync --trip trips/<slug>`). `pnpm parity` remains the proof for every engine change.

## Context

RelaxJer's engine was moved in verbatim and then split (story steps 1–3). The group already had a published page from
the legacy repo, with saved state on their phones (checklist ticks, language, rate, added stops, flight delay). Two
engines serving one trip meant every fix had to land twice.

## Decision

Switch only after proof, against taipei-travel's own build of the same data:

- identical data, markup, embedded data and map export; CSS equal but for formatting and two class names;
- 1,455 of 1,463 screens pixel-identical in iPhone WebKit, Android Chromium and desktop Chromium, in both languages,
  before and during the trip. The 8 others are the repeated-share fix below;
- saved state carries over, because the trip keeps its published `TRIP.fileName` and `TRIP.storageKey`;
- the Google map loads.

Then republish to the same link and check it on the live URL in three browsers. A backup of the last legacy build is
kept outside the repo for rollback.

### Parity

`pnpm parity --live <legacy repo> --trip trips/<slug>` builds the legacy repo's own engine and data (from a copy, with
no key) and diffs every section's text, in both languages, against RelaxJer's build of the same trip. On 2026-10-01 it
showed **one diff, a fix**: the live page repeated a share the text already states ("NT$160 each (NT$800 for 5 ·
≈NT$160 each)"), and RelaxJer shows it once (`Money.statesShare`). Once the data refresh moved here, parity diffs also
include fresh data, so read them rather than counting them.

## Alternatives

| Option                                         | Why not                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Keep the legacy page live until after the trip | Every fix would land twice, and the two engines would drift while the group was using the page |
| Switch without the pixel and state proof       | The group's saved state and a working page during the trip matter more than the switch date    |

## Consequences

- RelaxJer now carries a live page, so engine changes can reach real travellers. Keep `pnpm test:all` and `pnpm parity`
  green, and verify every republish (the `publish-htmlapp` skill).
- A rebuilt page must keep its published `fileName` and `storageKey`, or its readers lose what they saved.
- The legacy repo is read-only: data isn't copied back to it.

## Read when

You're about to change the engine while a trip is live, republish a trip page, or run parity.
