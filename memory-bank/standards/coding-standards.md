---
created: 2026-10-01
updated: 2026-10-01
---

# Coding Standards: Index

The rules that bind, and what enforces each one. The how-to detail is in [`patterns/`](./patterns/), and this file only
links to it. Content lives in one place (see [`../project/conventions.md`](../project/conventions.md)).

## Standards that bind

| Rule                                                                                                                                                                                           | Enforcement                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Never commit a real trip, key or build.** `trips/*` (except its README), `.share/`, `.secrets/`, `*.key`, `*.pem`, `.env*` and `dist/` stay out. No `git add -f` around it, no `--no-verify` | `.gitignore`; `.husky/pre-commit` path guard + gitleaks; `tests/repo/hygiene.test.mjs`; CI gitleaks over history; `.claude/hooks/` guards |
| **Nothing published carries a real trip's details** (name, hotel, flight numbers, dates, `never-publish.txt` lines)                                                                            | `pnpm test:release` + the history scan on pre-push                                                                                        |
| **Keys live outside the repo, and each user brings their own.** Never paste one into a file, a test or a chat                                                                                  | gitleaks; the hygiene test's key patterns; `.claude/hooks/guard-write.mjs`                                                                |
| **Demo data stays synthetic**: no real people, bookings or phone numbers, nothing copied from Google                                                                                           | `tests/contract/demo-trip.test.mjs`                                                                                                       |
| **Tests define done.** `pnpm test:all` before calling engine or data work finished; engine changes keep `pnpm parity` at the known diffs                                                       | pre-commit (`pnpm test`), pre-push (`pnpm verify`), CI (verify + e2e + short-trip e2e)                                                    |
| **Known engine debt is a `test.fail(true, reason)`**, and its marker is deleted in the change that makes it pass                                                                               | Playwright reports "expected to fail but passed"                                                                                          |
| **Tag demo-specific tests `@demo`.** Everything else must pass on any trip                                                                                                                     | `TRIP_DIR=… pnpm exec playwright test --grep-invert @demo` on a real trip; `pnpm test:e2e:short`                                          |
| **Engine sections share one scope; core modules and packs are pure**                                                                                                                           | ESLint config per folder; `tests/unit/packs.test.mjs`                                                                                     |
| **A UI change is checked by eye at 390 px and desktop, in Chromium and WebKit**                                                                                                                | Tier 1's four projects; the `verify-page` skill's real-browser pass                                                                       |
| **Every group cost shows a per-person share, in the trip's currency and the home currency**                                                                                                    | `tests/e2e/costs.spec.mjs`                                                                                                                |
| **Never describe people on a page by family relationship.** Say "the group", "seniors", "adults"                                                                                               | Review: the data-curator agent checks it. No word list, because place names (妈祖 temples, "外婆家") would trip one                       |
| **Seniors: count walking time ×1.4, and suggest a taxi first for long legs**                                                                                                                   | Review (`trip-intake`, data-curator)                                                                                                      |
| **Conventional Commits** in the house style                                                                                                                                                    | commitlint on commit-msg ([`commit-message-format.md`](./commit-message-format.md))                                                       |
| **Formatting and lint are the tools' job**                                                                                                                                                     | Prettier + ESLint via lint-staged; `pnpm verify` checks both                                                                              |
| **Decisions are ADRs**, one file each, with the index regenerated                                                                                                                              | `tests/repo/memory-bank.test.mjs` (frontmatter, ids, a stale index, broken links)                                                         |
| **Lessons and agent rules are proposed, not self-applied.** New rules for `knowledge/`, `.agents/` or `.claude/` go in as a reviewed change                                                    | Review; `tests/repo/agent-config.test.mjs` checks their shape                                                                             |

## Patterns

| When you're…                                                 | Read                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| changing the engine, a section, a core module or a pack      | [`patterns/engine.md`](./patterns/engine.md)           |
| writing or changing a test                                   | [`patterns/testing.md`](./patterns/testing.md)         |
| writing trip data (a real trip or the demo)                  | [`patterns/trip-data.md`](./patterns/trip-data.md)     |
| touching the pipeline or a pipeline step                     | [`patterns/pipeline.md`](./patterns/pipeline.md)       |
| changing anything the page shows                             | [`patterns/frontend.md`](./patterns/frontend.md)       |
| adding or changing a control (button, link, tab, disclosure) | [`patterns/affordances.md`](./patterns/affordances.md) |

## Comments

Comments say why, not what. Most files open with a comment of one to three lines: what the file is and why it exists
(see any file in `tests/` or `engine/build.mjs`). Inside, comment only what the code can't say: an outside fact (a
browser quirk, a host's behaviour, a data source's gap), a deliberate deviation someone would "fix" back, or a contract
with the outside world (the `#add=` link format). No tombstones, no step numbers, no restating the code.
