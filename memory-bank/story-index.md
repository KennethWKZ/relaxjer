---
created: 2026-09-30
updated: 2026-10-01
---

# Story Index

The roadmap: every step, its status, and what proves it done. Status is ✅ shipped, 🚧 in flight or ⏳ planned. The
"why" of each step lives in the ADRs ([`standards/decision-index.md`](./standards/decision-index.md)), and how to write
the code in [`standards/coding-standards.md`](./standards/coding-standards.md).

Order matters. Each step keeps `pnpm test:all` green before the next one starts, and every engine change keeps
`pnpm parity --live <legacy repo> --trip trips/<slug>` at the known diffs only
([ADR-20261001-live-page-on-relaxjer](./standards/decisions/ADR-20261001-live-page-on-relaxjer.md)).

## Steps

| Step | What                                                                                                                                                                                                                                                  | Done when                                                                                                                                                                  | Status and outcome                                                                                                                                                                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Repo layout, hygiene, trip contract, demo trip, tier-1 characterisation against the legacy engine                                                                                                                                                     | 11 node tests + 120 e2e runs green; the trip-agnostic set green on the real Taipei data                                                                                    | ✅ 2026-09-30. [ADR-20260930-repo-layout](./standards/decisions/ADR-20260930-repo-layout.md), [ADR-20260930-test-strategy](./standards/decisions/ADR-20260930-test-strategy.md)                                                                                                                  |
| 1    | Move the engine **verbatim** into `engine/`; `build.mjs` takes `--trip <dir> --out <dir>`; teach `tests/support/stage.mjs` the new layout; turn the CI e2e job on                                                                                     | Same specs green with no `LEGACY_ENGINE_DIR`                                                                                                                               | ✅ 2026-09-30: 120/120 on `engine/`; the Taipei trip built from `trips/` is byte-identical to the old repo's build                                                                                                                                                                               |
| 2    | Split `app.js` into modules along its own section map; `build.mjs` bundles them; unit tests for the pure ones                                                                                                                                         | Characterisation green; unit tests for flights, shifts, clashes, costs                                                                                                     | ✅ 2026-09-30: `engine/src/app/NN-*.js` (the joined build is byte-identical); `engine/src/core/{time,money,plan}.mjs` with unit tests. The transit planner is still inline                                                                                                                       |
| 3    | Pay the hard-coding debt into a trip schema; migrate the demo off `LEGACY_SLOTS`; open the push gate (`tests/release`)                                                                                                                                | Every `test.fail()` for the debt removed                                                                                                                                   | ✅ 2026-09-30: trip settings in [`standards/trip-format.md`](./standards/trip-format.md); the push gate passes; parity on the real trip differs only where two share bugs were fixed                                                                                                             |
| 3b   | Generic day roles (arrival, last day, flight-only day, free-time day from the data, any trip length) and the `tw` destination pack (tax refund, lucky draw, taxi meter, bike share)                                                                   | A 4-day test trip builds and passes the trip-agnostic e2e; live parity unchanged                                                                                           | ✅ 2026-10-01: `Plan.dayRoles`, `destinations/tw` + `regions/taipei`, `pnpm test:e2e:short`                                                                                                                                                                                                      |
| 4    | i18n: inline `Z(zh, en)` → locale files; per-trip UI languages (primary, secondary) + the destination's native layer with romanization                                                                                                                | A second language pair renders from config alone                                                                                                                           | ⏳                                                                                                                                                                                                                                                                                               |
| 5    | Move the pipeline (`pipeline/`, Python via uv) with Google mocked in tests; settle the Google-terms stance first                                                                                                                                      | Pipeline tests green offline                                                                                                                                               | ✅ 2026-10-01: `pnpm resync --trip trips/<slug>`; on the same inputs byte-identical to the old scripts except 3 fixed bugs. [ADR-20260930-google-keys](./standards/decisions/ADR-20260930-google-keys.md)                                                                                        |
| 6    | Agent tooling: skills (trip-intake, destination-pack, data-sync, build-page, verify-page, publish-htmlapp, trip-retro), agents (destination researcher, data curator, UX verifier, release checker), hooks, rules; seed `knowledge/`; the memory-bank | An agent plans the demo trip end to end from a requirements file                                                                                                           | 🚧 2026-10-01: the pieces are in (`.agents/skills/`, `.claude/`, `knowledge/`, `memory-bank/`, gated by `tests/repo`). The end-to-end run from a requirements file hasn't been done yet. [ADR-20261001-memory-bank-agent-config](./standards/decisions/ADR-20261001-memory-bank-agent-config.md) |
| 6c   | Affordance fixes from the 2026-10-01 audit: targets under 44 px, disabled and busy states, the focus ring on lanterns, ghost lantern buttons, the day strip's scroll cue and selected state, chevrons, the landing glow                               | Every "Fix" row in [`standards/patterns/affordances.md`](./standards/patterns/affordances.md) done, with a test where one can be written; parity and the 390 px pass green | ✅ 2026-10-01: every "Fix" row (`b429157`) and "Strengthen" row (`6ff9719`), measured by `tests/e2e/affordances.spec.mjs` on the demo and the short trip                                                                                                                                         |
| 6b   | Landing page on GitHub Pages (`site/`): what it is, how to plan a trip with it, links to the docs; built and checked like any UI change                                                                                                               | Live at kennethwkz.github.io/relaxjer                                                                                                                                      | 🚧 2026-10-01: built (`site/`, `.github/workflows/pages.yml`, `tests/repo/site.test.mjs`); goes live once the GitHub repo exists and Pages is set to "GitHub Actions"                                                                                                                            |
| 7    | A second destination (`jp`, Hokkaido or Tokyo) and a second demo trip                                                                                                                                                                                 | Both demos green on the same engine                                                                                                                                        | ⏳                                                                                                                                                                                                                                                                                               |

## Engine debt

Step 3 paid: dates, group name, group size, currency, time zone, day routes, forecast spots, tickets, map areas, meal
slots, shopping notes and the per-person share gaps (all trip data now, [`standards/trip-format.md`](./standards/trip-format.md)).
Since 2026-10-01 these are trip or pack data too:

- day roles `d1`…`d7` (`Plan.dayRoles`) and the Taiwan-only features (the `tw` pack);
- the place ids `hotel`, `tpe1`, `tpe2`, the Taoyuan airport section, the required Taiwan site ids, the lucky-draw
  wording;
- YouBike by name, the snowboard section's labels, `taipei-trip*` file names, the `tp5.` storage prefix, the brush
  font (`TRIP.fileName`, `storageKey`, `brushFont`, `SNOW.h/kind/icon`);
- one hotel per trip: one, or one per night (`DAYS[i].hotel`, `Plan.hotelsByDay`; the 4-day test trip moves hotel on
  night 2);
- one themed shop list: any number now (`SHOPLISTS`; `SNOW` still works as one list).

**Still in the engine:** UI languages fixed to Chinese + English (`Z(zh, en)`), Chinese group numerals (五人), and the
Traditional → Simplified search. That's step 4.

## Known issues

- WebKit desktop flakes under full parallel load, about 1 in 140 runs, a different test each time ("closed lists are
  not built until opened", "+ after a stop offers nearby places"). Both pass alone every time, and CI retries once. If
  it grows, run WebKit with fewer workers.
- The airport method tiles break "Manageable" mid-word at desktop width. Cosmetic, desktop only.
- MapLibre GL JS 6 (July 2026) is ESM-only; the page pins 5.24 from cdnjs. Moving to 6 is an engine change, not a
  version bump.
- The engine's lantern look came from the first destination. Whether a destination pack may re-theme it is open
  (`DESIGN.md`, Do's and Don'ts).

## First trip (Taipei, 2026)

- The tier-1 tests found three bugs in the live page on their first run. They were fixed and republished on 2026-09-30.
  Their causes are lessons now ([`../knowledge/engine-browser.md`](../knowledge/engine-browser.md)).
- A fourth bug, a deep link landing off target in WebKit, was found and fixed in RelaxJer on 2026-10-01.
- The group's live page has been built by RelaxJer since 2026-10-01, and its data refresh has run here since step 5
  ([ADR-20261001-live-page-on-relaxjer](./standards/decisions/ADR-20261001-live-page-on-relaxjer.md)). The legacy
  repo is a fallback until the trip ends, then archived.

## Decisions before the repo goes public

- ~~Licence~~: **MIT**, decided 2026-09-30 (`LICENSE`).
- ~~Google Maps Platform terms~~: **each user brings their own keys**, decided 2026-09-30
  ([ADR-20260930-google-keys](./standards/decisions/ADR-20260930-google-keys.md)).
- ~~Name~~: **RelaxJer**, decided 2026-09-30 ([ADR-20260930-name-relaxjer](./standards/decisions/ADR-20260930-name-relaxjer.md)).
  Before launch it still needs a formal MyIPO + SSM check.
- **Hosting:** GitHub Pages serves one simple landing page: what RelaxJer is, and how a family uses the repo to plan
  their trip (clone, add their own keys, describe the trip to the agent, build, publish behind a password). No trip
  pages go on Pages, not even the demo. Pages sites are public even from a private repo, so real trips keep a
  password-gated host (ht-ml.app today). The `publish-htmlapp` skill refuses to push a real trip to Pages.
- **Google's terms vs the data cache:** Google allows storing place IDs, and coordinates for 30 days, and expects Places
  content on a Google map. The pipeline stores fetched details in trip files, and the MapLibre fallback shows them.
  Get a legal read before the public guide recommends the current flow
  ([ADR-20260930-google-keys](./standards/decisions/ADR-20260930-google-keys.md)).
- **CI supply chain:** pin GitHub Actions to commit SHAs.
- **History:** the pre-push scan blocks any pushed commit that adds a real trip's details. Rewrite such a commit before
  the first push.
