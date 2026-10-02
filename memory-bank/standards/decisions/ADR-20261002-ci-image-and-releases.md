---
id: ADR-20261002-ci-image-and-releases
date: 2026-10-02
title: "CI's Browser Jobs Run in Playwright's Image, in Halves, and release-please Makes the Releases"
domain: tooling
status: amended
---

# CI's Browser Jobs Run in Playwright's Image, in Halves, and release-please Makes the Releases

## Summary

CI's e2e jobs run inside Playwright's official image (`mcr.microsoft.com/playwright:v<version>-noble`), which already
holds the browsers and their system packages, so no job installs packages from Ubuntu's mirror. Each browser's tests
run in two halves side by side (`--shard`). Releases come from release-please: it keeps one release pull request open
on `main`, with the version bump and the `CHANGELOG.md` lines from the commits; merging it tags the commit and drafts the
release, which goes public once ci is green on that commit and the release gate passes. It replaces `pnpm release`
(commit-and-tag-version); v1.0.0 was the last release cut by hand. Decided by Kenneth on 2026-10-02.

## Context

- `playwright install --with-deps webkit` installed WebKit's system packages from Ubuntu's mirror on every run: under a
  minute on most days (median 55 s over 28 runs), 20 minutes on a slow one, which put a job past its time limit.
- The WebKit jobs then ran their tests for about 6.5 minutes, the longest stretch of a run.
- `v1.0.0` was cut by hand (`pnpm release`, then a push with the tag), and nothing turned the tag into a release
  page. Each release took the maintainer's machine and four commands.

## Decision

- **The e2e jobs run in `mcr.microsoft.com/playwright:v1.63.0-noble`** (Ubuntu 24.04, Node 24, git), as the runner's
  user (`--user 1001`). The image's version must equal `@playwright/test` in `package.json`: Playwright won't start
  another version's browsers. `tests/repo/ci.test.mjs` fails when they drift, so a Playwright bump changes both in one
  commit.
- **Each project runs in two halves** (`--shard=1/2`, `2/2`), both the demo pass and the short-trip pass: eight jobs
  instead of four. The job limit goes from 30 minutes back to 20.
- **`release.yml`**, on every push to `main`, runs release-please (`release-please-config.json`,
  `.release-please-manifest.json`): it opens or updates the `chore(release): vX.Y.Z` pull request, with the changelog
  sections `.versionrc` had. Merging it tags the commit (`force-tag-creation`) and makes a **draft** release. A second
  job runs `pnpm test:release`, waits for the commit's ci run to pass (45 minutes at most), and publishes the draft. The
  release pull request gets ci like any other (its first run waited for an "Approve and run"), and since
  [ADR-20261002-required-ci](ADR-20261002-required-ci.md) its merge waits for it. The workflow
  holds a write token, so its actions are pinned to commit SHAs, like `pages.yml`; `ci.yml` keeps following each
  action's major tag. The repo setting "Allow GitHub Actions to create and approve pull requests" is on for it.

## Alternatives

| Option                                                     | Why not                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| An Alpine image                                            | Playwright's browsers need glibc and support Ubuntu and Debian only; WebKit would have to be built by hand |
| Our own image in GHCR (Playwright's plus pnpm)             | Saves about 15 s a job, but it's one more image to rebuild on every Playwright bump                        |
| Cache the browser downloads (`actions/cache`)              | The slow part is the system packages, which `--with-deps` installs every run anyway                        |
| A self-hosted runner with everything installed             | A public repo: anyone's pull request would run code on the maintainer's machine                            |
| Keep `pnpm release`, with a tag-triggered release workflow | Built first, then dropped the same day: still the maintainer's machine and four commands for each release  |
| A "Cut release" button that runs `pnpm release` in CI      | CI would push to `main` itself, past the local pre-push checks                                             |
| semantic-release (a release on every push)                 | No review before a release, and a release for every fix (about eight on 2026-10-02 alone)                  |

## Consequences

- **Security:** the image is Microsoft's, pinned to an exact version tag (not a digest, so the tag is trusted, as with
  `ci.yml`'s actions). The release job's token can write releases and nothing else that CI couldn't already read; its
  actions are pinned to SHAs.
- **Operational:** a Playwright bump touches `package.json` and `ci.yml` together (the test says so). Pulling the
  image takes about 30–60 s a job instead of the install; no mirror stalls. A release is a merge of the
  release pull request; if ci fails on it, the release stays a draft until it's fixed and the publish job is re-run.
- **Cost:** eight e2e jobs instead of four. Free on a public repo; on a private one they'd use more of the monthly
  minutes, though each is shorter.

## Read when

You're changing CI's jobs, bumping Playwright, or changing how a release is cut or published.
