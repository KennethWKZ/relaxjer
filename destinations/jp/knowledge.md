# Japan: what matters when planning there

Checked 2026-11-17 unless a line says otherwise. Tax-free rules, fares and entry rules change: re-check each before a
trip. Lessons that hold for every country live in [`knowledge/`](../../knowledge/README.md).

## The group and the language

- **The native layer is on** (`native: { lang: 'ja' }`): a group that reads Chinese or English still meets Japanese on
  every sign, map and taxi app, and shared kanji often differ (白い恋人 is not 白色恋人). Give every place `trad` (its
  Japanese name as written on its sign or Google Maps in Japan) and `roma` (Hepburn), and give a stop that isn't its
  place's name its own `native`. [ADR-20261117-native-layer](../../memory-bank/standards/decisions/ADR-20261117-native-layer.md).
- **Addresses** go in `addr` in Japanese (〒, prefecture, city, ward, block), which is what a taxi driver types in.

## Money and tax-free

- **Tax-free is a refund since 1 Nov 2026:** you pay the tax-inclusive price at the shop, then customs checks the goods
  at departure and the shop refunds the tax (card or other). Sources: National Tax Agency,
  https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/format/002.htm ; Japan Customs,
  https://www.customs.go.jp/kaigairyoko/taxrefund.htm.
- **Minimum:** ¥5,000 or more, before tax, in one shop on one day (`taxRefund.min`). The page's chip shows the figure
  before tax; on a shelf price that includes 10% tax, that's about ¥5,500. Customs, as above.
- **At departure:** within 90 days of purchase, at the customs point before security, before checking the bags in, with
  a Tax Refund kiosk or Visit Japan Web (New Chitose is on the VJW list). Customs checks per receipt: if one item on a
  receipt isn't in the bag, none of that receipt counts. Keep the packaging and tags. Customs, as above; poster
  https://www.mlit.go.jp/kankocho/tax-free/content/001990233.pdf.
- **Consumables** (food, drink, cosmetics, medicine) count only if unused in Japan. **General goods** (ski wear, a
  snowboard) may be used before departure if they leave with you. NTA Q&A,
  https://www.nta.go.jp/publication/pamph/shohi/menzei/201805/pdf/0026006-152_01.pdf.
- **No yen cap** found; the limit is what you can carry out. Customs, "Key Changes".
- **Departure tax:** ¥3,000 per departure from 1 Jul 2026, collected with the airfare. NTA No.7195,
  https://www.nta.go.jp/taxes/shiraberu/taxanswer/inshi/7195.htm.

## Entry

- **Malaysian passports:** visa-free for short tourist stays when the passport is an ICAO ePassport (90 days on a
  secondary source, https://japan-visa.com/guides/visa-free; MOFA's own page refused the check). Confirm on MOFA or the
  Embassy of Japan in Malaysia before a trip.
- **Visit Japan Web:** set it up before landing; it serves immigration and customs at New Chitose, and the tax refund.
- **JESTA** (an electronic travel authorization): reported for 2028 or later on secondary sources; not confirmed.

## Getting around Sapporo (`regions/sapporo`)

- **Subway (札幌市営地下鉄):** ¥210 to ¥380 for adults by distance. Sapporo city,
  https://www.city.sapporo.jp/st/josyaken/ryokin/ryoukin.html (page dated 2026-04-01).
- **IC cards:** the subway, the tram, JR Hokkaido Bus, Jotetsu and Chuo Bus take SAPICA, Kitaca, Suica, PASMO and the
  other nationwide cards, so a Suica already on a phone works. SAPICA itself doesn't work in Kitaca areas (JR). Sapporo
  city, https://www.city.sapporo.jp/st/josyaken/card.html ; https://www.sapica.jp/about/area.html.
- **Taxi (Sapporo–Otaru area):** upper-limit fare from 17 Dec 2025: ¥600 for 1.05 km, then ¥100 per 272 m. A 20%
  surcharge from 22:00 to 05:00, and all day in winter (10 Dec – 26 Mar); they don't stack. Companies may charge less
  (MK: ¥540 for 1.05 km). Hokkaido District Transport Bureau, https://wwwtb.mlit.go.jp/hokkaido/content/000362131.pdf ;
  https://www.mk-group.co.jp/about/news/251217sapporo_unchin. The 1.3 road factor in `taxiFare` is an estimate, as in
  Taipei. Asahikawa and Furano are other fare areas: don't use the Sapporo meter there.
- **Bike share (Porocle):** closed in winter; the 2026 season ended 15 Nov 2026 (https://porocle.jp/news/5662/). The
  pack has no `bikeShare`.
- **Four people fill one taxi**, without big suitcases: with bags, a jumbo taxi or a charter van.

## Renting a car in Hokkaido

Learned while pricing a winter one-way rental, Sapporo to Asahikawa, for four people with eight cases. Checked
2026-11-27 unless a line says otherwise; prices move with the season, so quote again for each trip.

- **Luggage decides the model, before price.** Honda Rent-a-Lease Sapporo's own test: a Step Wagon with its third row
  folded into the floor takes about 3 large and 2–3 medium cases in the boot (tested 2023-05-20,
  https://www.hondarent.com/blog/knowledge/rentalcar-how-many-suitcases.html). The rest ride on the second row. The
  Nissan Serena, Toyota Noah and Voxy flip their third row up against the sides instead, so their boot is narrower and
  takes fewer (https://response.jp/article/2023/06/20/372313.html). Ask how many cases and what size at intake, then
  pick the model.
- **"Or similar" isn't a promise.** Booking sites list "Step Wagon or similar", and the similar cars (Serena, Noah,
  Voxy) are often the same price. Before booking, ask the rental company to confirm the model and 4WD; a guaranteed
  model is worth paying a little more for when the luggage only fits one car.
- **Don't filter seats tightly.** A 7-seat Step Wagon (two separate middle seats instead of a bench) was much cheaper
  than the 8-seat on the same site and dates, and an 8–9 seat filter hid it. Check the seat band next to the one you
  need. With two middle seats, the small cases go in the aisle and footwells.
- **Price from the offer's details page, not the list.** On Klook, each offer's "Select" opens a details page (in a
  new tab) with every insurance package and the split between paying online and paying at pick-up, all without
  booking. Stop before the driver's details form. Read there: the real operator (an "Alamo" listing was run by Nippon
  Rent-A-Car), the deposit, whether winter tyres are an add-on to tick (¥5,280 for 8 days on one offer) or must be
  reserved separately, the free-cancellation date, and what the pay-at-pick-up figure includes: on one ORIX offer it
  looked to include the ¥16,500 one-way fee.
- **Compare like for like:** full cover, winter tyres and the one-way fee in every option, cheapest first. For 8 days,
  one way, a Step Wagon came to about ¥141,800 with ORIX through Klook (Klook Protect, no deposit), about
  ¥187,500 with Alamo through Klook (deposit USD 500–3,000), and ¥166,500–195,000 with Honda Rent a Car directly
  (normal to high-season rate, ¥1,980 a day for full cover, ¥11,000 one-way to Asahikawa; https://www.hondarent.com/en/).
- **Book early in winter.** Honda Rent a Car direct replied that it had no Step Wagon left for a January week asked
  about in late November. Klook's ORIX offer allowed free cancellation until a few days before pick-up, so booking early
  costs little.
- **ETC cards:** Honda Rent a Car says to bring your own; ORIX and most others lend one (about ¥330–550). Ask when
  booking, because the Expressway Pass needs a rental company's ETC card.
- **Hokkaido Expressway Pass:** a flat rate for NEXCO East's Hokkaido expressways, 4 to 8 days (4 days ¥7,700). It is
  sold only at the counters of designated rental companies, with a passport and the driving permit: ORIX, Nippon,
  Nissan, Toyota, Times, Honda, OTS and others, but not Alamo, Enterprise or National under their own names. Check
  the company against NEXCO's list before booking (https://en.driveplaza.com/drawari/hokkaido_expass/shoplist.html ;
  terms, https://en.driveplaza.com/assets/pdf/drawari/hokkaido_expass/policy_en.pdf). It pays only when the drives
  are long: price each day's tolls first on NEXCO's route search (https://www.driveplaza.com/dp/SearchTop, weekday
  daytime ETC). On one plan with two expressway days, per-trip tolls came to ¥7,950, only ¥250 more than the pass.
- **Hand the company a request in Japanese and English** with the model, 4WD, winter tyres, the Expressway Pass and
  an ETC card, and the pick-up and return shops. Pick-up shops near a station are often a short walk away: two drivers
  can collect the car without the bags while the others wait with them at the hotel's entrance.

## Sights with look-alikes and traps (Hokkaido)

- **Biei's "lone tree" usually means the Christmas Tree** (クリスマスツリーの木): one narrow spruce alone in a field. The
  others are easy to mix up: the Ken & Mary Tree (ケンとメリーの木, a broad poplar by a road, from a 1972 car advert), the
  Seven Stars Tree (セブンスターの木) and the Parent and Child Tree (親子の木). Confirm which one the group means
  (`trip-intake`). Every tree stands on private farmland: no stepping into the fields, and no drones anywhere in Biei.
  Found while planning a winter trip, 2026-11.
- **The Christmas Tree in winter:** the road beside it is walk-only with no stopping, so a charter can't take the group
  there; the Christmas Tree Liner bus from the tourist centre by Biei Station does, and needs booking. It runs only
  part of the winter (the 2026–27 season starts in early January). https://www.biei-hokkaido.jp/en/202627ws ,
  checked 2026-11; recheck each season.
- **Hill of the Buddha** (頭大仏, Makomanai Takino Cemetery, south Sapporo): winter viewing 10:00–15:00, ¥1,000 an adult
  (¥1,000 notes or a card). The lavender hill is snow, and the snowfields are closed; the path is 135 m with a 40 m
  tunnel, and wheeled cases aren't allowed on it. No taxi rank, and the cemetery doesn't call one, so it fits a charter
  day (for example on the way out of Sapporo) or a booked taxi both ways. Bus: Chuo Bus 真108 from Makomanai Station,
  ¥500; its winter timetable wasn't readable. https://www.takinoreien.com/pages/107/ ,
  https://www.takinoreien.com/pages/108/ , https://www.takinoreien.com/pages/315/ , checked 2026-11-21.

## Shops and data

- **Convenience stores and drugstores:** Seicomart (Hokkaido's own chain), Lawson, FamilyMart, Sapporo Drug (サツドラ).
  Search by brand; Google's category lumps them. https://www.sapica.jp/about/area.html (e-money at Seicomart, Sapporo
  Drug, Hokkaido Lawson).
- **Tax-free shops:** tag a shop `tax-refund` only from its own sign or the Japan Tax-Free Shop list, never from a
  Google category.
- **Winter:** pavements are ice from December to March. Count a walk slower than the map says, and prefer underground
  walkways (Sapporo's Chi-Ka-Ho and Pole Town) when dragging bags.

## The data refresh in Japan

- Set `"google": { "language": "ja", "region": "JP" }` in the trip's `pipeline.json`: names and addresses then match
  signs and taxi screens. The pipeline reads Google's Japanese hours (`月曜日: 7時00分～17時00分`, `24 時間営業`,
  `定休日`), drops "日本、〒…" from addresses, and keeps station names as signed (大通駅, never 大通駅站). Checked on a
  trip refresh, 2026-11-17.
- Steps outside Taiwan: `pins`, `fetch`, `apply`, `toilets`, `shops` (no tea-shop, metro or bike-share step yet).
- A place that isn't booked yet (a hotel to choose) gets the station's `gpid`, so the page never shows another
  business's phone number for it.
- Restaurant ratings from Tabelog run lower than Google's: 3.5 is already very good (the page says so).
- **No train, subway or bus times from Google's routing:** on the first Japan trip's refresh (November 2026) every
  transit leg came back with no route (the subway, JR and a city bus, 6 of 6), while walking and driving legs did. The
  route card shows those legs without a time. Their Directions buttons still open Google or Apple Maps, whose apps do
  route trains in Japan, so write the train time from the operator's timetable into the stop's note (JR Hokkaido for
  the line) rather than waiting for the refresh to fill it in.

## Open (not yet checked)

- Subway toilets inside the gates (no `metroToiletTip` until confirmed).
- Whether the ¥7,000+ long-ride discount applies before or after the winter surcharge.
- A Sapporo taxi sample to replace the 1.3 road factor.
