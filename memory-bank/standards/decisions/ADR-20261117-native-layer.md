---
id: ADR-20261117-native-layer
date: 2026-11-17
title: 'The Native Layer Shows the Local Words Under Each Stop and Place, One Tap to Copy, When the Pack Names the Language'
domain: engine
status: accepted
decision: "A pack sets the native language and the 'please take us here' card text, and the engine reads them from the pack, never a constant."
tags: [trip-data]
---

# The Native Layer Shows the Local Words Under Each Stop and Place, One Tap to Copy, When the Pack Names the Language

## Summary

A country pack that exports `native: { lang, name }` turns on the native layer. Every stop shows its place's local
spelling (`PLACES[key].trad`) and romanization (`roma`) under its name, or the stop's own `native` and `roma` when the
stop isn't its place's name. Every other place row shows the same as its first button. Tapping copies the local words.
"Copy for chat" adds them to each stop, and the driver card marks its local lines with the pack's language. Without
`native` (Taiwan), the page is unchanged. First use: Japan (`destinations/jp`), at the planner's request for a group
that reads Chinese and English but not Japanese. This is the place-name part of story step 4; locale files and per-trip
UI languages stay in step 4.

## Context

- A group in Japan reads the page in Chinese or English, but signs, maps, taxi apps and staff use Japanese. Kanji
  shared with Chinese often differ (白い恋人 is not 白色恋人), so the group needs the exact Japanese, not a Chinese
  name that looks close.
- The planner asked for the local words beside both UI languages and easy to copy, so they can compare them with a sign
  or paste them into a map or translator.
- `trad` already held "the destination's own spelling" for search and the driver card, and the driver card was hard-wired
  to Traditional Chinese (`lang="zh-Hant"`, a Traditional label).

## Decision

- Pack export `native: { lang: '<BCP 47>', name: [zh, en], ask }`; `ask` is "please take us here" in that language, for the
  driver card, which said it in Traditional Chinese before. The engine reads the language from the pack, never a
  constant, so Korea or Thailand is a pack change.
- Data: a place's `trad` is the local spelling, its new `roma` the romanization; a stop's new `native` and `roma`
  override the place's for a stop that isn't the place's name.
  The food, drink and wishlist cards from the side files show their `name_trad` the same way, with an optional
  `name_roma`.
- UI: one `.mlink.native` button (copy icon, the words with `lang` set, the romanization in a quieter tone), 44 px high,
  wrapping inside itself on a phone. On a stop it's its own line under the name; elsewhere it's the first button of the
  place's links. Japanese text gets a Japanese font stack through `:lang(ja)`, so shared kanji draw the Japanese way.
- Tap copies with the page's existing `copy()` (clipboard, or the copy sheet as fallback) and a toast naming the words.

## Alternatives

- **Show the local words only on the driver card:** one tap away and hidden while reading the plan; the planner wanted
  them next to each name to compare.
- **A third UI language (the page in Japanese):** the group can't read it; they need both side by side.
- **Long-press to copy plain text:** not discoverable, and selection on a button fails on iOS; a button with a copy icon
  is a visible signifier (`patterns/affordances.md`).

## Consequences

- Security: none; the words are trip data, and copying uses the clipboard API the page already uses.
- Operational: trip data in Japan needs `trad` and `roma` per place; `trip-intake` and `data-sync` should fill them.
  Taiwan pages render as before (parity holds).
- Cost: none.

## Read when

Adding a destination whose language the group doesn't read, or changing how places or the driver card show names.
