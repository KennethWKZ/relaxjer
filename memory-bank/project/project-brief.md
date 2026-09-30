---
created: 2026-09-30
updated: 2026-10-01
---

# Project Brief

## Project Name

**RelaxJer** (Manglish for "just relax": family trips at a comfortable pace, with the planning done for you).
`github.com/KennethWKZ/relaxjer`, MIT. The name's research is in
[ADR-20260930-name-relaxjer](../standards/decisions/ADR-20260930-name-relaxjer.md).

## Where This Stands

Pre-alpha, not yet public. It was extracted from the first trip's single-trip repo (Taipei, 2026), and that trip's live
page is built from here now. The step-by-step status is in [`../story-index.md`](../story-index.md).

## Business Goals

- **Reuse for any destination.** The next trips might be Hokkaido, Tokyo or Korea. The engine, pipeline and conventions
  carry over; each trip brings only its own requirements and data.
- **Two UI languages plus a native layer.** The group reads the page in two languages (for the first group: Simplified
  Chinese and English). Each destination adds its local language for place names, food, menus, signs and "show this to
  the driver" text (Japan: Japanese + romaji; Korea: Hangul + romanization). Taiwan needed no separate layer because the
  group reads Chinese; the page carried Traditional names for Google searches and signs only.
- **An AI enabler, not just code.** The repo ships the skills, rules, agents and hooks an AI agent needs to plan the
  next trip from the traveller's requirements, at the first trip page's quality or better. Lessons from each trip and
  country are consolidated so the agent keeps improving.
- **Test-driven.** Tests define the quality bar, and the agent runs them before calling anything done.
- **Public.** Communities can plan their own family trips and host them behind a password. Trip data and generated pages
  are never committed.
- **Code intelligence.** It works with codebase-memory-mcp and graphmind, and `.cbmignore` keeps trip data and builds
  out of the graph.

## Scope

### In scope

- The page engine and its single-file build (`engine/`).
- Destination packs: country and city settings and adapters (`destinations/`).
- The data pipeline: Google first, OpenStreetMap fallback, weather, links, images (`pipeline/`).
- A synthetic demo trip and the test suite that characterises the page on it.
- Agent tooling for any AI agent (`AGENTS.md`, `.agents/skills/`), with Claude Code extras in `.claude/`.
- A landing page on GitHub Pages (story step 6b).

### Out of scope / deferred

- A backend, accounts or shared state: the page is static, and state stays on each phone.
- Hosting real trip pages on GitHub Pages, or anywhere public.
- Shipping Google keys or Google-derived content ([ADR-20260930-google-keys](../standards/decisions/ADR-20260930-google-keys.md)).
- A framework rewrite of the engine (React, Svelte): the host serves one file, and the quality bar lives in the legacy
  engine's details ([ADR-20260930-repo-layout](../standards/decisions/ADR-20260930-repo-layout.md)).
- Publishing the engine as a package, or a `pnpm create relaxjer` scaffolder: revisit if it's ever wanted.

## Target Users

- A **planner**: the one person in a family or group who plans the trip, working with an AI agent in a clone of this
  repo.
- The **travelling group**: everyone who opens the page on a phone during the trip, often including seniors (see
  `PRODUCT.md`).
- **Contributors**: people adding a destination pack, a lesson or an engine fix by pull request.

Personas and journeys are in [`product-context.md`](./product-context.md).

## Success Criteria

- An agent plans the demo trip end to end from a requirements file (story step 6).
- A second destination and a second demo trip pass the same suite on the same engine (story step 7).
- Every page passes the quality bar in [`product-context.md`](./product-context.md): tier 0 and tier 1 green, the
  trip-agnostic suite green on the real trip, a real-browser pass at 390 px and desktop.
- No real trip's details, key or build ever reaches the public repo: the release gate and history scan pass on every
  push.

## Key Constraints

- **Secrets and personal data in a public repo.** Only framework files are committed. gitleaks runs on every commit
  and push and in CI; the path guard blocks `trips/`, keys and builds; the release gate blocks a real trip's details.
- **Google Maps Platform terms** limit caching Places content. Each user brings their own keys, and committed examples
  carry no Google content ([ADR-20260930-google-keys](../standards/decisions/ADR-20260930-google-keys.md)).
- **Photo licences.** Photos are per trip, with credits, and never ship in the repo.
- **Self-learning safety.** The agent proposes lessons as a reviewed change (the `trip-retro` skill). It never rewrites
  its own rules silently, and tests gate every change to `knowledge/`, `.agents/` and `.claude/`.
- **One file, no service worker.** The host serves a single file, so the manifest and icons are `data:` URLs and the
  page updates itself by comparing build ids (`knowledge/hosting.md`).
- **Test data.** CI runs on the synthetic demo trip with no keys (Google mocked), never on a real family's trip.

## Origin

The first trip page was one repo: a 250 KB `app.js` with every feature, the trip's data and photos next to it, a Python
data pipeline hard-coded to Taipei, and keys in `.share/`. It moved here in steps: characterisation tests first, then
the engine verbatim, then the split into sections, then the hard-coding debt into trip and pack data, then the pipeline
(story steps 0–5). The Taiwan-only parts became the `tw` pack: the Asia/Taipei clock, the Taipei MRT planner and taxi
fare formula, YouBike live counts, the TRS tax-refund rules, the NT$ → RM conversion, and store-specific notes.

## References

- [`../story-index.md`](../story-index.md): steps, status, debt, open decisions.
- [`../standards/decision-index.md`](../standards/decision-index.md): every decision and its trade-offs.
- [`../../knowledge/`](../../knowledge/): the lessons from the first trip.
- `PRODUCT.md` and `DESIGN.md` at the repo root: the trip page's product context and design system.
