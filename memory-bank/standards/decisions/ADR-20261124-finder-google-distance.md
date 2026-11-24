---
id: ADR-20261124-finder-google-distance
date: 2026-11-24
title: 'The Finder Says How Far a Place Is by Road, from One Google Place Search with a Routing Summary'
domain: engine
status: accepted
decision: 'With a key, the finder asks Google once per place for the way from the group: metres by road and the walk at the group pace, or the ride.'
tags: [hosting]
---

# The Finder Says How Far a Place Is by Road, from One Google Place Search with a Routing Summary

## Summary

With the planner's Google key and a network, the place finder says how far the place it shows is by road, from where
the group is: "From the hotel: 800 m · ~14 min walk · by road, Google". It comes from one Text Search request with a
routing summary (`routingParameters` and the `routingSummaries` field), sent from the phone with the page's browser key
when the finder opens a place: the phone's position when it's near the trip, else the plan's stop under way or the
hotel. A walk counts at the group's pace (Google's minutes, 40 % longer); a walk longer than 20 minutes there asks for the ride
instead. Nothing goes on the map, and Directions still opens the exact route. Asked for by the planner on 2026-11-24:
"show current device location to that searched result location where is it and how far estimate by using google".

## Context

- [ADR-20261124-map-first-search](ADR-20261124-map-first-search.md) frames a picked place with where the group is and
  marks it, and drops every line and distance from the map: a straight line crosses what the group walks around, so its
  numbers mislead. The planner still wanted to know how far, and asked whether Google could say it.
- Google's place search (Places API (New) Text Search) can return a routing summary for each place: the distance and
  duration from an origin, walking or driving (no transit). It needs no Routes API, so the browser key's two APIs (Maps
  JavaScript API and Places API (New), [ADR-20260930-google-keys](ADR-20260930-google-keys.md)) stay as they are, and
  the page's policy already lets a key-built page reach `*.googleapis.com`
  ([ADR-20261001-page-csp](ADR-20261001-page-csp.md)). One test call from a key-built page on localhost answered on
  2026-11-24.
- The Maps JavaScript library's `Place.searchByText` has no routing option (its reference, read 2026-11-24), so the
  page calls the web service with `fetch`.
- Asking for `routingSummaries` bills the request as Text Search Enterprise: 1,000 free a month, then US$35 per 1,000
  (Google's price list, read 2026-11-24).

## Decision

- **When:** the finder opens a place (a trip place or a Google result) on a page built with a key, while the phone is
  online. Nothing is asked without a key, offline, next door (under 50 m), or when the page has no start.
- **From:** the phone when it's near the trip, else the plan's stop under way, else the hotel (`wayFrom`, the same order
  as the camera's frame); the line names which: "From you", "From the hotel", or "From <the stop>".
- **What:** one `places:searchText` request, field mask `places.id,places.location,routingSummaries`, the place's name
  biased to 300 m around its pin, `travelMode` WALK when the straight-line walk at the group's pace is 20 minutes or
  less, else DRIVE (`Way.modeFor`, the add sheet's taxi-first rule). The place is the result with its Google id, or
  without one the nearest result within 150 m of its pin (`Way.pickIndex`). The walk is shown at the group's pace;
  the ride as Google gives it, without traffic.
- **Once:** one call per opening of the finder; a redraw repaints the answer it has, and the same place from the same
  start is remembered for the page view (`wayMemo`). A refusal or no network says nothing and is asked again next time.
- **Where:** one line under the place's links, in the finder only, with "by road, Google" after the figures. The day
  rows below keep their own straight-line estimates, noted as such.

## Alternatives

- **The Routes API from the page.** The exact route and a choice of modes, at US$5 per 1,000 after 10,000 free, but the
  browser key would be opened to a third API for what Directions already shows in the maps app. Rejected while the
  routing summary covers "how far".
- **The straight-line distance and the page's own walking model.** Free and offline, but it is the number
  ADR-20261124-map-first-search dropped as misleading. Rejected.
- **Ask on every result in the list.** One search already returns a summary per result, but the list would cost a call
  for every search, tapped or not, and the page's own places would need one each. Rejected: ask only for the place the
  group opens.
- **Transit times.** Google's routing summary has no transit mode. Directions opens transit in the maps app.

## Consequences

- **Security:** the start's position (the phone's, when it's near the trip) goes to Google with the place's name, under
  the planner's key, each time the finder opens a place it hasn't asked about. That is Google, which already serves the
  map and the search on a key-built page; nothing goes anywhere else, and nothing is stored. A page built without a key
  sends nothing.
- **Operational:** Google's answer shape is read by `engine/src/core/way.mjs` (unit tests); the e2e tests answer the
  request with a stand-in (`tests/e2e/place-finder.spec.mjs`), so a change in Google's format shows only in a real
  call. A walk leg's minutes use `GROUP_WALK`, so a change to the group's pace changes this line too.
- **Cost:** each place opened in the finder is one Text Search Enterprise request: 1,000 free a month per billing
  account, then US$35 per 1,000. A group opening 20 places a day for two weeks is about 280. Listed in
  [`guides/google-maps.md`](../../../guides/google-maps.md).

## Read when

- Changing the finder's head, the way it measures distances, or what the page sends to Google.
- Changing the browser key's APIs or the page's policy for Google hosts.
