---
id: ADR-20261002-live-demo-on-pages
date: 2026-10-02
title: 'The Demo Trip Goes Live on GitHub Pages, Built by CI With No Key and Its Clock Set to a Day Under Way'
domain: hosting
status: accepted
---

# The Demo Trip Goes Live on GitHub Pages, Built by CI With No Key and Its Clock Set to a Day Under Way

## Summary

The landing page links to a live copy of the synthetic demo trip, so a planner can open the page their group would
get, on their own phone, before cloning anything. `pages.yml` builds `examples/demo-trip` on every push to `main`
that touches the engine, the demo or the site, with no Google key and no sync file, and publishes it at
`/relaxjer/demo/` beside `site/`. The build's new `--demo-clock` flag sets the page's clock to Day 3, mid-morning, and
lets it run on, so a visitor lands on a day under way rather than on "162 days to go". This reverses the earlier rule
that Pages hosts the landing page only, "not even the demo trip", for the demo trip alone. Chosen by Kenneth on
2026-10-02 over publishing it to ht-ml.app from CI.

## Context

The landing page shows each feature as a drawn loop. A planner deciding whether to use RelaxJer still couldn't touch the
real thing without cloning the repo and building it. The demo trip is synthetic by contract (no real people, bookings or
phone numbers, nothing copied from Google; `tests/contract/`), and a keyless build carries no secret. The old rule kept
every trip page off Pages so that a real one could never land there by habit. The demo was caught by that rule, not
the reason for it.

## Decision

- **Pages publishes `site/` and the demo trip's single file, nothing else.** The workflow copies `site/` as it is and
  `trip-standalone.html` to `demo/index.html`. `tests/repo/site.test.mjs` holds it to that: the only `--trip` is
  `examples/demo-trip`; there's no `--keys`, no `--sync` and no secret; the build log must say "google key no · group
  sync no"; and tier 0 (with the trip contract) and the release gate run before the build. The actions stay pinned
  to commit SHAs.
- **A demo clock** (`node engine/build.mjs … --demo-clock "YYYY-MM-DD HH:MM"`, in the trip's own time): the page opens
  at that moment and runs on from there (`Time.demoNow`), across midnight too. The build refuses it for any trip but
  `examples/demo-trip`, so a real trip's page always keeps the real time. The engine's test override (`<storageKey>now`)
  still wins, so the e2e suite is unchanged. `tests/e2e/demo.spec.mjs` opens the page built with the workflow's own
  clock (read from `pages.yml`).
- **The demo is in the visitor's own year.** The demo trip's data is one March, 2027. Before anything reads a date,
  a page built with the demo clock moves every date of the trip season (the data and its side files, 120 days either
  side) by whole weeks into the visitor's year (`Time.demoShift`, `engine/src/app/01-demo-year.js`), and its clock with
  it: Sat 13 Mar 2027 becomes Sat 11 Mar 2028, so every weekday holds and the page still opens mid-morning on Day 3.
  The tab title follows; the storage key stays the build's. The demo data writes dates only in date fields ("the
  evening of Day 6", not "18 Mar"), and the demo contract test holds it to that and to the shift naming every data
  global. A visitor with a wrong system clock sees the wrong year, which is harmless for a demo. The landing page's
  drawings keep the demo's own dates, so in other years a drawn day number can sit a day or two off; its postmark
  says "Day 3" rather than a date.
- **A demo says it's a demo.** A page built with the demo clock opens in English when the visitor hasn't picked a
  language (they come from an English landing page; 中 is one tap away), shows a strip under the bar with the clock's
  start and a link back to the landing page, and never asks for location: the visitor isn't on the trip, so where
  they are can't say whether the group is late. Every other page still opens in Chinese, and `demo.spec.mjs` checks
  both.
- **No Google search without a key.** The add sheet offered "Search Google for …" on every page; without a key it could
  only fail ("Can't reach Google"). It now appears only on a page built with `--keys`, which is what
  `guides/trip-page.md` already said.
- **Group sync stays a drawing.** A public demo database would carry its write token and sync key in the page, so anyone
  could write to it and every visitor would see every other visitor's changes. The landing page's two-phone postcard
  shows sync instead.
- **The landing page links `demo/`** from the hero and from the postcards' introduction. The site test treats `demo/` as
  built at deploy time.

## Alternatives

| Option                          | Why not                                                                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ht-ml.app, published from CI    | CI would hold the maintainer's ht-ml.app publish credential, and any workflow on `main` could then overwrite any of their pages, including a real trip's. The publish flow is also built for password-protected pages |
| ht-ml.app, published by hand    | Goes stale between publishes, and every engine change needs someone to remember                                                                                                                                       |
| A live demo with group sync on  | A public database anyone can write to, at the maintainer's cost, and every visitor sees every other visitor's edits                                                                                                   |
| Keep the old rule, no live demo | Planners only see drawings until they've cloned and built                                                                                                                                                             |

## Consequences

- **Security:** no secret enters the workflow, and the page has none to leak. The demo keeps its own
  Content-Security-Policy in a `<meta>` tag. Pages sends no headers, so `frame-ancestors` can't be set: another site
  could frame the demo, which holds nothing worth taking. localStorage is per origin, so the demo shares
  `kennethwkz.github.io` with any other Pages site of the account; its keys carry the `rj.2027-03-13.` prefix.
- **Operational:** a push to `main` that touches the engine, the demo or `destinations/` redeploys, so the demo always
  matches `main`. Engine debt shows on a public page the moment it lands. The tier-0 site test is the guard against a
  real trip ever being built there. A real trip still goes only behind a password (`knowledge/hosting.md`).
- **Cost:** none to the project. The page is about 550 KB, on Pages' free hosting. Its map loads tiles from OpenFreeMap
  (OpenStreetMap as the fallback), as every keyless page does, so the demo's visitors add to that traffic. Not
  checked: OpenFreeMap's terms for a public demo; read them if the demo draws real traffic.

## Read when

You're changing `pages.yml`, what the landing page links to, the build's `--demo-clock`, or the rule on where a trip
page may be hosted.
