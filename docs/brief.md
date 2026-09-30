# Travel planner framework: brief for the next session

Working brief written at the end of the Taiwan trip build (2026-09-30). No keys, passwords, site IDs or personal trip details
are in this file. Review it before the repo goes public.

## Goal

- **Reuse for any destination.** The next trips might be Hokkaido, Tokyo or Korea. The engine, pipeline and conventions carry
  over; each trip only brings its own requirements and data.
- **Two UI languages plus a native layer.** The group reads the page in two languages (for us: Simplified Chinese + English).
  Each destination adds the local language for place names, food, menus, signs and "show this to the driver" text
  (Japan: Japanese + romaji; Korea: Hangul + romanization). Taiwan needed no separate layer because the group reads Chinese;
  the page only carried Traditional names for Google searches and signs.
- **An AI enabler, not just code.** The repo ships the skills, rules, agents and hooks an AI agent needs to plan the next trip
  from the traveller's requirements, at the quality level of the Taiwan page or better. Lessons from each trip and country
  are consolidated so the agent keeps improving.
- **Test-driven.** Tests define the quality bar. The agent runs them before calling anything done.
- **Public GitHub repo.** Communities can plan their own family trips and host them on ht-ml.app. Trip data and generated
  pages are never committed (gitignored).
- **Code intelligence.** Works with graphmind and codebase-memory-mcp, with a `.cbmignore` that keeps trip data and builds out.

## Current state: this repo is the Taiwan trip itself, not yet split

| Path | Role | Reusable? |
|---|---|---|
| `build.mjs` | Bundles everything into one HTML file (fonts subset, photos and icons inlined, late-loaded images) | Mostly |
| `src/app.js` (~250 KB, one file) | Rendering engine and every feature | Mixed; see below |
| `src/style.css`, `src/shell.html` | Design system, icons, page shell | Yes |
| `src/data.js` | The trip: days, schedule, fixed times, flights, budget, checklist, airport | Trip data |
| `src/*.json` | Google/OSM-derived places, food, drinks, toilets, transit, shops, weather | Trip data |
| `scripts/*.py` | Data pipeline: Google Places/Routes (Mac-side key), OSM Overpass fallback, opencc, weather, image slimming; `resync.py` runs the steps | Mostly, but hard-coded to Taipei |
| `img/` | Photos with credit JSON, icons | Trip data (licences are per photo) |
| `.share/` | Keys, caches, publish logs, legacy tests | Never commit |
| `PRODUCT.md`, `.impeccable/` | Design context | Template it |
| `dist/`, `*-standalone.html` | Built pages | Never commit |

**Taiwan-only parts inside `src/app.js`:**
- the Asia/Taipei clock (`tpNow`)
- the Taipei MRT offline planner and the Taipei taxi fare formula
- live counts from the YouBike API
- the TRS tax-refund rules
- the NT$ → RM conversion
- store-specific notes, e.g. a supermarket chain trading under a new local name

UI strings are written inline as `Z(zh, en)`.

## Features the framework must keep (the quality bar)

- **Costs:** per-person costs next to group totals, both converted to the home currency (the rate is editable).
- **Timeline:**
  - each day's timeline with fixed times that never move
  - times tied to the flights, and a flight-delay editor
  - a running-late re-plan that uses location and time, suggests only and never moves anything by itself, with fixed items anchoring the day
  - your own added stops: a per-day button, a "+" under each timeline dot, clash and deadline checks, a share link
- **Near each stop, and "near me":** food, drinks, rest spots and toilets (plus places that let you borrow a toilet).
- **Map:**
  - Google first, MapLibre as fallback
  - categories, search, a list and sorting
  - a live location dot
  - an offline transit planner that needs no routing API
  - live bike-share counts
- **Destination info:** a checklist, weather, tax refund with minimum spend, airport transfer options decided on the day, a shopping box, a free-day time budget worked back from the flight.
- **Page behaviour:**
  - an offline notice
  - a home-screen install button, with the iPhone steps as a guide
  - site search, the Sections menu, a Back pill, instant tab jumps with a landing glow
  - a language switch that keeps your place
- **Speed and build:**
  - closed lists built only when opened, late-loaded images, section skipping only where the browser has scroll anchoring
  - a single-file build for ht-ml.app behind a password

## Lessons learned (turn these into rules and tests)

- **`content-visibility: auto`:**
  - It needs scroll anchoring. Without it (Safari) the page jumps thousands of px while scrolling up, so gate it on `CSS.supports('overflow-anchor', 'auto')`.
  - Its paint containment clips children that bleed out with negative margins.
  - `innerText` of skipped content is `''`.
- **Smooth scrolls** across undrawn sections stop short. Snap to the target at `scrollend`; tab and menu jumps are instant.
- **Full redraws must keep the reader's place:**
  - anchor on an element near the top of the screen
  - remember open `<details>` by their nearest id, so build-on-open lists reopen too
  - carry the old section heights over
  - hold the spot for 2 s, and let go on touch, scroll or a deliberate programmatic scroll
- **Google AdvancedMarker** content must be a `div`, not a `button`, or clicks recurse.
- **The place sheet strips ids** from its copy, so use `data-` attributes inside sheets.
- **Data hygiene:**
  - Google first, OSM as fallback.
  - Check place types (a car park is not an airport terminal).
  - Filter fake "public toilets" such as offices and gyms.
  - Drop partial OSM transit lines.
- **ht-ml.app:**
  - It serves one file only, so there is no service worker and the manifest and icons go in as `data:` URLs.
  - The password cookie lasts 24 h.
  - The CDN can serve the old copy for minutes, and `?v=` does not bust it. Verify each publish with curl plus a marker string that only the new build contains; run the share command again if the page is stale.
- **Keys:**
  - The browser key is restricted to the site plus localhost, for Maps JS and Places only.
  - Server-side keys never go into a page.
- **Group:**
  - Never describe people by family relationship on the page.
  - Seniors: walking time ×1.4, suggest a taxi first for long legs.
- **Verification:** every UI change is checked at 390 px and desktop and in real Chrome; iPhone behaviour is checked in WebKit.

## Risks to settle before building

1. **Secrets and personal data in a public repo.** Start a fresh git repo containing only framework files. Add a secret scanner
   (e.g. gitleaks) as a pre-commit hook and in CI. Never `git add -A` this folder as it stands: `.share/` holds live keys.
2. **Google Maps Platform terms.**
   - The terms limit caching Places content (names, ratings, hours, photos) in stored pages: place IDs may be kept, coordinates only for a limited time, most other fields not at all.
   - That is a judgement call for a private family page. A public framework that tells others to do it is a different matter.
   - Decide:
     - document the terms
     - "refresh before the trip" workflows
     - each user brings their own keys
     - an open-data baseline (OSM, Wikidata) for anything redistributable
3. **Photo licences.** Photos are per trip with credits; never ship them in the repo.
4. **Self-learning safety.** The agent proposes lessons, for example as a PR to `knowledge/`, reviewed by a person. It should
   not silently rewrite its own rules, and tests gate every change.
5. **The `app.js` monolith.**
   - Write characterisation tests first, on a synthetic demo trip.
   - Then split into modules that `build.mjs` bundles.
   - Then pull destination specifics into packs.
6. **i18n model.**
   - Move the inline `Z(zh, en)` strings to locale files.
   - Per trip, configure the UI languages (primary and secondary) and the destination's native language with its romanization.
7. **Test data.** CI runs on a synthetic demo trip with no keys (Google mocked), never on a real family trip.

## Proposed shape (decide in the new session)

```
engine/                 page engine (modules) + build
destinations/<cc>/      country packs: config (time zone, currency, languages), adapters (transit, bike share,
                        taxi fares, tax refund), knowledge.md (what matters there)
pipeline/               data sync (Google-first, OSM fallback), images, weather
examples/demo-trip/     synthetic trip used by tests and docs (committed)
trips/                  real trips: requirements, data, photos, builds (gitignored)
tests/                  unit + Playwright e2e (390 px + desktop, Chromium + WebKit)
knowledge/              lessons across trips and countries (updated via reviewed PRs)
.claude/                skills/, agents/, rules/, settings.json hooks
AGENTS.md, CLAUDE.md    how an agent works in this repo
.cbmignore              keeps trips/, dist/, caches out of the code graph
```

First-cut Claude Code pieces:
- **Skills:**
  - `trip-intake`: requirements → trip file
  - `destination-pack`: research a new country
  - `data-sync`
  - `build-page`
  - `verify-page`: tests + real browser
  - `publish-htmlapp`: with the verify step
  - `trip-retro`: lessons → knowledge PR
- **Agents:** destination researcher, data curator, UX verifier (read-only), release checker.
- **Hooks:**
  - block writes of secrets and commits of `trips/`
  - run fast tests after engine edits
  - load `knowledge/` at session start
- **Rules:** Google-first data, group wording, per-person costs in the home currency, frontend verification, publish verification.

## Where things are now

- **Legacy tests:** `.share/legacy-tests/` holds 40 Playwright (Python) suites plus `regress.sh`, rescued from `/tmp`.
  - They expect `dist/` served on `localhost:8123` and the Taiwan data.
  - Pages behind the password read it from `TRIP_PAGE_PASSWORD`.
  - They are the starting point for the framework's characterisation tests.
- **Keys and publishing:** described in the harness memory for this repo (never copy them into the repo).
