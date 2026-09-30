# AGENTS.md

RelaxJer turns a family's trip requirements into one offline-friendly, installable trip page. It's being extracted
from a single-trip repo. **Status: steps 0–3 of `docs/roadmap.md` are done.** The engine is in `engine/` (sections in
`src/app/`, pure logic in `src/core/`), and reads each trip's own settings (`docs/trip-format.md`). Next: the `tw`
destination pack and generic day roles.

## Read first

- `docs/brief.md`: the goal and the quality bar.
- `docs/adr/0001-repo-layout.md`: where things go.
- `docs/adr/0002-test-strategy.md`: how tests work and why.
- `docs/roadmap.md`: the steps, the engine's hard-coding debt, and open decisions.

## Commands

```sh
npm install                      # also wires .githooks (pre-commit: blocks trips/keys, gitleaks, fast tests)
npm test                         # tier 0: repo hygiene + trip contract (node:test, < 1 s)
npm run test:e2e                 # tier 1: 4 projects, ~1–2 min, on engine/
npm run build -- --trip trips/<slug> --keys ~/.config/relaxjer/google.json   # a real trip; omit --keys for the demo
npm run test:release             # the push gate: no real-trip details in engine/
TRIP_DIR=<trip folder> npm test                                    # contract on a real trip (local only)
TRIP_DIR=<trip folder> npx playwright test --grep-invert @demo    # trip-agnostic e2e on it
LEGACY_ENGINE_DIR=/path/to/legacy-trip-repo npm run test:e2e      # compare against the old engine
node tests/support/probe.mjs     # debug: page errors of the last built page, with engine line numbers
```

## Rules

- **Never commit a real trip, key or build.**
  - `trips/*` (except its README), `.share/`, `*.key`, `.env*` and `dist/` are ignored, and the hook blocks them.
  - Don't `git add -f` around it, and don't `git add -A` in the legacy repo, which holds live keys.
- **Keys live outside the repo, and each user brings their own** (ADR 0003). Never paste one into a file, a test or chat.
- **Demo data stays synthetic.** No real people, bookings or phone numbers, and nothing copied from Google (a contract
  test enforces it).
- **Tests define done.**
  - Run `npm run test:all` before calling engine or data work finished.
  - A UI change also gets checked by eye at 390 px and desktop, in Chromium and WebKit.
- **Known engine debt is a `test.fail()` with a reason.** When a change makes one pass, delete its marker in the same
  change.
- **Tag demo-specific tests `@demo`.** Everything else must pass on any trip.
- **Lessons are proposed, not self-applied.** New rules for `knowledge/` or `.claude/` go in as a reviewed change, and
  tests gate them.
- **Never describe people on a page by family relationship.**
- **Seniors:** count walking time ×1.4, and suggest a taxi first for long legs.
