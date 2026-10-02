---
id: ADR-20261002-ci-image-and-releases
date: 2026-10-02
title: "CI's Browser Jobs Run in Playwright's Image, in Halves, and a Pushed Tag Becomes a GitHub Release"
domain: tooling
status: accepted
---

# CI's Browser Jobs Run in Playwright's Image, in Halves, and a Pushed Tag Becomes a GitHub Release

## Summary

CI's e2e jobs run inside Playwright's official image (`mcr.microsoft.com/playwright:v<version>-noble`), which already
holds the browsers and their system packages, so no job installs packages from Ubuntu's mirror. Each browser's tests
run in two halves side by side (`--shard`). A pushed `v*.*.*` tag becomes a GitHub release, with its `CHANGELOG.md`
section as the notes, once the tag passes the release gate and its commit's ci run is green (`release.yml`).
Releases are still cut by hand (`pnpm release`). Decided by Kenneth on 2026-10-02.

## Context

- `playwright install --with-deps webkit` installed WebKit's system packages from Ubuntu's mirror on every run: under a
  minute on most days (median 55 s over 28 runs), 20 minutes on a slow one, which put a job past its time limit.
- The WebKit jobs then ran their tests for about 6.5 minutes, the longest stretch of a run.
- Tags existed (`v1.0.0`), but nothing turned them into a release page with notes.

## Decision

- **The e2e jobs run in `mcr.microsoft.com/playwright:v1.63.0-noble`** (Ubuntu 24.04, Node 24, git), as the runner's
  user (`--user 1001`). The image's version must equal `@playwright/test` in `package.json`: Playwright won't start
  another version's browsers. `tests/repo/ci.test.mjs` fails when they drift, so a Playwright bump changes both in one
  commit.
- **Each project runs in two halves** (`--shard=1/2`, `2/2`), both the demo pass and the short-trip pass: eight jobs
  instead of four. The job limit goes from 30 minutes back to 20.
- **`release.yml`** runs on a pushed version tag, or by hand for a tag that has no release yet. It checks that the tag
  is on `main` and names `package.json`'s version, runs `pnpm test:release`, waits for the commit's ci run to pass
  (45 minutes at most), then creates or updates the release with `scripts/release-notes.mjs`. It holds a write token,
  so its actions are pinned to commit SHAs, like `pages.yml`. `ci.yml` keeps following each action's major tag.

## Alternatives

| Option                                                   | Why not                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| An Alpine image                                          | Playwright's browsers need glibc and support Ubuntu and Debian only; WebKit would have to be built by hand |
| Our own image in GHCR (Playwright's plus pnpm)           | Saves about 15 s a job, but it's one more image to rebuild on every Playwright bump                        |
| Cache the browser downloads (`actions/cache`)            | The slow part is the system packages, which `--with-deps` installs every run anyway                        |
| A self-hosted runner with everything installed           | A public repo: anyone's pull request would run code on the maintainer's machine                            |
| Release fully from CI (release-please, semantic-release) | A release then needs a bot's pull request or a token that can push to `main`; `pnpm release` already works |

## Consequences

- **Security:** the image is Microsoft's, pinned to an exact version tag (not a digest, so the tag is trusted, as with
  `ci.yml`'s actions). The release job's token can write releases and nothing else that CI couldn't already read; its
  actions are pinned to SHAs.
- **Operational:** a Playwright bump touches `package.json` and `ci.yml` together (the test says so). Pulling the
  image takes about 30–60 s a job instead of the install; no mirror stalls. A release is `pnpm release`, then
  `git push --follow-tags origin main`; the release page appears once ci is green.
- **Cost:** eight e2e jobs instead of four. Free on a public repo; on a private one they'd use more of the monthly
  minutes, though each is shorter.

## Read when

You're changing CI's jobs, bumping Playwright, or changing how a release is cut or published.
