---
id: ADR-20261001-group-sync
date: 2026-10-01
title: "Group Sync Through the Planner's Own Firebase Realtime Database, Over Its Plain HTTPS API"
domain: data
status: accepted
---

# Group Sync Through the Planner's Own Firebase Realtime Database, Over Its Plain HTTPS API

## Summary

A trip page can share what the group changes on the trip: added stops, pushed-back times, changed flight times, and
the ticks of checklist groups marked `shared`. Every phone sees each change within seconds, and works offline as
before. It's optional, per trip: the planner sets up their own Firebase Realtime Database once (`pnpm sync`), and the
build puts it in (`--sync`). The page talks to it with `fetch` and `EventSource`, no library; every record is
encrypted on the phone, so the database holds only ciphertext under names it can't read. Decided by Kenneth on
2026-10-01. This reverses the project brief's "no shared state" non-goal, for trips that opt in.

## Context

State lived on each phone (`localStorage`). The only way to share was the `#add=` link for added stops, which carries
no removals, pushed-back times, flight changes or ticks, and has to be tapped by each person. On an iPhone a tapped
link opens in Safari or the chat app's browser, never in the home-screen copy (which has its own storage), so a shared
link may import into storage the person never opens again (not yet tested on a device).

The page is one static HTML file on ht-ml.app behind a password: no server of ours, no service worker, offline after the
first load. Whatever syncs has to be reachable from plain page JavaScript, free for a family, private, and not depend on
the phone being online at the same moment as the others.

## Decision

- **The planner's own Firebase Realtime Database**, on the free Spark plan when its project has no billing account (a
  project that also holds the Maps keys is on Blaze: the same free amounts, billed beyond them), in the region nearest the trip
  (`asia-southeast1` for Asia). One per planner, like their Google keys
  ([ADR-20260930-google-keys](ADR-20260930-google-keys.md)); RelaxJer runs nothing.
- **The page uses the database's REST API directly**: `GET` to read a trip, `PATCH` (one request, all or nothing) to
  send changes, `EventSource` for live changes. No Firebase SDK: the page already keeps its own copy on the phone,
  which is the part the SDK can't do in a web page, and the SDK would add 287 KB of outside code that could read the
  keys.
- **What syncs is a set of records** (`engine/src/core/sync.mjs`): `stop:<id>`, `shift:<date>`, `flt:arr|dep`,
  `tick:<group>-<item>` for groups with `shared: true`. Everything else (language, theme, rate, personal ticks) stays
  on the phone. Each record's newest version wins: the later edit, a tie to the larger device id.
- **The phone's saved state is the source of truth.** A change is saved first, queued, and sent when there's a
  connection; what comes from the group is checked like a pasted share link, merged, saved, and the page redraws once
  it has settled. A phone's state from before sync goes in as the oldest version, so anything synced wins.
- **Three secrets per trip**, made by `pnpm sync init`, kept in `~/.config/relaxjer/sync/<slug>.json` (mode 600) and
  baked into the page (which is behind the ht-ml.app password):
  - a random **trip id**, the database path;
  - a **write token**: the rules (`scripts/sync/database.rules.json`) only take a record carrying the token stored at
    `/keys/<trip>`, which no phone can read or write. A trip the planner didn't create accepts nothing;
  - a **sync key**: records are AES-GCM encrypted under a key derived from it, and named by an HMAC of their id, so the
    database sees neither content nor kind.
- **The rules also keep the newest**: an older version can't replace a newer one, a record can't be deleted, fields and
  size are fixed, and an edit time more than a day ahead is refused. Once the planner ends sync (`pnpm sync end`), the
  trip can't be read or written, and its records are gone.
- **Opt-in per trip.** A page built without `--sync` behaves as before. The `#add=` link stays, for anyone outside the
  group.

## Alternatives

| Option                                    | Why not                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A better share link only (query or `#`)   | Still a hand-off someone taps, per change; on iPhone it likely lands outside the home-screen copy         |
| WebRTC phone to phone                     | Both phones must be online at once, carrier NAT needs a relay server anyway, iPhone drops it when locked  |
| ntfy.sh as the relay                      | Free and zero-setup, but keeps messages 12 hours, rate-limits per IP, no guarantees from one operator     |
| Momento Topics                            | Messages are dropped once delivered; its cache keeps items 24 hours at most; needs an API key in the page |
| FCM web to web                            | Sending needs a service-account server (the legacy API ended June 2024); receiving needs a service worker |
| The Firebase JavaScript SDK               | 287 KB more code with access to the keys, and its offline cache isn't available in web pages              |
| A shared relay RelaxJer runs for everyone | Makes the project an operator of strangers' data: abuse, uptime, terms                                    |

## Consequences

- **Security:** anyone with the page password can read and change the shared plan: the same trust as the page. ht-ml.app
  has no delete, so a leaked page leaks its sync keys for good; `pnpm sync end` (and a new `init` for a new page) is the
  remedy, and the page's Content-Security-Policy only lets it connect to that one database
  ([ADR-20261001-page-csp](ADR-20261001-page-csp.md)). Google stores ciphertext, edit times and device ids, not content.
- **Operational:** each planner does a five-minute Firebase setup once, then `pnpm sync init` per trip (the `sync-setup`
  skill). A rebuild must keep the same sync file, like `storageKey`, or the group starts over. The rules are tested on
  Firebase's emulator (`pnpm test:sync-rules`, needs Java), and the e2e suite runs two phones against a stand-in that
  enforces the same rules (`tests/support/fake-rtdb.mjs`).
- **Cost:** free within the database's free amounts: a group of six opening the page 40 times a day downloads about
  110 MB a month of the 10 GB, with at most six of the 100 allowed connections. On Spark (a project with no billing
  account) it can't charge at all; in the project that holds the Maps keys it's Blaze, billed only beyond those amounts,
  under that billing account's budget alert. The first trip shares one project for Maps and sync.
- **Open:** a real-database check from a live page; whether checklist sharing should be per item rather than per group
  (a group like "Before the trip" mixes a booking with each person's passport).

## Read when

You're changing what the page shares or how it merges, the sync rules, `pnpm sync`, or anything else that sends a trip's
state off the phone.
