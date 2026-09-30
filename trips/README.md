# trips/

Real trips live here, one folder each (`trips/<slug>/`). Everything in this folder except this README is gitignored:
requirements, data, photos and built pages never reach the public repo.

A trip folder holds `data.js`, the `*.json` side files and `img/`, the same shape as `examples/demo-trip/`. Build it with:

```sh
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json   # → trips/<slug>/dist/trip-standalone.html (TRIP.fileName sets the name)
TRIP_DIR=trips/<slug> pnpm test              # the trip contract on your data
TRIP_DIR=trips/<slug> pnpm exec playwright test --grep-invert @demo   # page tests that hold for any trip
```

API keys don't belong here either. Pass the Google browser key with `--keys`, from a file outside the repo ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)).

A built trip page carries hotels, flights and names. Publish it only behind a password, never on GitHub Pages.
