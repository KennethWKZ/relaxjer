---
created: 2026-10-01
updated: 2026-10-01
---

# Pipeline

How to change `pipeline/` and the pack pipeline steps. Commands and folders are in `pipeline/README.md`, and the data
lessons in [`../../../knowledge/data-hygiene.md`](../../../knowledge/data-hygiene.md).

## Sources, in order

1. **Google** (the user's own server key) for positions, place ids, hours, ratings, addresses and route legs.
2. **The operator's live source** where it beats Google, for example a bike share's live dock counts.
3. **OpenStreetMap** only for what Google can't give (a metro line's stop order, the offline map), checked against
   Google where possible.
4. **Open-Meteo** for the forecast.

## Steps

- A step is looked up in the trip's region pack, then its country pack, then `pipeline/steps/`. Put a step where it
  belongs: generic in `steps/`, a country's in `destinations/<cc>/pipeline/`, a city's in
  `destinations/<cc>/regions/<city>/pipeline/`.
- What a trip searches for (its chains, shopping list, weather spots, which places are stations or districts) goes in
  `trips/<slug>/pipeline.json`, never in a step.
- Read the trip through `lib/` (the build's own evaluation of `data.js`), never by regex.
- Keep the output stable. Sort what you write, and never depend on set or dict order (Python's hash seed reshuffled a
  list once).

## Tests

- `pnpm test:pipeline`: offline, on the demo trip, Google mocked. Every new step gets a test there.
- After a real `--write`, run `pnpm test:all` (and `pnpm parity` while the first trip is live), look at the page, then
  republish.

## Keys and terms

- The server key is read from `~/.config/relaxjer/google-places.key` (mode 600) or `RELAXJER_GOOGLE_KEY_FILE`. It never
  goes into a page, a trip folder, a test or a log line.
- Google's terms limit how long Places content may be kept. The cache lives in the trip's gitignored `.cache/`, and a
  trip's data is never published or committed ([ADR-20260930-google-keys](../decisions/ADR-20260930-google-keys.md)).
- Google bills every call, so every Google call goes through `lib/google.py`'s `call()`: it answers from the cache,
  asks again only what failed, stops a step after `MAX_NEW` new calls without the planner's yes, and keeps what it
  paid for when a step stops early. `--fresh` and a trip's first run print their cost and wait for a yes; an agent
  never gives one ([ADR-20261001-resync-cost-guard](../decisions/ADR-20261001-resync-cost-guard.md)).
