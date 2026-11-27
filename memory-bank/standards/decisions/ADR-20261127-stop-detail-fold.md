---
id: ADR-20261127-stop-detail-fold
date: 2026-11-27
title: "A Stop's Longer Note Folds Under Its Short One, Shut on a Phone"
domain: design
status: accepted
decision: 'A stop splits its text into note (always shown) and detail, a native fold: shut below 600 px, open from 600 px, a tap either way.'
tags: [trip-data, engine]
---

# A Stop's Longer Note Folds Under Its Short One, Shut on a Phone

## Summary

A stop (`DAYS[i].schedule[]`) can carry `detail: [zh, en]` beside its `note`. The note stays the one line under the
stop; the detail folds under it behind a "更多说明 / More details" row. The fold is shut on a phone (below 600 px) and
open on a wider screen, and a tap folds or unfolds it at any width. Asked for by Kenneth on 2026-11-27, after the first
trip's car-hire and train days gave several stops notes of six to ten lines at 390 px.

## Context

- A stop's note had no length limit and no fold (`.stop-note`). Planners put the must-know line and the useful-once
  detail (a question for the front desk, walking directions, the backup trains) in one paragraph, so on a phone one
  stop could fill most of the screen and the day's string was lost.
- The page already folds a stop's nearby options the same way: shut below 600 px, open above, kept per stop for the
  page view (`optsOpen`, `05-render-small-parts.js`; [ADR-20261001-option-chips](ADR-20261001-option-chips.md)).
- The page's search treats text inside a closed `details` as findable and opens it on a jump (`12-search.js`).
- Affordances rule 13 says what most readers need is never folded away. Only the planner knows which part that is.

## Decision

- **A trip field, `detail: [zh, en]`**, in `trip-format.md` ("A stop"). The contract checks its shape, and that a
  stop with a detail has a note: the short line always shows.
- **On the page:** a native `<details class="stop-detail">` after the note, in the note's column (a stop's photo keeps
  its place). Its summary is the nearby-options row (`.sn-tog`: 44 px, the whole row the target, the info icon, a
  label, a chevron that turns, and the Fog Grey fill when open; rules 4, 11 and 16).
- **Shut below 600 px, open from 600 px**, the same break as the nearby options. A tap on the summary (or Enter or
  Space) folds or unfolds it on any screen; the choice is kept per stop for this page view (`detailOpen`), so a
  language switch or a push-back redraw keeps it. A reload within 30 minutes reopens the folds that were open, as
  it does for every fold on the page (`spotSave`, `21-live-location.js`).
- **Copy for chat** keeps the short note only: the chat text is for the group's quick read.

## Alternatives

| Option                                       | Why not                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Clamp every note to two lines with "More"    | Cuts mid-sentence and may hide the one line that matters; text clamped by CSS isn't what the page's search jumps to    |
| Move the detail into the stop's sheet        | Two taps and a dialog to read a line; stops with nothing else to show would need a sheet just for it                   |
| A custom button and `hidden`, like the chips | The page's search skips `hidden` text; a native `details` is found, opened on a jump, and announced as a disclosure    |
| Fold on every screen                         | A desktop has the room; Kenneth asked for it to follow the screen size, with folding still a tap away on a wide screen |
| Only shorten the notes                       | Fixes one trip, not the next; some detail is useful on the day                                                         |

## Consequences

- **Security:** none. Nothing new reaches the network; the text goes through the same `fmt()` as a note.
- **Operational:** planners choose what folds. A trip without `detail` renders exactly as before. Splitting an old
  note is a data edit (`trip-customize`), not an engine change.
- **Cost:** none.

## Read when

You're writing a stop's note or detail, or changing how a stop's rows fold or what a summary row looks like.
