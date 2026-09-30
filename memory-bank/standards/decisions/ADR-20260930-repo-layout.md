---
id: ADR-20260930-repo-layout
date: 2026-09-30
title: 'Repository Layout: One Framework Repo, Destination Packs, Gitignored Trips'
domain: layout
status: accepted
---

# Repository Layout: One Framework Repo, Destination Packs, Gitignored Trips

## Summary

One public repo holds the framework: the page engine, destination packs, the data pipeline, tests, the agent tooling and
a synthetic demo trip. Real trips live in a gitignored `trips/`, and keys live outside the repo. Country settings sit in
`destinations/<cc>/`, and city settings in `destinations/<cc>/regions/<city>/`. Amended on 2026-10-01 by
[ADR-20261001-memory-bank-agent-config](ADR-20261001-memory-bank-agent-config.md): `docs/` became `memory-bank/`, and
the agent tooling landed in `.agents/` and `.claude/`.

## Context

The first trip page (Taipei, 2026) lived in a single-trip repo: one 250 KB `app.js`, trip data next to it, keys in
`.share/`. The framework has to reuse the engine for any destination, ship the AI tooling that plans a trip, and be a
public GitHub repo that never carries a real family's data or keys.

## Decision

```
relaxjer/
  engine/                 page engine: sections + build.mjs → one self-contained HTML file per trip
  destinations/<cc>/      country pack: config (time zone, currency, languages + romanization), adapters
                          (tax refund, entry rules), knowledge.md (what matters in that country)
    regions/<city>/       city-level adapters: transit network, bike share, taxi fares
  pipeline/               data sync: Google first, OSM fallback, weather, images                       (Python, uv)
  examples/demo-trip/     synthetic trip used by tests and docs (committed)
  trips/<slug>/           real trips: requirements, data, photos, builds (gitignored except trips/README.md)
  tests/
    repo/                 repo hygiene: ignore rules, secrets, hook wiring, agent config, memory-bank  (node:test)
    contract/             trip contract: rules a trip's data must follow               (node:test)
    unit/                 pure engine modules and destination packs                     (node:test)
    e2e/                  characterisation of the page on the demo trip                (Playwright)
    release/              the push gate: no real trip's details in anything published  (node:test)
    support/              harness: staged build, static server, fixtures, page probes, contract
  knowledge/              lessons that cross trips and countries (engine, UX, hosting, data hygiene)
  memory-bank/            project context, standards, decisions (ADRs), story index
  .agents/skills/         skills any agent can load (Claude Code sees them through .claude/skills/)
  .claude/                agents/, rules/, hooks/, settings.json (Claude Code only)
  AGENTS.md, CLAUDE.md    how an agent works here
  PRODUCT.md, DESIGN.md   the trip page's product context and design system (read by design tools)
  .cbmignore, .gitignore, .gitleaks.toml, .husky/, .github/workflows/
  .editorconfig, .prettierrc.yaml, eslint.config.mjs, commitlint.config.mjs, lint-staged.config.mjs, .versionrc
```

### Where this departs from the brief's proposed shape

| Brief                                                            | Decision                                                                                 | Why                                                                                                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `destinations/<cc>/` holds transit, bike share and taxi adapters | Country config stays at `<cc>/`; city adapters go under `<cc>/regions/<city>/`           | Transit, bike share and taxi fares are per city (Taipei and Kaohsiung metros differ; so do Tokyo and Sapporo). Tax refund, currency and entry rules are per country. |
| One `knowledge/` folder                                          | `knowledge/` for cross-cutting lessons; `destinations/<cc>/knowledge.md` for one country | An agent planning Hokkaido should load Japan's notes without Taiwan's. The engine and hosting lessons apply everywhere.                                              |
| Keys in each trip (`.share/`)                                    | Keys live **outside the repo**, in `~/.config/relaxjer/` (mode 600) or the OS keychain   | A stray `git add -f trips/…` or a copied trip folder can't leak what isn't in the tree.                                                                              |
| `dist/` at the root                                              | Builds go to `trips/<slug>/dist/` (real) and `.cache/` (tests)                           | The build output sits next to the trip that made it, and the same ignore rule covers it.                                                                             |

## Alternatives

1. **Monorepo with pnpm workspaces (`packages/engine`, `packages/pipeline`, …).**
   - Rejected for now: one engine, one pipeline and no published packages don't need workspace tooling.
   - Revisit if `create-relaxjer` (a `pnpm create relaxjer` scaffolder) or a separately versioned engine appears.
2. **Real trips in a separate private repo per family**, instead of a gitignored `trips/`.
   - Better history and backup, and it fits this layout: a trip folder can be its own nested git repo (the parent
     ignores it).
   - Recommended for anyone who wants trip history. Not forced, because most families won't run two repos.
3. **Rewrite the engine from scratch in a framework (React, Svelte).**
   - Rejected: the host serves one file, so there's no service worker. The quality bar lives in hard-won details of the
     legacy engine (scroll holds, section skipping, lazy lists).
   - Characterise, then split ([ADR-20260930-test-strategy](ADR-20260930-test-strategy.md)).

## Consequences

- **Security**
  - `.gitignore` covers trips, keys, env files, builds and test output.
  - `tests/repo/hygiene.test.mjs` asserts this with `git check-ignore`, and scans every committable file for key
    patterns.
  - `.husky/pre-commit` blocks trip and key paths, runs gitleaks on the staged diff and runs the fast tests. It fails
    closed when gitleaks is missing.
  - CI repeats the gitleaks scan over the full history.
- **Code intelligence**
  - `.cbmignore` keeps trips, builds, caches, data fixtures and vendored skills out of codebase-memory-mcp.
  - `memory-bank/` holds the "why" (ADRs, the story index) for graphmind and for any agent that reads files.
- **Operational**
  - Two toolchains: Node for the engine and tests, Python (uv) for the pipeline.
  - Moving the pipeline to Node is possible later. It wasn't worth it before the pipeline had tests (story step 5).
- **Cost:** none beyond CI minutes. Playwright's four-project matrix is the largest item, about 1–2 min per run.

## Read when

You're deciding where a new file goes, adding a top-level folder, or changing what's ignored.
