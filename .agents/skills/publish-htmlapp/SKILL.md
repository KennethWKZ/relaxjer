---
name: publish-htmlapp
description: Publish or republish a RelaxJer trip page on ht-ml.app behind a password, then prove the live copy is the new build. Use when someone asks to publish, share, deploy, upload or update the live trip page. Refuses GitHub Pages or any public host for a real trip. Publishing reaches an outside audience — confirm with the planner first.
---

# Publish on ht-ml.app

Publishing puts a page in front of people, and ht-ml.app has no delete. **Confirm with the planner before every first
publish and every republish**, unless they have told you to publish this change. Read `knowledge/hosting.md` first.

## Refuse

- **GitHub Pages, or any public link, for a real trip.** A trip page carries hotels, flights and names. Pages hosts the
  project's landing page only.
- **A page that failed `verify-page`**, or wasn't verified.
- **A page built with a key the planner didn't mean to ship.** The build's own output line says whether a key went in.

## First publish

```sh
lavish-axi share trips/<slug>/dist/<fileName>-standalone.html --private
```

It prints the URL, a generated viewer password and a secret update key, **each shown once**.

- Ask the planner to save each secret alone in its own file outside the repo, mode 600:
  `~/.config/relaxjer/publish/<slug>.update-key` and `~/.config/relaxjer/publish/<slug>.viewer`, plus the site id and
  URL in `<slug>.site`. One value per file means nothing has to be cut out of a labelled line later. **Never echo the
  update key into the chat, a repo file, a test or a commit.**
- If the planner wants a password the group can type (the gate asks again every 24 h), pass
  `--password "<chosen>"`, quoted. An empty value would publish a public page, so lavish-axi refuses it.

## Republish to the same link

```sh
P=~/.config/relaxjer/publish/<slug>
lavish-axi share trips/<slug>/dist/<fileName>-standalone.html --site <site id> --update-key "$(cat "$P.update-key")"
```

- The key is read in the shell, so it never appears in the chat. An older trip whose file holds labelled lines needs
  its key cut out in the shell the same way, never pasted.
- Without `--password` or `--private`, the viewer password stays as it is.
- Keep `TRIP.fileName` and `TRIP.storageKey` unchanged from the last publish (`build-page`), or the group loses its
  saved state.
- Keep a copy of the previous build outside the repo, so a bad publish can be rolled back by republishing it.

## Prove the live copy is the new build

The CDN can serve the old copy for minutes, and `?v=` doesn't bust it.

1. The build id you just published:
   `grep -o 'relaxjer-build" content="[0-9a-f]*' trips/<slug>/dist/<fileName>-standalone.html`
2. The live page's build id, through the password gate. The gate reads the viewer password from the `ht_ml_pwd`
   cookie. Use only the password itself, never a whole labelled line from the file:
   `curl -s --cookie "ht_ml_pwd=$(cat "$P.viewer")" <url> | grep -o 'relaxjer-build" content="[0-9a-f]*'`
3. If they differ after a few minutes, run the same share command again (it fixed a stale copy within a minute on the
   first trip), then check again.
4. Open the live URL on a phone-sized viewport in Chromium and WebKit, and check the page loads past the gate with no
   page errors.

Phones that hold the old copy on their home screen show an update bar once they're back online.

## Done when

The live build id matches the new build, the page opens past the gate in two browsers, and the planner knows the URL.
Tell them the password only if it's new, and never repeat the update key.
