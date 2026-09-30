---
paths:
  - 'destinations/**'
---

# Destination packs

Read `destinations/README.md` and `memory-bank/standards/patterns/engine.md` § Core modules and packs. The workflow is the
`destination-pack` skill.

- Packs are pure: no imports, no DOM, no trip globals, named exports only. Every export is optional.
- Amounts are in the country's currency. Text is `[zh, en]`.
- Every fact in `knowledge.md` carries the date it was checked, and every function a unit test in
  `tests/unit/packs.test.mjs`.
