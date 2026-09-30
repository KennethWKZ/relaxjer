---
paths:
  - 'engine/src/**'
  - 'site/**'
  - 'DESIGN.md'
  - 'PRODUCT.md'
---

# Frontend

Read `PRODUCT.md`, `DESIGN.md` and `memory-bank/standards/patterns/frontend.md` (SSoT) before changing what a page
shows.

- Load the matching skill first: `impeccable` for new or redesigned UI, critique and polish; `animate`,
  `review-animations`, `improve-animations` or `apple-design` for motion; `dataviz` for charts; `diagram-design` for
  diagrams.
- Reuse the tokens and components in `engine/src/style.css`. A new token goes into `DESIGN.md` in the same change.
- 390 px first; 44 px targets; `rem` type; both themes; both UI languages; reduced motion, transparency and contrast.
- Check it in a real browser at 390 px and desktop, in Chromium and WebKit, and walk the group's journeys
  (`verify-page`; the `ux-verifier` agent).
- Never describe people by family relationship.
