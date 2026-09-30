# Roadmap

Order matters: every step keeps `pnpm test:all` green before the next starts, and every engine change keeps
`pnpm parity --live <legacy repo> --trip trips/taipei-2026` at the listed diffs only: the proof that RelaxJer renders the
first trip the same as its live page.

| Step | What | Done when |
|---|---|---|
| 0 ✅ | Repo layout, hygiene, trip contract, demo trip, tier-1 characterisation against the legacy engine | 11 node tests + 120 e2e runs green; trip-agnostic set green on the real Taipei data |
| 1 ✅ | Move the engine **verbatim** into `engine/`; `build.mjs` takes `--trip <dir> --out <dir>` instead of fixed paths; teach `tests/support/stage.mjs` the new layout; turn the CI e2e job on | Same specs green with no `LEGACY_ENGINE_DIR`. Done 2026-09-30: 120/120 on `engine/`; the Taipei trip built from `trips/taipei-2026` is byte-identical to the old repo's build |
| 2 ✅ | Split `app.js` into modules along its own section map (storage · helpers · time · render parts · sections · wishlist · now/next · scroll spy · search · share · driver card · checklist · MapLibre map · Google map · Back · transit planner · live location · events · Sections menu · near me · theme); `build.mjs` bundles them; unit tests for the pure ones | Characterisation green; unit tests for flights, shifts, clashes, costs, the transit planner. Done 2026-09-30: `engine/src/app/NN-*.js` (joined build is byte-identical); `engine/src/core/{time,money,plan}.mjs` with 9 unit tests; the transit planner is still inline (next) |
| 3 ✅ | Pay the hard-coding debt (this also opens the push gate, `tests/release`) (below) into a trip schema + the `tw` destination pack; migrate the demo off `LEGACY_SLOTS` | Every `test.fail()` in `known-debt.spec.mjs` and `costs.spec.mjs` removed. Done 2026-09-30: trip settings in `docs/trip-format.md`; the push gate passes; parity on the real Taipei trip differs only where the two share bugs were fixed |
| 3b | Generic day roles (arrival, last day, flight-only day, free-time day from the data, any trip length) and the `tw` destination pack (tax refund, lucky draw, taxi meter, bike share) | A 4-day test trip builds and passes the trip-agnostic e2e; live parity unchanged |
| 4 | i18n: inline `Z(zh, en)` → locale files; per-trip UI languages (primary, secondary) + the destination's native layer with romanization | A second language pair renders from config alone |
| 5 | Move the pipeline (`pipeline/`, Python + uv) with Google mocked in tests; decide the Google-terms stance first (below) | Pipeline tests green offline |
| 6 | `.claude/`: skills (trip-intake, destination-pack, data-sync, build-page, verify-page, publish-htmlapp, trip-retro), agents (destination researcher, data curator, UX verifier read-only, release checker), hooks (block secrets/trips, fast tests after engine edits, load knowledge), rules; seed `knowledge/` from the brief's lessons | An agent plans the demo trip end to end from a requirements file |
| 6b | Landing page on GitHub Pages (`site/`): what it is, how to plan a trip with it, links to the docs; built and checked like any UI change | Live at kennethwkz.github.io/relaxjer |
| 7 | A second destination (`jp`, Hokkaido or Tokyo) and a second demo trip | Both demos green on the same engine |

## Hard-coding debt in the legacy engine

Step 3 (2026-09-30) paid: dates, group name, group size, currency, time zone, day routes, forecast spots, tickets,
map areas, meal slots, shopping notes, the per-person share gaps (all now trip data, `docs/trip-format.md`).
**Still in the engine** (step 3b, in progress: the `tw` destination pack and generic day roles):

- day roles `d1` arrival / `d4` charter / `d6` last full day / `d7` departure, and place ids `hotel`, `tpe1`, `tpe2`
- Taiwan-only features: tax refund (NT$2,000 chip), lucky draw amounts, Taipei MRT planner and taxi meter, YouBike
- output file names `taipei-trip*.html`; the snowboard-gear section's name; a few Taiwan examples in UI copy

The original list, for the record:

- **Trip shape**
  - Day ids `d1`–`d7` with fixed roles: `d1` arrival, `d4` charter, `d6` free day + airport, `d7` departure.
  - Day routes (`LEGS`) use the first trip's place ids.
  - Place ids `hotel`, `tpe1`, `tpe2`.
  - The forecast spots `FC_SPOT`.
- **Dates and text**
  - Header dates, the date in front of after-midnight flight times, the going-home heading, the "leave by" note.
  - The shopping-days list, the search placeholder, the footer.
- **Group and money**
  - `PAX = 5`.
  - The NT$ parser and the "/ 五人 | for 5" markers.
  - NT$ → RM conversion.
  - The tax-refund NT$2,000 threshold chip.
  - The lucky-draw calculator for 5.
- **Place**
  - The Asia/Taipei clock (`tpNow`).
  - The Taipei MRT planner and taxi fare formula.
  - YouBike live counts.
  - Store notes near the hotel.
- **Per-person share gaps** (tested as expected failures)
  - Bold group figures get no share: `fmt()` bolds before it matches.
  - Free-time idea rows print costs as plain text.

## Findings in the live Taipei page (2026-09-30)

The tier-1 tests found three bugs. They were fixed in the first trip's own repo, where the legacy engine lives, and they were **republished and verified live on
2026-09-30** (iPhone WebKit, phone and desktop Chromium: every tab lands under the bar, nothing overflows, no page errors):

1. **Day 6 "Shopping (10 shops…)" link ran ~200 px off a 390 px screen in English.**
   - Cause: it's `nowrap`.
   - Fix: it now wraps with balanced lines (`style.css`, `.block > .mlink`).
2. **The iPhone install button was 1.4 px too wide in English.**
   - Same fix (`.mlink.home-btn`).
3. **On WebKit, tab and Sections jumps landed off-target.**
   - Real data: Budget landed 900 px down, below the screen. Demo: 770 px past it.
   - Cause: WebKit reports `overflow-anchor` support, so section skipping turns on, but it doesn't hold the target while
     skipped sections draw.
   - Fix: `holdLanding()` in `app.js` re-lands a few times over ~1.2 s, and stops on touch, another jump, or Back.
     Landing is now 126 px in all 4 projects.
   - Still worth a check on a real iPhone: Playwright's WebKit is close to iOS Safari, not identical.

Not fixed:
- The airport method tiles break "Manageable" mid-word at desktop width. Cosmetic, desktop only.
- The per-person share gaps above.

## Parity with the live Taipei page

`pnpm parity --live ~/Repositories/taipei-travel --trip trips/taipei-2026` builds the live repo's own engine and data
(from a copy, no key) and diffs every section's text, in both languages, against RelaxJer's build of the same trip.
On 2026-10-01 it shows **one diff, a fix**: the live page repeats a share the text already states ("NT$160 each
(NT$800 for 5 · ≈NT$160 each)"); RelaxJer shows it once (`Money.statesShare`). The live page keeps the repeat until
Kenneth OKs a republish.

## Decisions for Kenneth before the repo goes public

- ~~Licence~~: **MIT**, decided 2026-09-30 (`LICENSE`).
- ~~Google Maps Platform terms~~: **each user brings their own keys**, decided 2026-09-30 (ADR 0003).
- ~~Name~~: **RelaxJer**, decided 2026-09-30 (`docs/naming.md`). Repo: `github.com/KennethWKZ/relaxjer`.
  - Screened clean: no marks in WIPO (incl. MyIPO data), TMview or USPTO; npm free; .com, .my and .app free.
  - No domain for now: the project page (demo trip + docs) goes on GitHub Pages. relaxjer.com was free on 2026-09-30 if one is wanted later.
  - Before launch: a formal MyIPO + SSM check. MyIPO's own site was down during the screen.
- **Hosting:** GitHub Pages serves one simple landing page: what RelaxJer is, and how a family uses the repo to plan their trip (clone, add their own keys, describe the trip to the agent, build, publish behind a password). No trip pages on Pages, not even the demo. Pages sites are public, even from a private repo, so real family trips keep a password-gated host (ht-ml.app today). The `publish` skill must refuse to push a real trip to Pages.
- **CI supply chain:** pin GitHub Actions to commit SHAs.
- **Brief:** review `docs/brief.md` (copied as is).
