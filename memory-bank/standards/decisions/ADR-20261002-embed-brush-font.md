---
id: ADR-20261002-embed-brush-font
date: 2026-10-02
title: "Nothing From the Network Holds the Trip Page's First Paint: the Brush Face Travels in the Page"
domain: layout
status: accepted
---

# Nothing From the Network Holds the Trip Page's First Paint: the Brush Face Travels in the Page

## Summary

The trip page loaded its brush face (`TRIP.brushFont`, a Google Fonts `text=` subset) with a `<link rel="stylesheet">`
to `fonts.googleapis.com`. A stylesheet blocks rendering, so the page showed nothing until Google answered: on a weak
signal abroad, the group stared at a blank screen. The build now fetches the subset once, keeps it in `.cache/fonts/`,
and puts it in the page as a `data:` font. No font host is left in the page or its policy (a page built with a Google
key keeps them, for the Maps JavaScript API's own Roboto). Decided by Kenneth on 2026-10-02, after a performance pass
measured it.

## Context

Measured in Chromium at 390 px, on the demo and on the first trip (`--keys none`), with the font request held back:

| Font request            | First paint before | After       |
| ----------------------- | ------------------ | ----------- |
| answers normally        | 256–408 ms         | 84–164 ms   |
| 3 s slow (weak roaming) | 3.15–3.2 s         | under 0.2 s |
| hangs 8 s, then fails   | 8.1 s              | under 0.2 s |

Fully offline, the request failed at once and the page drew, so the offline tests never saw it: the trap is a slow
network, not none. `tech-stack.md` already listed the brush font among the extras the page can do without, and the page
already falls back to the system Kaiti faces (`style.css` `--font-brush`), so the stylesheet bought nothing a fallback
didn't, except the face itself.

The same pass looked at layout and text measurement (including the Pretext library) and found nothing worth changing
there: the page measures no text, and its layout costs a few milliseconds a frame.

## Decision

- **The build embeds the face** (`engine/build.mjs`, `brushFace`): it fetches the Google Fonts stylesheet for the
  page's own glyphs (with a current browser's user agent, so the answer is woff2), fetches each woff2 file, and writes
  `@font-face { … src: url(data:font/woff2;base64,…) }` into the page's `<style>`. The demo's 27 glyphs add about 16 KB;
  the first trip's 47 about 26 KB.
- **It fetches once.** The face is kept in `.cache/fonts/<hash of the request>.css` (ignored by git), so a rebuild is
  byte for byte the same and works offline.
- **No network and no kept copy: the build warns** (`! brush font: couldn't fetch …`) and the page letters in the system
  Kaiti faces. The build doesn't fail: a planner offline still gets a working page (`build-page` says to build again
  online before publishing). The build's summary says which it did.
- **The policy narrows** (ADR-20261001-page-csp): `font-src` is `data:` alone and `style-src` loses
  `fonts.googleapis.com`, unless the page is built with a Google key.
- **Tests:** `tests/e2e/policy.spec.mjs` checks the policy names no font host, the head has no outside stylesheet, and
  the trip's brush face is loaded from the page.

Two smaller fixes from the same pass, which need no decision of their own: `Time.nowIn` keeps one date formatter per
time zone (building one cost ~10× a call, about 45 ms of the demo's start on a slow phone), and the page doesn't jump
as it appears (an empty `#app` holds the screen's height; the location card renders from the phone's last answer, kept
as `store` key `geoSeen`, until the browser gives its own).

## Alternatives

| Option                                                     | Why not                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Keep the link, load it without blocking (a script adds it) | The face still needs Google on every open, offline pages never get it, and Google still sees each open                    |
| Commit the font file to the repo                           | Each trip letters different glyphs, so a whole CJK face would go in (megabytes), or a subsetter would become a dependency |
| Drop the brush face, use only the system Kaiti faces       | The brush lettering is the page's brand (`DESIGN.md`), and phones without a Kaiti face fall back to a plain serif         |

## Consequences

- **Security:** one fewer outside host: no request to Google Fonts when the page opens, so Google no longer learns
  who opens a trip page, and the policy allows fonts only from the page itself. The fetched stylesheet is checked for
  characters that could close the `<style>` before it goes in.
- **Operational:** the first build of a trip needs the network (it already did, for the map's data). A build offline
  with no kept copy publishes a page without the brush face, and says so. Changing a trip's wishes or brand fetches a
  new subset.
- **Cost:** none. The page grows by the subset (tens of KB), which the group downloads once with the page.

## Read when

You're changing how the page loads a font, what the page fetches before it first draws, or `TRIP.brushFont`.
