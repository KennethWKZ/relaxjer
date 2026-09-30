# RelaxJer

*Malaysian for "just relax": family trips at a comfortable pace, with the planning done for you.*

RelaxJer plans a family trip with an AI agent and builds it into **one self-contained page**. The group opens it on
their phones, installs it to the home screen, and uses it offline. Each day has a timeline with fixed times that never
move, and every group cost shows a per-person share in the home currency. You get food, drinks, rest spots and toilets
near each stop, and a map with an offline transit planner. The page runs in two UI languages plus the destination's
own.

> **Status: pre-alpha, step 0.** The repo layout and the first tests exist. The engine is still being extracted from
> the first trip (Taipei, 2026); see [`docs/roadmap.md`](docs/roadmap.md).

## Quick start (contributors)

```sh
npm install        # Node 22+; also installs the pre-commit hook (needs gitleaks: brew install gitleaks)
npm test           # repo hygiene + trip contract
LEGACY_ENGINE_DIR=/path/to/legacy-trip-repo npm run test:e2e   # page characterisation, Chromium + WebKit, 390 px + desktop
```

## Layout

| Path | What |
|---|---|
| `engine/` | Page engine and single-file build (arrives in step 1) |
| `destinations/<cc>/` | Country packs: time zone, currency, languages, tax refund, entry rules; city adapters under `regions/` |
| `pipeline/` | Data sync: Google first, OpenStreetMap fallback, weather, images |
| `examples/demo-trip/` | A synthetic trip that tests and docs run on |
| `trips/` | Your real trips. Gitignored; never committed |
| `tests/` | Hygiene, trip contract, Playwright characterisation |
| `knowledge/` | Lessons learned across trips and countries |

Decisions and their trade-offs are in [`docs/adr/`](docs/adr/).

## Google keys

RelaxJer ships no keys and no Google data: each user sets up their own Google Cloud keys, and the page works without them
(OpenStreetMap map, offline transit planner). See [`docs/adr/0003-google-keys.md`](docs/adr/0003-google-keys.md).

## Hosting

GitHub Pages hosts only the project's landing page: how to use this repo to plan your trip. Pages sites are public,
so never put a real trip there. Host your trip page somewhere password-protected (for example ht-ml.app), because
it carries hotels, flights and names.

## Licence

[MIT](LICENSE)
