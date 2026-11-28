---
id: ADR-20261128-skip-planned-stops
date: 2026-11-28
title: 'Anyone Can Skip a Planned Stop, Except a Flight or the Lodging: It Folds Away, Syncs, Is Logged and Comes Back'
domain: engine
status: accepted
decision: 'Anyone may skip a planned stop but a flight or the lodging; it folds away, syncs with who, undoes, and only suggests moving later stops earlier.'
tags: [sync, design]
---

# Anyone Can Skip a Planned Stop, Except a Flight or the Lodging: It Folds Away, Syncs, Is Logged and Comes Back

## Summary

Every planned stop, opened, has **Skip** (跳过). A skipped stop leaves the day's string and folds, with the day's other
skips, into one line at the schedule's foot, "2 skipped" (已跳过 2 站), where each has **Put back** (放回来). Anyone in
the group may skip and put back, not only planners: Kenneth chose this (option B) on 2026-11-28. With group sync a skip
reaches every phone and goes on Recently removed with who skipped it; on every page it has Undo on the toast for
8 seconds. Flights and the lodging can't be skipped at all. A fixed time asks once more. Right after a skip the page
offers to move the next stops earlier, as a suggestion the group taps or doesn't. A stop whose place is closed that day
says so on its row and offers Skip there. This amends the planners rule of
[ADR-20261002-sync-planners](ADR-20261002-sync-planners.md) and the records of
[ADR-20261001-group-sync](ADR-20261001-group-sync.md).

## Context

- Only the stops the group added could be changed or removed, and with group sync only by the phone that added them or
  a planner. A planned stop (from `data.js`) couldn't be removed or skipped at all: running late only showed "shorten or
  skip this", with nothing to tap.
- On the trip plans change at once: a place turns out closed, it rains, the group is tired. Whoever notices is often not
  the planner, and the planner may be asleep or on another bus.
- PRODUCT.md: "Fixed times never move; everything else can be re-planned, but only as a suggestion", and "every removal
  can be undone, so a slip costs one tap".
- The database only ever sees sealed records under names it can't read, so it can't tell a skip from an added stop;
  who may do what is the page's guard against slips ([ADR-20261002-sync-planners](ADR-20261002-sync-planners.md)).

## Decision

### Who

- **Anyone may skip a planned stop, and anyone may put one back** (option B). Skips stay open to every phone the way
  pushed-back times, flight changes and shared ticks are: one per stop, reversible, and logged. Added stops keep their
  guard (`canEditStop`): only the phone that added one, or a planner, changes or removes it.
- A blocked phone's skips are dropped where records come in, like the rest of what it writes (`Sync.dropBlocked`), and
  blocking it puts back the skips it made last, with the other changes it made last; Undo restores them.

### What can't be skipped

`Plan.skippable(stop, { hotels, terminals, flightDay })` is the one rule. A stop has no Skip when:

- it follows a flight (`rel`): landing, immigration and bags, the airport train, leaving for the airport, check-in at
  the terminal, and any stop timed from the flight, a first-evening dinner included;
- its place is an airport terminal (`AIRPORT.terminals[].place`);
- its place is one of the trip's hotels (`TRIP.hotel` and every `DAYS[i].hotel`): check-in, check-out, back to the
  hotel, a pickup at its door, breakfast there. It's where the group sleeps and keeps its bags;
- its kind is a flight or a bed (`icon: 'plane'` or `'bed'`), so a planner can mark a lodging or flight stop that has no
  place;
- it's on the day that holds only the flight home (`ROLE.flight`).

The page doesn't read a stop's words: "Back to the hotel" with no place and no kind is skippable, unless the planner
gives it `icon: 'bed'`. No new trip field: an opt-out such as `noSkip` isn't needed while a fixed time asks twice.

### Skipping

- **Skip** is the last labelled icon in the opened stop. A **fixed time** (`fixed: true`, a booking) asks once more:
  "这是已预订的，确定不去？ / This one is booked. Skip it anyway?". Other stops skip on the tap.
- The toast says what was skipped (with sync, "on everyone's page") and carries **Undo** for 8 seconds.
- **The fold**: the day's skipped stops leave the string and become one row on it at the schedule's foot, before the
  share and reset buttons: a dashed ring with the skip mark, "已跳过 N 站 / N skipped" and a chevron that turns. Opened,
  each is a line (its planned time and name in Ink 3, struck through, a "Skipped" tag; with sync, who skipped it) with
  **Put back**. It keeps the stop's anchor (`#d3-s4`), so a jump or a search hit opens the fold and lands on it.
- A skipped stop drops out of Now and Next, the running-late check (it's neither the target nor a deadline), the clash
  after a push-back, the push-back sheet's choices, the stop before an added stop (its distance and walk), the add
  sheet's getting-there and Add after's next time, the place finder's days, and the near-me anchor.
- **The day's route** goes round a place every stop of that day at which is skipped (`Plan.routeWithout`): the legs
  a→b and b→c become a→c, by the first leg's mode that isn't on foot. That leg is new, so it shows no minutes until the
  next data refresh (`Plan.storedLeg`), and the day's "time on the way" counts only the legs it still knows. The Route
  tile's line, its whole-route links and the day's fact line read the new route.
- **The map** keeps a skipped place's pin, at the quiet look of another day's (40 %, smaller) when it's skipped on every
  day it's on; the map's list strikes it through on that day. Days strikes it through with the tag; Copy for chat marks
  it "(skipped)" and leaves out its note.
- **Search** still finds a skipped stop, in its fold, with its "Skipped" tag in the line.
- **The day's cost line doesn't change.** No stop carries a cost of its own in the trip format (a day's budget rows are
  by kind: transport, meals, tickets), and a skipped booking is usually paid already. A budget row tied to a stop would
  be a new field, left until a trip needs it.

### Closed that day

When the data refresh says a stop's place is shut on its day (`geo.json` `places[id].closed_dates`, `Plan.closedOn`),
the row says so under its name, "今天休息 / Closed today" on the day itself and "当天休息 / Closed that day" before,
with **Skip this stop** right there when it can be skipped. The clash after a push-back ("shorten or skip this") gets
the same Skip.

### The suggestion to move the next stops earlier

- Right after a skip, where the stop was, the page shows it greyed with "后面的站提早 N 分钟？ / Move the next stops N
  min earlier?", what that means ("Hot spring soak could start at 13:30, up to the fixed 19:10 …") and two buttons:
  "N min earlier" and "No thanks". Nothing moves without the tap. It's this page view's only (not stored, not synced):
  the phone that skipped is the one that's deciding.
- **The amount** (`Plan.pullEarlier`): the next stop the group still goes to moves to about when the skipped one began,
  by the skipped stop's length (to the next stop's start when it has no end), never before the stop before it ends,
  never into the past, at most 3 h, in whole 5 minutes; under 10 minutes, no suggestion. **A fixed time never moves**:
  no suggestion when the next stop is fixed, flight-tied or a numbered step, and the move stops at the next fixed time,
  as a push-back does.
- It's the push-back's own machinery in reverse: a move `{ from, min }` with a negative `min` in the day's `shift`, so
  the banner reads "Moved 90 min earlier from …" and "Back to planned times" clears it. Pushes and pulls add up.
- The skip remembers the move it took (`pull: { from, min }`), so **putting the stop back moves those stops back**, and
  Undo on the move's toast takes it back. A skip suggests one move at most.

### Storage, sync and sharing

- Per phone in `store` `skips`: `{ <key>: { by, dev, at, pull } }`, through the storage module, never `localStorage`
  directly. The key is the stop's day and a fingerprint of its planned time, its name in both languages and its place
  as the data writes them (`Plan.stopKeys`, e.g. `d3-1grwpl0`, `-2` for a stop written the same twice that day). A
  republish that changes the stop leaves an old skip on nothing, never on another stop; a changed note keeps it.
- With group sync a skip is a record, `skip:<key>`, sealed like the rest; put back is its null. It's shared on token
  and approval trips alike (it isn't one of the gated kinds). Others see a toast ("Mei skipped Thermal Valley · Day 3",
  "… put … back") and the While you were away card lists it; a skip rewritten with its move isn't news again.
- **Recently removed** lists each skipped stop while it's skipped, with who skipped it and when, and Put back for anyone;
  its heading becomes "Recently removed or skipped". `Sync.skipLog` keeps the entries beside the removed stops' in
  `syncGone`.
- **Without sync**: skips stay on the phone. "Share my changes" (it reads "Share my added stops" while there are no
  skips) adds the skipped keys to the `#add=` link as `&skip=k1_k2`; opening it offers them with the added stops. A link
  from before has no `&skip` and imports as it always did; a page from before reads the stops and ignores the skips.
- **Back to the original plan** puts skips back too, after asking ("put back N skipped stops"), with Undo; with sync
  it's still a planner's button, "for everyone".
- The database rules don't change: they can't see a record's kind, and any approved device (or, on a token trip, any
  page with the token) already writes any record, over whichever device wrote it last. The shared checks
  (`scripts/sync/rules-checks.mjs`) gain the cases that say so, for the emulator and the stand-in.

## Alternatives

| Option                                                     | Why not                                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Only planners skip (option A)                              | The person who finds the place closed is usually not the planner; Kenneth chose B, logged and reversible, on 2026-11-28 |
| The planner removes the stop from the data and republishes | A laptop, the contract, a publish and a reload on every phone, for a change the group makes standing at the closed gate |
| A skipped stop just disappears                             | Nothing to put back from, and the group can't see what it dropped                                                       |
| A skipped stop stays in place, greyed                      | The string grows a dead row per skip; one fold line keeps the glance layer one line deep (Two Disclosures rule)         |
| Move the next stops earlier by itself                      | PRODUCT.md: everything but fixed times can be re-planned, only as a suggestion                                          |
| A stop's key by its position in the day                    | A republish that adds or moves a stop would carry the skip onto another stop                                            |
| Read "hotel", "check in", "airport" from the stop's words  | Words in two languages and any trip's phrasing: it would miss some and catch others; the place and `icon` are data      |
| A `noSkip` field                                           | Fixed times already ask twice and flights and lodging can't be skipped; a field nobody needs is one more to check       |
| Take a skipped stop's cost off the day's line              | No stop carries a cost of its own, and a booking skipped late is usually paid                                           |
| A new kind of record for the move earlier                  | The push-back's record already holds a day's moves; a negative minute count is the same machinery in reverse            |

## Consequences

- **Security:** none new. A skip is one more sealed record kind; its words (who skipped it) are encrypted like a stop's
  `by`. Anyone with the page can skip anything skippable, as anyone can push the day back: the page password is the
  lock, and a skip costs one tap to undo. The database rules are unchanged.
- **Operational:** no trip field and no migration. A phone on an older build ignores `skip:` records, and keeps only the
  push-backs of a day that also holds a move earlier, until it takes the update bar; its own page is otherwise as
  before. A republish that edits a skipped stop's time, name or place un-skips it on every phone (its key changes),
  which is the right default for a plan the planner just changed. The e2e suite covers skip, the fold, Undo, Put back,
  the fixed confirm, no Skip on flights and lodging, closed that day, and two phones; the unit tests the rules.
- **Cost:** none. One small record per skipped stop, within the free amounts; two icons (`i-skip`, `i-undo`).

## Read when

You're changing what a stop opened offers, who may change a planned stop, what Now and Next, the running-late check,
the route or the map count, the push-back's moves, Recently removed, the share link, or Back to the original plan.
