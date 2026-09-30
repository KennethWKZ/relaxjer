---
name: destination-pack
description: Add or extend a RelaxJer destination pack — a country (destinations/<cc>/pack.mjs) and its cities (regions/<city>/pack.mjs), their pipeline steps and knowledge.md — with unit tests. Use when planning a trip to a country or city the repo doesn't cover yet (Japan, Korea, Hokkaido, Tokyo…), or when a pack's facts (tax refund, taxi fares, transit, bike share, entry rules) need updating.
---

# Destination pack

Read first: `destinations/README.md` (what the engine reads from `Pack`), `memory-bank/standards/patterns/engine.md`
§ Core modules and packs, and the existing `destinations/tw/` as the worked example.

## 1. Research

In Claude Code, hand this to the read-only `destination-researcher` agent. Otherwise, do it yourself from primary
sources: the tax authority, the tourism bureau, the transit operator, the taxi regulator. For each fact, record the
source and the date you checked it. A fact without a source doesn't go in.

| Level   | Research                                                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Country | name `[zh, en]`, currency symbol, the tourist tax refund (minimum spend, per shop or per day), visitor programmes, entry rules, the native language and its romanization (story step 4) |
| City    | its name, what the metro is called, the transit card, the taxi meter (flag fall, per-distance, night surcharge), the bike share and whether it has a public live-count API              |
| Data    | which Google place types mislead there, which chains matter, where OSM beats Google (stop order), and what a group of seniors should know                                               |

## 2. Write the pack

- `destinations/<cc>/pack.mjs` (ISO 3166-1 alpha-2, lower case) and `destinations/<cc>/regions/<city>/pack.mjs`.
- **Pure modules:** no imports, no DOM, no trip globals, named exports only. Every export is optional. Amounts are in the
  country's currency.
- Only the exports the engine reads (the table in `destinations/README.md`). A new capability needs an engine change
  first: document the export in that table in the same change.
- Text is `[zh, en]` pairs, as elsewhere, until story step 4.

## 3. Pipeline steps (if the city needs them)

- `destinations/<cc>/pipeline/<step>.py` for the country, `destinations/<cc>/regions/<city>/pipeline/<step>.py` for the
  city. The pipeline finds a step in the region, then the country, then `pipeline/steps/`.
- Every step gets an offline test in `pipeline/tests/` (`pnpm test:pipeline`).

## 4. Knowledge

`destinations/<cc>/knowledge.md`: what matters when planning there, with the date each fact was checked. Keep lessons
that hold for every country in `knowledge/` instead.

## 5. Test

- `tests/unit/packs.test.mjs` checks every pack is pure and unit-tests its functions. Add the new pack's cases: a taxi
  fare at a known distance and time, a refund at the edge of the minimum, a bike-share parse on a recorded sample.
- `pnpm test`, then build a trip that uses the pack (`pnpm build --trip …`), and run `verify-page` on it.
- A second demo trip for a new destination (story step 7) uses synthetic data only.

## Done when

The pack is pure and tested, every fact carries a source and a date in `knowledge.md`, `pnpm test` passes, and a trip
using the pack passes the trip-agnostic e2e.
