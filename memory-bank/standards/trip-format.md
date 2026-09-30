---
created: 2026-09-30
updated: 2026-10-01
---

# Trip format

A trip is a folder (`trips/<slug>/`, or `examples/demo-trip/` for the committed example) holding `data.js`, the
`*.json` side files and `img/`. `pnpm test` checks it against the contract in `tests/support/trip-contract.mjs`
(`TRIP_DIR=trips/<slug> pnpm test`). This page covers the settings the engine reads; `examples/demo-trip/data.js` shows
every field in use.

## `TRIP`: the trip's own settings

| Field                   | Example                                                     | What it drives                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | `['台北示范行', 'Taipei demo trip']`                        | the trip's name in both UI languages                                                                                                                                                                  |
| `start`, `end`          | `'2027-03-13'`                                              | the header dates, the day list (must match `DAYS`)                                                                                                                                                    |
| `brand`                 | `'台北示范行'`                                              | brush lettering, page title, home-screen name, KML title                                                                                                                                              |
| `description`           | one line                                                    | the page's meta description                                                                                                                                                                           |
| `pax`                   | `5`                                                         | group size: every "for 5" / "/ 五人" figure also shows a share each                                                                                                                                   |
| `tz`                    | `'Asia/Taipei'`                                             | the destination's clock ("now", today's plan), whatever the phone says                                                                                                                                |
| `currency`              | `{ sym: 'NT$', home: 'RM', rate: 7.8, rateNote: [zh, en] }` | money figures and the home-currency line; the rate is editable on the page                                                                                                                            |
| `checked`               | `'2027-03-01'`                                              | "hours and prices checked on …" notes                                                                                                                                                                 |
| `arriveCity`            | `['桃园', 'Taoyuan']`                                       | the before-the-trip line ("Fly to Taoyuan on Sat 13 Mar")                                                                                                                                             |
| `forecastSpot`          | `'taipei'`                                                  | which `forecast.json` spot a day reads unless it names its own                                                                                                                                        |
| `searchHint`, `footer`  | `[zh, en]`                                                  | the search box placeholder, the page footer                                                                                                                                                           |
| `mapViews`              | `[{ id, name: [zh, en], bbox: [w, s, e, n] }]`              | the map's area buttons; the map opens on the first                                                                                                                                                    |
| `shopDays`              | `[{ ok, zh, en }]`                                          | "which days suit shopping" notes; `{d3}` becomes Day 3's date, `{back}` the time to collect bags on the last day                                                                                      |
| `addStopNote`           | `[zh, en]`                                                  | the note under "add a stop"                                                                                                                                                                           |
| `kml`                   | `{ optional, transport: [place ids] }`                      | Google My Maps export: the optional layer's name, the places on the hotel/transport layer                                                                                                             |
| `destination`, `region` | `'tw'`, `'taipei'`                                          | the destination pack (`destinations/tw/pack.mjs` + `regions/taipei/pack.mjs`): tax refund, lucky draw, metro name, taxi meter, bike share. Leave out for none                                         |
| `city`                  | `['台北', 'Taipei']`                                        | "not in Taipei yet"; defaults to the region pack's city                                                                                                                                               |
| `fileName`              | `'taipei-trip'`                                             | the build's file names: `<fileName>-standalone.html`, `<fileName>.html`, `<fileName>-mymaps.kml` (default `trip`)                                                                                     |
| `storageKey`            | `'tp5.'`                                                    | the prefix the page saves state under on the phone (checklist, added stops, language); default `rj.<start>.`. Keep a published page's prefix when you rebuild it, or its readers lose what they saved |
| `brushFont`             | `'Ma Shan Zheng'`                                           | the Google Fonts face for the brush lettering (brand, day wishes)                                                                                                                                     |
| `hotelSlots`            | `['d1-hotel']`                                              | food slots that mean "near the hotel" (the breakfast `bk-hotel` and supper `sup-hotel` slots always do)                                                                                               |

Group figures are written in the data as `"NT$1,200–1,800 / 五人"` (zh) and `"NT$1,200–1,800 for 5"` (en), with the
trip's own currency symbol and group size; the page adds the per-person share. `**bold**` works in all text.

## Per day (`DAYS[i]`)

| Field          | What it drives                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schedule[]`   | the timeline. `fixed: true` never moves; `rel: { arr: [a, b] }` or `{ dep: [a, b] }` follows the flights (minutes after landing / before take-off) |
| `route`        | the day's route card: `[[from place, to place, 'transit' \| 'walking' \| 'driving' \| 'bicycling'], …]`                                            |
| `mealAt`       | which stops are meals and which researched food slots (`extra.json`) suit them: `[[/stop name/, [[meal, [slot, …]]]], …]`                          |
| `tickets`      | ticket / booking cards for the day (ids from `extra.json` `tickets`)                                                                               |
| `forecastSpot` | the forecast spot for that day                                                                                                                     |
| `foodSlots`    | the researched food slots listed under the day ("Where to eat")                                                                                    |
| `freeEvening`  | `true`: wishlist items that fit "any evening" are suggested on this day                                                                            |
| `freeFrom`     | `'13:00'`: this day has free time from then; it gets the free-time ideas list (one day at most)                                                    |

Days can be any number, ids `d1`…`dN` in order. The engine reads each day's role from the data (`Plan.dayRoles`):
the first day is the arrival; the day the group leaves for the airport is the evening before an after-midnight
take-off, else the flight's own day; a day after it that holds only the early take-off takes no added stops.

## Places, sites and the airport section

The engine looks up no place or site by a fixed name. The hotel is `PLACES[TRIP.hotel]` (default `'hotel'`), or one
per night (`DAYS[i].hotel`); every
other place or site is named by the data that uses it, and the contract checks that each one exists.

| Field                                                         | Example                                              | What it drives                                                                                                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRIP.hotel`                                                  | `'hotel'`                                            | the hotel's place id when one hotel serves the whole trip                                                                                                                  |
| `DAYS[i].hotel`                                               | `'onsen'`                                            | a trip with several hotels: the hotel from that night on (a day without one keeps the night before's). The airport evening uses the last night's hotel, where the bags are |
| `AIRPORT.terminals`                                           | `[{ place: 'tpe1', code: 'T1' }, …]`                 | the arrival and going-home route links; the first is where the group lands and leaves                                                                                      |
| `AIRPORT.sites`, `AIRPORT.departSites`                        | `['tymetro']`, `[{ site: 'uber', label: [zh, en] }]` | site links under the arrival steps and the going-home links                                                                                                                |
| `AIRPORT.route`, `routeTitle`, `routeAlt`                     |                                                      | the rail diagram from the airport, its heading and its accessible title                                                                                                    |
| `AIRPORT.transitCard`, `transitCardSite`, `transitCardTicket` | list, `'easycard'`, `'easycard-buy'`                 | the transit-card block (its name comes from the region pack, `Pack.transitCard`)                                                                                           |
| `AIRPORT.methods[].ticket`                                    | `'airport-transfer-booking'`                         | an `extra.json` ticket card shown with that way to the hotel                                                                                                               |
| `MONEY.transitCard`                                           | `[zh, en]`                                           | the transit card in the budget's cash-and-cards block                                                                                                                      |
| `WEATHER.sites`, `ENTRY.sites`, `ENTRY.lucky.sites`           | `['cwa', 'cwaEn']`                                   | site links under the forecast, the entry rules and the lucky draw                                                                                                          |
| `ENTRY.sources`                                               | `[zh, en]`                                           | "Sources: …" under the entry rules                                                                                                                                         |

## Shop lists (`SHOPLISTS`)

Themed shop lists for the Optional section, as many as the trip wants (snowboard gear, tea, anime, pharmacies…):

| Field                                 | What it drives                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `id`                                  | the list's anchor (`#snow`) and its checklist keys; lower case, unique                             |
| `h`, `group`, `kind`, `icon`, `photo` | its heading, its group in the free-time ideas, its map pin label, icon and photo (default "Shops") |
| `lede`, `lede2`                       | the lines under the heading                                                                        |
| `shops[]`                             | `{ place, name, area, rank, when, list, day }`: each shop's place id, labels, and the day it fits  |
| `rule`, `checks`, `close`             | an optional "before going in, check" block                                                         |

The older single-list form, `const SNOW = { … }`, still works: it becomes the list with id `snow`.

## The airport evening (`FLIGHTS.ret.plan`)

The leave day's timeline, worked back from take-off (and recomputed when someone types a delay):

| Field                      | Example                                        | What it drives                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `back`, `leave`, `airport` | `350`, `305`, `230`                            | the plan, in minutes before take-off: back at the hotel for the bags, leave, at the airport                                                                                                                  |
| `latest`, `road`           | `180`, `75`                                    | the latest arrival at the airport and the longest road there: the "leave by" warning                                                                                                                         |
| `route`                    | `[zh, en]`                                     | one line under the flight ("Taoyuan T1 → Kuala Lumpur. Boarding time is …")                                                                                                                                  |
| `steps`                    | `[{ at: ['13:00', 440], what: [zh, en], by }]` | the lines: `at` holds one or two times, each `'HH:MM'` or minutes before take-off; `by: true` prefixes "By"; in `what`, `{latest}` is the latest time to leave and `{-N}` the time N minutes before take-off |

The take-off line and its date ("Take-off (19th)") are added by the engine.

Also read: `OPTIONAL[i].ticket` and `OPTIONAL[i].food: { slots, h }`, `BUDGET.airportNote` and `BUDGET.chartNote`,
and `AIRPORT.mrtFare`.

## Still fixed in the engine

[`../story-index.md`](../story-index.md) lists what is left ("Engine debt").
