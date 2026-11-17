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
