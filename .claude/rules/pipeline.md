---
paths:
  - 'pipeline/**'
  - 'destinations/**/pipeline/**'
---

# Pipeline

Read `memory-bank/standards/patterns/pipeline.md` (SSoT) and `knowledge/data-hygiene.md`.

- Google first (the user's own server key), the operator's live source where it's better, OpenStreetMap only for what
  Google can't give.
- A step is generic (`pipeline/steps/`), a country's or a city's. What one trip searches for goes in its
  `pipeline.json`.
- Stable output: sort before writing; never depend on set or dict order.
- The server key is never printed, logged, committed or put in a page.
- Google bills every call: go through `lib/google.py`'s `call()`, never around its cache, and never pass `--yes` or
  `RESYNC_PAID`. Paying for a refresh is the planner's call.
- Every step has an offline test in `pipeline/tests/` (`pnpm test:pipeline`).
