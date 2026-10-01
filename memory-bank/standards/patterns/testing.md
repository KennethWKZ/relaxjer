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
- **The page's Content-Security-Policy is on in every test.** A refusal fails the test like a page error
  ([ADR-20261001-page-csp](../decisions/ADR-20261001-page-csp.md)); a test that triggers one on purpose takes it off
  `pageErrors` itself (`tests/e2e/policy.spec.mjs`).
- **Group sync runs two phones** (`tests/e2e/sync.spec.mjs`): global setup also builds `trip-sync.html`, pointed at the
  test server's stand-in database (`tests/support/fake-rtdb.mjs`, the same rules as the real one) with keys made fresh
  per run. Each test gets its own space in it (the `rtdb_ns` cookie, `tests/support/sync.mjs`), because tests run in
  parallel and every sync page holds the same trip id. Setup also gives it a planner code (`TEST_PLANNER_CODE`), so the
  specs can claim planner on a phone and block the other; `add-stop.spec.mjs` covers Undo and the 4-stop caution on a
  page with no sync.
- **The real database rules run on Firebase's emulator,** not in CI: `pnpm test:sync-rules` (needs Java; firebase-tools
  comes through npx). Run it after any change to `scripts/sync/database.rules.json`, and change the stand-in to match.

## Running

```sh
pnpm test                         # tier 0
pnpm test:e2e                     # tier 1, ~2–3 min (3 workers locally; CI uses its default)
pnpm test:all                     # both + the short trip: before calling engine or data work done
TRIP_DIR=trips/<slug> pnpm test   # the contract on a real trip
LEGACY_ENGINE_DIR=/path/to/legacy pnpm test:e2e    # the same specs on the legacy engine
node tests/support/probe.mjs      # page errors of the last build, with engine line numbers
pnpm test:sync-rules              # the group-sync rules on Firebase's emulator (local, needs Java)
```

WebKit desktop flakes about once in 140 runs under full parallel load (story index, "Known issues"). A single retry in
CI covers it. Locally, re-run the one test alone before chasing it.
