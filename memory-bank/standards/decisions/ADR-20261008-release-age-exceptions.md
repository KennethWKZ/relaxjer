---
id: ADR-20261008-release-age-exceptions
date: 2026-10-08
title: 'A Release Comes In Before Its Three Days Only by Exact Version, Until It Turns Three Days Old'
domain: tooling
status: accepted
---

# A Release Comes In Before Its Three Days Only by Exact Version, Until It Turns Three Days Old

## Summary

The three-day release-age gate stays for every package. When the maintainer wants a release sooner,
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml` names it by exact version (`name@x.y.z`), with a comment giving the
date it would have passed the gate, and the entry goes once that date has passed. First use: Playwright 1.64.0, taken on
2026-10-08, the morning after its release. Decided by Kenneth on 2026-10-08 (amends
[ADR-20261001-project-tooling](ADR-20261001-project-tooling.md)).

## Context

- `minimumReleaseAge: 4320` refuses any version younger than three days. On 2026-10-08 it refused `@playwright/test`,
  `playwright` and `playwright-core` 1.64.0, published 2026-10-07 at 20:44 UTC (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`).
- pnpm also checks the lockfile against the gate on every install. Without the exception, CI's
  `pnpm install --frozen-lockfile` fails on the same three entries (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, checked on
  2026-10-08), so the exception has to be in the repo, not only on the maintainer's machine.
- `minimumReleaseAgeExclude` takes a package name or a scope wildcard (`@scope/*`), which lets every later version in
  early too, or `name@version` (several exact versions joined by `||`), which lets in only those releases.

## Decision

- **The gate stays at three days for everything else** (`tests/repo/hygiene.test.mjs` keeps it at a day or more).
- **An exception names exact versions:** one `name@x.y.z` entry for each package the release needs early. For
  Playwright that's three, because `@playwright/test` pins `playwright`, which pins `playwright-core`. The hygiene test
  reads every line under the key and refuses anything else: a bare name, a wildcard, a range, an `||` list, an inline
  list or another spelling of the key.
- **Each exception says when it lapses** (published + three days) in a comment, and is removed by the first change
  after that date. Nothing checks the date, because a lapsed exact-version entry lets nothing new in.
- **It's the maintainer's call**, recorded in the commit that adds it.

## Alternatives

| Option                                         | Why not                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Wait the three days                            | The default, and still the right one for most bumps; here the maintainer chose not to wait                       |
| Lower `minimumReleaseAge`                      | Opens the gate for every package at once, and 1.64.0 was under a day old, below the floor the hygiene test keeps |
| Exclude by name (`playwright`)                 | Lets every later Playwright release in early as well, and stays open for as long as nobody removes it            |
| `--config.minimumReleaseAge=0` for one install | CI's frozen install checks the lockfile against the gate, so it fails; nothing in the repo records the exception |

## Consequences

- **Security:** the named release skips the three days in which a hijacked version is usually caught and pulled. Only
  that version does: its dependencies still go through the gate unless named too, and an exact version can't widen to a
  later release.
- **Operational:** one entry to remove after its date. Until then, the exception has to stay in step with the lockfile:
  a bump to a different version needs its own entry or the three days.
- **Cost:** none.

## Read when

You want a dependency release that's under three days old, or you're wondering why `pnpm-workspace.yaml` names one.
