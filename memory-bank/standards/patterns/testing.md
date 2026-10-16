---
created: 2026-10-01
updated: 2026-10-02
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
- **A slow phone is a slowed CPU, not a faked clock.** When a behaviour depends on how fast the phone is (the browser's
  own work landing after the page's), the Chromium projects run it on a CPU slowed through the DevTools protocol:
  `(await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 })`, skipped in WebKit,
  which has no such switch. The close-a-sheet tests in `tests/e2e/navigation.spec.mjs` do this.
- **The page's Content-Security-Policy is on in every test.** A refusal fails the test like a page error
  ([ADR-20261001-page-csp](../decisions/ADR-20261001-page-csp.md)); a test that triggers one on purpose takes it off
  `pageErrors` itself (`tests/e2e/policy.spec.mjs`).
- **Group sync runs two phones** (`tests/e2e/sync.spec.mjs`): global setup also builds `trip-sync.html`, pointed at the
  test server's stand-in database (`tests/support/fake-rtdb.mjs`, the same rules as the real one) with keys made fresh
  per run. Each test gets its own space in it (the `rtdb_ns` cookie, `tests/support/sync.mjs`), because tests run in
  parallel and every sync page holds the same trip id. Setup also gives it a planner code (`TEST_PLANNER_CODE`), so the
  specs can claim planner on a phone and block the other; `add-stop.spec.mjs` covers Undo and the 4-stop caution on a
  page with no sync.
- **The landing page runs in the same projects** (`tests/e2e/site.spec.mjs`): global setup copies `site/` beside the
  trip page, and the spec opens it with motion on, because that's where its overflow and its moving sky live. A state
  that only lasts a moment, a postcard part-way through settling, is measured by seeking its animation through its
  run, not by hoping a sampled frame lands on it. It skips under `TRIP_DIR` and `LEGACY_ENGINE_DIR`: the landing page
  depends on neither, so those runs would only repeat it. Its checks walk the whole page, and CI's WebKit paints the sky's blur and
  glow in software, several times slower than a laptop, so in WebKit they get 120 s (`test.setTimeout` in a `beforeEach`; a file-level `test.slow(callback)` doesn't reach the tests' timeout). Keep them cheap
  anyway: settle what the check doesn't measure up front, scroll instantly, and work out what doesn't change with the
  scroll once.
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

## When a test fails only sometimes

A test that passes when re-run alone isn't cleared. During the first trip, two "flakes" were real: one was a race in
the test, and the other was a page bug a senior's slow phone would hit, which passed hundreds of runs on a laptop.

1. **Read the failure.** A test that failed every CI retry is not a flake. Note how far off it was, and in which
   direction.
2. **Reproduce it under load:** `--repeat-each 40 --workers 6 --retries 0` on that test, the old code against the new.
3. **Reproduce it on a slow phone,** if it still passes: a copy of the test on a slowed CPU (above) that logs what the
   page does, such as each scroll event and its time.
4. **Then fix the cause:**
   - a race in the test: wait for the condition the test means (`expect.poll`), never longer timeouts;
   - a page bug: fix the page, and keep the slowed CPU in the test so the suite catches it on any machine.
5. **Prove it** with the same command: failures before, none after.

WebKit desktop flakes about once in 140 runs under full parallel load, a different test each time (story index, "Known
issues"). A single retry in CI covers that one; the steps above are for a test that fails twice, or always the same
test.
