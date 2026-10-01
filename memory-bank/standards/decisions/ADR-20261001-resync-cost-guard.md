---
id: ADR-20261001-resync-cost-guard
date: 2026-10-01
title: 'The Data Refresh Answers From Its Cache, and Paying Google for More Is the Planner’s Call'
domain: data
status: accepted
---

# The Data Refresh Answers From Its Cache, and Paying Google for More Is the Planner’s Call

## Summary

`pnpm resync` now answers every Google call it can from the trip's cache. It stops a step after 200 new calls, and asks
before a run that would pay for everything (`--fresh`, or a trip with no cache yet), printing the call count and its
list price. Only the planner says yes: typed at the prompt, or `--yes` in their own command. An agent can't, because
the Bash guard blocks it. Decided by Kenneth on 2026-10-01, after one refresh started only to test a key cost RM520.
It amends the "refresh before the trip" line of [ADR-20260930-google-keys](ADR-20260930-google-keys.md).

## Context

- **A fresh fetch was the default.** A run without `--reuse` started from an empty cache and asked Google every call
  again: 4,645 for the first trip, US$134 at list price, about half of it Text Search at the Enterprise tier (ratings
  and hours).
- **The documented flow paid twice.** It was a dry run and then `--write`, and `--write` without `--reuse` fetched
  everything again.
- **A step run on its own also fetched fresh.**
- **A failed call was stored like an answer**, so a run a quota cut short could never finish from the cache.
- Google's budget alerts only send an email. Its quotas stop spending, but they are set per method, which leaves room
  for a full refresh a day.

## Decision

- **Cache first.** `lib/google.py` answers from the cache unless `RESYNC_FRESH=1` (`--fresh`). It asks again only for
  a call that failed in a way that passes: 401, 403, 429, 5xx, or no network. A 404 stays an answer, because `pins.py`
  re-pins a place Google no longer has.
- **A cap on new calls.** Without `RESYNC_PAID=1` (`--yes`), a step stops after `MAX_NEW` (200) new calls, at most
  about US$7. The calls it made are saved on the way out (`atexit`), so nothing paid for is lost.
- **A priced yes.**
  - `--fresh`, or a trip with no cache, prints the calls and their list price (`estimate()`: product × the dearest
    field asked, from Google's price list).
  - It goes ahead on `yes` typed at a terminal, or `--yes`.
  - Without a terminal and without `--yes`, it stops before asking anything.
- **The agent can't say yes.**
  - `.claude/hooks/guard-bash.mjs` blocks `resync … --yes` and setting `RESYNC_PAID`, in Bash, Monitor and
    context-mode's shells.
  - The planner runs the paid command themselves, in their own terminal or as a `!` command in Claude Code.
- **Testing a key** is one call per API (`guides/google-maps.md`, step 5), never a refresh.

## Alternatives

| Option                                       | Why not                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Keep fresh as the default; add a prompt only | A habitual "yes" still pays, and a step run directly bypassed the prompt |
| Docs only                                    | The docs existed, and the run happened anyway                            |
| A cost guard in a settings "ask" rule        | Permission rules match a prefix, so they can't single out `--yes`        |
| Rely on Google quotas alone                  | Set per method and per day, they still allow one full refresh a day      |

## Consequences

- **Cost:** a mistaken run costs at most about US$7 per step, and a full refresh happens only with the planner's yes.
- **Freshness:** cached hours and ratings stay until someone asks for `--fresh`. Refreshing right before the trip is
  now a deliberate step (the data-sync skill), and Google's storage terms still argue for doing it.
- **Operational:**
  - A trip's first refresh now needs the planner at the keyboard, or their `--yes`.
  - A refresh that adds many places stops at 200 new calls a step, and the planner re-runs it with `--yes`.
  - The price table in `lib/google.py` needs updating when Google's prices change. The estimate leaves out the free
    monthly amounts, so it errs high.
- **Security:** the hook is a speed bump, not a sandbox. An agent bent on it could still write a script that calls
  Google directly. Quotas on the key are the backstop.

## Read when

You're touching `pipeline/lib/google.py` or a step's Google calls, changing what `pnpm resync` fetches by default, or
writing a skill or a hook that runs the refresh.
