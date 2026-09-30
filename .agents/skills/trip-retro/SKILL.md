---
name: trip-retro
description: After a trip (or a hard stretch of one), turn what went wrong and right into proposed lessons for RelaxJer's knowledge/, a destination's knowledge.md, the engine's tests, or the agent rules — as a reviewed change, never applied silently. Use when someone says the trip is over, asks what we learned, wants a retro or post-mortem, or reports a problem the group hit on the page.
---

# Trip retro: lessons as a reviewed change

The agent proposes and a person approves. **Never rewrite `knowledge/`, `.agents/`, `.claude/`, `AGENTS.md` or
`memory-bank/` silently.** Every lesson lands as a diff the planner or a maintainer reviews, and a lesson that can be
tested gets a test.

## 1. Gather

- The planner's and the group's notes: what they looked for and didn't find, what confused them, what they loved.
- What changed during the trip: data refreshes, republishes, bugs fixed while it was live (`git log` since the trip
  started).
- The page on a phone: walk the journeys in `knowledge/group-ux.md` once more with what you now know.

## 2. Sort each finding

| The finding is…                                  | It goes to                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| true for every trip (a browser quirk, a UX rule) | `knowledge/<topic>.md`                                                               |
| true for one country or city                     | `destinations/<cc>/knowledge.md`, with the date it was checked                       |
| a bug in the engine                              | a failing test first (`test.fail(true, reason)` if it's not fixed now), then the fix |
| a gap in the data shape                          | `memory-bank/standards/trip-format.md`, the contract, and the engine                 |
| a better way for the agent to work               | a proposed change to a skill, rule or `AGENTS.md`                                    |
| only about this trip                             | nowhere in the repo; it stays in `trips/<slug>/`                                     |

## 3. Scrub

A lesson is generic. It carries no real names, hotel, flight numbers, dates, booking codes or group details, so write
"the first trip" or "a group of five". The release gate (`pnpm test:release`) catches the obvious ones; read the diff for
the rest.

## 4. Propose

- One branch and one pull request (or one commit for the maintainer to review): `docs(knowledge): …`,
  `fix(engine): …`, `feat(agents): …`.
- The description lists each lesson, the evidence for it, and the test that now gates it (or why none can).
- `pnpm verify` and `pnpm test:release` pass before it's offered.

## Done when

Every finding is sorted, the generic ones are proposed as a reviewed change with their tests, and nothing about the
real trip left `trips/`.
