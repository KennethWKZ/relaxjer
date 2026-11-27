---
id: ADR-20261127-firebase-hosting-approval-push
date: 2026-11-27
title: 'Trip Pages on the Planner’s Firebase Hosting, With Planner Approval and Web Push'
domain: hosting
status: proposed
decision: 'Proposed: a trip page on the planner’s Firebase Hosting, opened by phones the planner approves, with web push from a Cloud Function. Demo trip first.'
tags: [sync, design]
---

# Trip Pages on the Planner’s Firebase Hosting, With Planner Approval and Web Push

## Summary

Proposed, not built. Move a trip's page from ht-ml.app to Firebase Hosting in the planner's own Firebase project (the
one group sync already uses), replace the shared page password with **planner approval** per device, and add **web
push** for join requests and the group's changes, sent by a Cloud Function. Prototyped on the synthetic demo trip in a
throwaway project first; a real trip moves only after the prototype passes the exit criteria below and the planner
says go. Raised by Kenneth on 2026-11-27, after the "while you were away" card
(ADR-20261127-while-away, in review) covered the no-new-service part.

## Context

- **Today:** one self-contained HTML file per trip on ht-ml.app behind one shared password (`knowledge/hosting.md`).
  The host serves one file only, so there is no service worker. Group sync runs on the planner's Firebase Realtime
  Database over REST, with records encrypted on the phone and a write token in the page
  ([ADR-20261001-group-sync](ADR-20261001-group-sync.md), [ADR-20261002-sync-planners](ADR-20261002-sync-planners.md)).
- **What the group can't have today:**
  - news while the page is closed: web push needs a service worker on the page's own origin, and a sender holding a
    private key;
  - per-person access: a leaked password means a new one for everyone, and there's no removing one person.
- **What exists already:** planners and blocked devices are records (`role:`, `block:`); the database rules are tested
  on Firebase's emulator (`pnpm test:sync-rules`); the change wording for toasts and the away card is one function,
  `syncLine`.
- **Platform limits:** iPhones receive web push only in a page added to the Home Screen (iOS 16.4 or later), after a
  tap that asks for permission, and every push must show a notification. A Home Screen app keeps storage separate from
  Safari. Cloud Functions need the pay-as-you-go (Blaze) plan. Checked from memory on 2026-11-27; recheck before
  building.

## Decision (proposed)

### Hosting

- The page becomes a **public app shell plus encrypted trip data**, both on Firebase Hosting in the planner's project:
  the engine (no trip details), a service worker, a real manifest, and the trip bundle encrypted with the trip key
  (AES-GCM). Hosting serves only ciphertext of the trip, so it needs no gate of its own.
- The service worker caches the shell and the bundle, so the page works offline after a phone's first approved open.
  Updates keep the "update bar" model: a new bundle is fetched, and the page offers to switch.
- The Content-Security-Policy stays strict ([ADR-20261001-page-csp](ADR-20261001-page-csp.md)), now as a Hosting
  header, with `connect-src` limited to the project's database, Identity Toolkit and Secure Token endpoints.
- `pnpm publish:trip` gets a Firebase target (`firebase deploy --only hosting`, signed in as the planner); ht-ml.app
  stays for trips that don't move.

### Planner approval

- **Identity:** each browser signs in to Firebase Auth anonymously over REST (Identity Toolkit `accounts:signUp`, no
  SDK), and keeps its refresh token. A person's phone, tablet and laptop are separate devices, as in group sync today.
- **Asking to join:** a new device writes `/trips/$trip/members/$uid` with its name, its kind and an ECDH public key,
  state `pending`. The page shows "Waiting for the planner".
- **Approving:** a planner's device sees the request (and gets a push, below), taps Approve, and writes the trip key
  **wrapped to that device's public key** to `/trips/$trip/keys/$uid`. Google stores only wrapped keys, so the
  database never holds the trip key or the plan in the clear, as today.
- **Removing or blocking:** a planner sets the member's state to `blocked`; the rules then refuse its reads and writes.
  A full revoke (someone who already holds the key) means a new trip key, re-wrapped to every approved device, and a
  re-encrypted bundle: `pnpm sync rotate`.
- **Planners** are listed at `/trips/$trip/planners/$uid`, written only by `pnpm sync planner` from the planner's laptop
  (signed in as the project owner) or by another planner. Losing every planner device is recovered the same way.

### Database rules (the real gate)

- `members/$uid`: the device itself may create its own entry as `pending` and change its own name; only a planner may
  set `approved` or `blocked`.
- `keys/$uid`: readable only by `$uid` when approved; writable only by a planner.
- `r/` (sync records): readable and writable only by approved, unblocked members, with today's newest-wins check; the
  write token goes.
- `subs/$uid`: writable by `$uid` only, readable by nobody (the function reads it with its own identity).
- Every rule gets emulator tests before any deploy, as `pnpm test:sync-rules` does now.

### Web push

- Standard Web Push with a VAPID key pair; no Firebase Messaging SDK in the page. The page subscribes after a tap on
  "Turn on alerts" (on iPhone, only in the Home Screen app) and writes the subscription to `subs/$uid`.
- **Sender:** a Cloud Function (2nd gen, in the database's region) triggered by writes to `r/` and `members/`:
  - for a record, it pushes the record's ciphertext to every subscribed, approved device except the author's; the
    service worker decrypts it with the trip key it keeps in IndexedDB and words it with `syncLine`, falling back to
    "The plan changed";
  - for a join request, it pushes "Someone wants to join" to the planners;
  - it caps pushes per author per hour, and deletes subscriptions the push service answers 404 or 410.
- **Its identity:** its own service account with only Realtime Database read on the trip paths and Secret Manager
  access to the one VAPID secret; never the default compute service account (project editor). No service-account key
  file is ever created; the project blocks key creation by organisation policy where it can.
- **The VAPID private key** sits in Secret Manager, one secret for all of a planner's trips, one active version
  (old versions destroyed on rotation). The public key is in the page.

### Prototype first

On a throwaway Firebase project, with the synthetic demo trip only:

1. Hosting shell, encrypted bundle, service worker, offline after first open.
2. Anonymous sign-in, a join request, approval from a second device, a block, and `pnpm sync rotate`.
3. Rules on the emulator, then deployed; the function on the emulator, then deployed.
4. Push to an Android phone (Chrome) and an iPhone Home Screen app: a change, a join request, the rate cap.
5. A week of use, then read the bill.

**Exit criteria:** every step works on a real iPhone and Android phone; e2e covers what the browsers can (push itself
can't run in Playwright's WebKit, so a manual check list covers it); the bill shows $0; and the release gate passes.

## Alternatives

| Option                                                         | Why not (for now)                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Stay on ht-ml.app, the away card only                          | Done (ADR-20261127-while-away, in review); no news while the page is closed, one shared password                       |
| ht-ml.app for the page plus a separate "alerts" app on Hosting | Two Home Screen icons per iPhone and two approvals; still one shared password for the page                             |
| Our own password encryption of the page (no approval)          | The gate becomes our crypto code; one password for everyone; no per-person removal                                     |
| Firebase Auth with Google sign-in                              | Every member needs a Google account and a sign-in the seniors would have to manage; anonymous plus approval is one tap |
| Firebase Messaging SDK                                         | About 287 KB more in the page; standard Web Push with VAPID reaches the same push services                             |
| Push the plain text of a change                                | The function would need the trip key; forwarding ciphertext keeps Google out of the plan                               |

## Consequences

- **Security:**
  - The gate moves from ht-ml.app's password to Firebase Auth plus the database rules: Google's code and our tested
    rules, not our own crypto gate.
  - New assets to guard: the function's service account (least privilege), the VAPID secret, and above all the
    planner's Google account (2-step verification), which can deploy, read billing and change rules.
  - An approved member can still read and change the shared plan (as today) and could spam changes; the rate cap and
    blocking cover it.
- **Operational:**
  - Each planner adds one setup: Blaze with a budget alert, the function deploy, the Hosting site, run by a script from
    `sync-setup`; Claude may start `firebase login` / `gcloud auth login`, and the planner finishes it.
  - New moving parts: a service worker (stale caches), refresh tokens, a function runtime to keep current, and a manual
    push check list.
  - A Home Screen app on iPhone needs approving separately from Safari, and clearing a browser's data means asking again.
  - The first open needs a connection; today's page works from the first byte.
- **Cost:** about $0 at a group's size (Hosting, Realtime Database and anonymous Auth within the free allowances; a few
  hundred function calls; one secret version and a few hundred reads within Secret Manager's free allowance), but a
  card on file and a budget alert are required. Figures from memory on 2026-11-27; the prototype's bill confirms them.

## Read when

You're deciding whether to move a trip off ht-ml.app, building the approval or push prototype, or changing who can
read a trip.
