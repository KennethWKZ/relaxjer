---
id: ADR-20261007-squash-merges
date: 2026-10-07
title: 'Pull Requests Merge by Squash, So the Changelog Lists Each Change Once'
domain: tooling
status: accepted
---

# Pull Requests Merge by Squash, So the Changelog Lists Each Change Once

## Summary

Every change merged through a pull request since v1.2.2 showed twice in `CHANGELOG.md` and the release notes: once from the branch's commit and once
from the merge commit, whose body GitHub fills with the pull request's title. The repository now allows only "Squash
and merge", titled from the commit (or the pull request when it has several), so `main` gets one Conventional Commit
per pull request. Decided by Kenneth on 2026-10-07 (adds to
[ADR-20261002-ci-image-and-releases](ADR-20261002-ci-image-and-releases.md)).

## Context

- release-please splits a commit message wherever a blank line is followed by a Conventional Commit header
  (`splitMessages` in its `commit.js`), so it can read several changes from one squashed commit. A merge commit
  `Merge pull request #35 from …` with the body `fix(engine): …` is therefore one more `fix`.
- Checked against release-please 17's own parser on 2026-10-07: a merge commit whose body is the title gives 1 entry, a
  blank or prose body gives 0, a squashed commit gives 1.
- GitHub allows only three merge-commit settings (title and body): pull request title and body, pull request title and
  blank, merge message and pull request title. Each puts the title in the message, so a merge commit always counts
  again.
- Commits are checked by commitlint (the commit-msg hook, and ci over a pull request's commits). A title GitHub writes at
  merge time isn't.

## Decision

- **Only "Squash and merge"** is allowed (Settings → General → Pull Requests; merge commits and rebase merging off).
- **Its title is "Default to pull request title, unless the pull request has a single commit"** (`COMMIT_OR_PR_TITLE`),
  and its body the commit messages. A branch carries one commit, so `main` gets that commit's checked header plus
  ` (#n)`. A pull request with several commits takes its title, so that title follows
  [the commit format](../commit-message-format.md) too.
- **Past releases are cleaned once by hand:** the second line of each pair is dropped from `CHANGELOG.md`; release
  notes already published stay as they are.

## Alternatives

| Option                                       | Why not                                                                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merge commits with a blank body              | Not a setting GitHub offers: a merge commit's message always carries the pull request's title                                                       |
| Rebase merging                               | One entry per commit too, but release-please documents squash merging, and a rebase gives every commit of a long branch its own changelog line      |
| A pull request title check in ci             | Only matters for a pull request with several commits; one more job for `ci-ok` to wait on. Worth adding if multi-commit pull requests become common |
| Hand-edit `CHANGELOG.md` before each release | Has to be remembered every release, and the release notes come from the pull request's body, so both need editing                                   |

## Consequences

- **Security:** none: no new token or permission.
- **Operational:** `main`'s history is linear, one commit per pull request, without merge commits. A branch's own
  commits survive only on the pull request. A multi-commit pull request's changelog line is its title, which nothing
  lints.
- **Cost:** none.

## Read when

You're changing how pull requests merge, release-please's configuration, or wondering why a change shows twice (or not
at all) in the changelog.
