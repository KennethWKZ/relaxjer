# Your trip page, part by part

What the group gets: one page for the whole trip, on every phone, working offline. This guide walks through each part
of it, for the planner who'll explain it to the group and for anyone in the group who wants to know what a button does.
The last section says what turns each part on, so a planner (or their agent) knows what to put in the trip.

The examples come from the synthetic demo trip (`pnpm build --trip examples/demo-trip`): five people, a week in Taipei,
two of them seniors.

## Opening it

- **One link, one password.** The planner sends both to the group chat. The password page remembers you for a day,
  so pick one the seniors can type.
- **Add it to the home screen.** The Install button in the header uses Android's own prompt; on an iPhone it shows the
  steps (Share → Add to Home Screen) and what to know: the home-screen copy keeps its own ticks and settings, location
  should be set to Allow for it, the password is asked again every day, and it can't start offline: open it once
  online, then it keeps working when the signal goes.
- **It works offline.** The plan, the costs and the lists live inside the page. A bar says when you're offline ("plans
  and lists work; the map, Google and live bikes wait; don't reload").
- **It keeps the destination's clock.** "Now", "today" and the running-late check use the trip's time zone, whatever
  the phone says. Now and Next refresh every minute and whenever you come back to the page.
- **New version?** When the planner republishes, a bar offers the update (checked when you come back or get online, at
  most every 10 minutes, never offline). Ticks, added stops, the language, the theme and the rate you set are kept.

## Finding your way

- **The header** stays on screen: the trip's name (in brush lettering) and dates, Search, the theme button (light,
  dark, or follow the phone, with a toast saying which), the language button (it names the other language, and keeps
  your place; the browser tab's title switches with it, and in English the brush name is read out and shown on
  hover by the trip's English name), and Install.
- **The day strip** under it: Overview, one tab per day (date, weekday, a dot on today, in the day's lantern colour),
  then Map, Airport, Entry, Optional, Wishlist, Food, Budget, Weather, Checklist and Priorities. The lit tab follows
  your scroll, and the edges fade
  when there are more tabs to swipe to.
- **A day bar** slides in under the header once a day's heading scrolls away: Day N, the date, the title.
- **The Sections menu** (the round button that appears after the first screen): on a trip day it opens on Now and
  Next (before the trip, a countdown), then Food and Toilets nearby, every day, every section, back to the top, the
  theme, the Group sync row, and Install.
- **Jumps land instantly** (nearby ones scroll) and ring where they landed. A **Back pill** then takes you to where
  you were reading, and the phone's own Back closes an open sheet, dialog or full-screen map before it leaves the page.
- **Search** (the magnifier) finds any stop, place, note or list item across the whole plan, grouped by section with
  today first. It finds names in the language that isn't on screen, and a Traditional character finds its Simplified
  form (臺 finds 台). Matches are highlighted on the page, with previous / next and a count; Enter jumps to the first,
  Esc closes. A jump lands the match just under the header and lights its section's tab.
- **Links:** every section, day and card has its own address (`#d3`, `#airport`, `#opt-101`), so a link in the group
  chat opens right there. A food, drink, wishlist or optional card opens in a sheet over the page, with "Show in the
  list".
- **Typing in a sheet** (a stop's name or time, your name, the planner code): the sheet moves up to sit on the phone's
  keyboard, and the field you're typing in stays in view.
- **Copying** falls back to a "long-press to select all" box where the phone blocks the clipboard.

## The Overview, and Now and Next

- **Before the trip:** "N days to go", the flight, the first night's hotel, up to three to-dos coming due (entry
  registrations, the week-before weather check), and buttons to the checklist and Day 1.
- **On a trip day:** the day's badge and wish, what's on now and what's next (each a link to its stop), "Go to the next
  stop" with Google directions, "Open today", and "Check progress from my location". While a day's split is on, an
  "Apart" row says who went where and when the group meets again, linking to the split.
- **After the trip:** "Trip done. Welcome home."
- **The week:** one lantern row per day with its date, title and focus.
- **Trip facts:** the dates, the group, the hotel with its address in both languages, phone and links. If Google still
  lists the hotel under an old name, a note says so.
- **Backups if we have time:** the rain or tired-day options and optional sights, as chips.

## Each day

- **The heading:** Day N and the date (with Today), the day's brushed wish (and its gloss in English), the title, and
  chips for the forecast (temperature, rain chance), the focus, the day's spend (each person's share, the group total
  and the home currency, linking to the day's budget) and what to wear.
- **Today's route:** one navigation button per leg (walk, metro, taxi, bike) with its minutes and lines, and a "whole
  route" drive link.
- **Copy for chat** puts the day as text (times, notes, each person's budget, the rain plan, the link) on the
  clipboard; **Copy link** copies the day's address; **Map** opens the map full screen on that day.
- **The timeline:** each stop with its time and a note. A stop with a place has Map, Directions, the website and
  Details, a photo where there is one, and, under it, the food, drinks, rest spots and toilets near it. A **fixed
  time** (a flight, a show, a booked table) carries a red 定 seal. On a trip day the stops on now and next are tagged,
  past ones dim, and two or more done stops fold into "N done" (Hide done folds them again). A free day can number its
  steps instead of giving times.
- **Cards under the timeline**, as the plan needs them: option A or B to decide on the day (each with its cost and when
  to pick it), go / wait / stop rules for a weather-dependent plan (with a "should we ride?" flowchart), a route of
  stations in their line colours, tables and lists, the day's budget with each person's share, what to wear, the rain
  plan, ticks for the day, and two-column lists.
- **Tickets and how to book:** folded cards with the steps, the price, the hours and the official link, marked when
  some details are unconfirmed.
- **Where to eat:** researched places for the day's meals (the dish, closed dates, the rating), each opening its card,
  and **Also nearby:** wishlist places that fit the day, must-dos first.
- **Photos** with their caption and credit.

## Fixed times and running late

- **Push the rest of the day back.** "Running late? Push the rest back" opens a sheet: from which stop, and by how
  long (15–90 minutes). Flexible stops move; fixed ones hold, and the push stops at the next fixed time. A banner then
  says what moved ("+30 min from … until …", or "to the end of the day", each moved stop showing "was HH:MM"), warns if
  a stop now runs into a fixed time ("shorten or skip"), and offers Adjust or Back to the planned times. On a day that
  splits, the fork and the rejoin move with the stops; the times inside each plan (pick-up, return by) stay as planned.
  Nothing after "leave for the airport" can be pushed. With group sync, a push reaches every phone.
- **The running-late check.** With the phone's location, the page sees when you're 15 minutes or more behind the plan
  near a stop and offers "Push back N min" or No thanks (after No thanks it asks again only when you fall 20 minutes
  further behind). It never moves anything by itself. If a fixed time is about to
  be missed, it says "Hurry for 19:10 …" and suggests a taxi now, with directions.
- **A flight delay.** On the landing day and the going-home day, "Flight delayed? Change the time" takes the new time:
  the flight-tied times and the airport evening are recalculated, and "Back to HH:MM" (the booked time) undoes it. A landing at 21:00 or
  later points to the airport's late-arrival rule.

## Your own stops

- **Add a stop** from the day's "Add a stop" button, or from the "+" under a stop on the day's string: it lands right
  after that stop, at a time that fits. There's no "+" where nothing can go (under the closing "back to the hotel" row,
  the flight home, or a stop the next one starts with), and none on a day that holds only the early flight home.
- **Find it:** search the page's places, all or one of six categories, sorted nearest to the stop before or top
  rated; the first 25 show. A place closed that day is flagged and listed last, and shops with a tax refund are tagged. With Google, search
  Google for more. A ＋ on any food, drink, wishlist, map or idea card adds that place too.
- **The time:** a suggestion to start from (the next full hour today, an hour into the free time, noon, or the gap
  after the "+" stop), in 15-minute steps.
- **Getting there:** the sheet works out the trip from the stop before (or from where you are, for the next few hours
  today): the distance, and minutes walking (counted ×1.4 for seniors), by taxi (hailing one included, the same
  minutes the added stop shows later) and by metro. A time too early to get there says so and offers "Use HH:MM",
  only while that time still fits before the next stop and, on the leaving day, before the group must leave; the
  suggested time moves to it by itself the same way. A time already past today says so. It also says when to leave
  for the next timed stop, or warns that it can't be made.
- **It checks the rest:** the going-home deadline on the leaving day ("leave here by HH:MM, bags at …", shown even next
  to a fixed-time note), a clash with a fixed time, and, on
  a day that already has four added stops, a word before one more.
- **On the day:** an added stop shows "Added" (or "Added by …" with group sync), its address, any warning, the distance
  and walk or taxi time from the stop before, Change and Remove, and the drinks, rest spots and toilets near it. It
  appears on the map too, with Change on its card.
- **Undo.** Removing a stop asks first, then shows Undo on the toast for 8 seconds.
- **Share without sync.** "Share my added stops" makes a link; opening it on another phone offers "N shared stops →
  Add to my plan", skipping ones it already has.
- **Back to the original plan** clears added stops, flight changes and push-backs (ticks stay), after asking, with
  Undo. With group sync it's a planner's button.

## A day that splits

When part of the group goes its own way for an afternoon (a bike ride, a visit), the day forks at a dashed knot on its
string, saying what they do and who goes. Folded under it, "Plans and rules": the go / wait / skip rows, a switch
between the plans (short or long), and each plan's distance, ride and stop minutes, where to pick up and return the
bike (with live bikes and free docks when it opens, and "full? return at …"), the time back, the fee and the turn-back
time. A route opens the map full screen, drawn dashed in the day's colour, and Directions opens bike directions. The
stop where they come back says "Rejoining here: who (which plan)". Each phone remembers which plan it shows. The split
itself is the planner's: it's in the trip's data, and nobody makes one on the page.

## Optional plans, shop lists and the wishlist

- **Optional plans** are sights and ideas that never go on the schedule. Each card has a photo, when it's worth going,
  what to know, the cost (and each person's share), the address, hours, nearest station, links and any ticket, with a
  food list after the cards. Where one suits a stop, a "Nearby options" chip with the distance opens its card over the
  day; it's left out on a day the place is closed.
- **Shop lists** (tea, pharmacies, gear…): each list has its own heading in Optional, with its shops ranked (area,
  when to go, hours and phone where the trip has them, the day it fits), a "before going in, check" box with ticks, a
  group in the free-time ideas, and its pins on the map.
- **The wishlist:** the group's would-love-to places, grouped by the day they fit, near the hotel any evening, needing
  their own trip, or other. Each card shows its kind, a Must badge, what to order and the price, the rating and its
  source, the days it fits, branches, nearest station, hours ("Google differs: trust Google"), whether it has a toilet,
  and Add. Places reported closed or moved are flagged and left out of suggestions; a paused one is flagged. Under
  each stop,
  "Nearby" chips name wishlist shops and sights within 700 m, and wishlist food within 1.2 km at meal stops.
- **The free-time day** lists ideas (the wishlist, optional sights, each shop list) with ＋, and notes which days suit
  carrying shopping bags.
- **The shop box** under the free-shopping stop lists the trip's first four supermarkets and pharmacies (in the
  order the planner gave them), with the free-time day's hours, the distance from the hotel and the tax-refund tag,
  and folds out the tourist tax-refund rules.

## Near each stop, and near me

- **Under every stop:** meal chips at meal stops (sorted by rating, "N closed today", "near the hotel"), and pills for
  drinks, rest spots (seats and air-conditioning) and toilets, each opening a list sorted by distance with that day's
  hours, the walk, the rating and a tip.
- **How to order a drink:** sugar, ice, toppings and price, where the destination has a drink culture (Taiwan's).
- **Toilets:** the place's own (and whether it's accessible), public toilets by distance, shops that let you ask (buy
  something first), and station toilets, with the metro's tip where it has one (Taipei's free pass inside the gates).
  Cards say "has a toilet" or the nearest public one.
- **Food nearby:** Find food near me, Drinks, Sit and rest, Toilets near me, and breakfast and late-night food near the
  hotel. Near me picks the meal by the clock, lists what's within 2.5 km (else the nearest six), hides what's closed
  today (with a count), and gives the walk and directions. Without location it starts from the plan's current stop or
  the hotel, and "Start from somewhere else" lets you choose.

## The map

- **Google Maps** when the planner built with their own key (light and dark, Street View, a locate button), with live
  ratings, reviews, hours (today highlighted), photos and Google search. Otherwise a free MapLibre map on OpenFreeMap,
  falling back to OpenStreetMap's own tiles if that fails ([which to choose](google-maps.md)). It follows the theme.
- **Filters:** an area button for each part of the trip, all days or one (it opens on today), and categories: sights,
  food, wishlist, drinks, rest spots, toilets, metro, bike share and bus. A legend explains shape (the type) and colour
  (the day).
- **Search and list:** search the map, or list what's on it with a count, by type or nearest first.
- **Pins:** a popup with the name, its days, the address, the nearest station and how to get there from you, then the
  full card under the map. Metro stations show their lines and the time to the trip's places; bike-share docks their
  live counts.
- **Full screen**, with one-finger drag and Exit (Back closes it too). Your live location shows as a dot with an
  accuracy circle and a heading arrow when you move, and a dashed line runs to the pin you picked.
- **All places**, as a list by day, each tapping to its pin.
- **If it can't load** (offline, an ad blocker, an old phone), it says why, offers Try again and the hotel in Google
  Maps, and retries when you're back online. It starts loading just before you scroll to it.
- **My Maps:** a six-step guide and a Download KML button put the trip's places into Google My Maps.

## Getting around

- **The offline transit planner:** from a card or a pin, "How to get there from me (est.)" gives the walk, the metro
  line (towards which end, how many stops), any change and the last walk, with no network and no routing service.
  It suggests walking when that's quicker, and a taxi first for long legs.
- **Taxi fares** per car from the city's meter ("about NT$a–b per car; 5 people = 2 cars"), with the night surcharge.
- **The nearest station** to each place, with the walk.
- **Bike share:** live bikes and free docks on each dock, where the city publishes them (Taipei's YouBike).
- **Show the driver:** a full-screen card with the place's local name, Google's name, the local address, the English
  one, the phone, "please take us here" (in Chinese; other languages come with story step 4), Copy address and Google
  Maps. On a trip day it's one tap from the current and the next stop in the plan; every place also has it in its
  place sheet.
- **Directions** links open the phone's maps app in the right mode (walk, transit, drive, bike).

## Money

- **Every group cost also shows each person's share** ("≈ NT$x each", bold figures too, and never twice when the text
  already says it). Totals, each person's shares, the day's spend, the group pot, the shared cash and the airport
  options also show in the home currency, at a rate you can change on the page (it's remembered, and every figure
  follows it).
- **The budget:** what's not included, the total and each person's share, a suggestion, which costs don't shrink with
  fewer people (cars), the group pot (also in the home currency), the main shared costs, and a chart of each day's
  costs (estimates dashed, linking to each day).
- **Cash and cards:** how much shared cash and each person's share of it, what it's for, where cards work, and the
  transit card's top-up.
- **Tax refund:** the tag (with the minimum spend) on shops that qualify, in the add sheet and the shop box; the
  rules fold out in the shop box.

## Before you go

- **The checklist:** the entry ticks (the arrival card, registrations) first, then the trip's groups of ticks with
  notes, due dates and links, and a progress bar. With group sync, a group
  marked Shared ticks for everyone (bookings, tickets); personal ones (passport, packing) stay on each phone. "Clear my
  own ticks" leaves the shared ones.
- **Entry:** the entry rules with their warnings, sources and the date checked, and, in Taiwan, the visitor lucky
  draw with a calculator for the group (repeat visitors, companions, who can't join, the total in both currencies). Its
  ticks sit at the top of the checklist and show in the countdown when due.
- **Weather:** what to expect, when to check (a dated check shows up in the countdown), links, the daily checks, what
  to wear where, and the forecast on each trip day within 16 days. A line under the intro says where the forecast
  comes from, when it was checked, the days it covers, and how to read it (the % is the chance of rain at any time that
  day; the icon is the worst weather expected, even briefly).
- **Priorities:** the group's must-dos, should-dos and if-we-feel-like-it list, the trip's brushed motto, and photo
  credits.

## The airport and going home

- **Arriving:** the facts, a chart of the ways to the hotel by group total, and a card for each (door to door, changes,
  bags, best when, the recommended one, any booking), the steps from the plane, the rail line as a diagram, the rule for
  deciding on the day, buying and topping up the transit card, and links from each terminal to the hotel.
- **Going home:** the evening worked back from take-off (back for the bags, leave, at the airport, with the take-off's
  date), a "leave by" warning or the buffer, and links for the ride to the airport. A typed delay moves it all.

## Group sync

Off unless the planner sets it up for the trip (the `sync-setup` skill). With it:

- **What's shared:** added stops, pushed-back times, flight changes and ticks in shared lists reach every phone. The
  rest (the language, the theme, personal ticks, which split plan a phone shows) stays on each phone.
- **Your name.** The first open asks for a name once, a moment after the page shows (Not now is fine); until then a bar
  under the header asks again, and Later hides it for a day. The add-stop sheet asks too. A name given later goes onto
  the stops you already added, on every phone. A planner's name can't be taken.
- **Who can change what.** Each phone changes or removes only the stops it added ("only the person who added it, or a
  planner"), and "Remove the N stops I added" clears them. Pushed-back times, flight changes and ticks stay open to
  everyone.
- **Planners** (a phone that gave the planner code under "I'm a planner") can change anyone's stops, remove one
  phone's, put the whole group back on the original plan, make another phone a planner, and block a stray phone: its
  stops and last changes go back to the plan, and what it writes next reaches nobody. Undo brings it all back, and
  Unblock sends what waited.
- **The Group sync sheet** (a row in the Sections menu): what syncs, your name, the planner box, when it last synced or
  how many changes are waiting, Sync now (it says when it's working and when it's up to date), "The group" (each phone,
  its badges and how many stops it added), and **Recently removed** (the newest 10, with who removed each and Put
  back).
- **Others' changes** show as a toast: "Ana added … · Day 3 19:30", a push-back, a new landing time, a tick.
- **Offline is fine.** Changes wait on the phone and go when it's back online. Every record is encrypted on the phone
  before it leaves, on the planner's own Firebase database.
- **After the trip** the planner ends sync; each page says so and keeps its own copy.

A guard against slips, not a lock: the page's password is what keeps the plan to your group.

## Location

- **Asked only from a card that says why**, never by itself: Turn on location, or Not today (asked again tomorrow).
- **If the phone said no,** the card shows how to turn it on for iPhone, Android or a computer. If it asks again, it
  says why (an iPhone forgets; "only this time" was picked). If the phone gives only an approximate position, it shows
  how to turn on precise location, which the running-late check needs.
- **Once allowed,** it follows the phone on trip days (and stops while the page is hidden, to save the battery).
  Far from the trip ("not in Taipei yet"), distances start from the hotel.
- **Your position stays on your phone.** It's never sent anywhere.

## Made for seniors

Large text that follows the phone's own text size, buttons no smaller than a fingertip, high contrast in sunlight (and
solid bars and edged links when the phone asks for more contrast), solid surfaces when it asks for less transparency,
no sliding when it asks for less motion, a clear focus ring and screen-reader labels, walking counted ×1.4 when you
add a stop (the planner counts it ×1.4 in the plan too), a taxi first for long legs, and Back after every jump. Redrawing the page (a new language, a push-back, an added stop) keeps you on
the same spot.

## Private and safe

- The page sits behind a password, and every planner brings their own keys (Google, Firebase).
- It runs only its own code: a strict security policy refuses any other script or host, and the map library loads
  with an integrity check.
- It asks for location only from its card, and keeps it on the phone.

## What turns each part on

Everything above that isn't listed here is on every page. The fields are in
[`trip-format.md`](../memory-bank/standards/trip-format.md); ask your agent, with the `trip-customize` skill.

| Part                                                         | Turned on by                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Google's map, ratings, photos, hours, Google search          | building with your own key (`pnpm build … --keys`, [the guide](google-maps.md))                  |
| Group sync, names, planners, Recently removed                | `sync-setup`, then building with `--sync`                                                        |
| Positions, hours, route legs, food, drinks, toilets          | the data refresh (`data-sync`)                                                                   |
| The map and its pins                                         | `geo.json` (from the data refresh)                                                               |
| The forecast                                                 | the data refresh, for trip days within 16 days (`forecast_spots`, `forecastSpot`)                |
| Today's route                                                | `DAYS[i].route`, with the legs from the data refresh                                             |
| Tickets and how to book                                      | `DAYS[i].tickets`, and `extra.json` `tickets`                                                    |
| Where to eat, meal chips                                     | `DAYS[i].foodSlots` and `mealAt`, and `extra.json` `food`                                        |
| Day cards (decide, rain, budget, wear…)                      | `DAYS[i].blocks`                                                                                 |
| Tax refund tag and rules                                     | the country pack (`TRIP.destination`), `shops.json`, and `TAX`                                   |
| Lucky draw, drink guide                                      | the country pack, and `ENTRY.lucky` for the draw                                                 |
| Metro name, transit card, taxi meter, bike share, toilet tip | the city pack (`TRIP.region`); the transit card also `AIRPORT.transitCard` / `MONEY.transitCard` |
| The offline transit planner, station pins                    | the city's metro data (`mrt.json`, from the data refresh)                                        |
| Fixed times, flight-tied times                               | `fixed: true`, `rel` on a stop                                                                   |
| A day that splits                                            | `DAYS[i].split`                                                                                  |
| Optional plans, and their chips at stops                     | `OPTIONAL` (and `near`)                                                                          |
| Shop lists                                                   | `SHOPLISTS`                                                                                      |
| The wishlist, and its suggestions                            | `wish-a.json` / `wish-b.json`, and `freeEvening` / `freeFrom` on a day                           |
| The shop box                                                 | `shops: true` on a stop, and `shops.json`                                                        |
| Shared checklist groups                                      | `shared: true` on a `CHECKLIST` group, with group sync                                           |
| A hotel per night                                            | `DAYS[i].hotel`                                                                                  |
| Photos, the home-screen icon                                 | `img/` with `img/credits.json`, and `img/icon/` (by hand, `pipeline/README.md`)                  |
| Copy link and share links pointing at the live page          | the `SHARE_URL` environment variable at build                                                    |
