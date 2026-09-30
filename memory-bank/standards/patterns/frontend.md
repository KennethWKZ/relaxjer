---
created: 2026-10-01
updated: 2026-10-01
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
  more columns.
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
