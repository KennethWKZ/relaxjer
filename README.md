# RelaxJer

_Malaysian for "just relax": family trips at a comfortable pace, with the planning done for you._

RelaxJer plans a family trip with an AI agent and builds it into **one self-contained page**. The group opens it on
their phones, installs it to the home screen, and uses it offline. Each day has a timeline with fixed times that never
move, and every group cost shows a per-person share in the home currency. You get food, drinks, rest spots and toilets
near each stop, and a map with an offline transit planner. The page runs in two UI languages plus the destination's
own.

> **Status: pre-alpha.** The engine has moved in from the first trip (Taipei, 2026) and is being split and generalised;
> see [`memory-bank/story-index.md`](memory-bank/story-index.md).

## Quick start (contributors)

```sh
corepack enable    # once: gives you the pnpm version pinned in package.json (Node 24)
pnpm install       # also wires the git hooks (husky; needs gitleaks: brew install gitleaks)
pnpm test          # repo hygiene + trip contract + unit tests
pnpm test:e2e      # page characterisation, Chromium + WebKit, 390 px + desktop
pnpm build --trip examples/demo-trip   # build the demo trip page
```

## Layout

| Path                  | What                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `engine/`             | Page engine and single-file build                                                                      |
| `destinations/<cc>/`  | Country packs: time zone, currency, languages, tax refund, entry rules; city adapters under `regions/` |
| `pipeline/`           | Data sync: Google first, OpenStreetMap fallback, weather, images                                       |
| `examples/demo-trip/` | A synthetic trip that tests and docs run on                                                            |
| `trips/`              | Your real trips. Gitignored; never committed                                                           |
| `tests/`              | Hygiene, trip contract, Playwright characterisation                                                    |
| `knowledge/`          | Lessons learned across trips and countries                                                             |

Decisions and their trade-offs are in [`memory-bank/standards/decision-index.md`](memory-bank/standards/decision-index.md). Agents start at [`AGENTS.md`](AGENTS.md).

## Google keys

RelaxJer ships no keys and no Google data: each user sets up their own Google Cloud keys, and the page works without them
(OpenStreetMap map, offline transit planner). See [ADR-20260930-google-keys](memory-bank/standards/decisions/ADR-20260930-google-keys.md).

## Hosting

GitHub Pages hosts only the project's landing page: how to use this repo to plan your trip. Pages sites are public,
so never put a real trip there. Host your trip page somewhere password-protected (for example ht-ml.app), because
it carries hotels, flights and names.

## Licence

[MIT](LICENSE)
