---
created: 2026-10-01
updated: 2026-10-01
---

# Testing

How to write a test that fits the strategy ([ADR-20260930-test-strategy](../decisions/ADR-20260930-test-strategy.md)).

## Which tier

| You're checking…                                                 | Write it in                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| a rule about the repo: ignores, hooks, agent config, memory-bank | `tests/repo/*.test.mjs` (`node:test`)                             |
| a rule a trip's data must follow                                 | `tests/support/trip-contract.mjs`, exercised by `tests/contract/` |
| a pure function (core module, pack)                              | `tests/unit/*.test.mjs`                                           |
| what the page does                                               | `tests/e2e/*.spec.mjs` (Playwright, four projects)                |
| that nothing published carries a real trip's details             | `tests/release/` (runs on pre-push, not in `pnpm test`)           |
| the pipeline                                                     | `pipeline/tests/` (`pnpm test:pipeline`, offline, Google mocked)  |

Tier 0 (`pnpm test`) runs on every commit, so keep it under a few seconds: no network, no browser, no build.

## E2e conventions

- **Open the page through the fixtures** (`tests/support/fixtures.mjs`): `openTrip(page)`. Every test gets a page with
  no outside network, a pinned trip clock (`tripNow`, through the engine's own `<storageKey>now` override), a pinned
  UI language (`tripLang`), and a failure on any page or console error.
- **Tag demo-specific tests `@demo`**: anything that depends on the demo's ids, times or strings. Everything else must
  pass on any trip, which is the proof that the suite characterises the engine, not the demo:
  - `TRIP_DIR=trips/<slug> pnpm exec playwright test --grep-invert @demo` on a real trip (local only);
  - `pnpm test:e2e:short` on the 4-day trip made from the demo (also in CI).
- **Set the clock from the trip's own dates** in a trip-agnostic test, not from the demo's.
- **Known debt is a failing test, not a comment:** `test.fail(true, 'reason')` states the behaviour you want where the
  engine lacks it. When a change fixes it, Playwright reports "expected to fail but passed"; delete the marker in that
  change.
- **Contracts with the outside world get exact tests.** The `#add=` share-link format is one: links already sent to a
  group chat must keep importing.
- **Selectors live in the helpers.** When markup changes, change `tests/support/page.mjs`, not the invariants in the
  specs.
- **Don't fake the Playwright clock:** the engine's 2 s scroll holds measure real time.

## Running

```sh
pnpm test                         # tier 0
pnpm test:e2e                     # tier 1, ~1–2 min
pnpm test:all                     # both + the short trip: before calling engine or data work done
TRIP_DIR=trips/<slug> pnpm test   # the contract on a real trip
LEGACY_ENGINE_DIR=/path/to/legacy pnpm test:e2e    # the same specs on the legacy engine
node tests/support/probe.mjs      # page errors of the last build, with engine line numbers
```

WebKit desktop flakes about once in 140 runs under full parallel load (story index, "Known issues"). A single retry in
CI covers it. Locally, re-run the one test alone before chasing it.
