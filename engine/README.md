# engine/

The page engine and its single-file build, moved in **verbatim** from the first trip's repo (roadmap step 1). Only
`build.mjs`'s paths changed:

```sh
pnpm build --trip trips/<slug> [--out <dir>] [--keys ~/.config/relaxjer/google.json]
```

- `--trip`: a folder with `data.js`, the `*.json` side files and `img/`. The demo is `examples/demo-trip`.
- `--out`: default `<trip>/dist`. It writes `<name>-standalone.html` (the page to publish; `<name>` is `TRIP.fileName`, default `trip`), `<name>.html`
  and the My Maps KML.
- `--keys`: the Google browser key + Map ID, **opt-in** ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)). Keep the file outside the repo, for example
  `~/.config/relaxjer/google.json` (mode 600). Without it the page uses the free MapLibre map. Build the demo, and
  anything shared publicly, without it. The build prints whether a key went in.

`src/app/NN-*.js` are the engine's sections, joined in order into one script (they share one scope; `00-open` and
`99-close` wrap them). `src/core/*.mjs` hold the pure logic, unit-tested in `tests/unit`. `tests/release` (run by `.husky/pre-push`) blocks a push if a real trip's details creep back into the engine.
