---
created: 2026-10-01
updated: 2026-10-02
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

In group sync, "planner" is also a role a phone can hold on the page (see the glossary). The person above gives the
code that makes the first one.

## Primary Journeys

1. **Plan a new trip** (skills in order):
   1. Clone, `corepack enable`, `pnpm install`.
   2. Optionally set up your own Google keys ([ADR-20260930-google-keys](../standards/decisions/ADR-20260930-google-keys.md)).
   3. Write the requirements (`trips/<slug>/requirements.md`), and turn them into a trip folder (`trip-intake`).
   4. Pull places, hours, weather and links (`data-sync`).
   5. Optionally, share the group's changes across phones on your own Firebase database, before the build embeds it
      (`sync-setup`).
   6. Build the page (`build-page`), and check it with the tests and a real browser (`verify-page`).
   7. Publish it behind a password (`publish-htmlapp`).
2. **During the trip:** refresh the data, rebuild, verify, and republish to the same link (`data-sync` →
   `build-page` → `verify-page` → `publish-htmlapp`). The group's saved state carries over because the trip keeps its
   `fileName` and `storageKey`, and its sync file when it has group sync.
3. **After the trip:** end the trip's group sync if it had one (`sync-setup`), and turn what went wrong or right into
   proposed lessons for `knowledge/` or `destinations/<cc>/knowledge.md`, as a reviewed change (`trip-retro`).
4. **A new destination:** research the country and city, then add a pack with its tests and knowledge
   (`destination-pack`).
5. **An engine change:** tier 0 + tier 1 green, parity at the known diffs, a real-browser pass at 390 px and desktop in
   Chromium and WebKit ([`../standards/patterns/engine.md`](../standards/patterns/engine.md)).
6. **Hand the plan to the group** (a trip with group sync, `sync-setup`): the planner sets a planner code
   (`pnpm sync planner`), rebuilds with the sync file and republishes. On their own phone they give the code under
   "I'm a planner" in Group sync, and make another phone a planner from "The group" list when they want a second one.
   A leaked code means setting a new one and republishing; phones already planners stay planners. A tester's or a
   stray phone gets "Block this phone" in the same list: its added stops and last changes go back to the plan, and
   what it writes next reaches nobody. Someone who shouldn't see the trip any more needs a new page password and new
   sync keys too, since a block is only the page's.
7. **A senior removes a stop by mistake:** Undo on the toast puts it back for 8 seconds. After that, with group sync,
   the phone that added the stop finds it under "Recently removed" and taps Put back; a planner can put back any.
   Every page has the Undo; the list is group sync only.

## The Quality Bar

What every trip page keeps. It came from the first trip, and the tests characterise it. Every part of the page, for
planners, is in [`guides/trip-page.md`](../../guides/trip-page.md).

- **Costs:** per-person costs next to group totals, both converted to the home currency (the rate is editable).
- **Timeline:**
  - each day's timeline with fixed times that never move;
  - times tied to the flights, and a flight-delay editor;
  - a running-late re-plan that uses location and time, only suggests, never moves anything by itself, with fixed items
    anchoring the day;
  - your own added stops: a per-day button, a "+" under each timeline dot that lands right after its stop, a
    getting-there check (walk ×1.4, taxi, metro; "Use HH:MM" when too early; when to leave for the next timed stop),
    clash and deadline checks, a caution when a day already has 4 added stops, and Undo on the toast after a removal (every page). With group sync, a link isn't
    needed: they reach every phone marked with who added them. Each phone changes or removes only the stops it added,
    and "Remove the N stops I added" clears them; a planner can change any, clear one phone's, block one, and put the
    whole plan back. A phone's "Recently removed" list (30 kept, the newest 10 shown) offers Put back. Only stops are
    guarded: pushed-back times, flight changes and ticks stay open to every phone;
  - a day that splits: part of the group takes its own plan for a few hours, forked from the day's string with its
    go / wait / skip rule, and the stop where they come back says so.
- **Near each stop, and "near me":** food, drinks, rest spots and toilets (plus places that let you borrow a toilet),
  the group's wishlist where it fits, and the optional plans the trip suggests at that stop, which open over the day.
- **Each day:** Now and Next on a trip day (a countdown and the to-dos coming due before it), Copy for chat and Copy
  link, today's route as one navigation link per leg, decide-on-the-day options, and the rain plan.
- **Map:**
  - Google first, MapLibre as fallback;
  - categories, search, a list and sorting;
  - a live location dot, asked for only from a card that says why;
  - an offline transit planner that needs no routing API;
  - live bike-share counts where the city has them.
- **Destination info:** a checklist (groups marked shared tick for everyone with group sync), weather, tax refund with
  minimum spend, airport transfer options decided on the day, a shopping box, a free-day time budget worked back from
  the flight.
- **Page behaviour:**
  - an offline notice;
  - a home-screen install button, with the iPhone steps as a guide;
  - an update bar when a newer build is live (never while offline);
  - site search, the Sections menu (Now and Next at the top on a trip day), a Back pill, instant tab jumps with a
    landing glow;
  - with group sync, a phone's first open asks once for a name in a welcome sheet (Not now is fine), and until it has
    one a bar under the header asks again (Add name, or Later, which hides it for a day). Group sync itself stays a row
    in the Sections menu;
  - a language switch that keeps your place, and a theme switch (light, dark, follow the phone);
  - search in both languages (a Traditional character finds its Simplified form), with highlights and previous / next;
  - location asked for only from a card that explains a refusal, a forgotten answer or an approximate position.
- **Speed and build:**
  - closed lists built only when opened, late-loaded images, section skipping only where the browser has scroll
    anchoring;
  - a single-file build, published behind a password.

## Non-Functional Expectations

- **One file.** The page is a single self-contained HTML file: fonts subset, photos and icons inlined, no service worker.
- **Offline.** It renders and works without network, apart from the live map tiles, Google and live bike counts, and
  says so when offline. Group sync, when a trip has it, waits for a connection and never blocks the page.
- **Locked down.** The page carries its own Content-Security-Policy, and its one CDN library loads with an integrity
  hash ([ADR-20261001-page-csp](../standards/decisions/ADR-20261001-page-csp.md)).
- **Phones first.** 390 px is the reference width, with iPhone WebKit and Android Chromium as the reference browsers.
  Tier 1 runs Chromium and WebKit at 390 px and desktop.
- **No page errors.** Any page or console error fails a test.
- **Private by default.** A real trip page is published only behind a password, and never on GitHub Pages.
- **Cost.** Free to run: static hosting, and each user's own Google usage, usually within Google's monthly credit. Group
  sync adds the planner's own Firebase database, which a family trip keeps within its free amounts.

## Key Product Decisions

See [`../standards/decision-index.md`](../standards/decision-index.md). The ones that shape the product most: each user
brings their own keys ([ADR-20260930-google-keys](../standards/decisions/ADR-20260930-google-keys.md)), and real trips
never enter the repo ([ADR-20260930-repo-layout](../standards/decisions/ADR-20260930-repo-layout.md)).

## References

- [`project-brief.md`](./project-brief.md), [`glossary.md`](./glossary.md), [`../story-index.md`](../story-index.md).
