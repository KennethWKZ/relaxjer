# destinations/

One pack per country, `destinations/<cc>/` (ISO 3166-1 alpha-2, lower case), with city packs under
`regions/<city>/`. A trip picks them with `TRIP.destination` and `TRIP.region`; the build merges the two (the city
over the country) into the page's `Pack`. A trip without a destination builds too: the page leaves those features out.

| File                           | What                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `<cc>/pack.mjs`                | the country: name, currency symbol, tourist tax refund, visitor programmes (Taiwan's lucky draw) |
| `<cc>/regions/<city>/pack.mjs` | the city: its name, what the metro is called, the taxi meter, the bike share's live-count API    |
| `<cc>/knowledge.md`            | what matters when planning there: lessons, with the date they were checked                       |

Pack files are pure modules, like `engine/src/core/`: no imports, no DOM, no trip globals, named exports only. The build
inlines them; `tests/unit/packs.test.mjs` checks that and unit-tests every pack.

Any `https://` host a pack's code names (a bike share's live-count API) is what the page may connect to: the build adds
it to the page's Content-Security-Policy ([ADR-20261001-page-csp](../memory-bank/standards/decisions/ADR-20261001-page-csp.md)).
A pack that builds a URL from parts must still spell its host out in full.

What the engine reads from `Pack`, each optional:

| Export                                                                | Used for                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `country`, `sym`                                                      | `[zh, en]` name; the currency symbol the pack's amounts are in                                                                                                                                                                                                                                           |
| `taxRefund: { min }`                                                  | the tax-refund tag on shops and the "NT$2,000+" chip                                                                                                                                                                                                                                                     |
| `luckyDraw: { repeat, companion, since }`, `luckyShares(pax, repeat)` | the lucky-draw calculator (Entry section)                                                                                                                                                                                                                                                                |
| `city`, `metro`                                                       | `[zh, en]`: "not in Taipei yet", "by MRT"                                                                                                                                                                                                                                                                |
| `metroToiletTip`                                                      | `[zh, en]` tip under the toilet list                                                                                                                                                                                                                                                                     |
| `transitCard`                                                         | `[zh, en]`: the stored-value card's name (budget, airport)                                                                                                                                                                                                                                               |
| `drinkGuide`                                                          | `[[term, text], …]`: how to order a drink (sugar, ice, toppings)                                                                                                                                                                                                                                         |
| `googleZh`                                                            | the Chinese Google's search and map answer in when the page reads Chinese (`'zh-TW'` Traditional, `'zh-CN'` Simplified; plain `'zh'` without it); the country they lean to is `TRIP.destination`                                                                                                         |
| `native: { lang, name, ask }`                                         | the native layer: a BCP 47 tag (`'ja'`), its `[zh, en]` name, and "please take us here" for the driver card                                                                                                                                                                                              |
| `taxiFare(km, minsNow, date)`                                         | `[low, high]` per car in the "from where you are" plan (date: a seasonal rate)                                                                                                                                                                                                                           |
| `bikeShare: { name, request(nos), parse(json) }`                      | live bike and dock counts on bike-share pins                                                                                                                                                                                                                                                             |
| `theme`                                                               | the page's world: `engine/src/themes/<theme>.css` and `.mjs` (`'snowlight'`: Snow Light Path, set by Sapporo); look, browser-bar colour and icon. None: the default sky lanterns. The city's overrides the country's (ADR-20261117-destination-themes)                                                   |
| `refillWinter`                                                        | `['MM-DD', 'MM-DD']`: when outdoor drinking fountains are shut (it may run over New Year); on trip days inside it the refill list and the map leave outdoor taps out and count them (`regions/sapporo`: 1 November to 30 April)                                                                          |
| `driveStops`                                                          | `{ search: [{ q, kind, type?, fewer? }], names: { sa, pa, roadside }, dir: { up, down }, side }`: what the pipeline's `drive-stops` step searches for along a long drive, how a name tells its kind, the expressway's direction words and the side cars keep to (`jp`: service areas, 上り / 下り, left) |

The packs are `tw` with `regions/taipei`, and `jp` with `regions/sapporo`.

A new country or city: the `destination-pack` skill (`.agents/skills/destination-pack/`).
