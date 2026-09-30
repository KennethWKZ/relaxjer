---
created: 2026-10-01
updated: 2026-10-01
---

# Tech Stack

The tools and the posture. The decisions and their trade-offs live in the ADRs
([`decision-index.md`](./decision-index.md)).

## Posture

**Static pages, no backend, nothing always on.** A trip page is one HTML file on a static host, its state stays on
each phone (`localStorage` under the trip's storage key), and the only network it needs is for extras: map tiles,
Google, live bike counts, the brush font. Adding a server, accounts or shared state takes a superseding ADR, not an
incremental change.

## Runtime baseline

| Area         | Choice                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page         | Vanilla JS and CSS, no framework and no bundler. `engine/build.mjs` joins the sections into one IIFE, inlines the core modules, the packs, the trip data, photos and icons                                                      |
| Map          | MapLibre GL 5.24 from cdnjs (jsDelivr as fallback) on OpenFreeMap styles (liberty, dark): free, no key. Google Maps JavaScript + Places when the build gets the user's browser key (`--keys`)                                   |
| Fonts        | The phone's system sans for everything operated. The brush face comes from Google Fonts at view time, subset to the page's own glyphs (`text=`); offline, the system Kaiti faces take over                                      |
| Build, tests | Node 24, pnpm 11 (Corepack, `packageManager`), `node:test`, Playwright 1.63 (Chromium + WebKit)                                                                                                                                 |
| Pipeline     | Python ≥ 3.12 via uv (`pipeline/pyproject.toml`): `opencc` (Traditional → Simplified names), `pillow` (images). Google Places (New) + Routes with the user's server key; Open-Meteo weather; OpenStreetMap Overpass as fallback |
| Hosting      | Real trips: ht-ml.app behind a password (one file, no service worker). The project: a landing page on GitHub Pages (story step 6b), never a trip page                                                                           |

## Tooling ([ADR-20261001-project-tooling](./decisions/ADR-20261001-project-tooling.md))

- **Hooks:** husky. pre-commit runs the path guard, gitleaks on the staged diff, lint-staged and `pnpm test`.
  commit-msg runs commitlint. pre-push runs the history scan, gitleaks, `pnpm verify` and `pnpm test:release`.
- **Format and lint:** Prettier (tabs, width 150, single quotes, `proseWrap: preserve`), ESLint flat config.
- **Commits and releases:** Conventional Commits (commitlint), `pnpm release` (commit-and-tag-version).
- **Supply chain:** `minimumReleaseAge: 4320` (3 days), `allowBuilds: {}`, a checksum-verified gitleaks in CI. Pinning
  CI actions to SHAs is still open (story index).
- **Docs:** `pnpm gen:adr-index` writes the decision index from the ADR files.

## Agent tooling ([ADR-20261001-memory-bank-agent-config](./decisions/ADR-20261001-memory-bank-agent-config.md))

- `AGENTS.md` for every agent; `CLAUDE.md` imports it.
- Skills in `.agents/skills/` (Codex, Cursor, Gemini CLI), linked into `.claude/skills/` (Claude Code). Third-party
  ones come in through the skills CLI (`npx skills`) and are pinned in `skills-lock.json`.
- Claude Code plugins declared in `.claude/settings.json`: impeccable, diagram-design.
- Code intelligence: codebase-memory-mcp (`.cbmignore` keeps trips, builds, fixtures and vendored skills out), and
  graphmind for the prose in `memory-bank/`.
