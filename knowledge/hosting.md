# Hosting and publishing lessons

What the first trip taught about publishing a trip page. The step-by-step is the `publish-htmlapp` skill.

## Where a page may go

- **A real trip page goes only behind a password.** It carries hotels, flights and names.
- **Never GitHub Pages for a trip.** Pages sites are public, even from a private repo. Pages hosts the project's
  landing page only, and not even the demo trip.

## ht-ml.app

- **It serves one file only.** So there's no service worker, and the web manifest and icons go in as `data:` URLs.
- **Publishing:** `lavish-axi share <file> --private` creates the site and prints the URL, a generated viewer password
  and a secret update key, each once. Save the update key and password outside the repo
  (`~/.config/relaxjer/publish/<slug>.txt`, mode 600). Never paste the update key into a chat, a file in the repo or a
  commit.
- **Republishing** to the same link: `pnpm publish:trip trips/<slug>`, which runs `lavish-axi share <file> --site <site
id> --update-key <key>` with the key read from outside the repo. Without `--password` or `--private`, the viewer
  password stays as it is.
- **An agent never holds the publish secrets.** Once the repo denied agents the secrets folder, a publish that read the
  key in the agent's own shell was blocked (2026-10-01). The script reads them itself, and the planner approves each run.
- **Pick a password the group can type.** The gate keeps it in a cookie for 24 h, so seniors re-enter it daily. A
  generated password was too hard; the first group got a simple one.
- **The CDN can keep serving the old copy for minutes** after a republish, even when the host says `updated: true`,
  and `?v=` doesn't bust it. Verify every publish: fetch the page with the gate's `ht_ml_pwd` cookie and look for the new
  build id (`<meta name="relaxjer-build">`). If it's still the old one after a few minutes, run the same share command
  again; that fixed it within a minute.
- **Reading a password file:** use only the password, never a whole labelled line. Sending the label with it got the
  gate page back every time.
- **There's no delete.** `--unpublish` replaces the page with a locked placeholder; the host still holds what was
  published. A page that was public can't be made private instantly either (the CDN kept serving it for minutes). Get
  it right before the first publish.

## Rebuilds of a published page

- **Keep `TRIP.fileName` and `TRIP.storageKey`** across rebuilds, or the group's saved state (checklist, language, rate,
  added stops, flight delay) is lost.
- **Keep a backup of the last good build** outside the repo, so a bad publish can be rolled back by republishing it.
  `pnpm publish:trip` saves the live copy before it shares. Builds are also reproducible: rebuilding the same commit
  from the same data gives the same build id.
