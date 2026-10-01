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

| Export                                                                | Used for                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `country`, `sym`                                                      | `[zh, en]` name; the currency symbol the pack's amounts are in |
| `taxRefund: { min }`                                                  | the tax-refund tag on shops and the "NT$2,000+" chip           |
| `luckyDraw: { repeat, companion, since }`, `luckyShares(pax, repeat)` | the lucky-draw calculator (Entry section)                      |
| `city`, `metro`                                                       | `[zh, en]`: "not in Taipei yet", "by MRT"                      |
| `metroToiletTip`                                                      | `[zh, en]` tip under the toilet list                           |
| `taxiFare(km, minsNow)`                                               | `[low, high]` per car in the "from where you are" plan         |
| `bikeShare: { name, request(nos), parse(json) }`                      | live bike and dock counts on bike-share pins                   |

The first pack is `tw` with `regions/taipei`.

A new country or city: the `destination-pack` skill (`.agents/skills/destination-pack/`).
