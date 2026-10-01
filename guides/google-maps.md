# Set up Google Maps for your trip page

**We recommend Google Maps.** It's what your group already navigates with, and in Asia its opening hours, place details
and search are better than the free alternative's. You bring your own Google keys: RelaxJer ships none, and never sees
yours ([ADR-20260930-google-keys](../memory-bank/standards/decisions/ADR-20260930-google-keys.md)).

Everything works without Google too. The page falls back to a free MapLibre + OpenStreetMap map, and you can add Google
later. Setup takes about 20 minutes, needs a Google account and a payment card, and costs nothing for a typical family
trip if you follow the guardrails below.

> Checked against Google's documentation on 2026-10-01. Google changes its console labels and prices from time to time.
> If a step looks different, the linked Google page is the source.

## Google Maps or the free map?

| For your group                 | Free map: MapLibre + OpenFreeMap (OpenStreetMap data)                       | Google Maps (your own keys)                                                                |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The map                        | Clean vector map; detail depends on the OpenStreetMap community there       | The map your group knows from the Maps app, with Google's detail and labels                |
| Opening hours, ratings, photos | Only what's in your trip's data                                             | Live on each place: "Rating & photos", open now, permanently closed                        |
| Search on the page             | Searches your trip's own places                                             | Also "Search Google for …" when adding a stop or searching the map                         |
| Walking and transit times      | The times in your plan                                                      | The data refresh (`pnpm resync`) fills in route legs and the nearest station               |
| Directions                     | Links open the Google Maps app (no key needed)                              | The same links, plus Google pins with place ids                                            |
| Offline                        | The map needs network for its tiles; the plan, costs and lists work offline | The same: Google's map needs network, and Google's terms forbid storing it for offline use |
| Cost                           | Free (OpenFreeMap is donation-funded, with no guarantee of service)         | Free within Google's monthly allowance for a family trip; you pay above it                 |
| Setup                          | None                                                                        | A Google Cloud project, billing, two keys, a Map ID (below)                                |
| Privacy                        | Tile requests go to OpenFreeMap (no cookies, no IP logging by default)      | Map and place requests go to Google, under Google's terms and privacy policy               |
| Key risk                       | No key to leak                                                              | The browser key is visible in the page, so it must be restricted (below)                   |

## What it costs

Google gives every billing account a free allowance **per product, per month**. Above it you pay per 1,000 requests.
From [Google's price list](https://developers.google.com/maps/billing-and-pricing/pricing) (updated 2026-09-24):

| What the page or the refresh does            | Google product                 | Free each month | Then, per 1,000 |
| -------------------------------------------- | ------------------------------ | --------------- | --------------- |
| Each time someone opens the map              | Dynamic Maps                   | 10,000          | US$7            |
| "Rating & photos" on a place (rating, hours) | Place Details Enterprise       | 1,000           | US$20           |
| Each photo shown                             | Place Details Photos           | 1,000           | US$7            |
| "Search Google for …"                        | Text Search Pro                | 5,000           | US$32           |
| The data refresh's place details             | Place Details Pro / Enterprise | 5,000 / 1,000   | US$17 / US$20   |
| The data refresh's walking and transit legs  | Compute Routes Essentials      | 10,000          | US$5            |

**The page usually costs nothing.** Eight phones opening the map 20 times a day for a week is about 1,100 map loads
(11% of the free amount), and the group's ratings and photos stay under 1,000 each. A group that taps photos a lot
might pay a few dollars.

**A full data refresh does cost money.** It asks Google about every place, nearby drink stand, toilet and shop the
trip has, and a week-long trip has thousands: the first trip's cache holds about 4,600 answers, half of them text
searches at US$35 per 1,000. Asking them all is about US$130 at list price, before the free amounts take off the
first 1,000–5,000 of each product. On 2026-10-01 one such run, started only to test a new key, showed as RM520 on the
bill within minutes. So the refresh guards the spend
([ADR-20261001-resync-cost-guard](../memory-bank/standards/decisions/ADR-20261001-resync-cost-guard.md)):

- **It answers from the trip's cache** and asks Google only what's new, or what failed last time.
- **A step stops after 200 new calls** (about US$7) unless you add `--yes`. What it fetched is kept.
- **`--fresh` asks everything again**, for when you want it all current, such as right before the trip. It prints
  how many calls that is and what they cost, and goes ahead only when you type `yes` (or add `--yes`). A trip's first
  run, with no cache yet, asks the same way.
- **To test a key, make one call per API, not a refresh** (the check in step 5 below).
- **Set the quotas in step 7 before the first refresh.** A daily cap limits what a mistake costs; a budget alert only
  emails you, hours later.

What also costs money is a **leaked, unrestricted key**, which is why the restrictions and quotas below aren't optional.

## Setup

### 1. A Google Cloud project with billing

1. Open the [Google Cloud console](https://console.cloud.google.com/) and sign in.
2. In the project picker at the top, click **"New project"**, name it (for example `relaxjer-trips`), and create it.
3. Turn on billing for the project: **"Billing"** → link or create a billing account. Google asks for a card.
   - New Google Cloud customers get a free trial credit. When the trial ends, upgrade to a paid account, or the
     project stops.
   - Only trying it out? Google's [Maps Demo Key](https://developers.google.com/maps/documentation/javascript/demo-key)
     needs no billing, but it has a daily limit and fewer features: fine for a look, not for a trip.

### 2. Turn on three APIs

Open **"Google Maps Platform"** → **"APIs & Services"** (or the Maps API Library), and click **"Enable"** on each:

| API                     | Used by                                                 |
| ----------------------- | ------------------------------------------------------- |
| **Maps JavaScript API** | the page's map                                          |
| **Places API (New)**    | the page (ratings, photos, search) and the data refresh |
| **Routes API**          | the data refresh (walking and transit times)            |

You don't need the older "Places API", "Directions API" or "Distance Matrix API". If Google switches on extra APIs
with these, turn off the ones you don't use.

### 3. The browser key (for the page)

1. **"Google Maps Platform"** → **"Credentials"** → **"Create credentials"** → **"API key"**. Open the new key.
2. Name it `relaxjer browser`.
3. **"Application restrictions"** → **"Websites"**, and add:
   - `https://<your-site-id>.ht-ml.app/*`: the address your page is published at. Add it after your first publish, or
     add `https://*.ht-ml.app/*` for now, knowing that any other page on ht-ml.app could then use your key.
   - `http://localhost/*` and `http://127.0.0.1/*`, for checking the page on your own computer. Leaving the port out
     allows any port.
4. **"API restrictions"** → **"Restrict key"** → tick **Maps JavaScript API** and **Places API (New)** only.
5. **"Save"**.

A page opened straight from a file (`file://…`) can't use a website-restricted key, because the browser sends no
address. Serve it instead (`node tests/support/serve.mjs trips/<slug>/dist 8124`).

### 4. A Map ID (for Google's pins)

1. **"Google Maps Platform"** → **"Map Management"** → **"Create Map ID"**.
2. Name it, set **Map type** to **JavaScript**, choose **Vector**, and save. The Map ID itself is free.

### 5. The server key (for the data refresh)

1. Create a second API key the same way, named `relaxjer refresh`.
2. **"API restrictions"** → **"Restrict key"** → tick **Places API (New)** and **Routes API** only.
3. **"Application restrictions"**: choose **"IP addresses"** only if your home connection has a fixed IP. Otherwise
   leave it off, and keep this key on your computer. It never goes into a page.
4. Once it's in place (step 6), **check it with one call per API**, never with a refresh. The Places call asks for
   place ids only, which Google doesn't charge for; the Routes call is one of the 10,000 free each month. It prints
   each API's status (`200` means the key works), never the key:

```sh
node --input-type=module -e "
const key = (await import('node:fs')).readFileSync(process.env.HOME + '/.config/relaxjer/google-places.key', 'utf8').trim();
const call = (url, body, mask) => fetch(url, { method: 'POST', body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': mask } }).then((r) => r.status);
console.log('Places', await call('https://places.googleapis.com/v1/places:searchText', { textQuery: 'Tokyo Tower' }, 'places.id'));
console.log('Routes', await call('https://routes.googleapis.com/directions/v2:computeRoutes',
  { origin: { address: 'Tokyo Station' }, destination: { address: 'Tokyo Tower' }, travelMode: 'WALK' }, 'routes.duration'));
"
```

### 6. Put the keys on your computer, outside the repo

The build and the refresh read them from `~/.config/relaxjer/`, which no git repo can pick up. Paste the values in
yourself, and never paste a key into a chat with an AI agent:

```sh
mkdir -p ~/.config/relaxjer && chmod 700 ~/.config/relaxjer
# the browser key and the Map ID, for the page:
printf '{ "browserKey": "%s", "mapId": "%s" }\n' '<your browser key>' '<your map id>' > ~/.config/relaxjer/google.json
# the server key alone, for the data refresh:
printf '%s\n' '<your server key>' > ~/.config/relaxjer/google-places.key
chmod 600 ~/.config/relaxjer/google.json ~/.config/relaxjer/google-places.key
```

Then build with the key, and refresh your trip's data with the other:

```sh
pnpm build --trip trips/<slug> --keys ~/.config/relaxjer/google.json
pnpm resync --trip trips/<slug>            # a dry run first: the first one says what it costs Google, and asks
pnpm resync --trip trips/<slug> --write    # then write what it fetched, from the cache
```

The build prints whether a key went in. Build the demo, and any page you share outside your group, without `--keys`.

### 7. Guardrails: set them before you publish

- **A budget alert:** **"Billing"** → **"Budgets & alerts"** → **"Create budget"**, for example US$5 a month, with
  email alerts at 50%, 90% and 100%. An alert only emails you; it doesn't stop spending.
- **Quotas, which do stop spending:** **"Google Maps Platform"** → **"Quotas"**, pick each API, and lower its limits
  (for example, Places requests per minute) to a little above what your group could use. When a quota is reached, the
  API pauses until it resets, instead of billing you.
  - Places API (New) counts each method on its own (Text Search, Place Details, Nearby Search), so cap each one.
  - A per-minute limit only slows a refresh down. Where the console offers a per-day limit, that's what caps the
    spend.
  - Size the per-day limits to one full refresh (for the first trip: about 2,200 text searches, 1,300 place details,
    900 nearby searches). That stops a runaway loop or a stolen key at one refresh's cost a day. A refresh the quota
    cut short finishes the next day: the next run asks again only what failed.
- Keep the restrictions from steps 3 and 5. An unrestricted browser key is visible to anyone who opens the page.

## Google's terms, in short

> **Not legally reviewed.** RelaxJer's data refresh keeps some Places content in your trip's files longer than Google's
> terms allow, and nobody has had this flow checked by a lawyer. If you use it, you do so under your own agreement with
> Google and at your own risk (the [MIT licence](../LICENSE) gives no warranty).

Read [Google's policies for Places content](https://developers.google.com/maps/documentation/places/web-service/policies)
and the [Maps Platform terms](https://cloud.google.com/maps-platform/terms). Two points matter for a trip page:

- **Storing.** Place IDs may be kept, and coordinates for up to 30 days. Most other Places content (names, addresses,
  ratings, hours, photos) may not be stored.
- **Showing.** Places content is meant to be shown on a Google map, with Google's attribution.

RelaxJer's data refresh writes the places it fetched into your own trip's files, and a page built without a key shows
them on the free map. For a private page for your own group, that's your call under your own agreement with Google.
This guide isn't legal advice. To stay closest to the terms:

- build with your browser key, so the page uses Google's map;
- refresh right before the trip rather than keeping old data;
- never publish or share a trip's data.

## If the map doesn't load

| You see                                              | Likely cause                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| The free map instead of Google's                     | The build had no `--keys`, or `google.json` lacks `browserKey` or `mapId`                          |
| "This page can't load Google Maps correctly"         | Billing is off, or the key isn't allowed this address (`RefererNotAllowedMapError` in the console) |
| `ApiNotActivatedMapError`                            | Maps JavaScript API isn't enabled on the project                                                   |
| Ratings or "Search Google" fail while the map works  | Places API (New) isn't enabled, or isn't ticked in the browser key's API restrictions              |
| `no Google key at …` from `pnpm resync`              | The server key isn't in `~/.config/relaxjer/google-places.key`                                     |
| Works on the published page but not on your computer | Add `http://localhost/*` and `http://127.0.0.1/*`, and serve the page instead of opening the file  |

## About the free map

- **MapLibre GL JS** (BSD-3-Clause) draws it. The page pins version 5.24; version 6 changed how it's loaded, and moving
  to it is an engine change.
- **OpenFreeMap** serves the tiles free, with no key, funded by donations, and without a service guarantee. The map
  shows "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" automatically.
- **OpenStreetMap** data is © OpenStreetMap contributors, under the ODbL. RelaxJer doesn't use OpenStreetMap's own tile
  servers, whose policy forbids offline use and heavy traffic.
