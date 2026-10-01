---
paths:
  - 'README.md'
  - 'guides/**'
  - 'site/**'
  - 'PRODUCT.md'
  - 'memory-bank/project/**'
---

# Docs that planners read

Who reads what: `guides/getting-started.md` (the planner's walkthrough, every skill), `guides/trip-page.md` (every part
of the page and what turns it on), `guides/google-maps.md` (keys and costs), the README (the summary), the landing page
(`site/`, the pitch). The fields themselves live in `memory-bank/standards/trip-format.md`.

- **A feature isn't done until it's written down.** A change the group can see updates `guides/trip-page.md` (what it
  does, and its row in "What turns each part on"), `memory-bank/standards/trip-format.md` for a new field, and the
  quality bar in `memory-bank/project/product-context.md`. A headline feature also earns a line in the README and the
  landing page's packing list (or a postcard: ADR-20261002-landing-postcards).
- A new skill or role goes in the README's skills table, `guides/getting-started.md`, `AGENTS.md` and
  `.agents/README.md`; a new guide gets a link from the README. `tests/repo/docs-coverage.test.mjs` checks all of it,
  plus every data field, side file, command and heading link.
- Content lives in one place: the guide explains, `trip-format.md` lists fields, a skill holds the agent's steps. Link;
  don't copy.
- Plain words for planners, who may not be developers. Never describe people by family relationship, and never a real
  trip's details: examples come from the synthetic demo trip.
- The landing page stays static and synthetic; a UI change it draws means redrawing that card, checked at 390 px and
  desktop, light and dark, in Chromium and WebKit (`memory-bank/standards/patterns/frontend.md` § The landing page).
