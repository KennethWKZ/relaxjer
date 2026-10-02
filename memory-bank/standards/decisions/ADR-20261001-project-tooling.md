---
id: ADR-20261001-project-tooling
date: 2026-10-01
title: "Project Tooling Follows the Maintainer's Standard Setup"
domain: tooling
status: accepted
---

# Project Tooling Follows the Maintainer's Standard Setup

## Summary

pnpm (pinned, with a three-day release-age gate), husky, lint-staged, Prettier, ESLint, commitlint and
commit-and-tag-version, the same setup as Kenneth's other JavaScript repos (reference: his
`serverless-aws-nodejs-typescript` boilerplate). Adapted for a community repo. Decided by Kenneth on 2026-10-01.

## Context

The repo started with npm, a hand-rolled `.githooks/` folder (wired with `core.hooksPath`) and no formatter or linter.
A public repo that invites contributors needs one formatting style nobody argues about, commits a changelog can be built
from, and hooks that install themselves.

## Decision

| Concern         | Choice                                                                                           | Notes                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager | pnpm, pinned with `packageManager` (Corepack)                                                    | `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320`: a release must be 3 days old before it installs. `allowBuilds: {}`: no install scripts run.                                                  |
| Node            | 24 (`.nvmrc`, `.node-version`, `engines`)                                                        |                                                                                                                                                                                                    |
| Git hooks       | husky (`.husky/`), wired by `pnpm install`                                                       | pre-commit: path guard, gitleaks on the staged diff, lint-staged, fast tests. commit-msg: commitlint. pre-push: history scan, gitleaks, `pnpm verify`, release gate.                               |
| Formatting      | Prettier (`.prettierrc.yaml`: tabs, width 150, single quotes, trailing commas) + `.editorconfig` | Data fixtures, `engine/src/shell.html`, the two IIFE halves and vendored third-party skills are ignored (`.prettierignore`). `memory-bank/` is formatted like the READMEs (`proseWrap: preserve`). |
| Linting         | ESLint flat config, `@eslint/js` recommended + `eslint-config-prettier`                          | `engine/src/app/*.js` turns off `no-undef`/`no-unused-vars`: the build joins those fragments into one script, so per-file checks only see the split.                                               |
| Commits         | Conventional Commits, checked by commitlint                                                      | Types match the changelog sections, so every type has one. House style: [`../commit-message-format.md`](../commit-message-format.md).                                                              |
| Releases        | release-please (since 2026-10-02; `pnpm release` before)                                         | A release pull request; merging it releases ([ADR-20261002-ci-image-and-releases](ADR-20261002-ci-image-and-releases.md)).                                                                         |

Adapted from the reference: no Jira or Bitbucket links, no commitizen Jira adapter, no branch-name rule (a community
repo takes pull requests from any branch name), and `proseWrap: preserve` (the docs are hand-wrapped).

## Alternatives

1. **Stay on npm and `.githooks/`.**
   - Zero extra dependencies, and `npm` needs no Corepack step.
   - Rejected: it has no release-age gate, which matters for a public repo, and it differs from the maintainer's other
     repos.
2. **Biome instead of Prettier + ESLint.**
   - One fast tool.
   - Rejected for now: the reference setup uses Prettier + ESLint, and ESLint's flat config handles the per-folder
     globals (page script, Node, Playwright callbacks) that this repo needs.
3. **Lint the joined page script as one file**, so `no-undef` works on the engine.
   - Catches a misspelt cross-fragment name before the browser does.
   - Deferred, not rejected: the e2e suite already fails on any page error. Worth adding once the engine stops moving.

## Consequences

- **Security:** `minimumReleaseAge` and `allowBuilds: {}` reduce the supply-chain surface. gitleaks, the path guard and
  the real-trip gate moved into `.husky/` unchanged, and `tests/repo/hygiene.test.mjs` asserts they're still wired.
- **Operational:** contributors run `corepack enable` once. CI uses `pnpm/action-setup` and runs `pnpm verify` (lint,
  format check, fast tests, pipeline tests) before e2e.
- **One-time cost:** the first Prettier pass rewrote most files (spaces to tabs). It is one commit on its own, proved by
  parity (0 diffs on the demo and the Taipei trip) and the full test suite, so `git blame --ignore-rev` can skip it
  (`.git-blame-ignore-revs`).

## Read when

You're changing a hook, a lint or format rule, the package manager settings or the release flow.
