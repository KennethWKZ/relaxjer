# ADR 0001: Repository layout

- Status: accepted (2026-09-30)
- Context: `docs/brief.md` (written at the end of the Taipei trip build)

## Context

The first trip page (Taipei, Oct 2026) lives in a single-trip repo: one 250 KB `app.js`, trip data next to it, keys in
`.share/`. The framework must reuse the engine for any destination, ship the AI tooling that plans a trip, and be a
public GitHub repo that never carries a real family's data or keys.

## Decision

```
relaxjer/
  engine/                 page engine: modules + build.mjs → one self-contained HTML file per trip   (empty until step 1)
  destinations/<cc>/      country pack: config (time zone, currency, languages + romanization), adapters
                          (tax refund, entry rules), knowledge.md (what matters in that country)
    regions/<city>/       city-level adapters: transit network, bike share, taxi fares
  pipeline/               data sync: Google first, OSM fallback, weather, images                       (Python, uv)
  examples/demo-trip/     synthetic trip used by tests and docs (committed)
  trips/<slug>/           real trips: requirements, data, photos, builds (gitignored except trips/README.md)
  tests/
    repo/                 repo hygiene: ignore rules, secrets, hook wiring            (node:test)
    contract/             trip contract: rules a trip's data must follow               (node:test)
    e2e/                  characterisation of the page on the demo trip                (Playwright)
    support/              harness: staged build, static server, fixtures, page probes, contract
  knowledge/              lessons that cross trips and countries (engine, UX, hosting, data hygiene)
  .claude/                skills/, agents/, rules/, settings.json hooks                               (step 6)
  docs/                   brief, ADRs, roadmap
  AGENTS.md, CLAUDE.md    how an agent works here
  .cbmignore, .gitignore, .gitleaks.toml, .githooks/, .github/workflows/
```

### Where this departs from the brief's proposed shape

| Brief | Decision | Why |
|---|---|---|
| `destinations/<cc>/` holds transit, bike share and taxi adapters | Country config stays at `<cc>/`; city adapters go under `<cc>/regions/<city>/` | Transit, bike share and taxi fares are per city (Taipei and Kaohsiung metros differ; so do Tokyo and Sapporo). Tax refund, currency and entry rules are per country. |
| One `knowledge/` folder | `knowledge/` for cross-cutting lessons; `destinations/<cc>/knowledge.md` for one country | An agent planning Hokkaido should load Japan's notes without Taiwan's. The engine and hosting lessons apply everywhere. |
| Keys in each trip (`.share/`) | Keys live **outside the repo**, in `~/.config/relaxjer/` (mode 600) or the OS keychain | A stray `git add -f trips/…` or a copied trip folder can't leak what isn't in the tree. |
| `dist/` at the root | Builds go to `trips/<slug>/dist/` (real) and `.cache/` (tests) | The build output sits next to the trip that made it, and it's covered by the same ignore rule. |

## Alternatives considered

1. **Monorepo with npm workspaces (`packages/engine`, `packages/pipeline`, …)**
   - Rejected for now: one engine, one pipeline and no published packages don't need workspace tooling.
   - Revisit if `create-relaxjer` (npx scaffolder) or a separately versioned engine appears.
2. **Real trips in a separate private repo per family** instead of a gitignored `trips/`.
   - Better history and backup, and it is compatible with this layout: a trip folder can be its own nested git repo
     (the parent ignores it).
   - Recommended for anyone who wants trip history. Not forced, because most families won't run two repos.
3. **Rewrite the engine from scratch in a framework (React/Svelte)**
   - Rejected: the host serves one file, so no service worker. The quality bar lives in hard-won details of the legacy
     engine (scroll holds, section skipping, lazy lists).
   - Characterise, then split (ADR 0002).

## Consequences

- **Security**
  - `.gitignore` covers trips, keys, env files, builds and test output.
  - `tests/repo/hygiene.test.mjs` asserts this with `git check-ignore`, and scans every committable file for key
    patterns.
  - `.githooks/pre-commit` blocks trip and key paths, runs gitleaks on the staged diff and runs the fast tests; it fails
    closed when gitleaks is missing.
  - CI repeats the gitleaks scan over the full history.
- **Code intelligence**
  - `.cbmignore` keeps trips, builds, caches and data fixtures out of codebase-memory-mcp.
  - graphmind reads `docs/` (ADRs, roadmap) for the "why".
- **Operational**
  - Two toolchains: Node for the engine and tests, Python (uv) for the pipeline.
  - Moving the pipeline to Node is possible later. It isn't worth it before the pipeline has tests (roadmap step 5).
- **Cost:** none beyond CI minutes. Playwright's 4-project matrix is the largest item, about 1–2 min per run today.
