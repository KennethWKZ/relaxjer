---
id: ADR-20261127-sync-approval
date: 2026-11-27
title: 'Group Sync Admits Only Phones a Planner Approved'
domain: sync
status: proposed
decision: 'Proposed: the page stays on ht-ml.app; a phone reads or writes group sync only after a planner approves it, enforced by anonymous Auth and the rules.'
tags: [hosting]
---

# Group Sync Admits Only Phones a Planner Approved

## Summary

Proposed, not built. The trip page stays one file on ht-ml.app behind its password, as today. What changes is group
sync: each phone signs in to Firebase Auth anonymously, asks to join, and can read or change the shared plan only after
a planner approves it. The database rules enforce it, on Firebase's free plan. Blocking a phone moves from "every phone
ignores it" to "the database refuses it". Raised by Kenneth on 2026-11-27, after he chose to keep ht-ml.app rather than
move hosting for web push.

## Context

- **Today:** the page carries the trip's database address, sync key and write token
  ([ADR-20261001-group-sync](ADR-20261001-group-sync.md)). The rules check only the write token, so **anyone who has
  the page** (anyone with its password) can read the group's records and write new ones. A blocked phone
  ([ADR-20261002-sync-planners](ADR-20261002-sync-planners.md)) is dropped by every other phone, not by the database:
  it can still write, and it can still read.
- **The page itself can't be gated per person on ht-ml.app:** the host serves one file to anyone with the password,
  so the plan, the hotels and the flights stay readable by anyone holding it. This decision is about the shared,
  changing part: added stops, push-backs, flight changes and shared ticks.
- **Firebase anonymous Auth** gives each browser a stable user id over plain REST (Identity Toolkit and Secure Token
  endpoints), with no SDK, and works on the free (Spark) plan. Checked from memory on 2026-11-27; recheck before
  building.
- `pnpm sync` already writes to the database as the planner (`firebase login`), so it can approve the first planner
  phone from the laptop.

## Decision (proposed)

- **A phone signs in anonymously** on its first open with sync on (`accounts:signUp` over REST) and keeps its refresh
  token in the phone's storage. A phone stays what the glossary says: one browser's storage. Clearing it, or the iPhone
  Home Screen copy, is another phone that asks again.
- **It asks to join:** it writes a join request at `/trips/$trip/phones/$uid` with its name, its kind and its sync
  device id (`dev`), state `pending`. Until approved, the page works as a page that has no group sync: its own changes
  stay on the phone and wait, and the Group sync sheet says "Waiting for a planner".
- **A planner approves** in the Group sync sheet, which lists join requests with name and kind. Approving sets the
  state to `approved`; blocking sets `blocked`. The first planner phone is approved from the laptop
  (`pnpm sync approve`), which lists pending requests and marks one approved and a planner.
- **The rules are the gate:**
  - `phones/$uid`: a phone may create its own entry only as `pending` and change only its own name and kind; only a
    phone listed at `planners/$uid` may set the state;
  - `planners/$uid`: written by an existing planner or by the CLI;
  - `r/` (the sync records): read and write only by an `approved` phone, with today's newest-wins check; a record's
    `d` must be the writing phone's own `dev`, so no phone can write as another;
  - every rule has emulator tests before any deploy (`pnpm test:sync-rules`).
- **The planner code stays** as the in-page way for an approved phone to become a planner. The rules can't run
  PBKDF2, and the page's PBKDF2 hash is no proof (anyone with the page has it), so `pnpm sync planner` also stores a
  second, separately salted hash of the code at a path no phone can read. A phone that is given the code sends that
  value with its `planners/$uid` write, and the rules compare it. Guessing the code is as hard as today (offline
  against the page's hash); knowing the page alone isn't enough.
- **Blocking becomes server-side:** a blocked phone's reads and writes are refused by the database; the page keeps its
  "this phone is blocked" bar. The `block:` record goes; `phones/$uid` state replaces it.
- **The write token goes**: approval replaces it. The sync key stays in the page (it encrypts records, so Google still
  sees only ciphertext), and everyone with the page still holds it: the gate is who may fetch records, not who can
  decrypt them.
- **The Firebase web API key** goes into the page for the Auth endpoints. It identifies the project and isn't a secret;
  it is restricted to the Identity Toolkit and Token Service APIs and to the ht-ml.app referrer.
- **The page's Content-Security-Policy** adds the two Auth endpoints to `connect-src`
  ([ADR-20261001-page-csp](ADR-20261001-page-csp.md)).
- **Moving a live trip:** every phone already in the group is pending after the update. The planner's sheet offers
  "Approve the N phones already in the group" for requests whose `dev` already has records in the group, one tap
  instead of one each.
- **First on the demo trip** against the rules emulator and the e2e stand-in database, then on a throwaway project with
  two real phones, before any real trip.

## Alternatives

| Option                                                                | Why not                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Keep the write token only                                             | Anyone with the page password can read and write the group, and a block is a request, not a lock             |
| Move to Firebase Hosting with approval and web push                   | Gates the page too and adds alerts, but replaces hosting and needs Blaze; Kenneth chose to stay (2026-11-27) |
| A separate alerts app on Firebase Hosting                             | Two Home Screen icons and two approvals per iPhone; Blaze; doesn't gate the shared plan by itself            |
| Google sign-in instead of anonymous                                   | Every member needs a Google account to manage; anonymous plus approval is one tap for them                   |
| Approve per person (an approved phone vouches for its owner's others) | Anyone holding an approved phone could let in more phones without a planner                                  |
| Encrypt the sync key per approved phone                               | The page already holds the plan and the key for anyone with the password; wrapping adds code, not safety     |

## Consequences

- **Security:**
  - Someone with the page password but no approval sees the trip as published, and nothing the group changes after.
    They can't write to the group.
  - A block becomes enforced by the database, not by each phone's goodwill.
  - New surface: the API key (restricted), anonymous accounts (a stranger can create one and file a join request; it
    reads nothing, and a planner ignores or blocks it), and the rules, now the real gate.
  - The page password still guards everything in the page itself; a leak still means `--new-password`.
- **Operational:**
  - Planners approve each new phone once, and the first planner phone is approved from the laptop.
  - Approval needs a connection; a phone added offline waits, its changes kept, until it's approved.
  - Moving a live trip is a republish plus one "Approve the N phones" tap.
  - Refresh tokens and anonymous accounts are a new thing that can expire or be cleared: a phone that loses its
    storage asks again.
- **Cost:** none expected. Anonymous Auth, the Realtime Database and the rules fit the free plan at a group's size; no
  Cloud Functions, no Blaze. Figures from memory on 2026-11-27; recheck before building.

## Read when

You're changing who may read or write group sync, how a phone joins or is blocked, or the sync rules.
