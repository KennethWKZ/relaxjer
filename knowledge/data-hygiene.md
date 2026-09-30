# Data hygiene lessons

What the first trip taught about place data. The pipeline's rules are in
`memory-bank/standards/patterns/pipeline.md`.

## Sources

- **Google first, OpenStreetMap as fallback.** Google is what the group navigates with, so its positions, place ids,
  hours, ratings and addresses match the Maps app. Use OSM only for what Google can't give (a metro line's stop order,
  the offline map), and check it against Google where possible.
- **An operator's live source beats Google** where one exists (live bike-share dock counts).
- **Refresh before the trip** rather than keeping long-lived caches (Google's terms; hours change).

## Filtering

- **Check place types.** A car park is not an airport terminal.
- **Filter fake "public toilets"**: offices, gyms and shops that Google tags as toilets.
- **Keep useful near-misses; drop only noise.** A sit-down tea house, dessert shop, café or bar fails a "drink stand"
  filter, but a tired group wants exactly that. Give such places their own category (a rest spot). Drop only true noise:
  tea-leaf sellers, a curry shop matched by a chain's name, restaurants in a drinks list.
- **Drop partial OSM transit lines.** A line with missing stops misleads the offline planner.

## Stability

- **Keep a hand-checked Google id** when a fetch keeps returning a neighbour (the first trip's hotel id was overwritten
  by the inn next door). Pin it in the trip, and note why.
- **Make the output stable.** Sort before writing. A drink list once reshuffled on every run with Python's hash seed,
  and every refresh then looked like a change.
- **A regex that reads the trip will miss things.** Read it the way the build does (the pipeline's `lib/`). The old
  regex skipped two places.

## Keys

- The browser key is restricted to the site plus `localhost`, for Maps JavaScript and Places only.
- Server keys never go into a page.
