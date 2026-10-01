---
name: trip-intake
description: Turn a planner's trip requirements into a RelaxJer trip folder (trips/<slug>/) that passes the trip contract. Use when someone wants to plan a new trip, describes a trip in their own words, hands over an itinerary or a requirements file, or asks to start a trip page. Covers the questions to ask, the data shape, fixed times, group costs, seniors' pace, keys setup and the first contract run. Next steps are data-sync, then build-page.
---

# Trip intake: requirements → a trip folder

The output is `trips/<slug>/` with `data.js`, the side files and `img/`, passing `TRIP_DIR=trips/<slug> pnpm test`.
`trips/` is gitignored: nothing you write there is ever committed, and nothing from it may be copied anywhere else.

Read first: `memory-bank/standards/trip-format.md` (every field), `memory-bank/standards/patterns/trip-data.md` (how to
write it), `knowledge/group-ux.md`, and `destinations/<cc>/knowledge.md` if the country has one.

## 1. Get the requirements

Ask for `trips/<slug>/requirements.md` in the planner's own words, or write it with them from
[`requirements-template.md`](requirements-template.md). Pick the slug as `<city>-<year>` (`hokkaido-2027`).

You need these before writing data. Ask for any that are missing, all in one message:

- dates, and both flights (numbers, times, airports);
- the group's size, how many are seniors, and anything that limits walking;
- the hotel for each night;
- everything booked or at a fixed time (shows, tours, charters, restaurants);
- the budget the planner has, the home currency, and the two UI languages;
- must-dos, nice-to-haves, and what the group dislikes;
- whether the group should share its changes across phones (group sync, `sync-setup`, which needs the planner's own
  Firebase), and which checklist groups to mark `shared: true` if so.

Never invent a booking, a price or a budget. An estimate is fine when it's marked as one ("≈").

## 2. Pick the packs

- Is there a destination pack (`destinations/<cc>/`) and a region pack (`regions/<city>/`)? Set `TRIP.destination` and
  `TRIP.region`.
- No pack yet: build without one (the page leaves those features out), or run the `destination-pack` skill first.

## 3. Write the data

Start from the demo's shape (`examples/demo-trip/data.js` shows every field in use), but write every value from the
requirements. No demo content may survive: its hotel, stalls and prices are invented.

- `TRIP`: name in both languages, `start`/`end`, `brand`, `pax`, `tz`, `currency` (with the home currency and a rate
  note), `checked`, `mapViews`, `fileName`, and `storageKey` if the page was published before.
- `DAYS`: ids `d1`…`dN` in order. Booked or timed items are `fixed: true`; flight-tied items use `rel: { arr }` or
  `rel: { dep }`. Give each day a route, a rain plan and slack around fixed items. Seniors' walking counts ×1.4, and a
  long leg suggests a taxi first.
- Money: group figures as `"<sym>a–b / 五人"` (zh, with the Chinese numeral up to ten) and `"<sym>a–b for 5"` (en).
  The page adds the per-person share.
- `PLACES`: every place a day or list names. Positions come from Google through `data-sync`, so a rough position is
  fine for now.
- Wording: never describe people by family relationship. Say "the group", "seniors", "adults".
- `trips/<slug>/pipeline.json`: what `data-sync` should search for. Every key and a synthetic example are in
  [`pipeline/README.md`](../../../pipeline/README.md#pipelinejson). A trip outside Taiwan names its own `steps`. Create
  empty `wish-a.json` and `wish-b.json` (`{ "items": [] }`) if the group has no wishlist yet: the refresh expects them.
- `trips/<slug>/never-publish.txt`: one literal per line, for anything private the release gate can't derive (a
  nickname, a booking code).

## 4. Google keys (recommended)

Recommend Google Maps, and walk the planner through [`guides/google-maps.md`](../../../guides/google-maps.md) one step at
a time: the project and billing, three APIs, a restricted browser key and Map ID, a restricted server key, the key
files in `~/.config/relaxjer/`, then a budget alert and quotas. Show them the guide's comparison table if they're
unsure; the page works without Google too.

Ask them to confirm both keys' restrictions in the Cloud console before the first build. **Never ask for a key in the chat,
and never write one yourself.** They paste it into the file.

## 5. Shape it, then check

Walk the planner through the first draft day by day, and apply what they change with `trip-customize`. Travel
questions ("is this too much for the seniors?", "what needs booking?") go to the read-only `relaxbro` agent in Claude
Code, or to your own research with sources and dates.

```sh
TRIP_DIR=trips/<slug> pnpm test     # the contract on this trip: every place exists, every pin inside the map, day ids in order
```

Fix every contract failure in the data, never in the contract. Then hand over to `data-sync` (places, hours,
weather), then `build-page`. [`guides/trip-page.md`](../../../guides/trip-page.md) says what each field becomes on the
page, so you can show the planner what they'll get.

## Done when

- `TRIP_DIR=trips/<slug> pnpm test` passes.
- Every fixed time in the requirements is `fixed: true`, and every number in the data comes from the requirements or is
  marked as an estimate.
- `git status` shows nothing under `trips/` except its README.
