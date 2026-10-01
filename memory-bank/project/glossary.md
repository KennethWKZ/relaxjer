---
created: 2026-10-01
updated: 2026-10-02
---

# Glossary: Ubiquitous Language

Use these words, as written, in code, tests, docs and commit messages, so names never drift.

## Trips and data

| Term                    | Meaning                                                                                                                                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| trip                    | A folder with `data.js`, the `*.json` side files and `img/`: a real one in `trips/<slug>/` (gitignored), or the committed `examples/demo-trip/`                                                                                                                                  |
| demo trip               | `examples/demo-trip/`: a fictional group of five, one week in Taipei. Synthetic, safe to publish, the trip every test and doc runs on                                                                                                                                            |
| short trip              | A 4-day trip generated from the demo (`tests/support/short-trip.mjs`) that proves any trip length and a mid-trip hotel change                                                                                                                                                    |
| requirements            | `trips/<slug>/requirements.md`: the planner's own words about the trip, the input to `trip-intake`                                                                                                                                                                               |
| trip contract           | The rules a trip's data must follow before the engine can render it (`tests/support/trip-contract.mjs`)                                                                                                                                                                          |
| trip settings           | `TRIP`: the trip's own name, dates, group size, time zone, currency and pack choice ([`../standards/trip-format.md`](../standards/trip-format.md))                                                                                                                               |
| real-trip details       | A real trip's name, hotel, flight numbers, dates and `never-publish.txt` lines. The release gate derives them locally and blocks them from anything published                                                                                                                    |
| fixed item              | A schedule item with `fixed: true`. It never moves: re-plans and delays work around it                                                                                                                                                                                           |
| flight-relative time    | `rel: { arr: [a, b] }` or `{ dep: [a, b] }`: minutes after landing or before take-off; it follows a typed delay                                                                                                                                                                  |
| day role                | What a day is for, read from the data (`Plan.dayRoles`): the arrival, the leave day, a flight-only day, the free-time day                                                                                                                                                        |
| leave day               | The day the group leaves for the airport: the evening before an after-midnight take-off, else the flight's own day                                                                                                                                                               |
| group figure            | A cost for the whole group, written `"NT$1,200–1,800 / 五人"` (zh) and `"NT$1,200–1,800 for 5"` (en). The page adds the per-person share                                                                                                                                         |
| per-person share        | A group figure divided by `TRIP.pax`, shown next to it. Per-vehicle costs (charter, taxi) don't shrink with fewer people                                                                                                                                                         |
| home currency           | The group's own currency (`TRIP.currency.home`). Every figure also shows it, at a rate the reader can edit                                                                                                                                                                       |
| near me, near each stop | Food, drinks, rest spots and toilets around the reader or around a stop                                                                                                                                                                                                          |
| rest spot               | Somewhere to sit when tired: a sit-down tea house, dessert shop, café or bar (`cat: 'rest'`)                                                                                                                                                                                     |
| added stop              | A stop the reader adds to a day. It is checked for clashes and deadlines, and shared as a `#add=` link, or by group sync, which also says who added it                                                                                                                           |
| group sync              | A trip's opt-in sharing of added stops, pushed-back times, flight changes and shared ticks through the planner's own Firebase database, with a name and a role per phone (ADR-20261001-group-sync, ADR-20261002-sync-planners)                                                   |
| shared list             | A `CHECKLIST` group with `shared: true`: with group sync on, its ticks reach everyone's phone. Every other tick is personal                                                                                                                                                      |
| sync file               | `~/.config/relaxjer/sync/<slug>.json` from `pnpm sync init`: the trip's database, id, write token and sync key, and, after `pnpm sync planner`, the planner code's salt and hash. Never in the repo; a rebuild keeps the same one                                                |
| sync record             | One thing a phone shares: `stop:<id>`, `shift:<date>`, `flt:arr\|dep`, `tick:<group>-<item>`, `who:<phone>` (a name), `role:<phone>` (`planner`) or `block:<phone>`. It is sealed on the phone, and the newest version wins                                                      |
| write token             | The secret the sync database's rules check on every record; it lives at `/keys/<trip>`, which no phone can read                                                                                                                                                                  |
| phone                   | One browser's storage, with a random id (`dev`) that its stops, name and role hang on. Clearing site data, or the iPhone home-screen copy, is another phone (ADR-20261002-sync-planners)                                                                                         |
| planner (page role)     | A phone that gave the trip's planner code, or that a planner made one. It can change or remove any added stop, clear one phone's, make other phones planners, and block a phone. The page enforces it, not the database. The person who runs the framework is also "the planner" |
| planner code            | The code `pnpm sync planner` sets for a trip. Only its salt and PBKDF2-SHA-256 hash are kept, in the sync file and, once built, in the page. Setting a new one means rebuild and republish                                                                                       |
| blocked phone           | A phone a planner blocked in Group sync: its role, added stops and last changes went back to the plan, and every phone drops what it writes until Unblock. Its bar says so; its changes wait on it. Page-enforced only (ADR-20261002-sync-planners)                              |
| Recently removed        | A phone's local list of the stops that left the plan (it keeps 30, the sheet shows the newest 10), with Put back. Group sync only; never synced                                                                                                                                  |
| welcome sheet           | The sheet a phone gets once, on its first open with group sync on and no name, asking what the group should call it. Not now leaves the bar under the header as the reminder (`syncWelcomed`)                                                                                    |
| Undo                    | The button on the toast for 8 seconds after a removal or reset. It puts back only what that action took. Every page has it                                                                                                                                                       |
| running-late re-plan    | A suggestion from time and location for what to drop or shift. It never moves anything by itself                                                                                                                                                                                 |
| shop list               | A themed list in the Optional section (`SHOPLISTS`); `SNOW` is the older single-list form                                                                                                                                                                                        |
| optional plan           | An `OPTIONAL` entry: a sight or idea that is never scheduled. With `near`, a "Nearby options" chip at the stops it suits opens its card over the day                                                                                                                             |
| day split               | `DAYS[i].split`: part of the group takes its own plan for a few hours, hung at a dashed knot where the day's string forks (ADR-20261001-day-split)                                                                                                                               |
| rejoin stop             | The stop of a split day where the group comes back together; it says `Rejoining here: <who> (<plans>)`                                                                                                                                                                           |

## Engine and packs

| Term             | Meaning                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| engine           | `engine/`: the page's sections, styles, shell and the single-file build                                                                                     |
| section (engine) | One fragment `engine/src/app/NN-*.js`. The build joins them in order into one script, so they share one scope                                               |
| core module      | `engine/src/core/*.mjs`: pure logic (time, money, plan) with no DOM and no trip globals, unit-tested                                                        |
| destination pack | `destinations/<cc>/pack.mjs`: what the page knows about a country (currency symbol, tax refund, visitor programmes)                                         |
| region pack      | `destinations/<cc>/regions/<city>/pack.mjs`: a city (its metro's name, taxi meter, bike share)                                                              |
| `Pack`           | The merged pack the page reads: the region over the country                                                                                                 |
| native layer     | The destination's own language for place names, menus, signs and "show the driver" text, with romanization (story step 4)                                   |
| UI languages     | The two languages the group reads the page in, today fixed to Chinese + English (`Z(zh, en)`)                                                               |
| build            | `pnpm build --trip <dir>` → `<fileName>-standalone.html` (the page to publish), `<fileName>.html` and the My Maps KML                                       |
| build id         | `<meta name="relaxjer-build">`, 12 hex characters. The page compares it with the live copy's to offer an update, and a publish is verified by it            |
| page policy      | The Content-Security-Policy the build writes into the page: inline scripts by hash, only the hosts it uses, MapLibre with integrity (ADR-20261001-page-csp) |
| storage key      | `TRIP.storageKey`: the prefix the page saves the reader's state under. A published page keeps its prefix, or readers lose what they saved                   |
| section skipping | `content-visibility: auto` on sections, in Chromium-family browsers only (WebKit claims scroll anchoring but doesn't hold it)                               |
| landing glow     | The one-time ring on a heading or lantern after a jump, so the reader sees where they arrived                                                               |
| Back pill        | The floating button that returns the reader to where they were before a jump                                                                                |

## Tests and release

| Term                  | Meaning                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| tier 0                | `pnpm test`: repo hygiene, agent config, memory-bank, the trip contract and units, in about a second              |
| tier 1                | `pnpm test:e2e`: characterisation of the page, Chromium + WebKit × 390 px + desktop                               |
| characterisation test | An e2e test that pins what the page does today, so a refactor can prove it kept that behaviour                    |
| `@demo`               | The tag for a test that depends on the demo's ids, times or strings. Every untagged test must pass on any trip    |
| known debt            | A `test.fail(true, reason)` that states behaviour the engine lacks. Delete the marker when a change makes it pass |
| parity                | `pnpm parity`: every section's text, in both languages, diffed against the legacy page built from the same trip   |
| legacy engine         | The first trip's single-trip repo, kept as a fallback until that trip ends                                        |
| release gate          | `pnpm test:release` + the pre-push history scan: no real-trip details in anything published                       |

## Keys, hosting and agents

| Term           | Meaning                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| browser key    | The user's own Google key for the page (Maps JavaScript + Places), restricted to their host and `localhost`. Embedded only with `--keys` |
| server key     | The user's own Google key for the pipeline (Places + Routes). Never in a page                                                            |
| ht-ml.app      | The password-gated static host for trip pages. A site has an id, a secret update key, and a viewer password                              |
| lesson         | An entry in `knowledge/` or `destinations/<cc>/knowledge.md`: something a trip taught. Proposed by a retro, reviewed before it lands     |
| skill          | A workflow an agent loads by name, in `.agents/skills/<name>/SKILL.md`                                                                   |
| vendored skill | A third-party skill copied in by the skills CLI and pinned in `skills-lock.json`                                                         |
| seniors        | Older travellers in the group. Count their walking time ×1.4, and suggest a taxi first for long legs                                     |
