---
id: ADR-20261002-landing-postcards
date: 2026-10-02
title: 'The Landing Page Is a Set of Postcards, Each With a Drawn Demo That Loops, and Carries Its Own Policy'
domain: layout
status: accepted
---

# The Landing Page Is a Set of Postcards, Each With a Drawn Demo That Loops, and Carries Its Own Policy

## Summary

The landing page (`site/`) is redesigned as airmail postcards from the demo trip: one card per feature, a picture side
in one lantern colour with a looping demo of that feature, and a back with a brushed Chinese line and the copy. The
demos are drawn in HTML and CSS, after captures of the real demo build, not recorded. The cards lie under one trip
day's sky, from a morning sun to lantern night in the footer. The page now self-hosts a second font, carries a Content-Security-Policy in a `<meta>` tag, and has search and link-preview metadata. Asked for by the
maintainer on 2026-10-01; the direction contract is `.impeccable/surfaces/site-index-html.md`.

## Context

The first landing page explained the framework but showed little of the trip page at work. A planner deciding whether
to use RelaxJer needs to see what the group gets: what's next, fixed times, a stop added on one phone reaching the
others, a removal taken back. The page must stay static, self-contained and synthetic (`patterns/frontend.md`), and it
is served from GitHub Pages, which sets no security headers.

## Decision

- **Postcards.** Each feature is a card (`.card`): `.pic` holds the demo on one spot colour from the trip page's
  lantern palette, `.back` holds a stamp, a postmark, a brushed line and the copy. Cards settle once on arrival.
- **Drawn demos, not recordings.** Each demo is a mini trip page (`.m`: the page's 390 px layout, scaled) whose loop is
  CSS keyframes on one clock (`--T`). Its strings and flows follow a capture of the synthetic demo build, including the
  synced build the e2e tests use. A loop runs only while its card is in view (`site.js`), has a Pause button (WCAG
  2.2.2), describes itself in words (`role="img"`, `aria-label="Animated: …"`), and under reduced motion holds its
  `--still` frame. Where a finger taps, its target is a custom property measured off the drawn screen.
- **One trip day's sky behind it all** (asked for on 2026-10-02: the plain ground didn't feel like a relaxed trip).
  The ground is a gradient from a morning sky through an afternoon gold to a lantern night in the footer, with a sun,
  clouds and birds by day and stars by night (`.scene`, `aria-hidden`, a few small SVGs in `site/assets/`). It moves
  only with the scroll (`animation-timeline: scroll()`), so nothing in the background moves by itself (WCAG 2.2.2) and
  reduced motion holds it still. Lanterns keep to the side lanes outside the text column, so none sits behind a word.
- **Two self-hosted fonts.** Gabarito (latin subset, SIL OFL) for headlines joins the brush subset; both ship with
  their licence. Still no third-party request.
- **A page policy in `<meta>`:**
  - `default-src`, `script-src` and `font-src` are `'self'`: no inline script, no outside code or font;
  - `style-src 'self' 'unsafe-inline'`, for the cards' inline custom properties; `img-src 'self' data:`;
  - `connect-src`, `object-src`, `base-uri` and `form-action` are `'none'`.
- **Search and previews:** a canonical address, a description, Open Graph and Twitter cards whose image (`og.png`) is
  rendered from the page's own hero with a provenance sidecar, JSON-LD (`WebSite`, `SoftwareApplication`,
  `SoftwareSourceCode`) and `sitemap.xml`. No `robots.txt`: a project site at `/relaxjer/` can't serve the domain's.
- **Tests:** `tests/repo/site.test.mjs` also checks the metadata, the sitemap, and that every demo has a Pause button
  and a description. `tests/e2e/site.spec.mjs` checks the page with motion on, in Chromium and WebKit at 390 px and
  desktop: no sideways overflow, no lantern behind text, and a Pause that works and stays off the screen.

## Alternatives

| Option                                  | Why not                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Recorded loops (video or animated webp) | Megabytes per feature, one recording per theme, re-recorded on every UI change, no still frame |
| Still screenshots only                  | They show a state, not the tap that leads to it                                                |
| A sky that drifts on its own            | Motion nobody started, on every screen of the page; tied to the scroll it follows the reader   |
| Lanterns scattered over the whole page  | Placed by page height, they land on different words at every width; the side lanes never do    |
| Google Fonts                            | A third-party request on every visit, against the page's rule                                  |
| No policy                               | Cheap to add, and it stops injected markup from running script or calling out                  |

## Consequences

- **Security:** only `site.js` runs, and the page can't connect anywhere. Residual: `'unsafe-inline'` styles; the page
  holds no secrets.
- **Operational:** a demo is a drawing. When the trip page's UI changes, the card that shows it has to be redrawn by
  hand; no test fails when they drift, so the eye check in `verify-page` covers it.
- **Cost:** none. The page is about 80 KB of HTML, 75 KB of CSS, 60 KB of fonts and 4 KB of sky art.

## Read when

You're changing the landing page, adding a feature card or a demo, adding a font or any outside resource to `site/`,
or the trip page's UI changed in a way a card shows.
