# Finding stays

How to research hotels, apartments and houses for a trip, so the options a planner sees on the page are real for
their dates. The `relaxbro` role and the `trip-customize` skill follow it; `tests/repo/agent-config.test.mjs` checks
they link here.

## Availability for the exact dates

- **A price is not proof.** A listing can show a "from" price, a price for other dates, or a rate for fewer guests.
  Record what the site showed for the exact date range: a bookable rate with a Reserve or Book button, a "no
  availability" or "sold out" message, or a calendar with blocked nights.
- **One status per stay, per date range, per site:** `available`, `only N left`, `sold out`, `partly` (say which
  nights), or `unconfirmed` (the site gave no answer: say why). Each table column on the page is a date range, so
  check each column's range, not one stay of the whole trip.
- **Put the status on the page beside the price**, with the date it was checked. A stay that's sold out stays in the
  table, marked, so the planner sees what changed; it doesn't quietly disappear.
- **Check again before booking or publishing** when the last check is more than a few days old. Winter and holiday
  dates sell out fast.

## Fit the group

- **Count beds, not rooms.** A "semi-double" is one bed of about 140 cm for two people; a "double" is one bed. Say
  how the group would sleep (two twins, two doubles, a four-person Japanese room, a home with N bedrooms).
- **Check the unit, not just the property.** One listing can hold several units: a house for four and a flat for
  three. Name the unit you priced. A listing's "max guests" can be wrong; trust the room list.
- **Totals for the whole group and the whole range,** with taxes, cleaning fees and the cancellation rule (refundable
  or not). Breakfast and dinner plans are often extra per person: show both prices when they differ a lot.
- **Parking, whenever a car is an option:** free or paid (the price per night), on site or a lot nearby, whether it
  must be booked, and a height limit for a van. In Japan a city hotel's parking can cost as much as a meal each night,
  so it changes which stay is really cheapest: add it to the total of any option the group would drive to. Say "not
  stated" when the site doesn't say.
- **Bags and seniors:** a lift, stairs, and room for the group's big bags. Say "not stated" when the site doesn't say.
- **Where it is against the plan:** the walk to the station or the first stop of each day at the group's pace
  (walking ×1.4), dinner nearby, and the drive to a day trip or ski area. Mark straight-line distances as estimates.
  A home far from the station changes the plan (taxis, a car, fewer evenings out): say so on the option.

## Compare sites

- **Always compare Booking.com, Agoda and Airbnb, and both kinds of stay:** hotels, and homes (apartments,
  condominiums, whole houses). A home can beat two hotel rooms for a group on space, a kitchen and laundry; a hotel
  wins on location and no cleaning fee. Check Trip.com and the hotel's own site too when they're cheaper. Prices
  differ between sites, and one site can show rooms another doesn't.
- **Price from the property's own page, not the search list.** A search card's price can differ from the room list
  on the property page for the same dates (one hotel showed about 40 % more on its page); quote the page.
- **Booking sites need a real browser.** Their room lists are built in the page, so a plain fetch sees nothing. Put
  the dates, guests and currency in the address when the site allows it: Booking.com
  `checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&group_adults=4&no_rooms=2&selected_currency=<CUR>`, Agoda
  `checkIn=YYYY-MM-DD&los=3&rooms=2&adults=4&currencyCode=<CUR>`, Airbnb
  `check_in=YYYY-MM-DD&check_out=YYYY-MM-DD&adults=4`. Agoda's room list sometimes doesn't load for an agent: mark it
  `unconfirmed`, don't guess.
- **Ratings with their scale and count** (9.2/10 from 25 reviews). A new listing with no reviews says so.
- **One browser checker at a time.** Several agents sharing the planner's one browser take each other's tabs and
  stall it; run checks one after another, or split them by site, never in parallel on the same browser.
- **Read only.** In the planner's own signed-in browser: never sign in, book, add to a cart, type personal or payment
  details, or get past a CAPTCHA. Stop on that site and say so.

## On the page

- **Show options, not one pick.** A table per stay window (one column per date range: price, status, rating) for the
  many, and a decision card for the choices that change the plan (move hotels or not, a home or a hotel, near the
  station or not).
- **Include the special ones, even when they cost more.** A stay with a view, a private hot spring, a ryokan dinner or
  a memorable setting earns a place beside the sensible ones. Say what makes it worth the price and how much more it
  costs than the usual choice; the group compares and decides, not the agent.
- **The planner's ranking wins.** Never mark a stay "recommended" or "suggested" unless the planner said so. A stay the
  planner keeps only as a fallback goes last, labelled as the last resort, in every list it appears in.
- **Sources and dates:** each price note says which site and when, and whether tax is included.
