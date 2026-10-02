---
name: publish-htmlapp
description: Publish or republish a RelaxJer trip page on ht-ml.app behind a password, then prove the live copy is the new build. Use when someone asks to publish, share, deploy, upload or update the live trip page. Refuses GitHub Pages or any public host for a real trip. Publishing reaches an outside audience — confirm with the planner first.
---

# Publish on ht-ml.app

Publishing puts a page in front of people, and ht-ml.app has no delete. **Confirm with the planner before every first
publish and every republish**, unless they have told you to publish this change. Read `knowledge/hosting.md` first.

## Refuse

- **GitHub Pages, or any public link, for a real trip.** A trip page carries hotels, flights and names. Pages hosts the
  project's landing page and the synthetic demo trip, which `pages.yml` builds; nothing you publish goes there.
- **A page that failed `verify-page`**, or wasn't verified.
- **A page built with a key the planner didn't mean to ship.** The build's own output line says whether a key went in.

## First publish

```sh
lavish-axi share trips/<slug>/dist/<fileName>-standalone.html --private
```

It prints the URL, a generated viewer password and a secret update key, **each shown once**.

- Ask the planner to put the **update key in the macOS Keychain**, with no trusted apps, so macOS asks them before
  every read (they type it; never echo it):
  `security add-generic-password -s relaxjer-publish -a <slug> -T "" -w '<the key>'`. Without a Mac, it goes alone in
  `~/.config/relaxjer/publish/<slug>.update-key`, mode 600.
- The viewer password goes alone in `~/.config/relaxjer/publish/<slug>.viewer`, and the site id and URL in
  `<slug>.site`. One value per file means nothing has to be cut out of a labelled line later. **Never echo the update
  key into the chat, a repo file, a test or a commit.**
- If the planner wants a password the group can type (the gate asks again every 24 h), pass
  `--password "<chosen>"`, quoted. An empty value would publish a public page, so lavish-axi refuses it.

## Republish to the same link

```sh
pnpm publish:trip trips/<slug>             # after the planner said yes to this change
pnpm publish:trip trips/<slug> --dry-run   # the checks and the rollback copy, no publish
pnpm publish:trip trips/<slug> --check     # only prove what's live and that it opens
pnpm publish:trip trips/<slug> --audit [--candidate <page>]   # read-only: what the host sends and changes, and how a
                                                              # candidate build behaves at the live address
```

Run `--audit` before publishing a change to how the page loads or what it may reach (its Content-Security-Policy, a new
outside host, group sync). It reads only the viewer password, publishes nothing, and opens the candidate (by default the
trip's `dist/` page; build a candidate with `--out .cache/audit` to keep `dist/` equal to what's live) at the live
address on an iPhone and an Android phone, served in place of the live copy: what the policy refused, what failed to
load, page errors, and whether the map came up. It also says whether the host serves the page byte for byte and every
inline script unchanged (the policy's hashes depend on it).

`scripts/publish-trip.mjs` reads the secrets itself, so none reaches the chat. **Publishing has one door**: that
command, alone in Bash. Claude Code asks the planner before every `pnpm publish:trip` (a settings "ask" rule, which
prompts in every mode), and `.claude/hooks/guard-publish.mjs` denies every other route: `node scripts/publish-trip.mjs`,
`npm run …`, a chained command, a context-mode shell, a direct `lavish-axi share --update-key`, and any read of
`~/.config/relaxjer/publish/` or the Keychain item. On a Mac, macOS then asks once more before it releases the key.
Never read or copy the secrets another way. The script:

1. Reads the new page's build id from `trips/<slug>/dist/<fileName>-standalone.html`, and the live page's through the
   password gate. If they're the same, it stops.
2. Saves the live copy as `~/.config/relaxjer/publish/<slug>-rollback-<build id>.html`. To undo a bad publish, the
   planner publishes that file.
3. Reads the update key (the Keychain first; `--check` and `--dry-run` never read it), then shares the page to the same
   site. A "Deny" in the Keychain dialog stops the publish; it never falls back to a copy on disk. The viewer password
   stays as it is unless you pass `--new-password` (below). The phone checks in step 5 need the Playwright browsers
   (`pnpm setup:e2e`).
4. Polls the live build id for about 3 minutes. The CDN can serve the old copy for minutes, and `?v=` doesn't bust it,
   so after a minute it shares once more (that fixed a stale copy within a minute on the first trip).
5. Checks that the live page's Content-Security-Policy reads the same as the built one (the host re-serialises the HTML
   it stores), then opens the live page past the gate on an iPhone (WebKit) and an Android phone (Chromium) and fails on
   page errors or anything the policy refused. On a failure, republish the rollback copy.

It reads either layout: one value per file (`<slug>.viewer`, `<slug>.site`, and `<slug>.update-key` when the key isn't
in the Keychain), or the first trip's labelled files (`<slug>.txt` as lavish-axi printed it, `<slug>-viewer.txt`). If
the key still sits in a file on a Mac, it says so; the planner moves it into the Keychain and deletes the file copy. Keep `TRIP.fileName` and
`TRIP.storageKey` unchanged from the last publish, and build with the same `--sync` file if the trip has group sync
(`build-page`), or the group loses its saved state, or starts its shared plan over. For a trip with planners, check the
build line says `group sync yes (planner code set)` before you publish. Phones still on the old copy don't enforce
roles until they take the update bar.

Phones that hold the old copy on their home screen show an update bar once they're back online.

## Change the page password

When the page password may have leaked (it showed in a chat, a log, or to someone outside the group), or the group
wants a new one. The planner writes the new one themselves, so it never passes through a chat:

```sh
printf '%s\n' '<new password>' > ~/.config/relaxjer/publish/<slug>.viewer.new && chmod 600 ~/.config/relaxjer/publish/<slug>.viewer.new
pnpm publish:trip trips/<slug> --new-password   # with the next build, or alone: the same build gets the new password
```

The script reads it from that file, shares with it (`lavish-axi … --password`), and once the host confirms, saves it as
`<slug>.viewer` and deletes the `.new` file. It then proves the live page opens with the new password. Everyone, seniors
included, has to type the new one at the gate, so tell the group first, in the group chat, and pick something they can
type.

## Done when

The live build id matches the new build, the page opens past the gate in two browsers, and the planner knows the URL.
Tell them the password only if it's new, and never repeat the update key.
