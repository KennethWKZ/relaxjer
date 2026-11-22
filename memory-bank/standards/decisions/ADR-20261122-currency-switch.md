---
id: ADR-20261122-currency-switch
date: 2026-11-22
title: 'A Phone Can Read Every Figure in the Home Currency, Notes Included, Converted as the Page Draws'
domain: engine
status: accepted
---

# A Phone Can Read Every Figure in the Home Currency, Notes Included, Converted as the Page Draws

## Summary

A currency button beside the language button, and the same choice in the Sections menu, makes the page lead with the
group's home currency (`TRIP.currency.home`) instead of the trip's (`TRIP.currency.sym`). Every figure in the trip's
currency converts, the amounts written inside trip text too, at the phone's rate, while the page is drawn: `fmt()`,
`escText()` and the figure helpers call `Money.mapAmounts` (`engine/src/core/money.mjs`). Each converted figure keeps its
original beside it or on the line under it. The choice and the rate are the phone's own: `store` keys `amounts` and
`rate`, never synced. Asked for by the planner (Kenneth) on 2026-11-22.

## Context

- The page already showed a home-currency line under totals, shares, chips and the airport options, at a rate the reader
  could edit. Reading the whole plan in the home currency meant doing the sums for everything else.
- Most figures aren't structured: a trip's notes, costs, tickets and airport options carry amounts as text ("每人
  ¥1,000", "≈ ¥56,000–90,000", "¥60,000（≈ RM 1,540）"). A real trip can carry hundreds of them.
- The page is drawn as strings in one pass (`render()`), and `fmt()` already rewrote group figures to add each person's
  share. Seniors read it on older phones, so a second pass over the DOM after every draw would cost them.

## Decision

- **Convert while drawing, in one pure function.** `Money.mapAmounts(text, sym, fn, home)` finds each amount in the
  trip's currency: the symbol not glued to a letter or digit before it (so `NT$` is never read as `$`, nor `CN¥` as
  `¥`), a number with commas, decimals, 万/千/k, an optional range ("–", "-", "~") and a "+". It reports whether the
  words before it already say "rough" (约, ≈, ~, about…) and takes in the writer's own home-currency note right after it,
  so "¥60,000（≈ RM 1,540）" doesn't say RM twice. Other currencies, times, distances and counts stay as written. Unit
  tests in `tests/unit/core.test.mjs`.
- **Never lose the original.** A converted figure in text reads "≈ RM 140 (¥5,300)"; one with a line under it (totals,
  chips, the cash, the lucky draw) shows the original there instead. "≈" is added unless the text already says the
  figure is rough. Copied text keeps the trip's currency: it's for the group chat, where each reader chooses.
- **Round to what a rate can claim** (`Money.roundHome`): one significant figure under 1, whole under 100, to 10 under
  10,000, three significant figures above. The home-currency line in the trip-first view uses the same rule, so a figure
  reads the same in both views (it changes only figures above 10,000, which lost their false last digits).
- **A new rate re-texts in place.** Converted figures are spans holding their trip-currency figures (`data-cv`), like the
  home-currency lines (`data-rm`); the two charts redraw on their own. Nothing redraws the page while the rate field has
  the focus.
- **The phone's own setting.** `amounts` and `rate` live in `store` and group sync never reads them (a tier-0 test checks
  `26-sync.js`). "Use the trip's rate" deletes the phone's rate rather than copying the trip's, so a rate the planner
  republishes reaches the phone.
- **The button is an action, like the language button:** it names the currency it switches to, so it isn't a toggle and
  carries no pressed state. The Sections menu's choice is a toggle: a segmented control, its pressed side filled and
  ticked.
- **No button without a home currency of its own** (`Money.canSwitch`: `home` set, not `sym`, and a rate above 0).

## Alternatives

| Option                                                     | Why not                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Convert structured figures only                            | Most amounts are in notes; half the page would stay in the trip's currency                                               |
| Ask planners to mark amounts in the data (`{¥5,300}`)      | Every trip's data and every agent writing it would change, and an unmarked figure would silently stay unconverted        |
| A regex pass over the DOM after each draw                  | A second walk of the whole page on every draw, on the slowest phones; it would also reach attributes and copied text     |
| Show only the converted figure                             | The booking, the ticket counter and the receipt are in the trip's currency; the group needs both                         |
| Keep the old rounding (to 10 above 100) for converted text | Six-figure home amounts (a weak home currency) would claim precision a rate can't give, and the two views would disagree |
| A toggle button with a pressed state in the header         | Its label would have to stay fixed; the language button already set the "names what it switches to" pattern              |

## Consequences

- **Security:** none new: the choice and the rate stay in the phone's storage under the trip's prefix and never leave
  it. Converted text goes through the same escaping as before (conversion runs on escaped text, and its markup is fixed).
- **Operational:** a trip's text can write amounts as people do; a currency written after the number ("1,000円") or as
  a word isn't found and stays as written. A trip with `home` equal to `sym`, or no `home`, has no button.
- **Cost:** none.

## Read when

You change how money is shown, add a place that draws an amount (draw it with `money()`, `fmt()` or `cvHtml()`, not
`CUR.sym + num()`), touch `TRIP.currency`, or wonder why a figure reads "≈ RM 140 (¥5,300)".
