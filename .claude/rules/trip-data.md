---
paths:
  - 'trips/**'
  - 'examples/**'
---

# Trip data

Read `memory-bank/standards/trip-format.md` and `memory-bank/standards/patterns/trip-data.md` (SSoT).

- Fixed times are `fixed: true`; flight-tied times use `rel`. Group costs are group figures ("NT$a–b / 五人",
  "NT$a–b for 5"); the page adds the per-person share.
- Never describe people by family relationship. Seniors: walking ×1.4, a taxi first for long legs.
- Never invent a booking, price or budget; mark estimates ("≈").
- `trips/` is never committed, and its details never leave it: not into the engine, docs, tests or commit messages.
- The demo stays synthetic: nothing real, nothing copied from Google.
- Check with `TRIP_DIR=<trip> pnpm test`.
