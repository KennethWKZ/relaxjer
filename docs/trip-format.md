# Trip format

A trip is a folder (`trips/<slug>/`, or `examples/demo-trip/` for the committed example) holding `data.js`, the
`*.json` side files and `img/`. `pnpm test` checks it against the contract in `tests/support/trip-contract.mjs`
(`TRIP_DIR=trips/<slug> pnpm test`). This page covers the settings the engine reads; `examples/demo-trip/data.js` shows
every field in use.

## `TRIP`: the trip's own settings

| Field | Example | What it drives |
|---|---|---|
| `name` | `['台北示范行', 'Taipei demo trip']` | the trip's name in both UI languages |
| `start`, `end` | `'2027-03-13'` | the header dates, the day list (must match `DAYS`) |
| `brand` | `'台北示范行'` | brush lettering, page title, home-screen name, KML title |
| `description` | one line | the page's meta description |
| `pax` | `5` | group size: every "for 5" / "/ 五人" figure also shows a share each |
| `tz` | `'Asia/Taipei'` | the destination's clock ("now", today's plan), whatever the phone says |
| `currency` | `{ sym: 'NT$', home: 'RM', rate: 7.8, rateNote: [zh, en] }` | money figures and the home-currency line; the rate is editable on the page |
| `checked` | `'2027-03-01'` | "hours and prices checked on …" notes |
| `arriveCity` | `['桃园', 'Taoyuan']` | the before-the-trip line ("Fly to Taoyuan on Sat 13 Mar") |
| `forecastSpot` | `'taipei'` | which `forecast.json` spot a day reads unless it names its own |
| `searchHint`, `footer` | `[zh, en]` | the search box placeholder, the page footer |
| `mapViews` | `[{ id, name: [zh, en], bbox: [w, s, e, n] }]` | the map's area buttons; the map opens on the first |
| `shopDays` | `[{ ok, zh, en }]` | "which days suit shopping" notes; `{d3}` becomes Day 3's date, `{back}` the time to collect bags on the last day |
| `addStopNote` | `[zh, en]` | the note under "add a stop" |
| `kml` | `{ optional, transport: [place ids] }` | Google My Maps export: the optional layer's name, the places on the hotel/transport layer |
| `hotelSlots` | `['d1-hotel']` | food slots that mean "near the hotel" (the breakfast `bk-hotel` and supper `sup-hotel` slots always do) |

Group figures are written in the data as `"NT$1,200–1,800 / 五人"` (zh) and `"NT$1,200–1,800 for 5"` (en), with the
trip's own currency symbol and group size; the page adds the per-person share. `**bold**` works in all text.

## Per day (`DAYS[i]`)

| Field | What it drives |
|---|---|
| `schedule[]` | the timeline. `fixed: true` never moves; `rel: { arr: [a, b] }` or `{ dep: [a, b] }` follows the flights (minutes after landing / before take-off) |
| `route` | the day's route card: `[[from place, to place, 'transit' \| 'walking' \| 'driving' \| 'bicycling'], …]` |
| `mealAt` | which stops are meals and which researched food slots (`extra.json`) suit them: `[[/stop name/, [[meal, [slot, …]]]], …]` |
| `tickets` | ticket / booking cards for the day (ids from `extra.json` `tickets`) |
| `forecastSpot` | the forecast spot for that day |
| `foodSlots` | the researched food slots listed under the day ("Where to eat") |
| `freeEvening` | `true`: wishlist items that fit "any evening" are suggested on this day |
| `freeFrom` | `'13:00'`: this day has free time from then; it gets the free-time ideas list (one day at most) |

Days can be any number, ids `d1`…`dN` in order. The engine reads each day's role from the data (`Plan.dayRoles`):
the first day is the arrival; the day the group leaves for the airport is the evening before an after-midnight
take-off, else the flight's own day; a day after it that holds only the early take-off gets no tab and no added stops.

## The airport evening (`FLIGHTS.ret.plan`)

The leave day's timeline, worked back from take-off (and recomputed when someone types a delay):

| Field | Example | What it drives |
|---|---|---|
| `back`, `leave`, `airport` | `350`, `305`, `230` | the plan, in minutes before take-off: back at the hotel for the bags, leave, at the airport |
| `latest`, `road` | `180`, `75` | the latest arrival at the airport and the longest road there: the "leave by" warning |
| `route` | `[zh, en]` | one line under the flight ("Taoyuan T1 → Kuala Lumpur. Boarding time is …") |
| `steps` | `[{ at: ['13:00', 440], what: [zh, en], by }]` | the lines: `at` holds one or two times, each `'HH:MM'` or minutes before take-off; `by: true` prefixes "By"; in `what`, `{latest}` is the latest time to leave and `{-N}` the time N minutes before take-off |

The take-off line and its date ("Take-off (19th)") are added by the engine.

Also read: `OPTIONAL[i].ticket` and `OPTIONAL[i].food: { slots, h }`, `BUDGET.airportNote` and `BUDGET.chartNote`,
and `AIRPORT.mrtFare`.

## Still fixed in the engine

The place ids `hotel`, `tpe1` and `tpe2` are fixed. The Taiwan-only features (the tax refund, the lucky draw, the
Taipei taxi meter, YouBike) move into the `tw` destination pack; `docs/roadmap.md` lists what is left.
