---
name: data-sync
description: Refresh a RelaxJer trip's outside data with the pipeline — Google places, pins, hours and route legs, drinks and rest spots, toilets, metro and bike share, shops, the weather forecast and a link check — then rebuild. Use when a trip folder is new, before a trip, during a trip ("update the hours", "refresh the weather"), or when places look wrong. Dry run first, then --write.
---

# Data sync: `pnpm resync`

Read first: `pipeline/README.md` (commands, folders), `memory-bank/standards/patterns/pipeline.md` (sources and steps),
`knowledge/data-hygiene.md`.

## Before you run it

- Needs [uv](https://docs.astral.sh/uv/) and node. Google calls need the user's own **server key** in
  `~/.config/relaxjer/google-places.key` (mode 600). Without one, run with `--no-google`: weather and link checks still
  work.
- What the trip searches for lives in `trips/<slug>/pipeline.json` ([every key](../../../pipeline/README.md#pipelinejson)): `steps`, `chains`, `shops`, `pin_queries`,
  `forecast_spots`, `stations`, `skip_nearby`, `no_hours`, `area`. The steps look themselves up in the trip's region
  pack, then its country pack, then `pipeline/steps/`.

## Run

```sh
pnpm resync --trip trips/<slug>             # dry run: print what would change (answers from the cache)
pnpm resync --trip trips/<slug> --write     # write the trip's files and rebuild the page (with google.json and the trip's sync file when present)
#   --fresh   ask Google again for everything (prints the cost, needs the planner's yes)
#   --fresh-drives  ask again only the drives still ahead, for newer traffic predictions (two calls a drive)
#   --no-google  --no-weather  --no-links  --no-build
```

**Google bills every call.** Asking a week-long trip's calls again is about 4,600 calls and US$130 at list price: it
showed as RM520 when an agent ran one on 2026-10-01 only to test a key. So the refresh guards the spend
([ADR-20261001-resync-cost-guard](../../../memory-bank/standards/decisions/ADR-20261001-resync-cost-guard.md)):

- A run answers from the trip's cache, and asks Google only what's new or what failed last time.
- Each step stops after 200 new calls (`stopped: this step needs more than 200 Google calls…`). What it fetched is
  kept.
- `--fresh`, or a trip with no cache yet, prints how many calls and what they cost, and stops without a yes.
- Every Google step prints `new Google calls: N` and their list price, and the run ends with the total. Show the planner
  that line after any run that asked Google.
- **Drive times in the trip's last week:** `--fresh-drives` asks again only the traffic-aware drives still ahead (a
  week-long trip has about ten, so about twenty calls), everything else from the cache. Compare each drive's `bad` in
  `geo.json` with its deadline again afterwards.

**Paying is the planner's call, never yours.** When a run stops for either reason, show the planner what it printed,
and let them run the paid one themselves, adding `--yes` to the same command (and `--fresh` if they want everything
again), as a `!` command in Claude Code or in their own terminal. `.claude/hooks/guard-bash.mjs` blocks an agent's
`--yes` and `RESYNC_PAID`. Never refresh to test a key: use the one-call-per-API check in `guides/google-maps.md`
(step 5).

Always dry-run first, and read the diff before `--write`:

- **A place that moved far, or changed type, is a mismatch.** Check it (a car park is not an airport terminal, the inn
  next door is not the hotel). Pin a hand-checked Google id in `PLACES[k].gpid`, and note why.
- **Toilets:** filter offices, gyms and shops tagged as toilets.
- **Near-misses:** keep a sit-down tea house, dessert shop, café or bar as a rest spot; drop only true noise.
- **Transit:** drop partial OSM lines.
- **Links** it lists as broken are reported, not changed. Fix them in the data by hand.
- **Weather** covers only trip days within 16 days.

## After `--write`

1. `TRIP_DIR=trips/<slug> pnpm test`: the contract still holds.
2. `pnpm test:all`, and (the maintainer, while the first trip is live) `pnpm parity --live <legacy repo> --trip trips/<slug>`. Parity's
   text diffs now include fresh data, so read them rather than counting them.
3. `verify-page`, then `publish-htmlapp` if the page is published.

## Never

- Commit anything under `trips/` or paste its data elsewhere. The cache in `trips/<slug>/.cache/` is gitignored with it.
- Print, log or copy the server key.
- Change a step to fit one trip. Put what one trip searches for in its `pipeline.json`, and give a new step a test in
  `pipeline/tests/` (`pnpm test:pipeline`).

## Done when

The dry run's changes are explained, `--write` is applied, the contract and `pnpm test:all` pass, and the new places
were checked for mismatches.
