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
  most every 10 minutes, never offline). Ticks, added stops, the language, the theme, the currency and the rate you set
  are kept.

## Finding your way

- **The header** stays on screen: the trip's name (in brush lettering; on a phone too narrow for all of it, the trip's
  short name) and dates, Search (its field takes the header's row while you search), the theme button (light, dark, or
  follow the phone, with a toast saying which; the page follows the phone until someone picks, and on a phone the button
  sits in More's settings), the currency
  button, the language button (it names the other
  language, and keeps your place; the browser tab's title switches with it, and in English the brush name is read out
  and shown on hover by the trip's English name), and Install.
- **The currency button**, beside the language button, works the same way: it names the currency the figures would
  switch to (RM while they're in NT$, NT$ while they're in RM). Pressed, every figure in the trip's currency shows in the
  group's home currency: totals, shares, the budget and its chart, day budgets and their chips, optional plans,
  tickets, the airport options, taxi estimates, and the amounts written inside notes. Each keeps its original beside
  it, "≈ RM 710 (NT$5,500)", or on the line under it, and keeps your place; a toast says which currency and the rate.
  Figures in another currency ("USD 680"), times and distances stay as written. The choice stays on this phone (the
  rest of the group chooses for themselves), and copied text keeps the trip's currency. A trip without a home currency
  of its own has no button.
- **The bottom bar** on a phone and a tablet (narrower than 1024 px), the same whether the page is on the home screen
  or in the browser, like an app's: **Today** (its calendar shows today's date) opens Now and Next and the week;
  **Days** opens a list of every day, each with its date and weekday, Day number, title and forecast, today flagged and
  the day you're on lit, and a tap opens that day; **Map** opens the map; **More** opens Food and Toilets nearby, every
  other part of the plan (Airport, Entry, Optional, Wishlist, Food, Budget, Weather, Checklist, Priorities: whatever the
  trip has), then the settings: the theme, the snow's pause (in a look with a sky), which maps app opens, the Group sync
  row, Amounts and rate, Install, and the reset. The item for what's on screen is lit, in the day's colour on a day.
- **Lists like a phone's settings.** Days, More, the rail and the Sections menu are all drawn the same way, as an
  iPhone's Settings: rounded cards of full-width rows, one under the other. A row that opens something ends in ›; a
  setting that changes where it is (the theme, which maps app) shows its value and ⌃⌄, and a tap moves it to the next
  one; an action (pause the snow, Install, the reset) has neither. The part you're on is lit in its colour, with a ring
  and heavier words.
- **One part at a time.** Each part opens its own view, from its top: Today, one day, the budget, the airport. The
  phone's Back steps back through the views you opened, each where you left it (a tap on the bar is a step too), and a
  link to a part (`#d3`, `#budget`) opens its view. At the foot of every day, big **Previous day** and **Next day**
  buttons (the first day's goes back to Today); on a phone a sideways swipe across the day does the same.
- **On a computer** (1024 px and wider) a rail on the left takes the bar's place: Today, every day with its date, its
  title, its forecast and Today, then the other sections, each group on a card of its own. The view sits beside it, and
  sheets open as a panel on the right.
- **A day bar** slides in under the header once a day's heading scrolls away: Day N, the date, the title. A day's
  heading shows its date short, after a calendar mark ("3/15 周一" in Chinese).
- **The Sections menu** on a computer (the round button at the foot of the screen, there from the first screen of every
  view; it steps aside over the full-screen map, while Search is open, and where it would cover a day's Next day
  button): on a trip day it opens on Now and Next (before the trip, a countdown), then Food and Toilets nearby, Today,
  every day, every section, then the same settings as More. On a phone and a tablet the bottom bar's Today, Days and
  More hold all of it.
- **Amounts and rate** (in More, or the Sections menu on a computer): the same currency choice as the header button, and the rate (1 RM =
  NT$…), the same value as the budget's rate field. Figures follow a new rate as you type it; a rate that isn't a
  number above 0 is outlined and ignored. Under it, the trip's own rate and its note, and "Use the trip's rate" once
  you've set your own: it forgets yours, so a rate the planner updates later reaches your phone too. Both stay on this
  phone.
- **Jumps open their view first** (a stop on Day 3 opens Day 3, a card in a summary sheet opens that sheet), then
  land instantly (nearby ones scroll) and ring where they landed: from Now and Next, Search, the map's pins, Days and
  More, the Sections menu and every link on the page. A **Back pill** then takes you to where you were reading (on a
  phone it sits just above the bottom bar: a home-screen iPhone app has no Back button of its own), and the phone's own
  Back closes an open sheet, dialog or full-screen map before it steps back a view. Whatever floats at the foot of the
  screen (a message, the Back pill, the full-screen map's controls) sits above the bottom bar; a sheet opens over it.
- **Search** (the magnifier) finds any stop, place, note or list item across the whole plan, grouped by section with
  today first. It finds names in the language that isn't on screen, and a Traditional character finds its Simplified
  form (臺 finds 台). Matches are highlighted on the page, with previous / next and a count; Enter jumps to the first,
  Esc closes. A jump opens the match's view (and its sheet, when it's in one) and lands it just under the header.
- **Links:** every section, day and card has its own address (`#d3`, `#airport`, `#opt-101`), so a link in the group
  chat opens its view right there. A food, drink, wishlist or optional card opens in a sheet over the page, with "Show in the
  list", whether it's tapped or opened from a shared link.
- **Typing in a sheet** (a stop's name or time, your name, the planner code): the sheet moves up to sit on the phone's
  keyboard, and the field you're typing in stays in view.
- **Copying** falls back to a "long-press to select all" box where the phone blocks the clipboard.

## Today: Now and Next, and the week

- **Before the trip:** "N days to go", the flight, the first night's hotel, up to three to-dos coming due (entry
  registrations, the week-before weather check), and buttons to the checklist and Day 1.
- **On a trip day:** the day's badge and wish, what's on now and what's next (each a link to its stop), "Go to the next
  stop" with Google directions, "Open today", and "Check progress from my location". While a day's split is on, an
  "Apart" row says who went where and when the group meets again, linking to the split.
- **After the trip:** "Trip done. Welcome home."
- **The week:** one lantern row per day with its date, title and focus (in a destination's own look, the day's activity
  mark on its colour instead; see below).
- **Trip facts:** the dates, the group, the hotel with its address in both languages, phone and links. If Google still
  lists the hotel under an old name, a note says so.
- **Backups if we have time:** the rain or tired-day options and optional sights, as chips.

## Each day

- **The day's mark:** a small icon and its name beside the date for what the group does that day (snowboarding, a hot
  spring, the zoo, a city day, the seaside, a flight…), when the planner gives the day one.
- **The heading:** Day N and the date (with Today), the day's brushed wish (and its gloss in English), the title, and
  chips for the forecast (temperature, rain chance), the focus, the day's spend (each person's share, the group total
  and the home currency, linking to the day's budget) and what to wear. Under a sky (below) the forecast and what to
  wear move into the sky's weather line.
- **Today's route:** one line of the day's places in order, with the way between each (walk, metro, taxi, bike) and
  its minutes, and a **Whole route** button that opens the directions for all of it. A leg Google can't time (a train
  in Japan) shows the minutes the planner gave it.
- **Copy for chat** puts the day as text (times, notes, each person's budget, the rain plan, the link) on the
  clipboard; **Copy link** copies the day's address; **Map** opens the map full screen on that day.
- **The timeline:** each stop with its time and a note. A stop with more to it has a › button: tap it, or the stop,
  for its sheet with Map, Directions, the website and Details, the local words, a photo where there is one, the shop
  box, and the food, drinks, rest spots and toilets near it. On the stop under way and the next one, **Show driver**
  stays on the row, so it's one tap in a taxi. A **fixed
  time** (a flight, a show, a booked table) carries a red 定 seal. On a trip day the stops on now and next are tagged,
  past ones dim, and two or more done stops fold into "N done" (Hide done folds them again). A free day can number its
  steps instead of giving times.
- **Plans and details** under the day's heading: each card below is a summary button with one line, worked out from
  the card (how many options, or the one the group chose; a table's rows, and the range of the column with prices in most rows, named by its heading (or what its
  columns hold); the day's total; "Rain
  plan"), or the planner's own words. Tapping it opens the card in a sheet that scrolls on its own; ✕, a swipe down on
  its handle or the phone's Back closes it. The day itself keeps its heading, chips, route and timeline.
- **The cards**, as the plan needs them: option A, B or more to decide on the day (each with its cost, when
  to pick it, and its own map or website link, such as a hotel or a van to book), and any card's website links under it, go / wait / stop rules for a weather-dependent plan (with a "should we ride?" flowchart), a route of
  stations in their line colours, tables and lists, the day's budget with each person's share, what to wear, the rain
  plan, ticks for the day, and two-column lists.
- **Tickets and how to book** (a summary button, like the cards): folded cards with the steps, the price, the hours and the official link, marked when
  some details are unconfirmed.
- **Where to eat** (a summary button): researched places for the day's meals (the dish, closed dates, the rating), each opening its card,
  and **Also nearby:** wishlist places that fit the day, must-dos first.
- **Photos** with their caption and credit.

## The destination's own look

Some destinations dress the page in a look of their own, so it feels like the place. Everything works and reads the
same; only the colours and the drawings change. Without one, the page is the sky lanterns shown in the demo.

- **Snow Light Path** (Sapporo and Otaru): snow-white pages that turn into a navy snowy night in dark mode, made like
  a sticker book. Each day is a round frosted snow card with a drift along its foot, in one of seven candy colours
  (soda blue, strawberry, melon, grape, cocoa, lagoon, matcha) that also tint its chips and its row in the week. The
  day's activity mark, the day's number on the Now card and the Today flag are die-cut stickers (a white edge, a soft
  shadow, a little tilt); a penguin sticker sits on the Now card's corner, a sticker (snow bunny, mitten, heart or
  penguin) stands in each day's drift, and each day's picture is taped in with washi tape in the day's colour. None of
  them covers a word or a button. The timeline is a footpath in the snow with a small candle at each stop; a fixed time
  is an ice crystal. The stop the group is on now has its candle lit (it flickers gently, unless the phone asks for
  less motion). The first time a phone opens the trip, a little snow falls once over the countdown.
- **The sky** (Snow Light Path): every view opens under a band of sky with its title; on a day, the band holds the
  date, the wish and the weather line (the forecast in words, the low and high, the chance of snow or rain, and what to
  wear). The planner picks one of three skies for the trip:
  - **Live weather** (the look's own): snow falls by itself, heavier, bigger and faster on a snowy day and none on a
    clear one, and the sky turns to the day's colour as you go from day to day. A day without a forecast gets light
    snow.
  - **Snow globe:** the snow rests at the foot of the band until you press **Shake** (or swipe sideways on the sky),
    then swirls and settles in about five seconds. Nothing reads the phone's motion.
  - **Snow piles:** snow builds up at the band's foot (on a computer, on the snowy ground and the cards).

  **Pause the snow** stops it, and the phone remembers it: on a phone and a tablet it's in More's settings, two taps
  from anywhere; on a computer it's the pause button in the header. When the phone asks for less motion the sky holds
  still and the pause goes; while the page is hidden nothing moves. On a phone the sky fills the header and
  the band, behind the words; on a computer it's behind the whole page, the snow falling in the margins. With the sky
  off, the page keeps the still backdrop below.

- **The sky behind the page** (with the sky off): in Snow Light Path, scrolling down the trip is a night passing behind the cards: dusk at
  the top, a starry night with a faint aurora, falling snow, then dawn.
  At the very end the sun comes up over snowy hills. It moves only as you scroll, never by itself, stays pale by day
  and dark at night so every word stays as readable as on plain paper, and is a calm, still night when the phone asks
  for less motion.
- **Pictures of the day:** in a look that has them (Snow Light Path does), each day card opens with a drawing of its
  activity (`DAYS[i].motif`: snowboarding, the onsen, the penguins, a road trip…), and the overview opens with a snowy
  scene above Now and Next. A day with no mark, or a mark the look hasn't drawn, has no picture. On a phone the scene
  is a strip, and on a trip day a slim ribbon, so Now and Next and their buttons fit the first screen; under a sky the
  band takes its place on a phone.
- **The pictures move, each its own way:** while a picture is on screen, steam rolls off the onsen as rings spread on
  its water, steam curls off the noodles, the van on a road-trip day drives past the snow poles, the penguins waddle,
  the rider and the skier lean through their turn, the wave throws its spray, the train glides in, waits and pulls away,
  the plane flies on past the clouds, someone strolls off down the canal path in the town, the shopper hops at the
  window, and in snow country the lone spruce sways as snow blows off it in a heavy, windy snowfall. It all stays
  inside the picture, never behind the words, stops once the picture is scrolled away, and holds still when the phone
  asks for less motion.
- **Its own icon:** the browser tab, the bar's colour and the home-screen icon (a candle in the snow under a night sky)
  follow the look, unless the trip has its own `img/icon/`. When most of the days carry an activity the look can draw
  (Snow Light Path draws a snowboarder carving through powder), it takes the middle and the candle stands small beside it.

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
  rated; the first 25 show. A place closed that day is flagged and listed last, and shops with a tax refund are tagged. The keyboard's
  Search key puts the keyboard away and leaves the list. With Google, search Google for more. A ＋ on any food, drink, wishlist, map or idea card adds that place too.
- **A look first:** tapping a place in the list (its name or its ＋) opens it over the list: our photo, its kind and
  rating, its hours on the day picked (or "closed" that day), the address, and with Google its rating, reviews and
  photos, then the day, the time, getting there and Add, which stays at the foot of the sheet. "Back to the list" (or
  the phone's Back) returns to the list as it was: the search, the category and where it was scrolled.
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
  food list after the cards. Where one suits a stop, the stop gets a "Nearby options" row: on a phone it shows just
  how many ("2 nearby options", 附近可选 2) with a chevron, and a tap opens it (on a wider screen it starts open); each
  chip, with the distance, opens its card over the day. The row stays as you left it until the page is opened again.
  A plan is left out on a day its place is closed.
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
- **Food & drinks:** Find food near me, Drinks, Sit and rest, Toilets near me, and breakfast and late-night food near the
  hotel. Near me picks the meal by the clock, lists what's within 2.5 km (else the nearest six), hides what's closed
  today (with a count), and gives the walk and directions. Without location it starts from the plan's current stop or
  the hotel, and "Start from somewhere else" lets you choose.

## The map

- **Google Maps** when the planner built with their own key (light and dark, Street View, a locate button), with live
  ratings, reviews, hours (today highlighted), photos and Google search. Otherwise a free MapLibre map on OpenFreeMap,
  falling back to OpenStreetMap's own tiles if that fails ([which to choose](google-maps.md)). It follows the theme.
- **Map first:** the map fills the screen under the search and one row of categories, and searching never pushes it
  away. On a phone the results lie in a sheet over the map's foot: drag its top, or use its arrow buttons, to see more
  of the list (it stops at a peek, half and almost the whole map), and ✕ closes it. On a wider screen (a computer, a
  tablet, or the map in full screen there) they sit in a panel down the map's left, with the map open beside it.
- **Filters:** one button before the categories names the day the map shows (all days or one; it opens on today) and
  opens a sheet with every day and an area button for each part of the trip; a tap applies it and closes the sheet.
  The categories are sights, food, wishlist, drinks, rest spots, toilets, metro, bike share and bus. A legend explains
  shape (the type) and colour (the day).
- **Search and list:** search the map, or list what's on it with a count, by type or nearest first. A search also
  finds the shop box's supermarkets and pharmacies, which have no pin of their own, and works before the map has
  loaded (or when it can't load: the list still works). The keyboard's Search key puts the keyboard away and leaves
  the results in sight; a short list opens tall enough to show all of it, so "Nothing found" shows its "Search Google"
  row whole. With Google,
  "Search Google" finds places the page doesn't have, near where you are (or the hotel), in the trip's country and the
  page's language; those results stay put while your location updates, and "Back to page results" returns to the
  page's own. A toilet, station or bike-share dock tapped in the list shows on the map with its popup, the list lowered
  out of its way.
- **Place finder:** tap a sight, shop, food, drink or wishlist place in the results (or a Google result) and it shows
  in place of the list, its pin marked on the map in the part the list leaves open (or a marker of its own), bigger,
  ringed, with its name beside it and one halo as it lands. The map frames it with where you are, so the two show
  together; without your location (or before you reach the trip's area) with where the plan has the group: the stop
  under way on a trip day, else the hotel. No line is drawn to it and the map gives no distance, since a straight line
  isn't the way you walk: **Directions**, right under the place's name, opens the real route in your maps app. On a
  page built with a Google key, a line under the links says how far it is by road, from you (or the plan's stop, or the
  hotel), as Google measures it: "From the hotel: 800 m · ~14 min walk", the walk at the group's pace, or the minutes
  by car past a 20-minute walk. Then the day it fits best (the day whose stop is nearest, preferring one with free
  time after that stop; never a day it's closed, a day that already has it, or a day that's over), how far that stop
  is and the walk or taxi there (walking ×1.4), and a warning when it's far from every day. Below, the other days'
  nearest stops, each one tap from adding. "Add to Day N" opens the add sheet on that day, right after that stop.
  Details opens the place's own view. "Back to results" (or the phone's Back) returns to the list where it was.
  The days' distances are in a straight line and their times are estimates. Only the line by road asks Google, once
  for each place you open ([Google Maps: what it costs](google-maps.md#what-it-costs)).
- **Place details:** our photo, its kind, the rating the trip has (and where it's from), today's hours on a trip day,
  the address, Map, Directions and Add. With Google, "Info · hours, photos, reviews" (资料; on a phone just "Info") on every stop, Optional card, map card and
  place on a day's cards shows Google's live rating, reviews, opening hours (today highlighted) and photos: in the card
  itself, or for a stop in its details over the day. A place with no Google id is found by its name near its pin.
  Google is asked only on a tap, once per place per page view.
- **Pins:** a tapped pin stands out, ringed, the way a searched place does; with your location on, the map also frames
  it with you (no line is drawn to it). A popup with the name, its days, the address, the
  nearest station and how to get there from you, then the full card under the map. Metro stations show their lines and the time to the trip's places; bike-share docks their
  live counts.
- **Full screen**, with one-finger drag and Exit (Back closes it too); search, the filters and the list work there the
  same way. Your live location shows as a dot with an
  accuracy circle and a heading arrow when you move,.
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
  one, the phone, "please take us here" (in the local language where the country pack has one, Chinese otherwise), Copy address and Google
  Maps. On a trip day it's one tap from the current and the next stop in the plan; every place also has it in its
  place sheet.
- **Directions** links open the phone's maps app in the right mode (walk, transit, drive, bike).
- **Google Maps or Apple Maps:** "Open maps in" in More (the Sections menu on a computer) switches every Map and Directions link on this
  phone to Apple Maps (at the place's pin, with transit, drive or walk), and back. The whole-day route stays on Google
  Maps and says so: an Apple Maps link can't carry the stops in between.
- **The local words, one tap to copy:** where the group doesn't read the local language (Japanese in Japan), every
  stop, place, restaurant and wishlist entry also shows its name in that language, with its romanization, under the Chinese or English one. Tap
  it to copy the local words, then paste them into a map search, a taxi app or a translator, or hold the phone next to
  a sign to check it's the same place. "Copy for chat" adds them to each stop too, and the driver card shows them in
  the local script.

## Money

- **Every group cost also shows each person's share** ("≈ NT$x each", bold figures too, and never twice when the text
  already says it). Totals, each person's shares, the day's spend, the group pot, the shared cash and the airport
  options also show in the home currency, at a rate you can change on the page (in the budget or in More;
  it's remembered, and every figure follows it). The currency button turns that around: the home currency first, the
  trip's original beside or under it.
- **The budget:** what's not included, the total and each person's share, a suggestion, which costs don't shrink with
  fewer people (cars) and the group pot (also in the home currency) on the view; the main shared costs, a chart of each
  day's costs (estimates dashed, linking to each day) and the cash each open from a summary button.
- **Cash and cards:** how much shared cash and each person's share of it, what it's for, where cards work, and the
  transit card's top-up.
- **Tax refund:** the tag (with the minimum spend) on shops that qualify, in the add sheet and the shop box; the
  rules fold out in the shop box.

## Before you go

- **The checklist:** the entry ticks (the arrival card, registrations) first, then the trip's groups of ticks with
  notes, due dates and links, and a progress bar. With group sync, a group
  marked Shared ticks for everyone (bookings, tickets); personal ones (passport, packing) stay on each phone. "Clear my
  own ticks" leaves the shared ones.
- **Entry:** a summary button for the entry ticks (how many are done, leading to the checklist), one for each entry
  rule with its warnings, then the sources and the date checked, and, in Taiwan, the visitor lucky
  draw with a calculator for the group (repeat visitors, companions, who can't join, the total in both currencies). Its
  ticks sit at the top of the checklist and show in the countdown when due.
- **Weather:** what to expect, when to check (a dated check shows up in the countdown), links, the daily checks, what
  to wear where, and the forecast on each trip day within 16 days. A line under the intro says where the forecast
  comes from, when it was checked, the days it covers, and how to read it (the % is the chance of rain at any time that
  day; the icon is the worst weather expected, even briefly).
- **Priorities:** the group's must-dos, should-dos and if-we-feel-like-it list, the trip's brushed motto, and photo
  credits.

## The airport and going home

- **Arriving:** the facts and the steps from the plane, then summary buttons for the ways to the hotel (a chart by
  group total, and a card for each: door to door, changes, bags, best when, the recommended one, any booking), the rail
  line as a diagram, the rule for deciding on the day, and buying and topping up the transit card; and links from each
  terminal to the hotel.
- **Going home** (a summary button): the evening worked back from take-off (back for the bags, leave, at the airport, with the take-off's
  date), a "leave by" warning or the buffer, and links for the ride to the airport. A typed delay moves it all.

## Group sync

Off unless the planner sets it up for the trip (the `sync-setup` skill). With it:

- **What's shared:** added stops, pushed-back times, flight changes and ticks in shared lists reach every phone. The
  rest (the language, the theme, personal ticks, which split plan a phone shows) stays on each phone.
- **Your name.** The first open asks for a name once, a moment after the page shows (Not now is fine); until then a bar
  under the header asks again, and Later hides it for a day. The add-stop sheet asks too. The keyboard's Done key saves
  the name (while a Chinese input method is still picking characters, its Enter is left to it). A name given later goes onto
  the stops you already added, on every phone. A planner's name can't be taken, except by another of that planner's
  devices once it has given the planner code.
- **Who can change what.** Each phone changes or removes only the stops it added ("only the person who added it, or a
  planner"), and "Remove the N stops I added" clears them. Pushed-back times, flight changes and ticks stay open to
  everyone.
- **Planners** (a phone that gave the planner code under "I'm a planner") can change anyone's stops, remove one
  phone's, put the whole group back on the original plan, make another phone a planner, and block a stray phone: its
  stops and last changes go back to the plan, and what it writes next reaches nobody. Undo brings it all back, and
  Unblock sends what waited.
- **The Group sync sheet** (a row in More, or the Sections menu on a computer): what syncs, your name, the planner box, when it last synced or
  how many changes are waiting, Sync now (it says when it's working and when it's up to date), "The group", and
  **Recently removed** (the newest 10, with who removed each and Put back).
- **The group** lists each person once. Someone on a phone, a tablet and a laptop under one name shows that name with
  each device under it: what kind it is ("iPhone · home-screen app", "Mac · Chrome", "Android · OPPO Browser"), its
  badges (This one, Planner), how many stops it added and when it last changed something. Every browser is its own
  device: an iPhone's Safari and its home-screen copy are two. Blocked devices fold away under **Blocked phones (N)**
  at the end, with Unblock inside.
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
no sliding when it asks for less motion, a clear focus ring and screen-reader labels, every walking time counted ×1.4
for seniors (stop cards, the add sheet, the metro planner, the nearby lists and Google's walking minutes alike), a taxi first for long legs, one part of the trip on screen at a time with big Previous day and Next day buttons, and Back after every jump. Redrawing the page (a new language, a push-back, an added stop) keeps you on
the same spot.

## Private and safe

- The page sits behind a password, and every planner brings their own keys (Google, Firebase).
- It runs only its own code: a strict security policy refuses any other script or host, and the map library loads
  with an integrity check.
- It asks for location only from its card, and keeps it on the phone.

## What turns each part on

Everything above that isn't listed here is on every page. The fields are in
[`trip-format.md`](../memory-bank/standards/trip-format.md); ask your agent, with the `trip-customize` skill.

| Part                                                                                       | Turned on by                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A short name in a narrow phone's header (instead of the long one cut with …)               | `TRIP.brandShort`                                                                                                                                                                                                                        |
| Google's map, ratings, photos, hours, Google search                                        | building with your own key (`pnpm build … --keys`, [the guide](google-maps.md))                                                                                                                                                          |
| Info (Google's hours, photos and reviews) on stops and cards, Google results in the finder | building with your own key; Google searches lean to `TRIP.destination` and answer in the country pack's `googleZh` when the page reads Chinese                                                                                           |
| The finder's distance by road                                                              | building with your own key, and a network: Google's place search is asked once for each place opened (`ADR-20261124-finder-google-distance`)                                                                                             |
| The place finder, place details, the add sheet's look first                                | on every page with `geo.json`; the best day reads the days' stops, their times, `freeFrom`, and the place's hours and `closed_dates` from the data refresh                                                                               |
| Group sync, names, planners, Recently removed                                              | `sync-setup`, then building with `--sync`                                                                                                                                                                                                |
| Positions, hours, route legs, food, drinks, toilets                                        | the data refresh (`data-sync`)                                                                                                                                                                                                           |
| The map and its pins, Map in the bottom bar                                                | `geo.json` (from the data refresh)                                                                                                                                                                                                       |
| The forecast                                                                               | the data refresh, for trip days within 16 days (`forecast_spots`, `forecastSpot`)                                                                                                                                                        |
| Today's route                                                                              | `DAYS[i].route`, with the legs from the data refresh                                                                                                                                                                                     |
| Tickets and how to book                                                                    | `DAYS[i].tickets`, and `extra.json` `tickets`                                                                                                                                                                                            |
| Where to eat, meal chips                                                                   | `DAYS[i].foodSlots` and `mealAt`, and `extra.json` `food`                                                                                                                                                                                |
| Day cards (decide, rain, budget, wear…)                                                    | `DAYS[i].blocks`                                                                                                                                                                                                                         |
| A card's one-line summary, the option chosen                                               | worked out from each card; `sum` on a card for the planner's own words, `pick` on a `decide` card for the chosen option                                                                                                                  |
| The currency button, Amounts and rate                                                      | `TRIP.currency`: a `home` currency that isn't the trip's own `sym`, and a `rate`                                                                                                                                                         |
| Tax refund tag and rules                                                                   | the country pack (`TRIP.destination`), `shops.json`, and `TAX`                                                                                                                                                                           |
| Lucky draw, drink guide                                                                    | the country pack, and `ENTRY.lucky` for the draw                                                                                                                                                                                         |
| Metro name, transit card, taxi meter, bike share, toilet tip                               | the city pack (`TRIP.region`); the transit card also `AIRPORT.transitCard` / `MONEY.transitCard`                                                                                                                                         |
| The local words, one tap to copy                                                           | the country pack's `native`, with each place's `trad` and `roma` (a stop's own `native`, `roma`; a food, drink or wishlist entry's `name_trad`, `name_roma`)                                                                             |
| The destination's own look, its icon and bar colour                                        | the city pack's `theme` (Sapporo: Snow Light Path), from `TRIP.destination` and `TRIP.region`; the icon only when the trip has no `img/icon/`                                                                                            |
| The sky over each view (live weather, snow globe, snow piles), its pause                   | `TRIP.sky` in a look that has a sky (Snow Light Path's own is live weather); the weather from the forecast (`forecast_spots`, `forecastSpot`), light snow on a day without one; still, with no pause, when less motion is asked for      |
| The sky behind the page and the sunrise at its end                                         | the look (Snow Light Path draws one) with `TRIP.sky: 'off'`; it follows the scroll where the browser can, and holds a still night with less motion asked for                                                                             |
| The planner's preview panel (sky, weather, snow, theme, clock)                             | building with `--preview` (`pnpm build --trip … --preview`): a separate `<fileName>-preview.html` to compare looks on, never for publishing; its choices are never saved or synced                                                       |
| The day's activity mark, its picture, and the icon's                                       | `DAYS[i].motif` (one of the names in `trip-format.md`); the picture when the look has drawn that mark, moving when the look moves it (never with less motion asked for); the icon shows the one on the most days, when the look draws it |
| The offline transit planner, station pins                                                  | the city's metro data (`mrt.json`, from the data refresh)                                                                                                                                                                                |
| Fixed times, flight-tied times                                                             | `fixed: true`, `rel` on a stop                                                                                                                                                                                                           |
| A day that splits                                                                          | `DAYS[i].split`                                                                                                                                                                                                                          |
| Optional plans, and their chips at stops                                                   | `OPTIONAL` (and `near`)                                                                                                                                                                                                                  |
| Shop lists                                                                                 | `SHOPLISTS`                                                                                                                                                                                                                              |
| The wishlist, and its suggestions                                                          | `wish-a.json` / `wish-b.json`, and `freeEvening` / `freeFrom` on a day                                                                                                                                                                   |
| The shop box                                                                               | `shops: true` on a stop, and `shops.json`                                                                                                                                                                                                |
| Shared checklist groups                                                                    | `shared: true` on a `CHECKLIST` group, with group sync                                                                                                                                                                                   |
| A hotel per night                                                                          | `DAYS[i].hotel`                                                                                                                                                                                                                          |
| Photos, the home-screen icon                                                               | `img/` with `img/credits.json`, and `img/icon/` (by hand, `pipeline/README.md`)                                                                                                                                                          |
| Copy link and share links pointing at the live page                                        | the `SHARE_URL` environment variable at build                                                                                                                                                                                            |
