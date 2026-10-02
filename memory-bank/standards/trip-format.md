---
created: 2026-09-30
updated: 2026-10-02
---

# Trip format

A trip is a folder (`trips/<slug>/`, or `examples/demo-trip/` for the committed example) holding `data.js`, the
`*.json` side files and `img/`. `pnpm test` checks it against the contract in `tests/support/trip-contract.mjs`
(`TRIP_DIR=trips/<slug> pnpm test`). This page covers the settings the engine reads; `examples/demo-trip/data.js` shows
every field in use.

## `TRIP`: the trip's own settings

| Field                   | Example                                                     | What it drives                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | `['台北示范行', 'Taipei demo trip']`                        | the trip's name in both UI languages; in English, the tab's title and the brush mark's spoken name                                                                                                    |
| `start`, `end`          | `'2027-03-13'`                                              | the header dates, the day list (must match `DAYS`)                                                                                                                                                    |
| `brand`                 | `'台北示范行'`                                              | brush lettering, the tab's title in Chinese, home-screen name, KML title                                                                                                                              |
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
| `addStopNote`           | `[zh, en]`                                                  | the note under "add a stop" (ignored on a page with group sync, which says the stop goes on everyone's page and who added it)                                                                         |
| `kml`                   | `{ optional, transport: [place ids] }`                      | Google My Maps export: the optional layer's name, the places on the hotel/transport layer                                                                                                             |
| `destination`, `region` | `'tw'`, `'taipei'`                                          | the destination pack (`destinations/tw/pack.mjs` + `regions/taipei/pack.mjs`): tax refund, lucky draw, metro name, taxi meter, bike share. Leave out for none                                         |
| `city`                  | `['台北', 'Taipei']`                                        | "not in Taipei yet"; defaults to the region pack's city                                                                                                                                               |
| `fileName`              | `'taipei-trip'`                                             | the build's file names: `<fileName>-standalone.html`, `<fileName>.html`, `<fileName>-mymaps.kml` (default `trip`)                                                                                     |
| `storageKey`            | `'tp5.'`                                                    | the prefix the page saves state under on the phone (checklist, added stops, language); default `rj.<start>.`. Keep a published page's prefix when you rebuild it, or its readers lose what they saved |
| `brushFont`             | `'Ma Shan Zheng'`                                           | the Google Fonts face for the brush lettering (brand, day wishes); the build puts its subset in the page                                                                                              |
| `hotelSlots`            | `['d1-hotel']`                                              | food slots that mean "near the hotel" (the breakfast `bk-hotel` and supper `sup-hotel` slots always do)                                                                                               |

Group figures are written in the data as `"NT$1,200–1,800 / 五人"` (zh) and `"NT$1,200–1,800 for 5"` (en), with the
trip's own currency symbol and group size; the page adds the per-person share. `**bold**` works in all text.

## Per day (`DAYS[i]`)

| Field                | What it drives                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `n`            | the day's anchor (`d1`…`dN`, in order) and its number                                                                                                                                       |
| `date`, `dow`        | `'2027-03-13'` and the weekday `['六', 'Sat']` (the zh one bare: the page adds 周); dates run on from `TRIP.start` with no gap                                                              |
| `c`                  | the day's lantern colour, `1`–`7`: its tab, its string of stops, its map pins                                                                                                               |
| `title`              | `[zh, en]`: the day's heading, also in the week list, the day bar, the Sections menu and search                                                                                             |
| `focus`, `lede`      | `[zh, en]`: the one line under the title in the week list; an optional paragraph under the day's heading                                                                                    |
| `wish`, `gloss`      | a short brushed Chinese wish for the day (`'平安到'`) and its gloss `['', 'Arrive safe']`                                                                                                   |
| `wear`, `budgetChip` | `[zh, en]` chips under the heading: what to wear, and the day's spend. The spend chip shows only when `budgetChip` is set; with a `budget` card it takes the card's figures and links to it |
| `photos`             | photo ids (`img/credits.json`) shown on the day                                                                                                                                             |
| `stepsTitle`         | `[zh, en]`: the timeline's heading, when "Schedule" doesn't fit (a free day's ideas)                                                                                                        |
| `schedule[]`         | the timeline. `fixed: true` never moves; `rel: { arr: [a, b] }` or `{ dep: [a, b] }` follows the flights (minutes from landing / from take-off; negative is before)                         |
| `blocks[]`           | the cards under the timeline (below)                                                                                                                                                        |
| `route`              | the day's route card: `[[from place, to place, 'transit' \| 'walking' \| 'driving' \| 'bicycling'], …]`                                                                                     |
| `mealAt`             | which stops are meals and which researched food slots (`extra.json`) suit them: `[[/stop name/, [[meal, [slot, …]]]], …]`; the pattern matches the stop's zh name                           |
| `tickets`            | ticket / booking cards for the day (ids from `extra.json` `tickets`)                                                                                                                        |
| `forecastSpot`       | the forecast spot for that day                                                                                                                                                              |
| `foodSlots`          | the researched food slots listed under the day ("Where to eat")                                                                                                                             |
| `freeEvening`        | `true`: wishlist items that fit "any evening" are suggested on this day                                                                                                                     |
| `freeFrom`           | `'13:00'`: this day has free time from then; it gets the free-time ideas list (one day at most; without one, the leave day gets it)                                                         |
| `split`              | part of the group takes its own plan for a few hours (below)                                                                                                                                |

### A day that splits (`DAYS[i].split`)

When one or some of the group do something else for part of a day (a ride, a visit), the plan hangs, folded, on the
day's string where it forks, and the stop where they come back says so
([ADR-20261001-day-split](decisions/ADR-20261001-day-split.md)). That stop reads `Rejoining here: <who> (<plans>)`, so
`who` can name one person or several. Its times are the plan's own: a push-back doesn't move them.
Which plan a phone shows is remembered on that phone and isn't synced.

| Field     | What it is                                                                                |
| --------- | ----------------------------------------------------------------------------------------- |
| `at`      | `'13:45'`: where it forks; it hangs after the last stop that starts by then               |
| `who`     | `[zh, en]`, for example `['一人', 'One of us']`; never a family relationship              |
| `h`       | `[zh, en]`: what they do instead                                                          |
| `sub`     | `[zh, en]`, optional: when it applies and what it skips                                   |
| `icon`    | optional sprite icon, `bike` by default                                                   |
| `go`      | the decision rows, `[{ k: 'go' \| 'wait' \| 'stop', name: [zh, en] }, …]`                 |
| `options` | 1–4 plans, the switch between them (one may be `default: true`); each plan's fields below |
| `lists`   | optional `[{ h: [zh, en], list: [[zh, en], …] }, …]`: the bike, what to carry             |
| `note`    | `[zh, en]`, optional: where the numbers come from (mark estimates "≈")                    |

A plan (`options[]`): `id`, `name: [zh, en]`, and `join: 'HH:MM'`, the start time of the stop where they come back
(after `at`). Everything else is optional and shows only when present:

- `km`, `ride` and `stops` (minutes), `leave` and `back` (`'HH:MM'`), and `fee: [zh, en]`;
- `start`, `end` and `alt` (a second place to return the bike): `{ name: [zh, en], lat, lng, yb }`, where `yb` is
  the bike-share station number, and the page shows its live bikes and docks when the plan opens;
- `via`: up to 3 `[lat, lng]` points for the directions link (Google Maps, by bike, from `start` to `end`);
- `line`: `[[lat, lng], …]`, the route drawn dashed in the day's colour on the map. Take it from a free router
  (OpenStreetMap bike routing), never from Google's;
- `rule: [zh, en]` (a turn-back time, a cut-off), `rows: [[[zh, en], [zh, en]], …]` (more key / value rows), and
  `place` (a `PLACES` key, for a plan that's a visit).

### A stop (`DAYS[i].schedule[]`)

| Field   | What it is                                                                                                                                                                                                                                                                 |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`     | `'HH:MM'`, `'~HH:MM–HH:MM'` (`~` reads "about"), or a `[zh, en]` label with no clock time ("Evening"). Planned times never run backwards (the contract checks it)                                                                                                          |
| `what`  | `[zh, en]`: the stop                                                                                                                                                                                                                                                       |
| `place` | a `PLACES` key: its map and directions links, and the food, drinks, rest spots and toilets near it                                                                                                                                                                         |
| `link`  | a `SITES` key, an in-page anchor (`'#airport'`) or a URL                                                                                                                                                                                                                   |
| `note`  | `[zh, en]`: the line under the stop                                                                                                                                                                                                                                        |
| `fixed` | `true`: booked or timed. It carries the red seal, a push-back stops at it, and the running-late check treats it as a deadline                                                                                                                                              |
| `rel`   | follows a flight: `arr` (minutes after landing) or `dep` (minutes from take-off, negative before: `[-425, -350]`) as `[start, end]`; `about: 1` writes "~"; `min` is the earliest start (minutes after midnight); `next: 1` adds "next day"; `from` labels a missing start |
| `shops` | `true`: the trip's shop box (`shops.json`) hangs under this stop                                                                                                                                                                                                           |
| `step`  | a step number shown instead of a clock time (with the day's `stepsTitle`), for a free day's ideas; a step is never pushed back                                                                                                                                             |

### Day cards (`DAYS[i].blocks[]`)

Each card is `{ type, h: [zh, en], icon, … }`. `places` (place keys) and `sites` (`SITES` keys) add link rows to most.

| `type`        | Shows                                                         | Fields                                                                        |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `text`        | paragraphs, an optional total with its per-person share       | `p: [[zh, en], …]`, `total: { amt, per, min, max }`, `link: [href, [zh, en]]` |
| `list`        | a bullet list                                                 | `list`, `note`                                                                |
| `kv`, `costs` | label / value rows (`costs` for prices)                       | `rows: [[[zh, en], [zh, en]], …]`, `note`                                     |
| `table`       | a table                                                       | `cols`, `rows`                                                                |
| `route`       | a line of stations or stops, with metro line colours          | `stops: [{ name, line, code, isLine }]`, `note`, `total`, `note2`, `plain`    |
| `decide`      | options A / B to pick on the day, each with its cost and rule | `opts: [{ k, mark, name, cost, when, list, place }]`                          |
| `weather`     | go / wait / stop rows for a weather-dependent plan            | `opts: [{ k: 'go' \| 'wait' \| 'stop', name, list, body }]`, `flow`           |
| `wear`        | what to wear and bring                                        | `main`, `bring`, `note`                                                       |
| `budget`      | the day's costs, each with its share, and a total             | `rows: [[[zh, en], amount, …]]`, `total`, `min`, `max`, `est`, `note`         |
| `rain`        | the rain plan                                                 | `list`, or `groups: [{ h, list }]`                                            |
| `checklist`   | ticks kept on the phone                                       | `id`, `items: [[zh, en], …]`                                                  |
| `groups`      | two side-by-side lists                                        | `groups: [{ h, list }]`, `note`                                               |

Days can be any number, ids `d1`…`dN` in order. The engine reads each day's role from the data (`Plan.dayRoles`):
the first day is the arrival; the day the group leaves for the airport is the evening before an after-midnight
take-off, else the flight's own day; a day after it that holds only the early take-off takes no added stops.

## Places, sites and the airport section

The engine looks up no place or site by a fixed name, with one exception still in the engine: keep a `hotel` key,
because the Overview's hotel fact and the route card's "back to the hotel" read `PLACES.hotel`. The hotel is
`PLACES[TRIP.hotel]` (default `'hotel'`), or one per night (`DAYS[i].hotel`); every
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

### A place (`PLACES[key]`)

| Field            | What it drives                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `name`           | `[zh, en]`                                                                                                            |
| `maps`           | the text a map or directions link searches for                                                                        |
| `trad`           | the destination's own spelling (Traditional Chinese in Taiwan): search, and the "show the driver" card                |
| `addr`, `addrEn` | the address in the local language and in English (the driver card, the hotel fact)                                    |
| `tel`, `note`    | the phone number (the driver card), and a note (`[zh, en]`)                                                           |
| `site`           | the place's own website                                                                                               |
| `gpid`           | a hand-checked Google place id, pinned so the data refresh can't swap it for a neighbour                              |
| `gname`          | the name Google Maps still lists, when the place renamed: the hotel fact warns that a search for the new one misleads |

Positions and hours aren't written here: the data refresh puts them in `geo.json` (`data-sync`).

## The overview, money, weather, flights and entry

| Block          | Fields                                                                                                                                                                 | What it drives                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITES`        | `{ key: { name: [zh, en], url } }`                                                                                                                                     | every outside link the data names by key                                                                                                       |
| `FACTS`        | `[{ k, v, place }]`                                                                                                                                                    | the Overview's trip facts; `place` adds that place's links, with the first night's hotel address and `PLACES.hotel`'s note, phone and old name |
| `BACKUPS`      | `[[zh, en], …]`                                                                                                                                                        | the Overview's fallback chips (rain, tired, an optional sight)                                                                                 |
| `PRIORITIES`   | `{ must, should, mood }`                                                                                                                                               | the Rules section's must / should / mood lists                                                                                                 |
| `PRINCIPLE`    | `{ wish, p }`                                                                                                                                                          | the trip's brushed motto and its rules                                                                                                         |
| `BUDGET`       | `excludes`, `rows: [[label, text, min, max, anchor?]]`, `total`, `totalMin`, `totalMax`, `split`, `suggest`, `pool`, `poolText`, `airportNote`, `chartNote`            | the Budget section: the chart (estimates dashed), each row's share, the group pot                                                              |
| `MONEY`        | `cash: { amt, uses }`, `card`, `transitCard`                                                                                                                           | the cash-and-cards block                                                                                                                       |
| `TAX`          | `h`, `list`, `shops`, `note`                                                                                                                                           | the tourist tax refund card (the minimum spend comes from the pack)                                                                            |
| `WEATHER`      | `sites`, `lede`, `when: [{ d, t, v }]`, `items`, `outfits: [{ h, main, note, day }]`                                                                                   | the Weather section; the forecast itself comes from `forecast.json`                                                                            |
| `FLIGHTS`      | `out` and `ret`: `no`, `dep`, `arr`, `date`, `ret.plan` (below); `from`, `to` and `dur` are notes the page doesn't show                                                | the delay editor, the flight-tied times, the day roles                                                                                         |
| `ENTRY`        | `sites`, `sources`, `rules: [{ h, p, site }]`, `lucky: { sites, name, period, deadline, who, how, unsure }`                                                            | the Entry section; `lucky` is a visitor programme (Taiwan's lucky draw, with the pack's calculator)                                            |
| `ENTRY_CHECKS` | a checklist group (`id: 'entry'`, `h`, `items`); the countdown reads that id                                                                                           | the entry ticks (arrival card, registrations), with due dates                                                                                  |
| `AIRPORT`      | `terminals`, `sites`, `departSites`, `route`, `routeTitle`, `routeAlt`, `lede`, `facts`, `rule`, `steps`, `depart`, `methods`, `transitCard*`, `mrtFare`, `sourceNote` | the Airport section (the table above holds the place links)                                                                                    |

`AIRPORT.methods[]` are the ways to the hotel, compared for the whole group and picked on the day: `id`, `pick` (the
recommended one), `icon`, `short`, `name`, `sub`, `min` / `max` (group cost, for the chart), `cost`, `per`, `time`,
`xfer`, `bags`, `list`, `when`, and `ticket`.

## Side files

Beside `data.js`; most are written by the data refresh (`data-sync`), and the build reads each one only if it's there.
A food slot or a wishlist branch in them can carry `hours_lock: true` to keep its own hours over Google's. Builds
also read the `SHARE_URL` environment variable: the live page's address, for Copy link and share links.

| File                          | Holds                                                                                                                                                                                                             | Written by                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `geo.json`                    | each place's Google id, position, hours, closed dates and nearest station; route legs (walking and transit times); the map's bbox                                                                                 | `data-sync`                                                                         |
| `extra.json`                  | `food[]` (researched food slots: `slot`, name, position, hours), `tickets[]` (booking cards), `sites`                                                                                                             | by hand or `data-sync`                                                              |
| `drinks.json`, `toilets.json` | drinks and rest spots near each stop; toilets, and places that let you borrow one                                                                                                                                 | `data-sync`                                                                         |
| `shops.json`                  | the shop box (supermarkets, pharmacies) with the tax-refund tag                                                                                                                                                   | `data-sync`                                                                         |
| `transit.json`, `mrt.json`    | bike-share stations and bus stops; the metro network for the offline transit planner                                                                                                                              | the region's steps                                                                  |
| `forecast.json`               | the weather forecast for the trip's spots (days within 16 days)                                                                                                                                                   | `data-sync`                                                                         |
| `wish-a.json`, `wish-b.json`  | the wishlist: `items[]`, each with `branches[]` (position, hours, closed dates, rating) and `fits[]` (the days it suits); an item without a branch is dropped                                                     | by hand, then `data-sync`                                                           |
| `img/` + `img/credits.json`   | photos (`<id>.webp`, a square `<id>-sq.webp`, lighter copies in `img/lite/`) and their credits; the home-screen icon in `img/icon/` (`icon-192.png`, `icon-512.png`, `icon-180.png`, `icon-32.png`)               | by hand ([`pipeline/README.md`](../../pipeline/README.md#photos-and-icons-by-hand)) |
| `pipeline.json`               | what the refresh searches for: `steps`, `google`, `area`, `chains`, `pin_queries`, `stations`, `no_hours`, `areas`, `skip_nearby`, `shops`, `forecast_spots` ([every key](../../pipeline/README.md#pipelinejson)) | by hand (`trip-intake`)                                                             |
| `requirements.md`             | the planner's own words; never read by the build                                                                                                                                                                  | the planner                                                                         |
| `never-publish.txt`           | literals the release gate must refuse (a nickname, a booking code, part of a name), one per line                                                                                                                  | the planner                                                                         |

## Optional plans (`OPTIONAL`)

Sights and ideas that are never scheduled: the Optional section's cards, decided on the day.

| Field                          | What it drives                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | the card's anchor (`#opt-101`); unique, letters, digits and dashes                                                                                                                                    |
| `place`, `photo`               | its place (address, hours, nearest station and map links from `geo.json`) and photo                                                                                                                   |
| `name`, `meta`, `when`, `list` | its name, the line under it, and the "go when" rules                                                                                                                                                  |
| `cost`, `note`                 | the cost line and a note                                                                                                                                                                              |
| `near`                         | `[{ day, place }]`: the stops it suits. Each gets a "Nearby options" chip with the distance, and a tap opens the card in a sheet over the day. Left out on a day its place is closed (`closed_dates`) |
| `short`                        | `[zh, en]`: a shorter name for that chip (default `name`)                                                                                                                                             |
| `ticket`, `food`               | an `extra.json` ticket card on it; `{ slots, h }`: a food block after the cards                                                                                                                       |

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

## Checklist (`CHECKLIST`)

The "Before we go" lists, as many groups as the trip wants:

| Field     | What it drives                                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | the group's tick keys, `<id>-<item id>`; lower case, unique, and no group's id followed by a dash may start another's (the contract checks it)                                                                                   |
| `h`       | its heading                                                                                                                                                                                                                      |
| `items[]` | `{ id, t, sub, due, site, link }`: each tick's id, text, note, date it's due by, and a site or in-page link                                                                                                                      |
| `shared`  | `true`: on a page with group sync ([ADR-20261001-group-sync](./decisions/ADR-20261001-group-sync.md)), this group's ticks reach everyone's phone. Leave it off for anything each person does for themselves (passports, packing) |

## The airport evening (`FLIGHTS.ret.plan`)

The leave day's timeline, worked back from take-off (and recomputed when someone types a delay):

| Field                      | Example                                        | What it drives                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `back`, `leave`, `airport` | `350`, `305`, `230`                            | the plan, in minutes before take-off: back at the hotel for the bags, leave, at the airport                                                                                                                  |
| `latest`, `road`           | `180`, `75`                                    | the latest arrival at the airport and the longest road there: the "leave by" warning                                                                                                                         |
| `route`                    | `[zh, en]`                                     | one line under the flight ("Taoyuan T1 → Kuala Lumpur. Boarding time is …")                                                                                                                                  |
| `steps`                    | `[{ at: ['13:00', 440], what: [zh, en], by }]` | the lines: `at` holds one or two times, each `'HH:MM'` or minutes before take-off; `by: true` prefixes "By"; in `what`, `{latest}` is the latest time to leave and `{-N}` the time N minutes before take-off |

The take-off line and its date ("Take-off (19th)") are added by the engine.

Also read: `BUDGET.airportNote` and `BUDGET.chartNote`, and `AIRPORT.mrtFare`.

## Still fixed in the engine

[`../story-index.md`](../story-index.md) lists what is left ("Engine debt").
