# engine/

The page engine and its single-file build. It came from the first trip's repo (story step 1) and has since been split,
generalised and extended (group sync, the page's security policy, day splits, optional-plan chips, the add sheet's
checks). What the page does, part by part: [`guides/trip-page.md`](../guides/trip-page.md).

```sh
pnpm build --trip trips/<slug> [--out <dir>] [--keys ~/.config/relaxjer/google.json] [--sync ~/.config/relaxjer/sync/<slug>.json]
```

- `--trip`: a folder with `data.js`, the `*.json` side files and `img/`. The demo is `examples/demo-trip`.
- `--out`: default `<trip>/dist`. It writes `<name>-standalone.html` (the page to publish; `<name>` is `TRIP.fileName`,
  default `trip`), `<name>.html` (the body only), the My Maps KML and `mymaps/` (one KML per layer).
- `--keys`: the Google browser key + Map ID, **opt-in**
  ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)). Keep the file outside
  the repo (mode 600). Without it the page uses the free MapLibre map. Build the demo, and anything shared publicly,
  without it.
- `--sync`: the trip's group-sync file from `pnpm sync init`
  ([ADR-20261001-group-sync](../memory-bank/standards/decisions/ADR-20261001-group-sync.md)). A rebuild keeps the same
  one, or the group's shared plan starts over.
- The build prints whether a key went in, whether group sync is on (and a planner code set), and the page's size.

`src/app/NN-*.js` are the engine's sections, joined in order into one script (they share one scope; `00-open` and
`99-close` wrap them). `src/core/*.mjs` hold the pure logic, unit-tested in `tests/unit`. The country and city packs
come from `destinations/`. The build writes the page's Content-Security-Policy (each inline script by hash) and a build
id the page uses to offer updates. `tests/release` (run by `.husky/pre-push`) blocks a push if a real trip's details
creep into the engine. How to change it: [`memory-bank/standards/patterns/engine.md`](../memory-bank/standards/patterns/engine.md).
