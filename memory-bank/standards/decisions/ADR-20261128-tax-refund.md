---
id: ADR-20261128-tax-refund
date: 2026-11-28
title: 'The Tax Refund Is a Tile in Today with Its Steps, the Airport and Shop Coupons Shown Full Size for the Scanner'
domain: trip-data
status: amended
decision: 'TAX gains steps, methods, airport (rows, wifi), deadline, coupons (until, img), src; a tile in Today opens them; coupon images go in at full size.'
tags: [engine, design]
---

# The Tax Refund Is a Tile in Today with Its Steps, the Airport and Shop Coupons Shown Full Size for the Scanner

## Summary

The tourist tax refund was a small fold in the shop box: a heading, three rules, a line on shops. A group that buys in
earnest needs more: the steps at the till and at the airport, card or cash, where the customs kiosk and the cash
machine are, the customs Wi-Fi, how long after buying they can claim, and the shops' own coupons, whose barcode the
cashier scans. `TAX` gains optional fields for each, and a 退税 / Tax refund tile in Today's bookings opens them in one
sheet. A coupon shows its barcode image full width, opens full screen on pure white (a landscape coupon turned to fill an
upright phone's long edge, the screen kept awake), zooms in sharp on a double tap, and greys and folds to "Expired"
after its last day. Asked for by Kenneth on 2026-11-28.

## Context

- The fold sat under the free-shopping stop, where nobody looks at the airport; the airport steps matter most on the
  last morning, when the group is in Today.
- Department stores hand tourists coupons (a few percent off above a spend) as an image with a barcode. A cashier's
  scanner needs the bars sharp: a photo scaled down by the browser can blur them, and a dark theme can tint the white.
- The page is one file: an image is in it as a data URL. Photos use a lighter 720 px copy (`img/lite/`); a coupon must
  not. Coupons run 85–210 KB each as WebP. The repo has no size limit on a page (the e2e checks the number of nodes at
  first paint, not bytes), and the host takes pages of several MB.

## Decision

- **New optional fields**, each checked by the contract: `steps` (`[[zh, en], …]`), `methods` (`[{ h, items, note? }]`),
  `airport` (`{ h?, rows: [{ what, where, when?, note? }], wifi?: { ssid, pass?, note? } }`), `deadline`, `coupons`
  (`[{ id, shop, h, items?, until, img?, rules?, place? }]`) and `src`. `h`, `list`, `shops` and `note` stay, so an old
  trip renders as before, now in the sheet. The minimum spend still comes from the pack (`taxRefund.min`).
- **A tile in Today's bookings** (`top-p-tax`, the receipt icon, 退税 / Tax refund, its count the coupons still good)
  opens a sheet: the minimum spend and the deadline, the rules, the coupons, how it works as numbered steps, card or
  cash as two cards, and the airport's places and Wi-Fi (Copy buttons for the name and password). The shop box keeps
  one row that links to it. Content lives in the sheet only.
- **A coupon** shows its shop and last day, its offer and tiers, its image full width on white, its rules and its
  place's links. Past its `until` (`Tax.expired`: good through its last day, on the trip's clock) it folds to one greyed
  row, "已过期 / Expired", the good ones first.
- **Full screen for the scanner:** a tap opens a pure white full-screen layer whatever the theme (no glass, no blur,
  no dark tint), the whole coupon on the screen from the full-size image, scaled by CSS only, never a smaller copy. A
  landscape coupon on a phone held upright turns a quarter turn so it fills the long edge (`Tax.turnFor`); a portrait
  one is fitted whole; a phone already held sideways turns nothing. A double tap zooms in where it lands, one image
  pixel to one screen pixel (or twice the fit for a small image), and back; pinch zoom stays on. The screen stays awake
  while it's open (the Screen Wake Lock API, taken again when the page comes back, skipped where the browser lacks
  it). A 44 px ✕, Escape and Back close it. **Not used:** a web page can't set the screen's brightness, so one hint
  line asks for it ("Turn the brightness up for a quicker scan"); and `screen.orientation.lock` works only in full
  screen on some Android browsers and never on iPhone, so the image turns instead of the phone.
- **Images:** `img` is a key under the trip's `img/` (`'tax/coupon-store'` for `img/tax/coupon-store.webp`, `.png`,
  `.jpg` or `.svg`). The build puts each one in the page at its full size, never the lite copy, beside the photos in the
  late-loaded image block, and counts them apart in its summary line (`coupons N (KB)`). No size budget is raised: there
  isn't one. The contract checks every named image exists. The demo's coupon is a made-up SVG.

## Alternatives

| Option                                       | Why not                                                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Keep the fold in the shop box, longer        | The airport half is needed on the last morning, from Today; a fold under a shopping stop is the wrong place           |
| A view of its own                            | Today's other bookings (flights, insurance) are sheets; a view would be one more place in the bar and the rail        |
| Show the coupon at its own size, scrolling   | Half a wide barcode off a phone screen is no use at a till; fitted whole from the full-size image, a double tap zooms |
| Use the lighter 720 px copy, like the photos | A smaller copy blurs the bars once zoomed in; coupons are few, so their weight is a few hundred KB                    |
| Link the coupon to the shop's own page       | It needs a network at the till and often an account; the image works offline                                          |

## Consequences

- **Security:** none new. Images are data URLs under the page's existing `img-src data:`. The Wi-Fi name and password
  are the airport's public ones; the contract keeps them plain text.
- **Operational:** six optional `TAX` fields and a coupon shape, documented in trip-format and the guide, written by
  `trip-customize`. A coupon image the trip names but lacks fails the contract; the build leaves it out with a warning.
- **Cost:** each coupon adds its own size to the page (85–210 KB as WebP); a trip with three adds well under a MB.

## Read when

You're changing the tax refund, Today's bookings, a coupon or how a trip image goes into the page.

## Amendment 2026-11-28

A zoomed coupon keeps its turn: a barcode strip turned along an upright phone stays turned when a double tap zooms in,
around the tapped point, and the coupon then scrolls in every direction to each of its edges, so the whole barcode is in
reach at any zoom. The first build turned it back upright and centred it in a box that cut off its left half (Kenneth's
report). The layout is one pure function, `Tax.couponView` (fit, zoom, turn), and the page sizes the coupon in pixels
from it.

A coupon's `until` is optional. Some coupons print no end date, and the trip must not make one up: without `until` a
coupon never expires and shows 没写有效期 / No end date shown where its last day would be. The contract checks `until`
only when it is given.
