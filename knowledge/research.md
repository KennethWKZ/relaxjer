# Researching a trip

How to find what goes into a trip, so the planner gets current, sourced answers and real choices. The `relaxbro` and
`destination-researcher` roles and the `trip-intake`, `trip-customize` and `data-sync` skills follow it;
`tests/repo/agent-config.test.mjs` checks they link here. Stays have their own file: [stays](stays.md).

## Every finding is an audit fact

- **Source, date, and who said it.** Each hour, price, rule or tip carries where it came from (the operator's own page
  first; a blog or a post is a lead), the date it was published, and the date you read it. Write absolute dates
  ("2026-11-19"), never "two days ago".
- **The newest wins.** When sources disagree, the newest one wins and the older one is named.
- **Say what you couldn't confirm**, and where you looked. An unread page stays out of a comparison; it's never filled
  from memory.

## Social posts (rednote / Xiaohongshu)

Travellers' posts are the best lead for what's true on the ground now: which shops are worth the trip, prices seen,
closures, crowds, charter agencies and their quotes.

- **Use the planner's own signed-in browser.** rednote and Xiaohongshu are one app with two web addresses, and a login
  lives on one of them: try `https://www.rednote.com/search_result?keyword=<words>` first. A page that says
  "登录后查看搜索结果" isn't signed in on that address; switch address before asking the planner to sign in again.
- **Search in simplified Chinese**, with the place and the year (`札幌 雪具店`, `北海道包车 价格 2026`); the
  related searches under the results ("大家都在搜") are good next queries.
- **Posts from the last six months count.** Older posts are reference only, marked "older" with their date. A season's
  posts (ski shops in March) can be the newest there are; say so.
- **Record each post you use:** title, author, post date, URL, what it said that you used. A shop or price named only
  in a post's photos is unconfirmed until another source names it.
- **Read only.** No likes, follows, comments or messages. Never record a phone number or a messaging ID from a post.
  If the planner wants to message an agency, draft the message for them to send from their phone.
- **Not every result is a traveller.** Skip ads, fabric or wholesale suppliers, and agencies selling their own service;
  keep an agency's post only for its prices, labelled as theirs.

## Routes and drive times

- **Google's route times before any route advice.** A new leg, a reordered day or a drive-time claim goes through the
  trip's own pipeline (`DAYS[i].route`, `pnpm resync`, which asks Google only what the cache lacks). An open-source
  router or an estimate is a first sketch, labelled as one, never the plan.
- **Where Google has no public transport** (Japan), a transit leg carries its own minutes from the operator
  ([ADR-20261126-own-leg-minutes](../memory-bank/standards/decisions/ADR-20261126-own-leg-minutes.md)).
- **Winter drives show a buffer.** On snow, a drive shows Google's time and a just-in-case range of two to three times
  it. The day is planned on Google's time with an early start; the buffer is never a reason to cut a sight or change a
  hotel. Flag a day whose buffered end runs past dark or a booked dinner, with the fallback.
- **For a long drive, list the rest stops along the route** (the `drive-stops` step: service areas, roadside stations,
  petrol, with their hours that day), and plan a break about every 90–120 minutes of driving. The page shows the stops
  for reference; a break the group wants in the plan is its own stop, written like any other.

## What a data run costs

- **Every Google call is billed, a dry run's too** (see the `data-sync` skill): a dry run writes no trip file but
  still asks Google what the cache lacks, and a step re-asks what failed before. Before a run, say roughly how many
  calls it will make; a small check (a few new places or legs) is fine, a big or `--fresh` run needs the planner's yes.
- **After every run, tell the planner the calls and the list price** it printed, even when small.
- **Test a key with one call per API**, never with a refresh.

## Give choices, not one pick

- A planner exploring a trip wants options to compare: 8–12 per stay across price tiers and areas, alternative
  versions of a day side by side, and transport choices per leg (public, van, rental car, tour). Labels like "best
  value" sit inside the list; a single answer instead of a list is not enough.
- **Relaxed means unhurried, not fewer places** (the `trip-customize` skill): free evenings get easy nearby extras.
- Never call something "recommended" unless the planner did.

## Rental cars

- **The real total, not a "from" price:** the full-cover package and the split between paying online and at the
  counter, read from the offer's details page in the planner's signed-in booking site. Stop before the driver's
  details page.
- **Don't filter seats tightly:** check the next seat band too (a 7-seater with two middle seats can be far cheaper
  than an 8-seater), and check the group's luggage fits.
- **Name the real operator**, what's included (winter tyres, toll card) and what isn't; compare like for like.

## Shop lists for the group

When the planner wants every shop for something (snowboard gear, winter clothes, a drugstore run):

- **Search Google Places in the local language**, inside each city's area, with several queries: the specialists,
  the big chains, second-hand shops and budget brands (in Japan: スノーボードショップ, スポーツデポ, セカンドストリート,
  ワークマン, ユニクロ). Drop places that aren't operational or aren't shops.
- **Each shop shows its Google rating, the review count and the date checked**, its area, and when it fits the plan
  (which day, on foot or by car). Then let `data-sync` fill in hours.
- **Add the social picks** with a one-line source ("rednote, 2026-11"), and the buying tips from them (grades for
  second-hand gear, what to check).

## Paying: cards and cash

- **Compare cards on the effective cost** for the trip: the card's FX markup, cashback with its tiers, caps and
  minimum spend, which purchases are excluded (online, transport, duty-free), ATM fees on both sides, and annual fees.
  Use the issuers' own pages and terms, dated.
- **Turn it into "use this card for X"** (shops, cash, online bookings in the local currency, deposits, transit-card
  top-ups) in `MONEY.card`, and always "pick the local currency" when a terminal or ATM offers a choice.

## Bookings already paid

- **Read amounts from the receipt or the booking**, in the planner's signed-in account (airline, booking site) or a
  PDF they share: the exact total, the booking number, what it includes, the day it was paid. Never type the planner's
  password or a code.
- **Never guess a paid date or an amount.** Something booked by someone else, or a date you can't see, is asked of the
  planner; until then it's marked as unconfirmed.

## Bringing things home

- **Check the home country's duty-free allowance** for anything the group plans to buy in quantity (alcohol, tobacco,
  goods over a value), from the customs authority's own page. Over the allowance, add a checklist item to declare it,
  due on the day home, and a packing item (what goes in the checked bag, its weight).

## Insurance on the page

- `INSURANCE` holds what the group needs in an emergency: the plan, the dates, what's covered, the numbers to call
  (WhatsApp too) and what to keep for a claim. The page is shared: no ID or passport numbers, addresses, birth dates
  or nominees ([trip-format](../memory-bank/standards/trip-format.md)). The group's own insurance agent can be a
  contact when the planner asks.
