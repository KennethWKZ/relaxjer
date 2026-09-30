---
created: 2026-10-01
updated: 2026-10-01
---

# Trip Data

How to write a trip's data, real or demo. The fields are in [`../trip-format.md`](../trip-format.md), and the rules the
data must pass in `tests/support/trip-contract.mjs`. `examples/demo-trip/data.js` shows every field in use.

## Writing the plan

- **Fixed times never move.** Anything booked or timed (a flight, a show, a charter, a reservation) is `fixed: true`.
  Times tied to a flight use `rel: { arr: [a, b] }` or `{ dep: [a, b] }`, so a typed delay moves them.
- **A comfortable pace beats sights per day.** Leave slack around fixed items, and give each day a rain plan.
- **Seniors:** count walking time ×1.4, and suggest a taxi first for long legs.
- **Decisions show their rule:** when to go, when to skip, and the fallback.
- **Every number is the plan's own, or marked as an estimate** ("≈", "(估)"). Don't invent a budget the planner didn't
  give.

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
  docs, tests or a commit message: the release gate derives them locally and blocks the push.
- Add anything else that must never be published (a nickname, a booking code) to `trips/<slug>/never-publish.txt`,
  one literal per line.
- A trip whose page is already published keeps its `TRIP.fileName` and `TRIP.storageKey`.
