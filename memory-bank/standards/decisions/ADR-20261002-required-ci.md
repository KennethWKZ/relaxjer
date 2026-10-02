---
id: ADR-20261002-required-ci
date: 2026-10-02
title: 'A Red CI Blocks the Merge: main Requires One ci-ok Check, and the Maintainer Can Still Push'
domain: tooling
status: accepted
---

# A Red CI Blocks the Merge: main Requires One ci-ok Check, and the Maintainer Can Still Push

## Summary

`main`'s ruleset ("Protect Main Branch") blocked only deletion and force-pushes, so a pull request could merge with ci
red or still running. It now requires one status check, `ci-ok`, a job at the end of `ci.yml` that passes only when every
other ci job passed. The repository admin role may bypass it, so the maintainer's own pushes to `main` keep working.
Fork pull requests still wait for an approval before their ci runs: loosening that held the release pull requests too.
Decided by Kenneth on 2026-10-02 (amends [ADR-20261002-ci-image-and-releases](ADR-20261002-ci-image-and-releases.md),
which said the release pull request gets no ci: it does).

## Context

- The release pull requests showed ci running on them (`pull_request` events). The first one waited for an
  "Approve and run"; later ones ran on their own. A fork's pull request waited for approval under the policy
  "all outside collaborators".
- A required check by job name would list ten names (`secrets`, `test`, eight `e2e (project, shard)`), and the day the
  matrix changed, every pull request would wait for a check that no longer exists.
- A required check also applies to pushes: a commit pushed straight to `main` must have passed it elsewhere first. The
  maintainer pushes to `main` directly (the pre-push hook runs the release gate and the history scan).

## Decision

- **`ci-ok`** (`ci.yml`): `needs` every other job, runs `if: always()`, and fails unless every result is `success`. A
  matrix job reports one result for all its shards. `tests/repo/ci.test.mjs` fails when a job is missing from its
  `needs`.
- **The ruleset requires `ci-ok`** from GitHub Actions, without "up to date with main" (release-please's branch and
  short-lived branches would rebase for nothing).
- **The admin role bypasses it** ("always"): the maintainer can push to `main`, and can merge a red pull request only by
  ticking GitHub's bypass box on purpose. Contributors and the release pull request can't.
- **ci runs once per pull request**: `push` runs it only on `main` (merges, the maintainer's pushes, and the release
  commit the release job waits for), so a pull request's branch doesn't run it a second time. `tests/repo/ci.test.mjs`
  holds the triggers.
- **Fork pull requests keep the approval** ("all outside collaborators"). Tried for a day: the least strict setting,
  `first_time_contributors_new_to_github`, held every release pull request's ci for an approval (GitHub counts the
  `github-actions` bot as new), so `ci-ok` never came and the release couldn't merge. Under "all outside collaborators"
  the release pull requests run on their own.

## Alternatives

| Option                                 | Why not                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Require the ten job names              | Breaks every pull request the day the e2e matrix changes                                                           |
| No bypass                              | Every change, the maintainer's too, goes through a branch and a green ci first: safer, ~10 minutes slower a change |
| Also require a pull request for `main` | Same cost as no bypass, and a one-person repo has nobody else to review                                            |

## Consequences

- **Security:** a merge can't land red without a deliberate bypass. A fork's ci waits for the maintainer's approval; `ci.yml`
  uses `pull_request` (not `pull_request_target`), a read-only token and no secrets, so once approved a stranger's code
  runs sandboxed. The maintainer's direct pushes still skip ci until after
  they land, so the pre-push hook remains the gate for those.
- **Operational:** a pull request merges about 10 minutes after its last push (the e2e jobs). If ci never runs on a
  pull request (Actions down, or an approval pending), it can't merge until it does, or the maintainer bypasses.
- **Cost:** none: public-repo Actions minutes are free.

## Read when

You're adding or renaming a ci job, changing `main`'s ruleset, or wondering why a pull request can't merge.
