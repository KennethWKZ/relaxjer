---
id: ADR-20261002-sync-planners
date: 2026-10-02
title: 'Group Sync Gets Planners, Own-Stop Edits, Undo and a Recently Removed List'
domain: data
status: accepted
---

# Group Sync Gets Planners, Own-Stop Edits, Undo and a Recently Removed List

## Summary

With group sync ([ADR-20261001-group-sync](ADR-20261001-group-sync.md)) one tap on any phone could remove a stop
from everyone's page, and "Back to the original plan" (labelled "clear what I added") wiped the whole group's added
stops. Nothing could bring either back. Now each phone changes or removes only the stops it added. A **planner**
(the phone that gives the trip's planner code, or one a planner made planner) can change any stop, clear one
person's, make other phones planners, and put the whole plan back. Every removal has an Undo on the toast, and each
phone keeps a "Recently removed" list with Put back. A bar under the header asks a phone with no name for one, so
sync isn't hidden in the Sections menu. Decided by the maintainer on 2026-10-02.

## Context

- Anyone in the group could remove anyone's added stop, and the only "clear" was the whole group's plan.
- Removing is a newer version of a record and the newest wins, so a removal was final; nothing kept what went.
- Nobody could see who added what, or how many, so a phone that added too many stops and forgot about them was hard
  to spot.
- The name that travels with changes was set only in the Group sync sheet, two taps into the floating Sections
  button, so most phones never set one.
- RelaxJer is open source: a role can't be tied to a name the engine knows. The first planner has to come from the
  person who set sync up, and a name alone proves nothing: anyone can type it.

## Decision

Scope: everything here but two items is for pages with group sync on. Undo on the toast and the caution for a busy
day ship on every page, sync or not.

- **A role belongs to a phone, not a name.** Records gain two kinds: `who:<device>` (the name a phone goes by) and
  `role:<device>` (`'planner'`, or gone). A stop records the phone that added it (`dev`). Stops from before the
  field belong to the phone that wrote their newest version (`Sync.ownerOf`).
- **The first planner is whoever gives the trip's planner code.** `pnpm sync planner --trip trips/<slug>` asks for
  a code (hidden, 6+ characters) and keeps only a salt and its PBKDF2-SHA-256 hash (210,000 rounds) in the trip's
  sync file. The build puts that hash in the page. A phone that gives the code under "I'm a planner" in Group sync
  writes `role:<itself>`. Planners make any phone in the group a planner, or not, from "The group" list. All
  planners are equal. A planner can promote only phones listed in "The group" (each person sets a name first) and
  can't step down from its own row; another planner can. A phone can't take a name a planner's phone goes by.
- **Who may do what:**
  - Everyone can change or remove the stops their own phone added, and clear them all: "Remove the N stops I added",
    which replaces "Back to the original plan" on the everyday controls.
  - A planner can also change or remove any stop, clear one phone's stops, and use "Back to the original plan, for
    everyone" in the Group sync sheet. That clears stops, flight changes and pushed-back times, never names, roles or
    ticks.
  - Only stops are guarded (`canEditStop`). Pushed-back times, flight changes and shared ticks stay open to every
    phone, as before: they're one per day or per item, and changing them is the point.
- **A planner can block a phone.** "Block this phone" on any other phone in "The group" (which lists every phone
  heard from, named or not) writes `block:<device>`, takes away its planner role, removes its added stops, and puts
  back to the original plan the pushed-back times, flight changes and shared ticks it changed last. From then on
  every phone drops what it writes (`Sync.dropBlocked`), a block it writes for itself included. The blocked phone
  is told in the bar under the header and stops sending; its changes wait on it. Unblock sends them. Undo after a
  block puts everything back.
- **Every removal can be undone.** The toast after a removal or reset carries Undo for 8 seconds. Undo puts back
  only what that action took, as a newer version, so stops the group added in between stay. Every stop that leaves
  the plan, here or from another phone, goes on this phone's "Recently removed" list (`syncGone`, never synced: it
  keeps 30, the sheet shows the newest 10). Put back is offered to the phone that added the stop, and to planners.
- **Sync is visible.** On a phone's first open with sync on, a welcome sheet asks for its name once, after the page
  has shown (a second, or the first scroll) and never over another sheet: Save, or Not now. Until it has a name, a
  bar under the header asks too (Add name / Later; Later hides it for a day). It's a sheet over the page, not a gate:
  the group opens the link to see the plan, and everyone can type a name. The add-stop sheet says the stop goes on
  everyone's page and asks for a name right there. The Group sync sheet lists the group: each phone's name, its
  added stops and whether it's a planner.
- **A soft limit, not a hard one.** Adding a stop to a day that already has 4 added stops shows a caution in the add
  sheet. The database can't count stops, because it only sees ciphertext.

## Alternatives

| Option                                                    | Why not                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Named planners with a code each, set from the CLI         | Built first, then dropped: it ties the role to a name, and every new planner needs the CLI and a republish               |
| The first phone to open the page is the planner, no code  | Whoever opens it first wins (often not the planner), and phones offline at the time can disagree about who was first     |
| Roles enforced by the database rules                      | Records are encrypted, so the rules can't see a role or a stop's owner without the page sending them in the clear        |
| Signing role records with a planner's key (ECDSA)         | Stops it from being forged, but anyone who can edit the page can remove stops directly anyway: cost with no gain         |
| A hard cap on added stops                                 | The database can't count encrypted records; a cap in the page would only block honest phones                             |
| Remove a phone instead of blocking it                     | Nothing can take a phone off the database: it keeps the keys in its copy of the page. New keys mean everyone starts over |
| Keep any phone able to remove any stop, and add Undo only | Undo is gone after 8 seconds; the people who most need protecting are the ones who won't open a list to put it back      |

## Consequences

- **Security:** roles guard against mistakes, not attackers. The page enforces them, not the database: anyone with
  the page password can edit the page's code and write any record, a `role:` for their own phone included, and a
  phone still on an older build doesn't know about blocks. To cut a phone off for real: a new page password, and new
  sync keys (`pnpm sync init --force`). The
  planner code is never stored or shown, only a salted hash (210,000 PBKDF2 rounds, below OWASP's 600,000 for
  passwords): someone holding the page could guess a short code offline, so use one that isn't a password anywhere
  else. A leaked code: run `pnpm sync planner` again, rebuild and republish (the hash is in the page); phones
  already planners stay planners.
- **Operational:** the planner runs `pnpm sync planner` once per trip, in their own terminal, then rebuilds and
  gives the code on their own phone. `pnpm sync init --force` writes a sync file with no planner code: set it again.
  A phone is its storage: the iPhone home-screen copy, a browser whose site data was cleared, or a reinstall is a new
  phone, which can't change its old stops and isn't a planner until it gives the code again (or a planner makes it
  one). A live trip needs no migration: the new record kinds sit beside the old ones, and stops already there keep
  the phone that last wrote them as their owner. Phones still on the old build ignore `who:` and `role:` records
  and stay unrestricted until they take the update bar.
- **Cost:** none. A name and a role are a few small records per phone, within the free amounts.

## Read when

You're changing who may change or remove what with group sync on, the planner code, Undo or the Recently removed
list, or how the page asks a phone for its name.
