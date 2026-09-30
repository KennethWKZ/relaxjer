# ADR 0003: Each user brings their own Google keys

- Status: accepted (2026-09-30, Kenneth)

## Context

The first trip page used Google Maps Platform for places, pins, opening hours, ratings, routes and the live map. Google's terms limit how
Places content may be stored and redistributed: place IDs may be kept; most other fields may not be cached for long or shipped to others.
A private family page is a judgement call; a public framework that ships or tells thousands of people to cache that data is not.

## Decision

- **RelaxJer ships no Google keys and no Google content.** Every user creates their own Google Cloud project and keys.
- **Two keys per user, never mixed:**
  - a *browser key* for the page (Maps JavaScript API + Places API), restricted by HTTP referrer to their host and `localhost`;
  - a *server key* for the pipeline on their own machine (Places API + Routes API), never embedded in a page.
- **Keys live outside the repo** (`~/.config/relaxjer/`, mode 600, or the OS keychain), and the build embeds the browser key
  **only when asked** (`--keys <file>`). The demo, and any page shared publicly, is built without one. The build reads the browser key at build time;
  the pipeline reads the server key. Neither is ever written into a trip folder or the repo (ADR 0001).
- **Committed examples carry no Google-derived fields** (`gpid`, ratings, reviews, Google photos); a contract test enforces it.
- **Without keys the page still works**: MapLibre + OpenStreetMap map, the offline transit planner, hand-entered or open-data places.
  Google is an upgrade, not a requirement.
- What each user caches for their own trip is their responsibility under their own agreement with Google; the docs state the terms and
  the pipeline offers a "refresh before the trip" run rather than long-lived caches.

## Alternatives

| Option | Why not |
|---|---|
| A shared project key in the framework | Cost and abuse land on one account; breaks Google's terms at scale; a leaked key is everyone's outage |
| Open data only (OSM, Wikidata) | Safe to redistribute, but opening hours and place quality lag Google in Asia; kept as the no-key baseline instead |
| Proxy service that holds keys | An operated backend with auth, quotas and costs, for a project that is static pages by design |

## Consequences

- Setup gets one more step (a Google Cloud project, two keys, billing alert). The `trip-intake` skill walks a user through it and
  checks the key restrictions before the first build.
- Security: a leaked browser key is limited to the user's referrers and two APIs; the server key never leaves their machine.
- Cost: each user pays their own usage (small for a family trip, within Google's monthly credit for most); the docs recommend a budget
  alert and API quotas.
