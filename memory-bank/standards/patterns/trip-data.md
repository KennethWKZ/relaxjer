---
created: 2026-10-01
updated: 2026-10-07
---

# Trip Data

How to write a trip's data, real or demo. The fields are in [`../trip-format.md`](../trip-format.md), and the rules the
data must pass in `tests/support/trip-contract.mjs`. `examples/demo-trip/data.js` shows every field in use.

## Writing the plan

- **Fixed times never move.** Anything booked or timed (a flight, a show, a charter, a reservation) is `fixed: true`.
  Times tied to a flight use `rel: { arr: [a, b] }` or `{ dep: [a, b] }`, so a typed delay moves them.
- **A comfortable pace beats sights per day.** Leave slack around fixed items, and give each day a rain plan.
- **Seniors:** count walking time ×1.4, and suggest a taxi first for long legs. The page does this by itself; a group
  of fit adults only sets `TRIP.walkPace: 1` for Google's own walking times
  ([ADR-20261127-trip-walk-pace](../decisions/ADR-20261127-trip-walk-pace.md)).
- **Decisions show their rule:** when to go, when to skip, and the fallback.
- **Every number is the plan's own, or marked as an estimate** ("≈", "(估)"). Don't invent a budget the planner didn't
  give.
- **Check each stop's weekdays before moving a day.** A show that plays a few evenings a week, or a shop closed one day
  a week, decides which swaps are possible. On the first trip a swap the planner wanted failed on the show's days.
- **A drive against a deadline names its hour.** A chartered car's hire and a shop's closing end on the clock. Give the
  leg its departure (`['falls', 'shop', 'driving', '18:00']`), refresh, and compare `bad` (heavy traffic) in `geo.json`
  with the deadline. On the first trip Google gave an evening van leg 45 min with no traffic, 60 typical and 86 heavy
  at its real hour
  ([ADR-20261007-traffic-aware-drives](../decisions/ADR-20261007-traffic-aware-drives.md)).
- **Every drive sets off when the schedule says.** A drive leg with no time of its own is asked for at the time of the
  schedule stop just before its destination's stop (a range's end). That's right when the day has a "Drive to …" row
  at the leg's start place, or a check-out; when the stop before is the visit the drive leaves from, that's the visit's
  start, so give the leg its own time. Read the road list a refresh prints for every drive (`via`, `roads`,
  `warnings` in `geo.json`): a mountain pass or a road closed in some seasons shows there.
- **A leg Google can't time gets the trip's own minutes.** Google gives no public-transit route in Japan, so a refresh
  doesn't ask for one there and lists every leg without a time ("legs Google gave no time"). End such a leg with its
  door-to-door minutes from the operator's timetable, `['station', 'airport', 'transit', 37]`, and put the line, fare
  and source in the stop's note
  ([ADR-20261126-own-leg-minutes](../decisions/ADR-20261126-own-leg-minutes.md)).
- **An errand with a closing time goes on a short day**, in daylight, not after a long day out, and it gets a fallback:
  a split option for who fetches it, or the shop delivering. The first trip moved a bike pickup off its day-trip
  evening once the traffic times came back.
- **A split option's name is a label** of two or three words; when to use it and the route go in its `rows`. A long name
  wrapped to five lines at 390 px on the first trip; `squeezed()` in `tests/e2e/layout.spec.mjs` catches it.
- **Moving a plan to another date moves its links.** A day's `id` belongs to its date and never changes, so the plan's
  per-day references move instead: `route` legs, `mealAt`, `foodSlots`, `tickets`, `forecastSpot`, `freeEvening` /
  `freeFrom`, `OPTIONAL[].near`, `WEATHER.outfits[].day`, shop days and the wishlist's `fits`
  ([trip-format](../trip-format.md)). The contract only sees ids that don't exist, not ones that point at the wrong
  day, so have `data-curator` review a swap. It found the first trip's wishlist still on the old days.

## Money

- Write group costs as **group figures**: `"NT$1,200–1,800 / 五人"` (zh) and `"NT$1,200–1,800 for 5"` (en), with the
  trip's own currency symbol and group size. The page adds the per-person share, and the home-currency line, itself.
- Per-vehicle costs (charter, taxi) don't shrink when the group splits. Say so where it matters (`BUDGET.split`).
- `**bold**` works in all text, and bold figures get a share too.

## People and wording

- **Never describe people by family relationship.** Say "the group", "seniors", "adults", or a count ("5人").
- Names of people don't go in anything committed. The demo's people are fictional.

## Places

- Google first for positions, place ids, hours, ratings and addresses; OpenStreetMap only for what Google can't give
  ([`pipeline.md`](./pipeline.md)).
- Every place a day or a list names must exist in `PLACES`, and every pin must sit inside the trip's map areas. The
  contract checks both.
- Keep a hand-checked Google id when a fetch returns a neighbour, and note why.

## The demo trip

- Synthetic and safe to publish: invented hotel, flights (`XX` airline code), stalls and prices; public landmarks.
- Nothing copied from Google: no `gpid`, ratings, reviews or Google photo URLs. The contract test forbids them.
- A demo-only feature needs a `@demo` test. A feature every trip has needs a trip-agnostic one.

## Real trips

- They live in `trips/<slug>/`, gitignored. Never `git add -f` one, and never paste their details into the engine,
  docs, tests or a commit message. The gate derives them locally: the commit-msg hook (`tests/release/scan-staged.mjs`)
  stops the commit before it exists, and the pre-push history scan checks every commit again.
- **A git worktree has no `trips/` of its own** (it's gitignored), so the gate reads the main checkout's. If it finds
  no real trip there either, it stops instead of passing without checking; `RELAXJER_NO_REAL_TRIPS=1` says the machine
  has none. A plain checkout without trips (CI, a fresh clone) has nothing to leak, so it passes.
- **While a trip runs, today is one of its dates.** Don't date anything you commit then: a lesson, an ADR amendment
  ("Amended later"), a "checked" note (the month alone). Write "during the first trip". The first trip's retro
  dated a lesson and an amendment with the day it was written, and the push was refused until both were reworded and
  the commits rewritten.
- Add anything else that must never be published (a nickname, a booking code) to `trips/<slug>/never-publish.txt`,
  one literal per line.
- A trip whose page is already published keeps its `TRIP.fileName` and `TRIP.storageKey`.

## Decisions behind these rules

Each rule above rests on a decision. The decision and its reasons live in its ADR; this list is only the index.

- [ADR-20261001-day-split](../decisions/ADR-20261001-day-split.md): A day can split for part of the group: DAYS[i].split names where it forks and who goes, and the trip contract checks it.
- [ADR-20261001-option-chips](../decisions/ADR-20261001-option-chips.md): An optional plan attaches to a stop with OPTIONAL[i].near, shown as a dashed chip on that stop, and the contract checks the stop exists.
- [ADR-20261001-resync-cost-guard](../decisions/ADR-20261001-resync-cost-guard.md): A data refresh answers from the cache first and calls Google again only for failures that may pass on retry, never for a 404.
- [ADR-20261007-traffic-aware-drives](../decisions/ADR-20261007-traffic-aware-drives.md): A drive leg may carry an HH:MM time, and a drive still ahead uses Google's traffic-aware estimate for that time.
- [ADR-20261126-own-leg-minutes](../decisions/ADR-20261126-own-leg-minutes.md): A route leg may end with the trip's own minutes, shown only when Google has no time for it; Japan's transit is never asked.
