---
paths:
  - 'scripts/sync/**'
  - 'engine/src/core/sync.mjs'
  - 'engine/src/app/26-sync.js'
  - 'tests/support/fake-rtdb.mjs'
  - 'tests/e2e/sync.spec.mjs'
---

# Group sync

Read ADR-20261001-group-sync and ADR-20261002-sync-planners (`memory-bank/standards/decisions/`), and the `sync-setup`
skill for the planner's side.

- The database is the planner's own Firebase; RelaxJer runs nothing. Records are AES-GCM encrypted on the phone and
  named by HMAC, so the database never sees the plan. `localStorage` stays the source of truth, with an outbox.
- Never read, print, paste or commit a trip's sync file or a planner code. `pnpm sync` and `pnpm build --sync` read
  them, and the planner types the code in their own terminal.
- Roles are a guard against slips, not security: the page password is. A change to who may edit what is an ADR
  amendment, with the database rules (`scripts/sync/database.rules.json`) checked by `pnpm test:sync-rules` on the
  emulator.
- Two-phone behaviour is tested against `tests/support/fake-rtdb.mjs` in `tests/e2e/sync.spec.mjs` (`@demo`).
- A change the group sees updates `guides/trip-page.md` § Group sync and the `sync-setup` skill.
