@AGENTS.md

## Claude Code specifics

Everything above applies. This part covers only what Claude Code adds on top.

- **Skills** load from `.claude/skills/`, which links to the same folders in `.agents/skills/`. Invoke them by name
  (`/trip-intake`, `/verify-page`…).
- **Agents** in `.claude/agents/` are read-only reviewers: `destination-researcher`, `data-curator`, `ux-verifier`,
  `release-checker`. Use them to review work; verify their findings before acting.
- **Rules** in `.claude/rules/` load when you open a matching file (engine, tests, trip data, pipeline, packs,
  frontend, memory-bank). Each points at its source of truth in `memory-bank/standards/patterns/`.
- **Hooks** (`.claude/settings.json`):
  - a Bash guard blocks `git add -f`, `--no-verify`, `git commit -n`, `HUSKY=0` and hooksPath changes;
  - a write guard blocks keys in any file, and key or env files;
  - after a turn that changed framework files, a Stop hook runs lint, the format check and tier 0.
    They add to `.husky/`; they don't replace it.
- **Plugins:** trusting the folder offers `impeccable` and `diagram-design` (declared in `.claude/settings.json`).
  `dataviz` is built in. Load the matching one before UI work (`memory-bank/standards/patterns/frontend.md`).
- **Code graph:** codebase-memory-mcp project `Users-kennethwkz-Repositories-relaxjer`. `.cbmignore` keeps trips,
  builds, data fixtures and vendored skills out of it. The "why" is prose in `memory-bank/`: search it (graphmind, if
  registered, or grep) before re-deciding layout, tests or tooling.
- `~/.config/relaxjer/` holds the user's keys and publish secrets. Reading it with the Read tool is denied; scripts
  read it themselves.
