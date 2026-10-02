# RelaxJer

_Malaysian for "just relax": family trips at a comfortable pace, with the planning done for you._

RelaxJer plans a family trip with an AI agent and builds it into **one self-contained page**. The group opens it on
their phones, installs it to the home screen, and uses it offline.

- **What's next, at a glance:** Now and Next on a trip day, a countdown and the to-dos before it, every day's timeline
  with fixed times that never move, a push-back for running late that stops at the next fixed time (with location on,
  the page notices when you fall behind and offers it), and days that split for part of the group, with each plan's
  rule and where they meet again.
- **Getting there:** directions per leg, an offline metro planner, taxi fares per car, live bike-share counts, and a
  "show the driver" card with the local name and address.
- **Near every stop:** food, drinks, rest spots and toilets with hours and the walk, plus the group's wishlist and
  optional plans that never crowd the schedule.
- **Money:** every group cost with each person's share, and totals and shares in the home currency too, at a rate you
  can change.
- **Before and around the trip:** a checklist, the entry rules, the weather and what to wear, the airport options
  priced for the group, and the evening home worked back from take-off.
- **Your own changes:** add a stop (it checks the time against getting there, walking at a senior's pace ×1.4, and
  the fixed times), push the day back, type a flight delay. With group sync, on the planner's own Firebase, they reach
  every phone, with planners, Undo and Put back.
- **Built for the group:** two UI languages plus the destination's own, light and dark, large text and targets, a
  strict security policy, and a password in front.

Every part, and what turns it on: [`guides/trip-page.md`](guides/trip-page.md).

> **Status: 1.0.** Built on the first trip (Taipei, 2026) and generalised since: one destination pack (Taiwan) so far,
> and two UI languages (Chinese and English). What's next is in [`memory-bank/story-index.md`](memory-bank/story-index.md).

## How a trip becomes a page

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="site/assets/flow-dark.svg">
  <img alt="Your requirements go through the trip-intake, data-sync, build-page, verify-page and publish-htmlapp skills to one password-protected page on the group's phones; a trip retro turns lessons into knowledge for the next trip." src="site/assets/flow-light.svg" width="928">
</picture>

Each box is a skill any AI agent can run: Claude Code, Codex, Cursor or Gemini CLI. They live in
[`.agents/skills/`](.agents/README.md), and [`AGENTS.md`](AGENTS.md) is where an agent starts. Tell your agent about
the trip in your own words, and it takes it from there, stopping to ask before anything is published or paid for.

| Skill              | Say to your agent                       | It                                                                |
| ------------------ | --------------------------------------- | ----------------------------------------------------------------- |
| `planner-setup`    | "Set up RelaxJer on my computer"        | checks the tools, installs, builds and opens the demo             |
| `trip-intake`      | "Plan a trip to …"                      | turns your words into a trip folder that passes the checks        |
| `trip-customize`   | "Add …", "move …", "make day 4 lighter" | changes the plan, and says where each change shows on the page    |
| `data-sync`        | "Refresh the data"                      | fills in places, hours, food and toilets nearby, transit, weather |
| `build-page`       | "Build the page"                        | makes the one file                                                |
| `verify-page`      | "Check the page"                        | runs the tests, then looks at it at phone size in two browsers    |
| `sync-setup`       | "Share our changes across phones"       | sets up group sync on your own Firebase                           |
| `publish-htmlapp`  | "Publish it"                            | publishes behind a password, after your yes                       |
| `destination-pack` | "We're going to Japan"                  | adds a country or city RelaxJer doesn't know yet                  |
| `trip-retro`       | "The trip is over"                      | turns lessons into a reviewed change                              |

In Claude Code, `relaxbro`, a read-only travel agent, answers travel questions while your agent works ("is day 3 too
packed?", "what needs booking?"), and reviewer agents check the data, the page and each release. The planner's
walkthrough: [`guides/getting-started.md`](guides/getting-started.md).

## Plan a trip

```sh
git clone https://github.com/KennethWKZ/relaxjer && cd relaxjer
corepack enable && pnpm install     # Node 24; also wires the git hooks
```

What you need on your computer:

| Tool                | For                                                    | Install                                                                                                                    |
| ------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Node 24**         | everything (`corepack` then brings the right pnpm)     | [nodejs.org](https://nodejs.org/), or `nvm install 24`                                                                     |
| **gitleaks**        | committing: the git hooks refuse a commit without it   | macOS `brew install gitleaks`; Linux and Windows: a release from [gitleaks](https://github.com/gitleaks/gitleaks/releases) |
| **uv**              | the data refresh (`pnpm resync`) and `pnpm verify`     | [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/) (it fetches Python itself)                    |
| Playwright browsers | the page tests, and proving a publish on two phones    | `pnpm setup:e2e` (on Linux: `pnpm exec playwright install --with-deps chromium webkit`)                                    |
| cwebp (optional)    | lighter trip photos, the landing page's screenshots    | macOS `brew install webp`                                                                                                  |
| Java 11+ (optional) | checking the group-sync rules (`pnpm test:sync-rules`) | any JDK; 21+ runs the current Firebase emulator                                                                            |

Everything else, including the publishing tool (`lavish-axi`), comes with `pnpm install`. Building the demo and
`pnpm test` need only Node. On a Mac, publishing keeps the update key in the Keychain; elsewhere it reads a file
(`publish-htmlapp` skill).

Optional, the maintainer's tooling: [graphmind](https://github.com/aouicher/graphmind) and codebase-memory-mcp give AI
agents a code graph. The git hooks rebuild graphmind's graph only when it's installed, and skip it otherwise. If you
use it, exclude your trips before the first build (`graphmind exclude add trips`), because it doesn't read
`.gitignore`, and if you configure an embedding provider it sends indexed code there.

1. **Google Maps (recommended):** set up your own keys with [`guides/google-maps.md`](guides/google-maps.md). It takes
   about 20 minutes, and a family trip stays within Google's free monthly allowance. You can skip it: the page falls
   back to a free map.
2. **Describe the trip** to your agent: dates, flights, who's coming (seniors?), hotels, what's booked, what you'd
   love. It writes `trips/<slug>/`, which is gitignored and never committed. Then shape it together in plain words
   ("add a rest after lunch on day 4", "two of us cycle on day 5"): `trip-customize` knows which part of the page each
   request becomes.
3. **Share the group's changes (optional):** added stops, pushed-back times, flight changes and shared checklist ticks
   reach every phone through your own Firebase Realtime Database, which RelaxJer doesn't run. The `sync-setup` skill
   does it in about 5 minutes, before the build, and a family trip stays within Firebase's free amounts. Each phone
   changes only the stops it added, and a planner (a phone that gives the code you set with `pnpm sync planner`) can
   change any, or block a stray phone. Every removal can be undone. Without sync, each phone keeps its own.
4. **Refresh, build, check:** `pnpm resync --trip trips/<slug> --write` (the first run says what it costs Google
   and asks you first, [why](guides/google-maps.md#what-it-costs)), then
   `pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json` (add `--sync <the sync file>` if you set up
   sharing), then the tests and a look on your phone.
5. **Publish behind a password** (ht-ml.app), and share the link in your group chat. A republish to the same link
   keeps every phone's ticks and added stops, and the phones offer the update themselves.

### Google Maps or the free map?

|                           | Free map (MapLibre + OpenStreetMap) | Google Maps (your own keys)           |
| ------------------------- | ----------------------------------- | ------------------------------------- |
| Map                       | Clean, community detail             | The map your group already uses       |
| Hours, ratings, photos    | Only what's in your plan            | Live on every place                   |
| Search                    | Your trip's places                  | Plus Google search when adding a stop |
| Walking and transit times | Your plan's times                   | Filled in by the data refresh         |
| Cost and setup            | Free, nothing to set up             | Free for a family trip; ~20 min setup |

The full comparison, the costs, the guardrails and Google's terms are in [`guides/google-maps.md`](guides/google-maps.md).

## Contribute

```sh
pnpm test          # tier 0: hygiene, agent config, memory-bank, trip contract, units (~1 s)
pnpm test:e2e      # the page in Chromium + WebKit at 390 px and desktop
pnpm verify        # lint + format check + tier 0 + pipeline tests (CI adds gitleaks and the e2e jobs)
pnpm build --trip examples/demo-trip   # the synthetic demo trip
```

| Path                   | What                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `engine/`              | Page engine and single-file build                                                                  |
| `destinations/<cc>/`   | Country packs (currency, tax refund, visitor programmes, drink guide); city packs under `regions/` |
| `pipeline/`            | Data refresh: Google first, OpenStreetMap fallback, weather, images                                |
| `examples/demo-trip/`  | A synthetic trip that tests and docs run on                                                        |
| `trips/`               | Your real trips. Gitignored; never committed                                                       |
| `tests/`               | Hygiene, agent config, trip contract, units, Playwright characterisation, the release gate         |
| `knowledge/`           | Lessons learned across trips and countries                                                         |
| `memory-bank/`         | Project context, standards, decisions (ADRs) and the story index                                   |
| `.agents/`, `.claude/` | Skills for any agent; Claude Code's agents, rules and hooks                                        |
| `guides/`              | For planners: getting started, the trip page part by part, Google Maps                             |
| `site/`                | The landing page on GitHub Pages                                                                   |

Every decision and its trade-offs: [`memory-bank/standards/decision-index.md`](memory-bank/standards/decision-index.md).
The trip page's design system: [`DESIGN.md`](DESIGN.md), and who it's for: [`PRODUCT.md`](PRODUCT.md).

## Hosting

GitHub Pages hosts the project's landing page and a live copy of the synthetic demo trip, which CI builds with no key
([try it](https://kennethwkz.github.io/relaxjer/demo/)). Pages sites are public, so never put a real trip there. Host your
trip page behind a password (ht-ml.app, for example), because it carries hotels, flights and names, and with group sync
its database keys. The page carries its own Content-Security-Policy, so the host doesn't have to set headers.

## Licence

[MIT](LICENSE). Vendored design skills keep their own licences: [`.agents/THIRD_PARTY_NOTICES.md`](.agents/THIRD_PARTY_NOTICES.md).
