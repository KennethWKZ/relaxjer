# AGENTS.md

RelaxJer turns a family's trip requirements into one offline-friendly, installable trip page. This file is for every
AI agent (Claude Code, Codex, Cursor, Gemini CLI, Copilot…) and every person working in the repo. It maps the context
in `memory-bank/` and states the rules that bind.

**Status:** v1.0.0. Story steps 0–3b, 5, 6, 6c and 6d are done (engine moved, split and generalised; the `tw` pack;
the pipeline; the agent tooling, with skills from a fresh clone to a published page; the affordance fixes; group sync),
and the landing page (6b) deploys from `site/`. Group sync, on the planner's own Firebase database, and the page's
security policy are live on the first trip; a day can split for part of the group, a stop can suggest optional plans,
and the add sheet checks a stop's time against getting there. Every feature is written down for planners in
[`guides/trip-page.md`](guides/trip-page.md), and a tier-0 test keeps the docs in step with the code. Next: i18n (step
4), a second destination (7). See [`memory-bank/story-index.md`](memory-bank/story-index.md).

## Read first

- [`memory-bank/project/project-brief.md`](memory-bank/project/project-brief.md): the goal, scope and constraints.
- [`memory-bank/standards/coding-standards.md`](memory-bank/standards/coding-standards.md): the rules that bind and
  what enforces each one.
- [`memory-bank/standards/decision-index.md`](memory-bank/standards/decision-index.md): every decision, then the ADR
  file a task cites.

## Navigation

| Need                                                    | Read                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Words to use in code and docs                           | [`memory-bank/project/glossary.md`](memory-bank/project/glossary.md)                           |
| Who the framework is for, the journeys, the quality bar | [`memory-bank/project/product-context.md`](memory-bank/project/product-context.md)             |
| Who the trip page is for; its design system             | [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md)                                           |
| How a trip becomes a page                               | [`memory-bank/standards/system-architecture.md`](memory-bank/standards/system-architecture.md) |
| Tools and posture                                       | [`memory-bank/standards/tech-stack.md`](memory-bank/standards/tech-stack.md)                   |
| Every field a trip's data can hold                      | [`memory-bank/standards/trip-format.md`](memory-bank/standards/trip-format.md)                 |
| Steps, status, engine debt, open decisions              | [`memory-bank/story-index.md`](memory-bank/story-index.md)                                     |
| Lessons from past trips                                 | [`knowledge/`](knowledge/README.md), and `destinations/<cc>/knowledge.md`                      |

### Task shortcuts

| If your task is…                        | Start here                                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Set up a fresh clone for a planner      | skill `planner-setup`                                                                                             |
| Plan a new trip                         | skill `trip-intake`, then `data-sync` → `build-page` → `verify-page` → `publish-htmlapp`                          |
| Change a trip the planner already has   | skill `trip-customize` (travel questions: the `relaxbro` role), then `build-page` → `verify-page`                 |
| Answer "what can the page do?"          | [`guides/trip-page.md`](guides/trip-page.md): every feature and what turns it on                                  |
| Refresh a live trip's data              | skill `data-sync`, then `verify-page` and `publish-htmlapp`                                                       |
| Share the group's changes across phones | skill `sync-setup`, then `build-page` → `verify-page` → `publish-htmlapp`                                         |
| Change who may edit what in group sync  | [ADR-20261002-sync-planners](memory-bank/standards/decisions/ADR-20261002-sync-planners.md), `patterns/engine.md` |
| A new country or city                   | skill `destination-pack`                                                                                          |
| Change the engine, a section or a pack  | [`memory-bank/standards/patterns/engine.md`](memory-bank/standards/patterns/engine.md)                            |
| Change the landing page (`site/`)       | [`memory-bank/standards/patterns/frontend.md`](memory-bank/standards/patterns/frontend.md) § The landing page     |
| Change anything the page shows          | [`memory-bank/standards/patterns/frontend.md`](memory-bank/standards/patterns/frontend.md), `DESIGN.md`           |
| Write or change a test                  | [`memory-bank/standards/patterns/testing.md`](memory-bank/standards/patterns/testing.md)                          |
| Write trip data                         | [`memory-bank/standards/patterns/trip-data.md`](memory-bank/standards/patterns/trip-data.md)                      |
| Touch the pipeline                      | [`memory-bank/standards/patterns/pipeline.md`](memory-bank/standards/patterns/pipeline.md)                        |
| After a trip                            | skill `trip-retro`                                                                                                |
| A decision worth recording              | an ADR in `memory-bank/standards/decisions/`, then `pnpm gen:adr-index`                                           |

## Skills

Every skill is `.agents/skills/<name>/SKILL.md` (Claude Code sees the same folders through `.claude/skills/`). Load
the one that fits before you start. Any agent can read the file directly.

| Skill                                                                | For                                                      |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `planner-setup`                                                      | a fresh clone → tools, install, the demo opened, keys    |
| `trip-intake`                                                        | requirements → a trip folder that passes the contract    |
| `trip-customize`                                                     | the planner's changes → the trip's data, and where shown |
| `data-sync`                                                          | refresh places, hours, weather and links (`pnpm resync`) |
| `build-page`                                                         | the single-file page                                     |
| `verify-page`                                                        | tests, a real-browser pass, the group's journeys         |
| `publish-htmlapp`                                                    | publish behind a password and prove the live copy        |
| `sync-setup`                                                         | group sync on the planner's own Firebase (`pnpm sync`)   |
| `destination-pack`                                                   | a new country or city                                    |
| `trip-retro`                                                         | lessons as a reviewed change                             |
| `animate`, `review-animations`, `improve-animations`, `apple-design` | motion and interaction (vendored, MIT)                   |

Design skills that aren't vendored (impeccable, diagram-design, and dataviz inside Claude Code), and how to install
them for your agent: [`.agents/README.md`](.agents/README.md).

## Roles

When a task calls for review or expert advice, keep that role separate from the author, and keep it read-only: it
reports, and the author edits. Claude Code has these as agents in `.claude/agents/`; other agents can take the same
brief from those files.

| Role                     | Does                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `relaxbro`               | the group's travel agent: itinerary, pace, bookings, rain plans, sourced; never edits      |
| `destination-researcher` | sourced, dated facts for a new pack; never edits                                           |
| `data-curator`           | reviews a trip's data against the contract, data hygiene and wording rules; never edits    |
| `ux-verifier`            | builds, runs the e2e tiers, checks real browsers at 390 px and desktop; never edits source |
| `release-checker`        | go / no-go before a push, release or publish; never pushes                                 |

## Commands

```sh
corepack enable && pnpm install  # once; also wires .husky (pre-commit: trip/key guard, gitleaks, lint-staged, fast tests)
pnpm test                        # tier 0: hygiene, agent config, memory-bank, trip contract, units (node:test, ~1 s)
pnpm setup:e2e                   # once: Chromium + WebKit for tier 1 and for proving a publish
pnpm test:e2e                    # tier 1: Chromium + WebKit × 390 px + desktop, ~2–3 min (3 workers locally)
pnpm test:e2e:short              # the trip-agnostic e2e on a generated 4-day trip (it moves hotel on night 2)
pnpm test:all                    # tier 0 + tier 1 + the 4-day short trip: before calling engine or data work done
pnpm verify                      # lint + format check + tier 0 + pipeline tests (CI adds gitleaks and e2e; pre-push the history scan and release gate)
pnpm lint / pnpm format          # ESLint --fix / Prettier --write
pnpm gen:adr-index               # regenerate memory-bank/standards/decision-index.md after an ADR change
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json   # a real trip; omit --keys for the demo
pnpm resync --trip trips/<slug> [--write]   # refresh a trip's data from its cache; paying for more is the planner's call (data-sync)
pnpm test:pipeline               # the pipeline's offline tests (needs uv)
pnpm test:release                # the push gate: no real trip's details in anything published
pnpm sync init --trip trips/<slug> --db <url>   # group sync for a trip (rules|init|planner|end|status), see the sync-setup skill
pnpm test:sync-rules             # the group-sync database rules on Firebase's emulator (local, needs Java)
pnpm publish:trip trips/<slug>   # republish to the same link and prove it (--dry-run, --check, --audit): the planner approves each run (publish-htmlapp)
pnpm parity --ref <commit> --trip trips/<slug>      # renders the same as an earlier commit? (--live <repo>: maintainer only)
pnpm release                     # bump version + CHANGELOG from the commits; push with --follow-tags: release.yml makes the release
TRIP_DIR=<trip folder> pnpm test                                        # contract on a real trip (local only)
TRIP_DIR=<trip folder> pnpm exec playwright test --grep-invert @demo    # trip-agnostic e2e on it
LEGACY_ENGINE_DIR=/path/to/legacy-trip-repo pnpm test:e2e              # maintainer only: compare against the first trip's old engine
node tests/support/probe.mjs     # debug: page errors of the last staged page, with engine line numbers
```

## Rules

- **Never commit a real trip, key or build.**
  - `trips/*` (except its README), `.share/`, `*.key`, `.env*` and `dist/` are ignored, and the hook blocks them.
  - Don't `git add -f` around it, don't skip hooks with `--no-verify`, and don't `git add -A` in the first trip's legacy repo
    (maintainer only), which holds live keys.
- **Nothing published carries a real trip's details** (name, hotel, flight numbers, dates). Not in the engine, docs,
  tests or commit messages: the release gate and the pre-push history scan block them.
- **Keys live outside the repo, and each user brings their own**
  ([ADR-20260930-google-keys](memory-bank/standards/decisions/ADR-20260930-google-keys.md)). Never paste one into a
  file, a test or the chat.
- **Demo data stays synthetic.** No real people, bookings or phone numbers, and nothing copied from Google (a contract
  test enforces it).
- **Tests define done.**
  - Run `pnpm test:all` before calling engine or data work finished. Engine changes also keep `pnpm parity` at the
    known diffs.
  - A UI change also gets checked by eye at 390 px and desktop, in Chromium and WebKit (`verify-page`).
  - Report what actually ran. An unverified "done" is worse than an honest "not verified".
- **Commits follow Conventional Commits** (`feat(engine): …`, `fix(tw): …`), as in
  [`memory-bank/standards/commit-message-format.md`](memory-bank/standards/commit-message-format.md). commitlint
  checks them, and the changelog is built from them.
- **Known engine debt is a `test.fail()` with a reason.** When a change makes one pass, delete its marker in the same
  change.
- **Tag demo-specific tests `@demo`.** Everything else must pass on any trip.
- **Lessons are proposed, not self-applied.** New rules for `knowledge/`, `.agents/`, `.claude/` or this file go in as
  a reviewed change, and tests gate them.
- **Publishing reaches an audience.** Confirm with the planner before publishing or republishing a trip page, and never
  put a real trip on GitHub Pages.
- **Never describe people on a page by family relationship.**
- **Seniors:** count walking time ×1.4, and suggest a taxi first for long legs.
- **Content lives in one place.** Link to the file that owns a rule; don't copy it.

## Finishing a task

1. `pnpm verify` (and `pnpm test:all` for engine or data work; `verify-page` for anything the page shows).
2. A decision that isn't obvious from the code (a new data field, a dependency, a hosting or security call) gets an ADR
   in `memory-bank/standards/decisions/` in the same commit, then `pnpm gen:adr-index`.
3. Update the story index when a step's status changes.
4. Commit in the house format. Push only when the maintainer says so; pre-push runs the release gate.
