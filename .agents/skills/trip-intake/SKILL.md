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
- the hotel for each night, or, where it's not booked yet: the beds the group needs, the bags, a lift, how near the
  station, the budget, and any stay the planner wants only as a last resort ([stays](../../../knowledge/stays.md));
  research everything else the way [research](../../../knowledge/research.md) says (sources and dates, posts,
  routes, choices);
- everything booked or at a fixed time (shows, tours, charters, restaurants);
- the budget the planner has, the home currency, and the two UI languages;
- must-dos, nice-to-haves, and what the group dislikes. A must-do named loosely ("the lone tree", "that famous
  bridge") gets its exact name, in the local script and in English, written into `requirements.md` once the planner
  confirms which one it is. Many places have look-alikes nearby; don't add one as an extra stop without asking;
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
  note), `checked`, `mapViews`, `fileName`, and `storageKey` if the page was published before. Leave `walkPace` out
  when the group has seniors or anyone slow on foot; set `walkPace: 1` only when the planner says everyone is a fit
  adult (Google's own walking times).
- `DAYS`: ids `d1`…`dN` in order. Booked or timed items are `fixed: true`; flight-tied items use `rel: { arr }` or
  `rel: { dep }`. Give each day a route, a rain plan and slack around fixed items. Seniors' walking counts ×1.4, and a
  long leg suggests a taxi first. Give each day a `short` name, `[zh, en]`, 2–8 characters saying what the day is
  ("小樽一日" / "Otaru day", "滑雪 + 温泉" / "Ski + hot spring"): it is the day's one line in the week, Days, the rail and
  the map's list, while `title` keeps the whole route for the day itself. A stop note the group must act on gets
  `todo: true` so it stays in sight.
- Money: group figures as `"<sym>a–b / 五人"` (zh, with the Chinese numeral up to ten) and `"<sym>a–b for 5"` (en).
  The page adds the per-person share. In `BUDGET.rows`, what's already booked is a payment: `paid` (the date), `cur:
'home'` for anything paid at home (flights, often the hotel), `via` (where) and, if the planner wants it on the page,
  `ref`; a deposit and its balance go in `parts`; something planned without a price yet is `tbd: true`, never a guess.
  Give every row its kind for the By kind sheet: `cat` (`transport`, `car`, `lodging`, `food`, `tickets`, `activity`,
  `insurance`, `other`), or an estimate's last item.
- Insurance, when the group has it: `INSURANCE` with each policy's insurer, plan, who it covers, dates, what it covers,
  its app and the hotline numbers (`tel`, `wa`), and `claims` (what to keep, by event). Never an ID or passport number,
  an address or a birth date: the page is shared with the group, and the contract refuses them.
- **Write for the glance layer**
  ([ADR-20261128-progressive-disclosure](../../../memory-bank/standards/decisions/ADR-20261128-progressive-disclosure.md)):
  the page shows one line per stop, a tile per part and one number for money, and opens the rest on a tap. So a
  stop's `what` is its name, not a sentence; its `note` is short and anything longer goes in `detail`, both shown
  when the stop is opened; a stop's kind comes from the stop or its `icon`. A block gets a `tile: [zh, en]` word (at
  most 6 characters, 16 in English) when its heading is long, and a `sum` when the line the page works out says too
  much. A checklist item's `t` is a few words, its `sub` the explanation, shown on a tap. Don't repeat a figure in
  text that the page already shows (the budget's totals, a day's share).
- Tax refund, when the group will shop: `TAX` with the steps, card or cash, the airport points and Wi-Fi, the
  deadline, and any shop coupons (`coupons`, an image each in `img/tax/`, `until` only when the coupon prints one),
  every fact with its source (`src`) and anything only one blog says marked as that blog's.
- Long drives: add the `drive-stops` step to `pipeline.json` and the page lists rest stops along the way for
  reference; a break the group wants in the plan is its own stop. Refill points come from the `refill` step.
- `PLACES`: every place a day or list names. Positions come from Google through `data-sync`, so a rough position is
  fine for now.
- Wording: never describe people by family relationship. Say "the group", "seniors", "adults".
- `trips/<slug>/pipeline.json`: what `data-sync` should search for. Every key and a synthetic example are in
  [`pipeline/README.md`](../../../pipeline/README.md#pipelinejson). A trip outside Taiwan names its own `steps`. Create
  empty `wish-a.json` and `wish-b.json` (`{ "items": [] }`) if the group has no wishlist yet: the refresh expects them.
- Photos: two to four a day of the day's main places (`DAYS[i].photos`), sourced with their credits as
  [`pipeline/README.md`](../../../pipeline/README.md#photos-and-icons-by-hand) says. A page without them works, but it
  reads as a list instead of a trip, and the build says `photos 0`.
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
- Every must-do in `requirements.md` names one exact place, and every day has photos (or the planner knows it has none).
- Every day has a `short`, every stop's `what` is a name and its `note` short, and every budget row has its kind.
- `git status` shows nothing under `trips/` except its README.
