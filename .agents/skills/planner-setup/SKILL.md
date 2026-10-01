---
name: planner-setup
description: Get a planner's computer and AI agent ready to plan trips with RelaxJer — the tools (Node 24, pnpm, gitleaks, uv, Playwright), the install, a first demo build opened in a browser, the keys folder, and the optional Google Maps keys, group sync and publishing accounts. Use when someone has just cloned the repo, asks how to get started, what they need to install, or why a command fails on a fresh machine. Ends by handing over to trip-intake.
---

# Planner setup: from a fresh clone to a demo page

The planner may not be a developer. Explain each step in one plain sentence before you run it, run the read-only
checks yourself, and ask before installing anything outside the repo (Homebrew, a Node version manager, a browser).
`pnpm install` inside the repo is fine to run.

Read first: [`README.md`](../../../README.md) § Plan a trip, and [`guides/getting-started.md`](../../../guides/getting-started.md),
the planner's own copy of these steps.

## 1. Check what's there

Run these and report one line each (found and version, or missing):

```sh
node -v                 # needs 24.x (package.json "engines")
corepack --version      # comes with Node; it brings the pinned pnpm
gitleaks version        # the git hooks refuse a commit without it
uv --version            # the data refresh (pnpm resync) and pnpm verify
git --version
```

Missing ones, with the install the planner approves:

| Tool     | macOS                                       | Elsewhere                                                                          |
| -------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Node 24  | `brew install node@24`, or `nvm install 24` | [nodejs.org](https://nodejs.org/), or nvm                                          |
| gitleaks | `brew install gitleaks`                     | a release from [gitleaks](https://github.com/gitleaks/gitleaks/releases)           |
| uv       | `brew install uv`                           | [docs.astral.sh/uv](https://docs.astral.sh/uv/getting-started/installation/)       |
| Java 11+ | only for `pnpm test:sync-rules`             | maintainers checking the group-sync rules on Firebase's emulator; planners skip it |

## 2. Install

```sh
corepack enable && pnpm install     # the dependencies, the git hooks (husky), and lavish-axi for publishing
pnpm setup:e2e                      # Chromium + WebKit for the page tests (Linux: pnpm exec playwright install --with-deps chromium webkit)
```

## 3. Prove it works

```sh
pnpm test                                   # tier 0, about a second: hygiene, agent config, docs, the demo's contract
pnpm build --trip examples/demo-trip        # the synthetic demo, no key: examples/demo-trip/dist/trip-standalone.html
node tests/support/serve.mjs examples/demo-trip/dist 8124
```

Open `http://127.0.0.1:8124/trip-standalone.html` (in a real browser if the agent has one, or ask the planner to) and
show them the page at phone width: the day strip, Now/Next, a day's timeline, the map, the budget. That's what their
group will get. [`guides/trip-page.md`](../../../guides/trip-page.md) explains each part.

`pnpm test:e2e` (2–3 minutes) is for engine work; a planner doesn't need it before the first trip.

## 4. The keys folder

Everything private lives in `~/.config/relaxjer/`, outside every repo, and the planner writes it themselves:

```sh
mkdir -p ~/.config/relaxjer && chmod 700 ~/.config/relaxjer
```

| File                                     | Holds                                     | Written by                                   |
| ---------------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `google.json`                            | the browser key and Map ID, for the page  | the planner (`guides/google-maps.md` step 6) |
| `google-places.key`                      | the server key, for the data refresh      | the planner                                  |
| `sync/<slug>.json`                       | a trip's group-sync keys                  | `pnpm sync init` (`sync-setup`)              |
| `publish/<slug>.*` or the macOS Keychain | the page's viewer password and update key | the planner, after the first publish         |

**Never ask for a key, a password or an update key in the chat, and never write one yourself.** In Claude Code the
repo's settings deny the Read and Edit tools on this folder, the publish guard blocks shell reads of the publish
secrets, and `.claude/hooks/guard-write.mjs` blocks a key in any file. The rest is this rule: never `cat`, `grep` or
copy anything from it.

## 5. The optional accounts, each when it's needed

Ask which ones the planner wants now; each can wait until the trip needs it.

- **Google Maps (recommended, ~20 minutes):** walk them through [`guides/google-maps.md`](../../../guides/google-maps.md)
  one step at a time: a project with billing, three APIs, a restricted browser key and Map ID, a restricted server key,
  the quotas and a budget alert. Check the server key with the guide's one-call-per-API command, **never with a
  refresh** (a refresh can cost US$100+). Without Google the page uses the free MapLibre map.
- **Group sync (optional, ~5 minutes):** the once-per-planner part of `sync-setup` (a Firebase project, a Realtime
  Database in locked mode, `firebase login` in their own terminal, `pnpm sync rules`).
- **Publishing:** nothing to set up. `lavish-axi` came with `pnpm install`, and the first publish creates the site
  (`publish-htmlapp`).

## 6. Which agent

Any agent works from `AGENTS.md` and `.agents/skills/`. Claude Code adds the guards in `.claude/` (hooks that block a
paid refresh, a key in a file, a skipped git hook or a second route to publishing), read-only reviewer agents and a
`relaxbro` to plan with. Other agents get the same rules from `AGENTS.md` and the git hooks, without the Claude
Code hooks.

Optional for contributors: a code graph (graphmind, codebase-memory-mcp). Exclude trips before graphmind's first build
(`graphmind exclude add trips`): it doesn't read `.gitignore`.

## Done when

- `pnpm test` passes and the demo page opened in a browser.
- The planner knows which of Google Maps and group sync they're using, and the files for the chosen ones are in
  `~/.config/relaxjer/` with mode 600 (ask; don't read them).
- Next: `trip-intake` with the planner's trip.
