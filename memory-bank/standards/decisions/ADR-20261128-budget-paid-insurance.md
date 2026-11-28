---
id: ADR-20261128-budget-paid-insurance
date: 2026-11-28
title: 'The Budget Shows What Was Paid and What Is Still to Come, and a Trip Can Carry Its Travel Insurance'
domain: trip-data
status: amended
decision: 'Budget rows can be paid (date, where, ref), in the home currency, in parts, or price TBD; the glance is the paid total. INSURANCE: a tile, no IDs.'
tags: [engine, design]
---

# The Budget Shows What Was Paid and What Is Still to Come, and a Trip Can Carry Its Travel Insurance

## Summary

The budget was an estimate list in the destination's currency that left out flights and lodging. It now says what the
group has paid and what is still to come. A row can be paid (the day, where, a booking number), in the home currency
(flights booked at home) or the trip's, in parts (a deposit now, the balance on the day), or still without a price.
The Budget view leads with one big number, the total paid in the home currency, and one line for what's still to come
and each person's share. A trip can also carry its travel insurance (`INSURANCE`): a tile in Today's bookings opens the
policies, the numbers to call and what to keep for a claim. Asked for by Kenneth on 2026-11-28, with the
[progressive-disclosure](ADR-20261128-progressive-disclosure.md) batch.

## Context

- Planners book flights and hotels months ahead, in their home currency, and pay a coach or a guide in parts. The
  budget could only hold estimates in the destination's currency, so the paid things sat in `excludes` and the group
  couldn't see what was already settled.
- A money view in the apps the group uses (Wanderlog's spending tab) leads with one big number; the reference set the
  same discipline for the page (ADR-20261128-progressive-disclosure, "one big number on a money view").
- Insurance details lived in a chat message. In an emergency abroad the group needs the number to call in one tap, and
  after a delay the documents to keep. The page is shared with the whole group behind one password, so it must never
  hold anyone's ID number, address or birth date.

## Decision

- **Four row shapes** in `BUDGET.rows`: the old estimate array; a payment object (`label`, `min`, `max`, `cur`,
  `paid`, `via`, `ref`); a payment in parts (`parts: [{ amt, cur, paid, via, label }]`, simpler than two rows linked
  by an id, and the row's paid and still-to-pay halves fall out of its parts); and `tbd: true` for a planned add-on
  whose price isn't known (extra baggage). A paid row has one exact amount (`min` = `max`), never ≈.
- **`cur`**: `'home'` (or the home code) for the home currency; left out, the trip's. The tally (`Money.budgetTally`)
  sums in the home currency at the page's rate, and a sum that converted anything is marked ≈. A trip without a home
  currency keeps its own figures.
- **The glance** is the paid total, big, and one line: "还要花 ≈ RM a–b · 每人 ≈ RM c–d". A budget with no payment
  yet keeps its estimate total as before (`total`, `totalMin`, `totalMax`, checked by the contract only for an
  estimate-only budget). The glance is drawn again when the rate changes.
- **Two tiles**: Paid (each payment with where and when; its booking number in the opened row) and To pay (each estimate
  with each person's share, a balance with where it's paid, a price TBD row that's listed but never counted). By day
  and Cash & cards stay. `excludes` keeps what's truly outside (shopping). The group pot (`pool`, `poolText`,
  `suggest`) and the by-day chart stay as they were.
- **`INSURANCE`**: `policies` (name, insurer, plan, who, from, to, covers, note, site, app, contacts with `tel` and
  `wa`) and `claims` (what to keep, by event). Numbers are tel: links and WhatsApp a wa.me link, 44 px each. The tile
  shows only when the trip has a policy.
- **No personal identifiers**: the contract allows only the listed `INSURANCE` fields and refuses keys like `ic`,
  `nric`, `passport`, `dob` or `address`; trip-format states the rule for the whole trip.

## Alternatives

| Option                                                | Why not                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A deposit and its balance as two rows linked by an id | Two rows to keep in step and a link to check; `parts` keeps one row and its halves                         |
| Keep flights and lodging in `excludes`                | The group can't see what's settled; the paid total would leave out the biggest sums                        |
| An invented estimate for a price not known yet        | A made-up number reads as a plan; "price TBD" outside the totals is honest                                 |
| Insurance as a fact row or a note                     | A long block of numbers and rules on the glance layer; a tile and its sheet keep it one tap away           |
| A policy number or the insured's details on the page  | The page is shared with the group behind one password; the insurer's app and the hotline are enough to act |

## Consequences

- **Security:** the contract refuses personal identifiers in `INSURANCE`, and trip-format says none belong anywhere in
  a trip. Booking numbers (`ref`) are the planner's call; the demos carry synthetic ones. No new host: tel: and wa.me
  are links the reader taps.
- **Operational:** new optional fields, all checked by the contract and documented in trip-format: a budget row's
  `cur`, `paid`, `via`, `ref`, `parts`, `tbd`, and `INSURANCE`. trip-intake and trip-customize write them. An
  estimate-only budget renders as before. The live demo shifts the policy's dates with the trip's.
- **Cost:** a few hundred lines of engine and CSS, two icons (`i-shield`, `i-chat`). No paid API.

## Read when

You're changing the Budget view, the budget's rows or the money tally; adding a way to pay; adding insurance or any
field that could hold a person's details.

## Amendment 2026-11-28

The budget also says what kind of spend each sum is (Kenneth, the same day). A row may carry a kind from a closed list,
`transport`, `car`, `lodging`, `food`, `tickets`, `activity`, `insurance` or `other` (`Money.budgetKinds`): `cat` on an
object row, the last item of an estimate array (after its anchor when there is one), so every old row stays valid. A
row without one counts as `other`, and an estimate anchored at the airport as `transport`; the page never guesses a kind
from a row's words, so a row lands where the planner put it. A fifth tile, 按类别 / By kind, opens one row a kind,
biggest first (paid plus the middle of what's to come): its icon, its share of the whole, a share bar (paid solid, still
to pay hatched as an estimate, against the biggest kind's), what's paid (exact) and what's still to pay (a range) in the
home currency, and each person's share. `Money.budgetByKind` sums the very items `Money.budgetTally` sums, so the kinds
add up to the view's totals, and the sheet's foot repeats them; a unit test and an e2e test hold it. A split is bars,
never a donut. A day card's budget tags (`train`, `food`, `ticket`, `car`) read as the same kinds (`Money.kindOfTag`) and
draw the kind's icon on their row; `card` (a transit card top-up) names none. The contract checks `cat` against the list.
