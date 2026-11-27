---
created: 2026-10-01
updated: 2026-11-24
---

# Frontend: Design and UX Rules

How to change anything the trip page shows: the engine's CSS and markup, a section's rendering, and later the landing
page (`site/`). The design system itself is `DESIGN.md` (tokens and rules), and who the page is for is `PRODUCT.md`.
Both sit at the repo root, where the design tools read them. This file says how to work with them.

## Before you build

1. Read `PRODUCT.md` (users, principles, accessibility) and `DESIGN.md` (tokens, components, do's and don'ts).
2. Open the neighbouring part of the page as the reference, and reuse its components, tokens and spacing. A new colour,
   radius, shadow or type size needs a reason, and it goes into `style.css` as a token and into `DESIGN.md` in the same
   change.
3. Load the matching skill (next section).

## Which skill

| Task                                                                    | Skill                                                                            | Where it comes from                                                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A new part of the page, a redesign, a critique, an audit, polish        | **impeccable** (`/impeccable craft`, `critique`, `audit`, `polish`, `document`…) | Claude Code plugin (`.claude/settings.json`); others: `npx impeccable install`         |
| Motion from scratch: should it animate, which curve, how it exits       | **animate**                                                                      | vendored, `.agents/skills/animate/`                                                    |
| Reviewing motion someone wrote                                          | **review-animations**                                                            | vendored                                                                               |
| Auditing all the motion in the page                                     | **improve-animations**                                                           | vendored                                                                               |
| Gesture, spring, sheet, drag or momentum motion; materials; type detail | **apple-design**                                                                 | vendored                                                                               |
| A chart, stat tile or any data visualisation (the budget chart)         | **dataviz**                                                                      | built into Claude Code; other agents follow the chart rules below                      |
| A diagram for the docs or the landing page                              | **diagram-design**                                                               | Claude Code plugin; Codex: `codex plugin marketplace add cathrynlavery/diagram-design` |

Claude Code's own verification runs through the `verify-page` skill and the read-only `ux-verifier` agent.

## Rules

Every interactive element also follows [`affordances.md`](./affordances.md): how a control signals what it does, its
states and its feedback, as 25 testable rules with sources.

- **Phones first.** Design at 390 px, then check desktop. One column (`--col`, 46rem); wide screens get margin, not
  more columns (from 1024 px the week rail sits beside it: navigation, not a second reading column).
- **One part of the trip at a time** ([ADR-20261122-day-views](../decisions/ADR-20261122-day-views.md)). A day or a
  section is a view a few phone screens long; what the group plans or reads rarely (a decision, a table, a budget, the
  rules) goes behind a summary button whose one line says what's inside, and opens in a sheet that scrolls on its own
  and closes with Back. Back returns to the exact view and place; a new jump opens its view first.
- **A stop's note is one short line; the rest folds** ([ADR-20261127-stop-detail-fold](../decisions/ADR-20261127-stop-detail-fold.md)).
  What everyone needs at the stop goes in `note`; directions, phrases and backups go in `detail`, a native fold shut
  below 600 px and open above, a tap either way. Never fold the note itself.
- **A phone and a tablet get around by the bottom bar** ([ADR-20261124-bottom-app-bar](../decisions/ADR-20261124-bottom-app-bar.md)).
  Below 1024 px, Today, Days, Map and More (an icon over a short label) replace the date strip and the Sections button;
  a desktop keeps the rail. Nothing on a phone scrolls sideways to reach a part of the trip. Anything fixed to the foot
  of the screen sits on `--chrome-bottom` (the bar plus the home bar, `0px` without a bar; set in CSS, never measured),
  and a modal sheet opens over the bar.
- **A list that goes somewhere is a grouped list** ([ADR-20261124-grouped-lists](../decisions/ADR-20261124-grouped-lists.md)).
  The rail, Days, More and the Sections sheet, and the settings in them: one card per group (`.gl`), full-width rows
  (`.rl`, 52 px or more) split by a hairline that starts where the words do, each row ending in what it does: › to go
  somewhere, the value and ⌃⌄ for a choice that changes here, nothing for an action. Build a new one with `railRow`,
  `pickRow` or `actRow` (`04-render-nav.js`), never a new tile.
- **The operated layer stays plain.** Times, prices, instructions and buttons use the system sans at the existing type
  scale. The brush face is for names and wishes only.
- **44 px tap targets at least**, and 52 px for the floating actions. Type in `rem`, so the phone's text-size setting
  scales the page. Input text at least 16 px, so iOS never zooms.
- **Both themes, every time.** Check light and dark. Lantern ink stays at 4.5:1 or better on the paper it sits on,
  including a night lantern's lit base.
- **Motion is short and purposeful.** Press feedback 160 ms, state changes 200–240 ms, `--ease-out`. Jumps land
  instantly and glow once. Honour `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast: more`.
- **Seal red means fixed**, a lantern colour means "this day", and a metro line colour is the region's data. None of
  them is decoration.
- **Charts:** every bar or value labelled in both UI languages, per-person and group figures distinguished, estimates
  drawn as a dashed 22 % tint, no colour-only meaning, and readable at 390 px.
- **No layout shift, no overflow.** Nothing may run wider than 390 px in either language (the first trip had two such
  bugs). Long words wrap with balanced lines (`text-wrap: balance`), not `nowrap`.
- **A control never covers what it controls.** A play or pause control, a close button or a floating action sits
  beside or below the content it acts on, never over it. Where its glyph says enough (pause, play, close), it's an
  icon-only 44 px button whose words are for screen readers only.
- **A search on the map never hides the map** ([ADR-20261124-map-first-search](../decisions/ADR-20261124-map-first-search.md)).
  Results and the place finder lie in the pane over the map (a sheet with three heights on a narrow stage, a side panel
  on a wide one, by a container query on the stage), the camera aims past it (`paneAim`, `panePad`, and `framePad` when
  it frames a picked place with where the group is), and the map's own controls ride above it. A picked place is
  framed and marked by both maps from the same helpers (`frameFrom`, `destMark`, `nameSide` in 21-place-finder.js),
  and no line or distance is drawn to it: the finder's Directions gives the real way. The sheet's half height fits a
  short list whole (Nothing found and its Google row included), and once the keyboard goes the map is lined up again
  (`stageAfterKeyboard`). Anything new on the Map view goes in the pane, the chip row or the Filters sheet, never as a
  block between the search and the map; a new row above the map means changing the stage's height formula.
- **The phone keyboard never hides the field being typed in.** A bottom sheet with a text field moves up to sit on the
  keyboard while it's open, and the focused field scrolls into view (`.kb-up` in `19-back-button.js`;
  `knowledge/engine-browser.md`). A new sheet with a field gets the same check in WebKit at 390 px.
- **A typing field's Enter key acts.** Every text, search or password field says what its key does (`enterkeyhint`),
  and Enter does it, then lets go of the field so the phone's keyboard goes down (22-events.js). Never while an input
  method is composing: every Enter goes through `enterKey` (02-helpers.js). `tests/repo/engine-fields.test.mjs` checks
  both.
- **A class names one component.** A new element never borrows another component's class: it brings that component's
  styles with it (a map result's pin took the toilet list's `.spot`, a bordered flex row, and drew as a squeezed ring
  beside a card). A map pin's classes stay `lpin`, `lpin-*` and the states `sel` and `dest`; the same test checks it.
  Look up a name in `style.css` before using it.
- **Commas between the numbers of an inline SVG path** (`M0,120C60,96,130,84…`), in CSS, JS and HTML alike. Space-only
  runs can read as a payment card number to the host's scan, which then refuses every publish
  ([`knowledge/hosting.md`](../../../knowledge/hosting.md)); commas draw the same. `tests/repo/host-scan.test.mjs`
  checks the engine on every commit, and `pnpm publish:trip` checks the built page before it uploads. Art files the
  build base64-encodes (`themes/*-art/*.svg`) are exempt.
- **Never describe people by family relationship** in any copy.
- **Avoid the travel-app defaults:** stock hero photos, a teal accent, grids of identical icon cards.

## Checking a UI change

Run the checks before you call it done. The `verify-page` skill runs all of them:

1. `pnpm test:e2e`: Chromium and WebKit × 390 px and desktop, and no page errors.
2. Build the demo (`pnpm build --trip examples/demo-trip`) and look at it in a real browser at 390 px and desktop, in
   light and dark, in both languages. Use real-shaped data: long names, an empty list, many items.
3. Walk the group's real journeys one-handed at 390 px, as a senior would: what's next, getting to the next stop,
   where to eat nearby, the rain plan, the budget, the airport, and coming back after a jump. Count taps and long
   scrolls, and look for dead ends, back-navigation traps, tiny targets and squeezed text.
4. Put a screenshot next to the reference part of the page, and fix alignment, spacing and style drift.
5. Check an iPhone-sensitive change (scroll, jumps, install, location) in WebKit; Playwright's WebKit is close to iOS
   Safari, not identical.

## The landing page (`site/`)

GitHub Pages serves `site/` as it is (`.github/workflows/pages.yml`), under the `/relaxjer/` sub-path. It is a set of
airmail postcards from the demo trip, one per feature, each with a drawn demo that loops
([ADR-20261002-landing-postcards](../decisions/ADR-20261002-landing-postcards.md)). Its surface brief and direction
contract are in `.impeccable/surfaces/site-index-html.md`.

- **Static and self-contained.** Plain HTML, `site/assets/site.css` and one small script, under the page's own policy
  (`<meta>`; no inline script, no connections). Only relative paths, and no third-party script, style or font: the
  brush face and Gabarito are self-hosted subsets in `site/assets/fonts/`, each with its SIL OFL. A new brush glyph
  means fetching a new subset that includes it.
- **The ground is one trip day, and it stays decoration.** The page's sky runs from a morning sun at the top through
  an afternoon gold to lantern night in the footer; the night theme puts the same page under stars. Everything in it
  (`.scene`, the footer's `.night`) is `aria-hidden` art that moves only with the scroll (`animation-timeline`), so it
  holds still under reduced motion and where a browser lacks scroll timelines. The sun keeps to the screen's corner and
  sets as the page scrolls (`.sunpath`, fixed only where the scroll can carry it), warming to `--sun-low`, and a moon
  rises over the footer by day; at night the moon only drifts (`--sun-travel`). Lanterns keep to the side lanes outside
  the text column (`--lane`), shrinking to fit the 16 px gutter on a phone, so none sits behind a word; clouds may pass
  behind text because they only lighten the ground. `main` clips sideways (`overflow-x: clip`): a settling postcard
  or the hero phone can reach past the edge, and the body's clip alone still lets a phone pan into it.
- **The live demo sits beside it.** `pages.yml` builds the demo trip with no key and no sync file, its clock set to
  Day 3 mid-morning (`--demo-clock`), in each visitor's own year, and publishes it at `demo/`
  ([ADR-20261002-live-demo-on-pages](../decisions/ADR-20261002-live-demo-on-pages.md)). That build opens in English,
  says it's a demo with a link back, and never asks for location. The page links `demo/`
  relatively; the site test knows it's built at deploy time.
- **A demo is a drawing of the real page.** Each loop is a mini trip page (`.m`) in CSS keyframes, after a capture of
  the demo build (the synced one for sync features): same strings, same flow. It runs only in view, has a Pause button
  and an `aria-label="Animated: …"`, and holds its `--still` frame under reduced motion. The Pause button is a round,
  icon-only 44 px disc under the phone's right edge, in the card's bottom margin, never on the screen it controls; its
  name ("Pause the … demo", then "Play …") is screen-reader text. A UI change on the trip page
  that a card shows means redrawing that card; no test catches the drift.
- **Only the demo, ever.** The screenshots come from `node scripts/docs-update/site-screens.mjs`, which builds the
  synthetic demo without a key and writes each image with its provenance sidecar. The flow diagram comes from
  `node scripts/docs-update/flow-diagram.mjs`, and the home-screen icon (the logo's lantern as an opaque PNG, since
  iOS ignores an SVG one) from `node scripts/docs-update/site-icon.mjs`.
- **The logo is drawn from the page's own pieces.** The lantern carries 松 ("relax", as in 放轻松) on its paper, beside
  "RelaxJer" in the brush face, turned into paths from the self-hosted subset so it needs no font:
  `node scripts/docs-update/site-logo.mjs` writes `logo.svg` and `logo-mark.svg` with a `-dark` twin of each (only the
  ink changes). The README and the sticky bar use it; the favicon stays the plain lantern, where 松 would blur at 16 px.
  A change to the brush subset means running it again.
- **Found by its words.** The title and description name what people search for ("group trip planner") within
  Google's limits (about 60 and 155 characters), not just the brand; the `<h1>` stays the brush name. The sitemap
  carries no `lastmod`, since nothing would keep it current. The `google-site-verification` tag proves the
  maintainer's Search Console property, where the sitemap is submitted; Google rechecks it, so it stays (the site test
  holds it). It's public by design, not a secret.
- **Checked like the trip page.** `tests/repo/site.test.mjs` covers links, third-party requests, alt text,
  provenance, the file types, the search and preview metadata, a Pause button and a description on every demo, the
  night theme's two token blocks (system and button) staying identical, and the SHA-pinned deploy. `tests/e2e/site.spec.mjs` runs the page with motion on in the four e2e projects and both
  themes: never wider than the screen, no lantern behind a word, the sun setting with the scroll (and still without
  motion), every Pause a 44 px disc off its screen that pauses and plays, and the theme button switching day and night, remembered
  across a reload. The eye check is 390 px and desktop, light and dark, in Chromium and WebKit, with reduced
  motion (the still frames) and without (the loops).

**Two worlds.** The page has Lanterns (the default, no `data-world` attribute) and Snow (`data-world="snow"`, Snow Light
Path). `theme.js` picks Snow from December to February by the visitor's own clock when nothing is stored; the bar's
world button (`.nav-world`) switches and remembers a choice, and the season's own world forgets it. Snow's rules live in
the `:root[data-world='snow']` block and the `.world-*` classes at the end of `site.css`; Lanterns rules stay untouched.
Snow has no lanterns, birds or moon: candles stand in snow in the footer and on the postcard front, and the only motion
is the snowfall, which falls as the page scrolls and is gone under reduced motion. `tests/e2e/site.spec.mjs` checks both
worlds, and `tests/repo/site.test.mjs` checks the season rule for all twelve months.

## Decisions behind these rules

Each rule above rests on a decision. The decision and its reasons live in its ADR; this list is only the index.

- [ADR-20260930-name-relaxjer](../decisions/ADR-20260930-name-relaxjer.md): The product is called RelaxJer: the exact name is unclaimed, so the site can rank for it, and it carries the lowest legal risk.
- [ADR-20261002-embed-brush-font](../decisions/ADR-20261002-embed-brush-font.md): The build embeds the brush font's glyphs the page uses as base64 woff2, so the page renders the same offline.
- [ADR-20261002-landing-postcards](../decisions/ADR-20261002-landing-postcards.md): Each landing-page feature is a postcard: a drawn mini trip page on one spot colour, with its stamp and copy on the back.
- [ADR-20261117-destination-themes](../decisions/ADR-20261117-destination-themes.md): A pack may name one visual world; a city's world overrides its country's, and each world is two files in engine/src/themes/.
- [ADR-20261121-world-motion](../decisions/ADR-20261121-world-motion.md): A moving part of a picture is a top-level group with data-actor, and splitArt returns the still drawing plus each moving part as its own SVG.
- [ADR-20261121-world-stickers](../decisions/ADR-20261121-world-stickers.md): Day colours keep text contrast at 4.5:1 or more on light paper and 3.8:1 or more on dark; tints are fixed shares of the colour.
- [ADR-20261124-bottom-app-bar](../decisions/ADR-20261124-bottom-app-bar.md): Below 1024 px a bottom bar (Today, Days, Map, More) replaces the date strip and the Sections button, and the sky’s Pause moves into More.
- [ADR-20261124-grouped-lists](../decisions/ADR-20261124-grouped-lists.md): The rail, Days, More and the Sections sheet are grouped lists: cards of 52 px rows split by inset hairlines, each row ending in ›, a value with ⌃⌄, or nothing.
- [ADR-20261124-map-first-search](../decisions/ADR-20261124-map-first-search.md): Search results and the finder lie over the map (sheet or side panel); a picked place is framed with the group and marked, no line; filters behind one button.
- [ADR-20261127-stop-detail-fold](../decisions/ADR-20261127-stop-detail-fold.md): A stop splits its text into note (always shown) and detail, a native fold: shut below 600 px, open from 600 px, a tap either way.
