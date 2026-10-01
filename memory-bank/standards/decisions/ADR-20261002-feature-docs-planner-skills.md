---
id: ADR-20261002-feature-docs-planner-skills
date: 2026-10-02
title: 'Every Feature Is Written Down Where Planners Look, a Tier-0 Test Keeps It So, and Agents Get Setup, Customize and a Travel Agent'
domain: agents
status: accepted
---

# Every Feature Is Written Down Where Planners Look, a Tier-0 Test Keeps It So, and Agents Get Setup, Customize and a Travel Agent

## Summary

An audit on 2026-10-02 found about 180 features on the trip page and about 140 in the framework. About 75 page
features appeared in no doc, and 13 data blocks were missing from `trip-format.md`. The fix:

- **Planner guides:** `guides/trip-page.md` (every part of the page and what turns it on) and
  `guides/getting-started.md` (the planner's walkthrough and every skill).
- **Two skills:** `planner-setup` (a fresh clone to a demo page) and `trip-customize` (the planner's words to the
  trip's data, and where each change shows).
- **A role:** `relaxbro`, a read-only travel agent.
- **A gate:** `tests/repo/docs-coverage.test.mjs` fails when a shipped field, side file, skill, role, guide, command
  or heading link goes undocumented.

Asked for by the maintainer.

## Context

Features landed faster than their docs. The README, PRODUCT.md and the landing page each covered a different part,
`trip-format.md` described only the settings added after the first trip, and nothing failed when a feature shipped
silently. A planner couldn't answer "what can the page do, and how do I turn it on?", and an agent had no skill for
the most common request after intake: "change this part of the plan". A planner also asks travel questions (pace, what
to book, rain plans) while the agent is busy, and those need research with sources, not edits.

## Decision

- **One catalogue for planners.** `guides/trip-page.md` explains every part of the page in plain words and ends with
  "What turns each part on". `trip-format.md` stays the field reference, now including every block the demo uses (the
  overview, money, weather, flights, entry, day cards, stops, places, side files). `pipeline/README.md` holds
  `pipeline.json`.
- **Skills follow the planner's day.** `planner-setup` checks and installs the tools, builds and opens the demo, and
  sets up the keys folder. `trip-customize` maps requests ("we booked a table at 18:00", "two of us cycle on day 5") to
  fields, and keeps published ids, `fileName`, `storageKey` and the sync file stable.
- **`relaxbro`** (`.claude/agents/relaxbro.md`) has read-only tools plus web search. It advises on itinerary, pace for
  seniors, bookings, closures, costs and rain plans, with a source and date for each fact. Its proposals are mapped to
  trip fields, and the main agent applies them once the planner agrees. Other agents take the same brief from the file
  (`AGENTS.md` § Roles).
- **The gate (tier 0, no network):** every key the demo's data uses, and every `TRIP` setting the engine or build
  reads, appears in `trip-format.md`. Every side file the build reads is listed. Every skill and role is in the README,
  `AGENTS.md`, `.agents/README.md` and the getting-started guide. Every guide is linked from the README. Every package
  script a person runs is in `AGENTS.md`, and every `pnpm sync` command is in its skill. Every link to a heading lands
  on one.
- **Rules carry it:** `.claude/rules/docs.md`, `sync.md`, `publish.md` and `agent-config.md` join the path-scoped
  rules, and `engine.md` asks for the docs in the same change.

## Alternatives

| Option                                     | Why not                                                                                                     |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Docs by review only                        | That's how 75 features slipped; a reviewer can't hold 180 features in mind                                  |
| Generate the guide from the code           | The page's strings don't explain when or why to use a feature; the result reads as a dump                   |
| One giant README                           | Planners and contributors need different depth; the README stays a summary                                  |
| Let the travel agent edit the trip         | Reviewers and advisors stay read-only (ADR-20261001-memory-bank-agent-config); the planner approves changes |
| A coverage test over every `--flag` string | Internal flags (Firebase's, git's) make it noisy; the gate checks what planners run                         |

## Consequences

- **Security:** none new. `relaxbro` can't write. Its web searches name places and dates, never the group's details.
- **Operational:**
  - A feature change now also touches the guide and maybe the landing page. The test catches missing fields, skills
    and commands, but not a missing sentence in the guide. That still needs the eye check, which `.claude/rules/docs.md`
    and `release-checker` call for.
  - Heading renames must fix their links.
- **Cost:** none.

## Read when

You add a page feature, a trip field, a side file, a skill, a role, a guide or a package script. Also read it when you
change how agents help a planner set up or change a trip, or when the docs-coverage test fails.
