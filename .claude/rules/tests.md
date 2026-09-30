---
paths:
  - 'tests/**'
  - 'playwright.config.mjs'
---

# Tests

Read `memory-bank/standards/patterns/testing.md` (SSoT).

- Tier 0 (`tests/repo`, `tests/contract`, `tests/unit`) stays fast: no network, no browser, no build.
- E2e opens the page through `tests/support/fixtures.mjs`: offline, a pinned trip clock, a pinned language, and a fail
  on any page error.
- `@demo` marks a test that depends on the demo's ids, times or strings. Every other test must pass on any trip.
- Known debt is `test.fail(true, reason)`, never a comment. Selectors live in `tests/support/page.mjs`.
- Never point a test at a real trip in CI, and never fake the Playwright clock.
