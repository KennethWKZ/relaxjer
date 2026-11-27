---
id: ADR-20261127-sync-approval
date: 2026-11-27
title: 'Group Sync Admits Only Devices a Planner Approved'
domain: sync
status: accepted
decision: 'The page stays on ht-ml.app; a device reads or writes group sync only after a planner approves it, enforced by anonymous Auth and the rules.'
tags: [hosting]
---

# Group Sync Admits Only Devices a Planner Approved

## Summary

Accepted on 2026-11-27 by Kenneth; not built yet. The trip page stays one file on ht-ml.app behind its password, as today. What changes is group
sync: each device signs in to Firebase Auth anonymously, sends a join request with the name its person types, and can
read or change the shared plan only after a planner approves it. The database rules enforce it, on Firebase's free
plan. A block becomes "the database refuses this device", not "every device ignores it". Raised by Kenneth on
2026-11-27, after he chose to keep ht-ml.app rather than move hosting for web push; the questions below were settled
with him the same day.

## Context

- **Today:** the page carries the trip's database address, sync key and write token
  ([ADR-20261001-group-sync](ADR-20261001-group-sync.md)). The rules check only the write token, so **anyone who has
  the page** (anyone with its password) can read the group's records and write new ones. A blocked device
  ([ADR-20261002-sync-planners](ADR-20261002-sync-planners.md)) is dropped by every other device, not by the database:
  it can still read and write.
- **Who someone is** is whatever name a device types: devices giving the same name are one person in The group, and
  only a planner's name is protected. An approved-looking device can call itself anyone.
- **The page itself can't be gated per person on ht-ml.app:** the host serves one file to anyone with the password,
  so the plan, the hotels and the flights stay readable by anyone holding it. This decision is about the shared,
  changing part: added stops, push-backs, flight changes and shared ticks.
- **A device** is one browser's storage on one machine (the glossary): an iPhone's Safari and its home-screen copy are
  two devices, and so are an iPad and a laptop.
- **Firebase anonymous Auth** gives each browser a stable user id over plain REST (Identity Toolkit and Secure Token
  endpoints), with no SDK, and works on the free (Spark) plan. Checked from memory on 2026-11-27; recheck before
  building.
- `pnpm sync` already writes to the database as the planner (`firebase login`).

## Decision

### Joining

- **A device signs in anonymously** on its first open with sync on (`accounts:signUp` over REST) and keeps its refresh
  token in its own storage. Clearing that storage makes it a new device that asks again.
- **It sends a join request** at `/trips/$trip/devices/$uid`: the name its person types (the welcome sheet already asks
  for one), its kind (`iPad · Safari`), its sync id (`dev`) and a short **join code** it shows on screen. State
  `pending`.
- **A pending device** works as a page without group sync: its own added stops and ticks stay on it and go to the group
  once it's approved, nothing lost. It sees no group changes until then, and a bar says "Waiting for a planner to let
  this device into the group's changes".

### Approving

- **Approval is per device.** Any planner device can approve or block, in the Group sync sheet, which lists join
  requests as "Mei · iPad · Safari".
- **People name themselves; the planner confirms.** Approving takes the typed name, or the planner edits it, or matches
  it to a person already in the group (the sheet says "Same person as Mei (iPhone)" when the name matches). After
  approval the device's person and name are locked: only a planner can rename a person or move a device to another.
- **The first planner device approves itself with the planner code.** `pnpm sync planner` stores, besides the page's
  PBKDF2 hash, a second, separately salted hash of the code at a path no device can read. A pending device given the
  code sends that value with its write to `planners/$uid` and its own approval, and the rules compare it. Anyone with
  the page holds only the page's hash, which the rules don't take; guessing the code is as hard as today.
- **Recovery from the laptop:** `pnpm sync approve` lists pending devices by name, kind and join code, and approves one
  as a planner, for a forgotten code or every planner device lost.

### The rules (the gate)

- `devices/$uid`: a device may create its own entry only as `pending`, and change its own name only while pending;
  only a planner may set the state, the person or the name after that.
- `planners/$uid`: written by an existing planner, by the CLI, or by the device itself with the planner-code proof.
- `r/` (the sync records): read and write only by an `approved` device, with today's newest-wins check; a record's `d`
  must be the writing device's own `dev`, so no device writes as another.
- Every rule has emulator tests before any deploy (`pnpm test:sync-rules`), and the e2e stand-in database follows the
  same rules.

### Found while building (2026-11-27)

- **A device's sync id is bound to its sign-in:** its `dev` is the first 24 characters of its Auth user id, and the
  rules check it. Without that, an approved member could register a second device under someone else's `dev`, get it
  approved, and write as them.
- **The planner-code proof sits apart:** approved devices can read `planners/`, so the proof goes in `claims/$uid`,
  written in the same update and readable by nobody.
- **Names are sealed** like records, so Google still sees only ciphertext; the CLI opens them with the key in the sync
  file.
- **Approval trips are told apart by a gate** the CLI writes at `/gates/$trip` (with the proof hash), readable by no
  device; a token path works only while a trip's write token exists and no gate does, so a token never opens an
  approval trip, and `pnpm sync end` closes both.

### Blocking

- A planner blocks a device from the sheet. Its added stops and last changes still go back to the plan for everyone,
  as today; the database now also refuses its reads and writes. Its bar says it's blocked; Unblock sends what waited.
- The `block:` record and the write token go: `devices/$uid` state and approval replace them. The sync key stays in the
  page, so Google still sees only ciphertext; the gate is who may fetch records, not who can decrypt them.

### The page

- **The Firebase web API key** goes into the page for the Auth endpoints. It identifies the project and isn't a
  secret; it's restricted to the Identity Toolkit and Token Service APIs and to the ht-ml.app referrer.
- **The Content-Security-Policy** adds the two Auth endpoints to `connect-src`
  ([ADR-20261001-page-csp](ADR-20261001-page-csp.md)).
- The page's own words ("phone", "Blocked phones") move to "device" where they mean any device, in a separate copy
  change.

### Rollout

- **New trips and the demo only.** A trip whose group sync is already live keeps today's model until it's over; it is
  not switched mid-trip.
- **First on the demo trip** against the rules emulator and the e2e stand-in database, then on a throwaway project with
  real devices (an iPhone with its home-screen copy, an Android phone, a laptop), before any real trip.

## Alternatives

| Option                                                                 | Why not                                                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Keep the write token only                                              | Anyone with the page password reads and writes the group, anyone can pose as anyone, and a block is a request |
| Move to Firebase Hosting with approval and web push                    | Gates the page too and adds alerts, but replaces hosting and needs Blaze; Kenneth chose to stay (2026-11-27)  |
| A planner's people list that devices pick from                         | A list to set up before anyone joins; the typed name plus the planner's confirmation protects as well         |
| The planner names each device at approval                              | The planner would be guessing whose iPad it is                                                                |
| Approve per person (an approved device vouches for its owner's others) | Anyone holding an approved device could let in more devices without a planner                                 |
| The laptop as the only way to make the first planner                   | A step on another machine; the planner code on the device itself does it, with the laptop as recovery         |
| Google sign-in instead of anonymous                                    | Every member needs a Google account to manage; anonymous plus approval is one tap for them                    |
| Encrypt the sync key per approved device                               | Anyone with the page already holds the plan and the key; wrapping adds code, not safety                       |

## Consequences

- **Security:**
  - Someone with the page password but no approval sees the trip as published, and nothing the group changes after;
    they can't write to the group or pose as a member.
  - A block and a person's name become enforced by the database, not by each device's goodwill.
  - New surface: the API key (restricted), anonymous accounts (a stranger can file a join request; it reads nothing,
    and a planner ignores or blocks it), the planner-code proof, and the rules, now the real gate.
  - The page password still guards everything in the page itself; a leak still means `--new-password`.
- **Operational:**
  - A planner approves each new device once, two taps per person with a phone and a tablet. The first planner device
    needs only the planner code.
  - Approval needs a connection; a device added offline keeps its changes until it's approved.
  - Refresh tokens and anonymous accounts can be cleared or expire: a device that loses its storage asks again.
- **Cost:** none expected. Anonymous Auth, the Realtime Database and the rules fit the free plan at a group's size; no
  Cloud Functions, no Blaze. Figures from memory on 2026-11-27; recheck before building.

## Read when

You're changing who may read or write group sync, how a device joins, is named or is blocked, or the sync rules.
