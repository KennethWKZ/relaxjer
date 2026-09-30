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
pnpm publish:trip trips/<slug>             # after the planner said yes to this change
pnpm publish:trip trips/<slug> --dry-run   # the checks and the rollback copy, no publish
pnpm publish:trip trips/<slug> --check     # only prove what's live and that it opens
```

`scripts/publish-trip.mjs` reads the update key and the viewer password from `~/.config/relaxjer/publish/` itself.
Agents can't read that folder (`.claude/settings.json` denies it), and Claude Code asks the planner before every
`pnpm publish:trip`. So the planner approves each publish, and no secret reaches the chat. Never read or copy those
files another way. The script:

1. Reads the new page's build id from `trips/<slug>/dist/<fileName>-standalone.html`, and the live page's through the
   password gate. If they're the same, it stops.
2. Saves the live copy as `~/.config/relaxjer/publish/<slug>-rollback-<build id>.html`. To undo a bad publish, the
   planner publishes that file.
3. Shares the page to the same site (`--site`, `--update-key`). Without `--password` or `--private`, the viewer password
   stays as it is.
4. Polls the live build id for about 3 minutes. The CDN can serve the old copy for minutes, and `?v=` doesn't bust it,
   so after a minute it shares once more (that fixed a stale copy within a minute on the first trip).
5. Opens the live page past the gate on an iPhone (WebKit) and an Android phone (Chromium) and fails on page errors.

It reads either layout: one value per file (`<slug>.update-key`, `<slug>.viewer`, `<slug>.site`), or the first trip's
labelled files (`<slug>.txt` as lavish-axi printed it, `<slug>-viewer.txt`). Keep `TRIP.fileName` and
`TRIP.storageKey` unchanged from the last publish (`build-page`), or the group loses its saved state.

Phones that hold the old copy on their home screen show an update bar once they're back online.

## Done when

The live build id matches the new build, the page opens past the gate in two browsers, and the planner knows the URL.
Tell them the password only if it's new, and never repeat the update key.
