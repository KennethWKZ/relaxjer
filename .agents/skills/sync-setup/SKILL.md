---
name: sync-setup
description: Set up, check or end group sync for a RelaxJer trip, so added stops, pushed-back times, flight changes and shared checklist ticks reach every phone in the group — through the planner's own Firebase Realtime Database. Use when someone wants the group's phones to share changes, asks to "sync" or "share my changes" with the others, or when a trip is over and its sync should end. Covers the one-time Firebase setup, `pnpm sync rules|init|planner|end|status`, planners, the build flag, and what never to do with the keys.
---

# Sync setup: `pnpm sync`

Group sync is optional, per trip ([ADR-20261001-group-sync](../../../memory-bank/standards/decisions/ADR-20261001-group-sync.md)).
The page reaches the planner's own Firebase database over plain HTTPS; every record is encrypted on the phone, so the
database never sees what's in the plan. RelaxJer runs nothing for it.

## Once per planner (the planner does this; about 5 minutes)

1. **A Firebase project.** In the [Firebase console](https://console.firebase.google.com/), create one, or add
   Firebase to an existing Google Cloud project. Which one decides the plan:
   - **A project with no billing account** stays on the free **Spark** plan, which can't charge at all. Best when the
     Maps keys live in another project.
   - **The project that holds the Maps keys** has a billing account (Maps needs one), so Firebase puts it on the
     pay-as-you-go **Blaze** plan: the same free amounts (1 GB stored, 10 GB downloaded a month), billed beyond them.
     A family trip uses about 1% of that; a budget alert on the billing account covers the rest.
2. **A Realtime Database** (Build → Realtime Database → Create): the region nearest the trip (`asia-southeast1`,
   Singapore, for Asia), and **locked mode**. Copy its URL, `https://<name>.<region>.firebasedatabase.app`.
3. **`firebase login`** once, in their own terminal (`! npx -y firebase-tools@15.32.1 login` from Claude Code). It
   opens a browser; the agent never sees the credentials.
4. **The rules:** `pnpm sync rules --db <database url>`. Run it again after `scripts/sync/database.rules.json` changes
   (rules from before approval refuse every approval trip: deploy them again first).
5. **Anonymous sign-in** (Build → Authentication → Sign-in method → Anonymous → Enable), and the **web API key**
   (Project settings → General → Web API key; register a web app there if none is listed). Each device signs in
   anonymously with it, so a planner can let it in. The key names the project and isn't a secret, but restrict it in
   Google Cloud → APIs & Services → Credentials: only the Identity Toolkit and Token Service APIs, and only the
   `https://ht-ml.app/*` referrer.

## Per trip

```sh
pnpm sync init --trip trips/<slug> --db <database url> --api-key <web API key>   # new keys → ~/.config/relaxjer/sync/<slug>.json, the gate → the database
pnpm sync planner --trip trips/<slug>                     # the planner code (asked for, hidden): only hashes are kept
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json --sync ~/.config/relaxjer/sync/<slug>.json
pnpm sync approve --trip trips/<slug>                     # the join requests waiting: name, kind, join code
pnpm sync approve --trip trips/<slug> --code <join code> [--planner]   # let that device in (recovery)
pnpm sync status --trip trips/<slug>                      # set up? which database? (never prints a key)
pnpm sync end --trip trips/<slug>                         # after the trip: its records and gate are deleted
```

- **A new trip is an approval trip**
  (ADR-20261127-sync-approval): a device
  reads or writes the group's changes only once a planner let it in, and the database refuses the rest. Each device's
  name goes in Group sync (or the welcome sheet) and becomes its join request; it shows a bar, "Waiting for a planner
  to let this device into the group's changes", with a 4-digit join code. Its own changes wait on it and go once it's
  in.
- **The first planner device lets itself in** with the planner code (Group sync → "I'm a planner"). From then on a
  planner answers the others in Group sync → Join requests ("Mei · iPad · Safari", with the join code): Approve as
  typed, edit the name first, "Same person as Mei (iPhone)" for someone's other device, or Block. Once in, a device's
  name and person are the planners' to change ("Change the name or person" under it in The group).
- **`pnpm sync approve` is the recovery** for a forgotten code or every planner device lost: it lists the join requests
  from the laptop, and `--code <join code> --planner` lets one in as a planner.
- **`pnpm sync init --token`** still makes the older kind, a token trip (no sign-in, no approval: anyone with the page
  reads and writes). A trip whose sync is already live stays as it is until it's over; never switch it mid-trip.

- Mark the checklist groups the whole group shares (bookings, tickets) `shared: true` in `data.js`
  ([`trip-format.md`](../../../memory-bank/standards/trip-format.md), Checklist). Leave each person's own (passports,
  packing) unmarked.
- Then `verify-page`, and `publish-htmlapp`; run `pnpm publish:trip trips/<slug> --audit --candidate <page>` before the
  first publish with sync, which also proves the page may reach the database from the live address.
- **The planner runs `pnpm sync planner` themselves** in their own terminal (it asks for the code twice, hidden; never
  type it for them or put it in a command line). An agent's shell, or a `!` command in Claude Code, has no terminal to
  ask on: there the planner writes the code alone in `~/.config/relaxjer/sync/<slug>.planner-code` (mode 600) from
  their own terminal, and the command reads it and deletes it.
- **Then rebuild and republish**: the code's hash is in the page. On their own phone the planner opens Group sync → "I'm
  a planner" → the code. Ask everyone to set a name first: a planner can make another phone a planner only once it's
  listed in "The group". A phone is its storage, so the iPhone home-screen copy, cleared site data or a reinstall is
  a new phone: give the code there again, or have a planner promote it. Running `pnpm sync planner` again sets a new
  code (rebuild and republish again); phones already planners stay planners. `pnpm sync init --force` makes a sync
  file with no code: set it again
  ([ADR-20261002-sync-planners](../../../memory-bank/standards/decisions/ADR-20261002-sync-planners.md)).
- A phone's first open asks for its name once (Not now leaves a bar under the header); the add-stop sheet asks too.
- "The group" lists each person once, with their devices under their name by kind ("iPhone · home-screen app", "Mac ·
  Chrome"). Someone on several devices uses one name on each; a planner gives the planner code on each of their
  devices first, then uses the same name.
- A planner can block a phone (Group sync → The group → Block this phone): its stops and last changes go back to the
  plan, and what it writes next is ignored (on an approval trip the database refuses it too); it folds away under
  "Blocked phones (N)". A tester or a stray phone: block
  it; never a person's own other device (it would keep its changes to itself). Someone who shouldn't see the trip
  any more: a new page password too.
- Each phone changes only the stops it added; planners change any. Pushed-back times, flight changes and shared ticks
  stay open to every phone.

## Never

- **Never read, print, paste or commit the sync file**, or pass its values on a command line. `pnpm sync` and
  `pnpm build` read it themselves. The hygiene test and the write guard block a pasted one.
- **Never `init --force` a trip that's live** unless the planner wants everyone to start over: it's a new database.
- **Never publish a page with sync anywhere public.** The keys are in the page; the ht-ml.app password is what guards
  them. A leaked page: `pnpm sync end`, then `init` again and republish.

## If it fails

| Symptom                                                                      | Likely cause and fix                                                                                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `init`: "Permission denied" or 401                                           | `firebase login` not done, or the wrong project: pass `--project <id>`                                                            |
| `init`: "isn't its project's default one"                                    | A second database in the project: pass `--project <id>`                                                                           |
| Page: "Group sync: stopped"                                                  | The trip's token is gone (`sync end` ran, or `init` again): rebuild with the current sync file                                    |
| Page: "the database refused a change"                                        | The rules weren't deployed (`pnpm sync rules`), or a phone's clock is more than a day ahead                                       |
| Page: changes "waiting for a connection"                                     | Offline, or the page can't reach the database: run `--audit` for what the policy or network refused                               |
| Page: no "I'm a planner" box                                                 | No planner code in the page: the build says `planner code not set`; `pnpm sync planner`, rebuild                                  |
| Page: "That isn't the planner code"                                          | A typo, or the code changed and the page wasn't rebuilt and republished since                                                     |
| Page: "The database didn't take the planner code"                            | An approval trip whose proof isn't in the database: run `pnpm sync planner` again, rebuild and republish                          |
| Page: "waiting for a connection" before anything synced, on an approval trip | Anonymous sign-in isn't enabled, or the API key is restricted to another referrer: step 5 above                                   |
| Page: a device waits and no request shows                                    | The planner's device isn't approved itself yet, or the rules are older than approval: `pnpm sync rules`, then `pnpm sync approve` |

## Next

`verify-page`, then `publish-htmlapp`.
