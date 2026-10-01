# Product

<!-- impeccable:product-schema 1 -->

> The trip page RelaxJer builds, for design tools and agents. The framework's own product context (the planner, the
> agent, contributors) is in `memory-bank/project/product-context.md`. Each real trip keeps its own specifics (the
> group, the dates, the hotel) in its gitignored `trips/<slug>/requirements.md`, never here.

## Platform

web

## Stack

delegated: one self-contained static HTML file per trip (inline CSS and vanilla JS, built by `engine/build.mjs`, no
framework), published behind a password and opened from a chat link on any phone browser, or installed to the home
screen.

## Users

A travelling group, typically 3–8 people and often including seniors, on their own phones (iOS and Android). They use
the page outdoors in city streets, on the metro, in a hired van, and in the hotel room at night. They open it many
times a day to check what's next, how to get there, what it costs, and what to do if it rains, and to decide things
together in the group chat (dinner option A or B, ride the bike share or not, add a sight or not). One of them, the
planner, made the plan with an AI agent; the rest never saw the tooling.

Never describe the group by family relationship. Use "the group", "seniors" and "adults" only.

## Product Purpose

Turn the planner's itinerary into a phone-first trip companion. Success: anyone in the group can answer "where are we
going, how do we get there, how much, what if it rains" within seconds, one-handed, without scrolling a long document.

## Positioning

The group's own plan, with its real times, budgets and decision rules, plus the transport choices laid out as
money-versus-effort comparisons for the whole group. A generic travel app doesn't have their rules, doesn't work
offline on a tired phone, and doesn't split every cost per person.

## Operating Context

- The link is shared in a group chat, and decisions are discussed there.
- Bright outdoor glare and dark hotel rooms both happen, daily.
- Network is patchy: the metro, a roaming plan that ran out, a phone that slept in a bag.
- The page sits on the home screen for the whole trip, and comes back after being paused for hours.

## Capabilities and Constraints

- A sticky header that stays visible while scrolling; quick jumps between days; text search across the whole plan.
- Fixed times never move; everything else can be re-planned, but only as a suggestion.
- Every group cost also shows a per-person share, in the destination's currency and the group's home currency.
- The airport transfer compares the options (train or metro with a transit card, taxi or ride-hail, a pre-booked van)
  with prices for the whole group, decided on the day.
- Optional items (shops, extra sights) are never scheduled. The trip can suggest one at a stop it suits: a
  "Nearby options" chip there opens its card over the day. A day can split: when part of the group takes its own
  plan for a few hours (a ride, a visit), it hangs where the day forks, with its rule, its choices and where they
  rejoin.
- State is per phone (`localStorage`) for checklist ticks, added stops and preferences. With group sync on (the
  planner's choice, per trip), added stops, pushed-back times, flight changes and the ticks of shared lists reach
  everyone's phone; the rest stays on each one. Each phone changes only the stops it added; a planner phone, one that
  gave the trip's planner code, can change any, and can block a phone whose changes should stop reaching the group.
  Every removal can be undone, so a slip costs one tap.
- Two UI languages (today Simplified Chinese and English), with the destination's own names for drivers and signs.

## Evidence on Hand

- The planner's requirements and itinerary (all times, budgets and rules come from them).
- Places, hours and routes from Google (the planner's own key) or OpenStreetMap, and each fare or price labelled with
  its source. Budgets that aren't in the plan must not be invented, and estimates are marked.

## Product Principles

1. The next thing to do is always one glance away.
2. Every number is the plan's number, or it's marked as an estimate.
3. Decisions show their rule: when to go, when to skip, what the fallback is.
4. A comfortable pace for seniors beats sights per day.
5. It works offline, and it says so when it is.

## Accessibility & Inclusion

Seniors use it: large, high-contrast text, 44 px+ tap targets, it follows the phone's text-size setting, and it works
in bright sunlight. It honours reduced motion, reduced transparency and higher contrast. Walking times for seniors are
counted ×1.4, and long legs suggest a taxi first.
