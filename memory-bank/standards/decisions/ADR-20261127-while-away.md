---
id: ADR-20261127-while-away
date: 2026-11-27
title: 'What the Group Changed While a Phone Was Away Waits on Today'
domain: sync
status: accepted
decision: 'Changes read on opening the page or coming back to it go into a card on Today, kept on the phone until Got it; no push and no new service.'
tags: [design]
---

# What the Group Changed While a Phone Was Away Waits on Today

## Summary

With group sync on, the changes a phone takes in when its page opens or comes back to the front (someone added or
removed a stop, pushed a day back, changed a flight time, ticked a shared item) go into a "While you were away" card
on Today. Each line says who did what, when, and links to its day. A toast says how many, with See. The card stays,
in either language, until the reader taps Got it. Asked for by Kenneth on 2026-11-27 as the first step before any push
notifications.

## Context

- Others' changes showed only as a toast, and only to a page that was open and in front. A phone that was closed, or
  in someone's pocket, took the changes in silently on its next open: the plan was right, but nobody knew it had
  changed.
- Push notifications need a service worker and a sender (a Cloud Function), which ht-ml.app can't host. That is a
  separate decision about hosting ([ADR-20261001-group-sync](ADR-20261001-group-sync.md) lists why it was left out).
- The page reads the whole group on opening and again on coming back to the front: while it's hidden it holds no live
  stream. So what that read brings is exactly what the reader missed.

## Decision

- **What counts:** the changes in the read that follows the page opening or coming back to the front, from other
  devices. A device's name or kind isn't news (as for the toast). Changes while the reader is looking stay a toast.
- **Not on a phone's first read of the group** (`meta.read`, set after the first good read): everything would be new.
- **Worded when it arrives**, in both languages (`syncLine`, shared with the toast), while the plan still holds what a
  removal took away, so the card can name a stop that's gone.
- **Kept on this phone only** (`syncAway` in its storage, never a sync record): one line per record, the newest version
  winning as in the merge, newest first, at most 30 (`Sync.awayLog`, unit tested). Five show; the rest fold under
  "N more".
- **Got it** clears it, here only, and moves the focus to the view's heading.

## Alternatives

| Option                                          | Why not                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Web push now                                    | Needs a service worker and a Cloud Function: a hosting change, its own decision                 |
| A longer toast                                  | Gone in seconds, and it can't list ten changes                                                  |
| Everything since a time ("last 24 hours")       | Would repeat what the reader already saw while looking, and differs per phone clock             |
| The card in a sheet that opens by itself        | Interrupts the reader on every open; a card waits for them                                      |
| Sync the "seen" state across a person's devices | Personal state never rides group sync; a person's laptop and phone can each show their own card |

## Consequences

- **Security:** none. Nothing new leaves the phone; the card is built from records the phone already decrypts.
- **Operational:** none for planners. The wording for a new kind of record goes in `syncLine`, once, for both the
  toast and the card, and for any later push notification.
- **Cost:** none.

## Read when

You're changing how others' changes are announced, adding a kind of sync record, or designing push notifications.
