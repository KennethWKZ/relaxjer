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
A fork's pull request runs ci without an approval unless its account is new to GitHub. GitHub holds the release pull
request's own ci for an "Approve and run", so a release takes that one click before the merge. Decided by Kenneth on 2026-10-02 (amends
[ADR-20261002-ci-image-and-releases](ADR-20261002-ci-image-and-releases.md), which said the release pull request gets
no ci).

## Context

- A pull request that release-please opens or updates with the workflow's token gets a `pull_request` ci run, but
  GitHub holds it as "action_required" until someone clicks "Approve and run", whatever the fork policy says (seen on
  v1.2.0 to v1.2.3 under both policies). With `ci-ok` required, the release couldn't merge until then.
- A fork's pull request waited for approval under the policy "all outside collaborators".
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
- **Docs and release bookkeeping skip the browser tests** (`scripts/ci/needs-e2e.mjs`, the `changes` job). `e2e` runs
  unless every changed file is on a list of what may skip it: top-level `*.md` (`CHANGELOG.md` included),
  `memory-bank/`, `knowledge/`, `guides/`, `.release-please-manifest.json`, and `package.json` when only its
  `"version"` changed. A path nobody listed runs everything, and so does a base it can't compare with. `secrets` and
  `test` always run (any file can leak a key; tier 0 checks the docs). The workflow itself always runs, with no path
  filter on its triggers, so `ci-ok` always reports; it accepts `e2e` as skipped only when `changes` said so.
  `tests/unit/needs-e2e.test.mjs` and `tests/repo/ci.test.mjs` hold the list and the wiring.
- **A release pull request takes one "Approve and run".** Its ci run comes from the workflow's token, and GitHub holds
  every such run until someone approves it; only that `pull_request` run counts for its merge gate. Tried and dropped
  the same day: the release job starting ci itself (`workflow_dispatch`) ran the tests, but a pull request's gate never
  counts a dispatched run, whoever starts it. Closing and reopening the pull request also gives it a run that isn't
  held (the event is then the maintainer's).
- **Fork pull requests run ci without approval** unless the account is new to GitHub
  (`first_time_contributors_new_to_github`, the least strict setting GitHub has).

## Alternatives

| Option                                                   | Why not                                                                                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Require the ten job names                                | Breaks every pull request the day the e2e matrix changes                                                                                                                             |
| No bypass                                                | Every change, the maintainer's too, goes through a branch and a green ci first: safer, ~10 minutes slower a change                                                                   |
| Also require a pull request for `main`                   | Same cost as no bypass, and a one-person repo has nobody else to review                                                                                                              |
| A personal access token or GitHub App for release-please | release-please's own fix: its pull requests get ordinary ci with no click, but a long-lived secret that can push sits in the repo (an App's key; a token that expires within a year) |
| The release job starts ci itself (`workflow_dispatch`)   | Runs the tests, but the pull request's gate doesn't count a dispatched run                                                                                                           |
| A path filter on ci's triggers (`paths-ignore`)          | ci wouldn't run at all on a docs pull request, so the required `ci-ok` would never report and the pull request could never merge                                                     |

## Consequences

- **Security:** a merge can't land red without a deliberate bypass. Fork pull requests run ci without approval; `ci.yml`
  uses `pull_request` (not `pull_request_target`), a read-only token and no secrets, so a stranger's code runs sandboxed,
  and the new-account check stops most throwaway-account abuse. The maintainer's direct pushes still skip ci until after
  they land, so the pre-push hook remains the gate for those.
- **Operational:** a pull request merges about 10 minutes after its last push (the e2e jobs). If ci never runs on a
  pull request (Actions down, or an approval pending), it can't merge until it does, or the maintainer bypasses.
- **Cost:** none: public-repo Actions minutes are free.

## Read when

You're adding or renaming a ci job, changing `main`'s ruleset, or wondering why a pull request can't merge.
