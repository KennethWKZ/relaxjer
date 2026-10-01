# Plan a trip with RelaxJer and your AI agent

This guide is for the planner: the one person in the group who plans the trip. You talk to your AI agent in plain
words; it runs RelaxJer's skills, asks you before anything costs money or reaches people, and hands you one page for the
whole group. What that page does, part by part, is in [`trip-page.md`](trip-page.md).

You need a computer with a terminal and an AI agent that can work in a folder: Claude Code, Codex, Cursor or Gemini
CLI. You don't need to know how the engine works.

## 1. Set up, once

```sh
git clone https://github.com/KennethWKZ/relaxjer && cd relaxjer
```

Open the folder in your agent and say **"Set up RelaxJer on my computer."** It runs the `planner-setup` skill: it
checks the tools ([the list in the README](../README.md#plan-a-trip)), installs the repo's own parts, builds the demo
trip and opens it, so you see what your group will get. It asks before installing anything outside the folder.

Two accounts are optional, and each can wait until your trip needs it:

- **Google Maps (recommended, about 20 minutes):** live opening hours, ratings, photos and Google search on the page.
  Your agent walks you through [`google-maps.md`](google-maps.md); you paste the keys into the files yourself.
- **Group sync (optional, about 5 minutes):** so a stop added on one phone shows on every phone. It runs on your own
  free Firebase database (the `sync-setup` skill).

## 2. Describe the trip

Say **"Plan a trip"**, then tell it about the trip the way you'd tell a friend:

> Taipei, 13 to 19 March, five of us, two are seniors who can walk about 20 minutes at a time. We land at 13:30 on
> flight XX 188 and fly home just after midnight on the 19th. One hotel in Zhongshan. We've booked a concert on the
> 17th at 19:30. We'd love the hot springs and a night market; nobody likes early starts. Budget about RM 3,000 each,
> flights and hotel already paid.

It runs `trip-intake`: asks for anything missing in one message, writes your trip into `trips/<slug>/` on your computer
(never committed, never uploaded), and checks it. You can also fill in
[the requirements template](../.agents/skills/trip-intake/requirements-template.md) first.

## 3. Shape it together

Ask for changes the way you'd ask a travel agent. Your agent runs `trip-customize`, which knows which part of the page
each request becomes:

| You say                                                               | On the page                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| "Day 4 is too much for the seniors. Add a rest after lunch."          | the day's timeline, with slack around its fixed times                                              |
| "We booked a table at 18:00 on day 2."                                | a [fixed time](trip-page.md#fixed-times-and-running-late) with a red seal; a push-back stops there |
| "Two of us want to cycle on day 5 while the rest go back."            | a [day that splits](trip-page.md#a-day-that-splits), with its go / wait / skip rule                |
| "Suggest the observatory near the dumpling place, don't schedule it." | an [optional plan](trip-page.md#optional-plans-shop-lists-and-the-wishlist) chip at that stop      |
| "Add a list of tea shops, and a pharmacy list."                       | [shop lists](trip-page.md#optional-plans-shop-lists-and-the-wishlist), each with its map pins      |
| "Put 'buy SIM cards' on the checklist for everyone."                  | a [checklist](trip-page.md#before-you-go) item, shared when group sync is on                       |
| "Which is better from the airport, the train or a van?"               | the [airport](trip-page.md#the-airport-and-going-home) options, priced for the whole group         |
| "We move to a hot-spring hotel for the last two nights."              | a hotel per night: the map, "near the hotel" and the airport evening follow it                     |
| "Our home currency is ringgit; one is about 7.8 Taiwan dollars."      | each share and total [in both currencies](trip-page.md#money), with the rate editable on the page  |

**Ask travel questions any time.** "What should we do on day 3?", "Is this day too packed?", "What do we need to book
ahead?", "What if it rains?" In Claude Code, the agent can hand these to the read-only `relaxbro`, which researches
hours, closures, transport and costs with a source and a date for each, and proposes changes for you to approve.

## 4. Fill in the real-world details

Say **"Refresh the trip's data."** The `data-sync` skill asks Google (with your key) and OpenStreetMap for every
place's position and hours, the food, drinks, rest spots and toilets near each stop, the metro and bike share,
and the weather, then checks every link. It shows you what changed before writing it.

**Google bills each call.** The refresh answers from your trip's cache, and stops after 200 new calls. A trip's first
refresh, or a fresh one, prints what it would cost and waits: you run the paid one yourself, never the agent
([why](google-maps.md#what-it-costs)).

## 5. Build it and check it

Say **"Build the page and check it."** `build-page` makes one file; `verify-page` runs the tests, then looks at it at
phone size in two browsers, walking what your group will do: what's next, getting there, food and toilets nearby, the
rain plan, the costs, the airport, offline.

## 6. Share it with the group

Say **"Publish it."** `publish-htmlapp` puts the page behind a password on ht-ml.app, after you say yes. You send the
link and the password to the group chat; everyone opens it and adds it to their home screen. Pick a password the
seniors can type: the gate asks again every day.

With group sync, also say **"Make me a planner."** You set a planner code in your own terminal (`pnpm sync planner`),
and give it on your own phone under Group sync → "I'm a planner". A planner can change anyone's stops, put back what
was removed, and block a stray phone ([group sync on the page](trip-page.md#group-sync)).

## During the trip

The group does most things on the page itself: push the rest of the day back when you're running late, type a flight
delay, add a stop, tick the checklist. Ask your agent for the rest, then republish to the same link:

- "Update the opening hours" or "refresh the weather" (`data-sync`);
- "Change tomorrow: swap the museum and the market" (`trip-customize`);
- "Publish the new version" (`publish-htmlapp`). Phones see an update bar and keep what they saved: their ticks, added
  stops and language.

## After the trip

Say **"The trip is over."** Your agent ends the trip's group sync if it had one (`sync-setup`), and runs `trip-retro`:
what went wrong or right becomes proposed lessons for the next trip, as a change you review.

## What your agent never does

- **Publish, or republish, without your yes.** Publishing reaches people, and the host can't delete.
- **Pay Google.** A refresh that needs paid calls stops and shows you the cost; you run it.
- **See your keys or passwords.** You paste them into files in `~/.config/relaxjer/`; the agent never reads them.
- **Commit or upload your trip.** `trips/` stays on your computer, and the git hooks block it.
- **Put a trip page anywhere public**, including GitHub Pages.

## Every skill

| Skill              | Say                                               | What it does                                                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------- |
| `planner-setup`    | "Set up RelaxJer on my computer"                  | checks and installs the tools, builds and opens the demo            |
| `trip-intake`      | "Plan a trip to …"                                | your words → a trip folder that passes the checks                   |
| `trip-customize`   | "Add …", "move …", "make day 4 lighter"           | changes the plan, and says which part of the page each change lands |
| `data-sync`        | "Refresh the data", "update the hours"            | places, hours, food and toilets nearby, transit, weather, links     |
| `build-page`       | "Build the page"                                  | one self-contained file                                             |
| `verify-page`      | "Check the page"                                  | tests, then a look at phone size in two browsers                    |
| `sync-setup`       | "Share our changes across phones", "end sync"     | group sync on your own Firebase database                            |
| `publish-htmlapp`  | "Publish it", "publish the new version"           | behind a password, after your yes, and proves the live copy is new  |
| `destination-pack` | "We're going to Japan" (a country RelaxJer lacks) | the country's tax refund, transit, taxis and entry rules            |
| `trip-retro`       | "The trip is over", "what did we learn?"          | lessons as a reviewed change                                        |

In Claude Code, read-only helpers check the work: `relaxbro` (plans with you), `data-curator` (checks the trip's
data), `ux-verifier` (checks the page in browsers), `destination-researcher` (facts for a new country) and
`release-checker` (before anything is pushed or published).
