---
name: trip-customize
description: Change an existing RelaxJer trip the way the planner asks — add, move or remove a stop, a booked (fixed) time, a rest, a rain plan, a decision between options, a day that splits for part of the group, an optional plan suggested at a stop, a shop list, a checklist item, a budget row, a hotel per night, the flights, the airport options — and say where each change lands on the page. Use after trip-intake, whenever the planner asks to adjust the plan before or during the trip, or asks "can the page show …?". Then rebuild, verify and (with their yes) republish.
---

# Trip customize: the planner's words → the trip's data

The trip lives in `trips/<slug>/data.js` and its side files (gitignored; never copy anything from it elsewhere). The
planner speaks in plans, not fields: translate each request into the field that owns it, tell them where it shows on
the page, and keep the rules that make the page trustworthy.

Read first: [`memory-bank/standards/trip-format.md`](../../../memory-bank/standards/trip-format.md) (every field),
[`memory-bank/standards/patterns/trip-data.md`](../../../memory-bank/standards/patterns/trip-data.md) (how to write
it), and [`guides/trip-page.md`](../../../guides/trip-page.md) (what each part of the page does, so you can say where a
change lands).

## Before you change anything

- **Travel questions go to an expert first.** "What should we do on day 3?", "Is this too packed?", "What needs
  booking?" In Claude Code, hand them to the read-only `relaxbro` agent (in the background, so the planner can keep
  talking) and apply its proposals once the planner agrees. Elsewhere, research them yourself from primary sources,
  with the date you checked.
- **A published page keeps `TRIP.fileName` and `TRIP.storageKey`**, and its `--sync` file. Changing them loses every
  phone's saved state, or starts the shared plan over.
- **Ids are forever on a published page.** A checklist item's id, a shop list's id or a day's id is a key on every
  phone; renaming one unticks it everywhere. Change the text, keep the id. Ticks in a day card's checklist and a shop
  list's checks are kept by position: add new ones at the end, never in between.
- **A skip on the trip lives on the phones, not in the data.** Anyone can skip a planned stop on the page (Skip in the
  opened stop) and put it back (ADR-20261128-skip-planned-stops); a skip is keyed to the stop's time, name and place as
  written, so editing any of those in the data puts a skipped stop back on every phone. When the planner wants a stop
  gone for good, remove it from the data; when they only changed their mind on the day, leave the data alone. Flights
  and the lodging can't be skipped on the page: a stop about the hotel or a flight with no `place` gets `icon: 'bed'` or
  `'plane'` so it can't be either.
- Never invent a booking, a price or a budget. An estimate is marked "≈" and says where it came from.
- Never describe people by family relationship, in either language: "the group", "seniors", "adults", "one of us".

## Requests and where they go

| The planner says                                        | Change                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Add lunch at … on day 2" / "move the museum to 10:00"  | `DAYS[i].schedule[]`: `t`, `what`, `place`, `note`. Add the place to `PLACES` and a rough position to `geo.json` `places[key]` (`{ lat, lng }`); `data-sync` corrects it                                                                          |
| "We booked a table / tickets / a tour at 18:00"         | the stop gets `fixed: true` (a red seal; a push-back stops there). A ticket or booking card: `extra.json` `tickets` + `DAYS[i].tickets`                                                                                                           |
| "Everything on day 1 depends on when we land"           | `rel: { arr: [a, b] }` (minutes after landing) or `rel: { dep: [a, b] }` (minutes from take-off, negative before); a typed delay then moves them                                                                                                  |
| "Day 4 is too much for the seniors"                     | a rest after lunch, slack around fixed times, a stop moved to another day before one is dropped; seniors' walking ×1.4, a taxi first for long legs. Ask `relaxbro`                                                                                |
| "We want it relaxed, not packed"                        | unhurried days, not fewer places: slow mornings and rests, and free evenings filled with easy nearby extras (a lit walk, a night view, a museum open late). Ask `relaxbro`                                                                        |
| "What if it rains?"                                     | a `{ type: 'rain', h, list \| groups }` block on the day, and `BACKUPS` for the trip                                                                                                                                                              |
| "Let's decide on the day: A or B for dinner"            | a `{ type: 'decide', h, opts: [{ k, mark, name, cost, when, list, place }] }` block; once the group has chosen, `pick: '<k>'` names the option on its summary button                                                                              |
| "Say it shorter on the button" (a card's summary)       | `sum: [zh, en]` on the block replaces the one line the page works out                                                                                                                                                                             |
| "Snow globe, not falling snow" / "no sky"               | `TRIP.sky`: `'live'`, `'globe'`, `'pile'` or `'off'`, in a look that has a sky (Snow Light Path). To compare first, build with `--preview` (`build-page`)                                                                                         |
| "Two of us cycle while the rest go back to the hotel"   | `DAYS[i].split`: `at`, `who`, `h`, `go` rules, 1–4 `options` with `join` (the rejoin stop's time). [ADR](../../../memory-bank/standards/decisions/ADR-20261001-day-split.md)                                                                      |
| "Swap day 2 and day 3"                                  | keep each day's `id` and date; move the plans and every per-day link with them ([trip-data](../../../memory-bank/standards/patterns/trip-data.md)); check each stop's weekdays first, and have `data-curator` review it                           |
| "The van is ours until 19:00"                           | the stop `fixed: true`; the drive back as a `route` leg with its hour (`'18:00'`); `data-sync`, then compare `geo.json` `legs[…].bad` with the end of the hire                                                                                    |
| "Suggest the observatory near there, don't schedule it" | an `OPTIONAL[]` card with `near: [{ day, place }]`: a "Nearby options" chip at that stop opens it over the day                                                                                                                                    |
| "Add a tea-shop list" / "a pharmacy list"               | a `SHOPLISTS[]` entry (`id`, `h`, `shops[]`, optional `rule`/`checks`); each gets a heading in Optional, map pins and a free-time group                                                                                                           |
| "Put 'buy SIM cards' on the checklist"                  | `CHECKLIST[].items[]` (`id`, `t`, `sub`, `due`, `site`); the group is `shared: true` only if everyone ticks it once for all (bookings), never for passports or packing                                                                            |
| "Our budget is …" / "add the charter car"               | `BUDGET.rows`, `total`/`totalMin`/`totalMax`, `pool`; group figures as `"<sym>a–b / 五人"` (Chinese numerals up to ten) and `"<sym>a–b for N"`; the page adds each person's share                                                                 |
| "We change hotels on night 5"                           | `DAYS[i].hotel` from that night on (one hotel for the whole trip: `TRIP.hotel`)                                                                                                                                                                   |
| "We paid the flights" / "deposit paid, rest in cash"    | `BUDGET.rows`: a payment `{ label, min = max, cur: 'home' (if paid at home), paid: 'YYYY-MM-DD', via, ref? }`; a deposit and balance in `parts: [{ amt, paid?, via }]`; a planned extra with no price `tbd: true`                                 |
| "Add our travel insurance"                              | `INSURANCE.policies` (insurer, plan, who, from, to, covers, app, contacts with `tel` / `wa`) and `claims`; no ID numbers, addresses or birth dates (the contract refuses them)                                                                    |
| "Rename day 3" / "the day list reads too long"          | `DAYS[i].short`: `[zh, en]`, 2–8 characters for what the day is (its row in the week, Days, the rail and the map's list); `title` keeps the route. A new or changed day gets one too                                                              |
| "Find us more places to stay" / "add this hotel"        | a `table` block (one column per date range: total, availability, rating) and a `decide` block for choices that change the plan; availability checked for each exact range, shown beside the price, following [stays](../../../knowledge/stays.md) |
| "Our flight changed"                                    | `FLIGHTS.out` / `FLIGHTS.ret` (`no`, `dep`, `arr`, `date`); the airport evening (`FLIGHTS.ret.plan`) is worked back from take-off                                                                                                                 |
| "Train or van from the airport?"                        | `AIRPORT.methods` (each with its group price and effort), `AIRPORT.route`, the transit-card block                                                                                                                                                 |
| "Where should we eat near the night market?"            | `extra.json` `food[]` slots, linked from `DAYS[i].foodSlots` and `mealAt`; `data-sync` fills in food, drinks, rest spots and toilets near every stop                                                                                              |
| "Things we'd love to do some evening"                   | the wishlist (`wish-*.json`); days with `freeEvening: true` suggest them, and a free-time day (`freeFrom`) lists ideas                                                                                                                            |
| "What to wear / pack for the weather"                   | `WEATHER` (`lede`, `when`, `items`, `outfits`) and a day's `wear` line or `{ type: 'wear' }` block; `data-sync` adds the forecast                                                                                                                 |
| "Our home currency is …"                                | `TRIP.currency` (`sym`, `home`, `rate`, `rateNote`); the rate stays editable on the page                                                                                                                                                          |
| "Share our changes across phones"                       | not data: the `sync-setup` skill, then rebuild with `--sync`                                                                                                                                                                                      |
| "Can the page show …?" (something it can't yet)         | say so plainly; an engine change follows `memory-bank/standards/patterns/engine.md`, and a country's rules belong in a pack (`destination-pack`)                                                                                                  |

Text is `[zh, en]` (both UI languages, story step 4 makes them configurable). `**bold**` works in all text.

## During the trip

Much of what the group needs mid-trip is already on the page, no rebuild: pushing the rest of the day back, a flight
delay, adding a stop, ticking the checklist, the running-late check. Point them there first
([`guides/trip-page.md`](../../../guides/trip-page.md)). For a change to the plan itself, edit the data, then rebuild
and republish to the same link: phones get the update bar and keep their ticks and added stops.

## Check, every time

```sh
TRIP_DIR=trips/<slug> pnpm test            # the contract: places exist, ids unique and in order, pins inside the map
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json [--sync ~/.config/relaxjer/sync/<slug>.json]
```

Then `verify-page` on the changed days (pin the clock to them with `localStorage <storageKey>now`), and `data-sync` if
you added places that need positions, hours or nearby food. In Claude Code the read-only `data-curator` reviews the
changed data. Publishing the new copy is the planner's call (`publish-htmlapp`).

## Done when

- Every request is in the data, and you told the planner where each one shows on the page.
- `TRIP_DIR=trips/<slug> pnpm test` passes, the page builds, and `verify-page` ran on what changed.
- `fileName`, `storageKey`, the sync file and every existing id are unchanged on a published trip.
