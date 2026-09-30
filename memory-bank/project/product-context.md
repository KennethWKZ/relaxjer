---
created: 2026-10-01
updated: 2026-10-01
---

# Product Context

RelaxJer has two products: the **framework** (this repo, used by a planner and an AI agent) and the **trip page** it
builds (used by the travelling group). This file covers the framework. The trip page's users, purpose and principles
are in `PRODUCT.md` at the repo root, and its design system in `DESIGN.md`. Design tools read both from there.

## Consumers as Personas

| Persona          | Who                                                                                                          | Needs from RelaxJer                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Planner          | One person in a family or group who plans the trip; comfortable with a terminal, not necessarily a developer | Describe the trip in plain words, and get a page the group can use, without learning the engine. Keys and hosting explained step by step |
| AI agent         | Claude Code, Codex, Cursor, Gemini CLI or another agent working in a clone                                   | One instruction file (`AGENTS.md`), skills for each workflow, tests that say when a step is done, and hard stops before anything leaks   |
| Travelling group | Everyone who opens the page during the trip, often including seniors                                         | See `PRODUCT.md`: what's next at a glance, costs per person, a plan that never moves the fixed times, works offline                      |
| Contributor      | Someone adding a destination pack, a lesson or an engine fix                                                 | A layout that says where things go, a fast test loop, and the reasons behind past decisions                                              |

## Primary Journeys

1. **Plan a new trip** (skills in order):
   1. Clone, `corepack enable`, `pnpm install`.
   2. Optionally set up your own Google keys ([ADR-20260930-google-keys](../standards/decisions/ADR-20260930-google-keys.md)).
   3. Write the requirements (`trips/<slug>/requirements.md`), and turn them into a trip folder (`trip-intake`).
   4. Pull places, hours, weather and links (`data-sync`).
   5. Build the page (`build-page`), and check it with the tests and a real browser (`verify-page`).
   6. Publish it behind a password (`publish-htmlapp`).
2. **During the trip:** refresh the data, rebuild, verify, and republish to the same link (`data-sync` →
   `build-page` → `verify-page` → `publish-htmlapp`). The group's saved state carries over because the trip keeps its
   `fileName` and `storageKey`.
3. **After the trip:** turn what went wrong or right into proposed lessons for `knowledge/` or
   `destinations/<cc>/knowledge.md`, as a reviewed change (`trip-retro`).
4. **A new destination:** research the country and city, then add a pack with its tests and knowledge
   (`destination-pack`).
5. **An engine change:** tier 0 + tier 1 green, parity at the known diffs, a real-browser pass at 390 px and desktop in
   Chromium and WebKit ([`../standards/patterns/engine.md`](../standards/patterns/engine.md)).

## The Quality Bar

What every trip page keeps. It came from the first trip, and the tests characterise it.

- **Costs:** per-person costs next to group totals, both converted to the home currency (the rate is editable).
- **Timeline:**
  - each day's timeline with fixed times that never move;
  - times tied to the flights, and a flight-delay editor;
  - a running-late re-plan that uses location and time, only suggests, never moves anything by itself, with fixed items
    anchoring the day;
  - your own added stops: a per-day button, a "+" under each timeline dot, clash and deadline checks, a share link.
- **Near each stop, and "near me":** food, drinks, rest spots and toilets (plus places that let you borrow a toilet).
- **Map:**
  - Google first, MapLibre as fallback;
  - categories, search, a list and sorting;
  - a live location dot, asked for only from a card that says why;
  - an offline transit planner that needs no routing API;
  - live bike-share counts where the city has them.
- **Destination info:** a checklist, weather, tax refund with minimum spend, airport transfer options decided on the day,
  a shopping box, a free-day time budget worked back from the flight.
- **Page behaviour:**
  - an offline notice;
  - a home-screen install button, with the iPhone steps as a guide;
  - an update bar when a newer build is live (never while offline);
  - site search, the Sections menu, a Back pill, instant tab jumps with a landing glow;
  - a language switch that keeps your place.
- **Speed and build:**
  - closed lists built only when opened, late-loaded images, section skipping only where the browser has scroll
    anchoring;
  - a single-file build, published behind a password.

## Non-Functional Expectations

- **One file.** The page is a single self-contained HTML file: fonts subset, photos and icons inlined, no service worker.
- **Offline.** It renders and works without network, apart from the live map tiles, Google and live bike counts, and
  says so when offline.
- **Phones first.** 390 px is the reference width, with iPhone WebKit and Android Chromium as the reference browsers.
  Tier 1 runs Chromium and WebKit at 390 px and desktop.
- **No page errors.** Any page or console error fails a test.
- **Private by default.** A real trip page is published only behind a password, and never on GitHub Pages.
- **Cost.** Free to run: static hosting, and each user's own Google usage, usually within Google's monthly credit.

## Key Product Decisions

See [`../standards/decision-index.md`](../standards/decision-index.md). The ones that shape the product most: each user
brings their own keys ([ADR-20260930-google-keys](../standards/decisions/ADR-20260930-google-keys.md)), and real trips
never enter the repo ([ADR-20260930-repo-layout](../standards/decisions/ADR-20260930-repo-layout.md)).

## References

- [`project-brief.md`](./project-brief.md), [`glossary.md`](./glossary.md), [`../story-index.md`](../story-index.md).
