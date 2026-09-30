# Taiwan: what matters when planning there

Lessons from the first trip (Taipei, 2026). The code for each lives in `pack.mjs` and `regions/taipei/pack.mjs`, and the
pipeline steps in `pipeline/` and `regions/taipei/pipeline/`. Check prices, rules and campaign dates again before each
trip: they're as of 2026.

## Language

- A group that reads Chinese needs no separate native layer. The page still carries **Traditional** names for Google
  searches and signs (the pipeline converts names to Simplified for reading, with opencc).
- The tea-shop ordering guide (sugar, ice, toppings, price) is in the pack's `drinkGuide`. Groups use it daily.

## Money and entry

- **Tourist tax refund:** at least NT$2,000 in one shop on one day (`taxRefund.min`). Shops that offer it are tagged,
  and the chip shows the minimum.
- **The tourism lucky draw** for foreign visitors: a Repeat Visitor can win, and brings one companion who can win too
  (`luckyDraw`, `luckyShares`). The campaign's rules and dates change; the trip's `ENTRY.lucky` text holds the current
  ones.

## Getting around Taipei

- **MRT (捷运)** with the **EasyCard (悠游卡)**. The metro's stop order comes from OpenStreetMap, checked against Google,
  because Google doesn't give it; partial OSM lines are dropped.
- **A toilet inside the gates:** the info counter gives a free temporary pass (15 min, same station).
- **Taxi meter:** NT$85 for the first 1.25 km, NT$5 per 200 m after, NT$20 more from 23:00 to 06:00; the road is about
  1.3× the straight line (`taxiFare`). Suggest a taxi first for seniors on long legs.
- **YouBike 2.0:** live dock counts come from the operator's own API, which beats Google for this.

## Shops

- Store names change: one supermarket chain trades under a new local name, so check chain names in the trip's
  `pipeline.json` searches before each trip.
