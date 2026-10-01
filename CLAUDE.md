@AGENTS.md

## Claude Code specifics

Everything above applies. This part covers only what Claude Code adds on top.

- **Skills** load from `.claude/skills/`, which links to the same folders in `.agents/skills/`. Invoke them by name
  (`/trip-intake`, `/verify-page`…).
- **Agents** in `.claude/agents/` are read-only: they report, and you edit.
  - `relaxbro` is the travel agent. Hand it the planner's travel questions (pace, what to see, bookings, rain plans) in
    the background, so the planner can keep talking, and apply its proposals with `trip-customize` once the planner
    agrees.
  - The reviewers are `destination-researcher`, `data-curator`, `ux-verifier` and `release-checker`. Verify their
    findings before acting.
- **Rules** in `.claude/rules/` load when you open a matching file (engine, frontend, tests, trip data, pipeline, packs,
  group sync, publishing, planner docs, agent config, memory-bank). Each points at its source of truth.
- **Hooks and permissions** (`.claude/settings.json`):
  - a Bash guard blocks `git add -f`, `--no-verify`, `git commit -n`, `HUSKY=0` and hooksPath changes, and an agent
    agreeing to pay Google for a refresh (`resync … --yes`, `RESYNC_PAID`);
  - a publish guard leaves one door to publishing: the package script alone in Bash, which asks the planner every time
    (an "ask" rule). Every other route to the script, the share or the publish secrets is denied, and naming them in a
    Bash command trips it too, so write such text with the Write or Edit tool;
  - a write guard blocks keys in any file, and key or env files;
  - after a turn that changed framework files, a Stop hook runs lint, the format check and tier 0.
    They add to `.husky/`; they don't replace it.
- **Plugins:** trusting the folder offers `impeccable` and `diagram-design` (declared in `.claude/settings.json`).
  `dataviz` is built in. Load the matching one before UI work (`memory-bank/standards/patterns/frontend.md`).
- **Code graph (optional):** if you use codebase-memory-mcp, its project name comes from your clone's path (for
  example `Users-<you>-…-relaxjer`), and `.cbmignore` keeps trips, builds, data fixtures and vendored skills out of it.
  The "why" is prose in `memory-bank/`: search it (graphmind if you have it, else grep) before re-deciding layout,
  tests or tooling.
- `~/.config/relaxjer/` holds the user's keys, sync files and publish secrets. Reading or editing it is denied; scripts
  read it themselves.
