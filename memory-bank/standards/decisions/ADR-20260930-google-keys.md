---
id: ADR-20260930-google-keys
date: 2026-09-30
title: 'Each User Brings Their Own Google Keys; RelaxJer Ships No Keys and No Google Content'
domain: data
status: accepted
---

# Each User Brings Their Own Google Keys; RelaxJer Ships No Keys and No Google Content

## Summary

Every user creates their own Google Cloud project and two keys: a browser key for the page and a server key for the
pipeline. They're kept outside the repo, and the build embeds the browser key only when asked (`--keys <file>`). Without
keys the page still works on MapLibre + OpenStreetMap. Decided by Kenneth on 2026-09-30.

## Context

The first trip page used Google Maps Platform for places, pins, opening hours, ratings, routes and the live map.
Google's terms limit how Places content may be stored and redistributed: place IDs may be kept, but most other fields
may not be cached for long or shipped to others. A private family page is a judgement call. A public framework that
ships that data, or tells thousands of people to cache it, is not.

## Decision

- **RelaxJer ships no Google keys and no Google content.** Every user creates their own Google Cloud project and keys.
- **Two keys per user, never mixed:**
  - a _browser key_ for the page (Maps JavaScript API + Places API), restricted by HTTP referrer to their host and
    `localhost`;
  - a _server key_ for the pipeline on their own machine (Places API (New) + Routes API), never embedded in a page.
- **Keys live outside the repo** (`~/.config/relaxjer/`, mode 600, or the OS keychain):
  - The build embeds the browser key **only when asked** (`--keys ~/.config/relaxjer/google.json`). The demo, and any
    page shared publicly, is built without one.
  - The pipeline reads the server key from `~/.config/relaxjer/google-places.key` (or `RELAXJER_GOOGLE_KEY_FILE`).
  - Neither is ever written into a trip folder or the repo
    ([ADR-20260930-repo-layout](ADR-20260930-repo-layout.md)).
- **Committed examples carry no Google-derived fields** (`gpid`, ratings, reviews, Google photos). A contract test
  enforces it.
- **Without keys the page still works:** MapLibre + OpenStreetMap map, the offline transit planner, hand-entered or
  open-data places. Google is an upgrade, not a requirement.
- What each user caches for their own trip is their responsibility under their own agreement with Google. The docs state
  the terms, and the pipeline offers a "refresh before the trip" run (`pnpm resync`) rather than long-lived caches.

## Alternatives

| Option                                | Why not                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A shared project key in the framework | Cost and abuse land on one account; it breaks Google's terms at scale; a leaked key is everyone's outage  |
| Open data only (OSM, Wikidata)        | Safe to redistribute, but opening hours and place quality lag Google in Asia; kept as the no-key baseline |
| A proxy service that holds keys       | An operated backend with auth, quotas and costs, for a project that is static pages by design             |

## Consequences

- **Setup:** one more step (a Google Cloud project, two keys, a billing alert). The `trip-intake` skill walks a user
  through it and checks the key restrictions before the first build.
- **Security:** a leaked browser key is limited to the user's referrers and two APIs. The server key never leaves their
  machine. gitleaks and `tests/repo/hygiene.test.mjs` block Google key patterns in anything committable.
- **Cost:** each user pays their own usage: small for a family trip, and within Google's monthly credit for most. The
  docs recommend a budget alert and API quotas.

## Read when

You're touching the build's `--keys` handling, the pipeline's Google calls, a committed example's data, or any doc that
tells users what to cache.
