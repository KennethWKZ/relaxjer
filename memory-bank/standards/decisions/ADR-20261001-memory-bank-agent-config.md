---
id: ADR-20261001-memory-bank-agent-config
date: 2026-10-01
title: 'Project Context Lives in memory-bank/; Agent Tooling Works for Any Agent, With Claude Code Extras'
domain: agents
status: accepted
---

# Project Context Lives in memory-bank/; Agent Tooling Works for Any Agent, With Claude Code Extras

## Summary

`docs/` became a `memory-bank/` in the shape of the maintainer's boilerplate: project, standards, date-slug ADRs with a
generated index, and a story index. `AGENTS.md` is the one instruction file every agent reads. Skills live in
`.agents/skills/`, which Codex, Cursor and Gemini CLI read, and are linked into `.claude/skills/` for Claude Code.
Agents, path-scoped rules and hooks are Claude Code extras, and each of them points back at a file any agent can
read. Third-party design skills are vendored only when they're small and MIT; the big ones are declared as Claude Code
plugins, with install commands for the other agents. Tests gate the whole setup.

## Context

- Kenneth asked for the design skills the first trip page was built with to be part of the framework, and for the repo
  to carry skills, rules and agents that any AI agent can follow, in his boilerplate's memory-bank layout.
- The first page used, per its session transcripts: **impeccable** (plugin, Apache-2.0), **diagram-design** (plugin,
  MIT), **animate** and **apple-design** (Emil Kowalski's skills, MIT), and **dataviz** (built into Claude Code).
- The repo is public, MIT, and takes pull requests, so two contributors adding "ADR 0005" at once is a real collision.
- Only Claude Code reads `.claude/`. Codex, Cursor, Gemini CLI and Copilot read `AGENTS.md`. The skills CLI
  (`npx skills`) installs project skills into `.agents/skills/` for Codex, Cursor and Gemini CLI, and links them into
  `.claude/skills/` for Claude Code, which follows the links.

## Decision

### memory-bank/

| Path                           | Holds                                                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `project/`                     | brief, product context (framework personas and journeys), glossary, and a pointer-only conventions file                |
| `standards/`                   | tech stack, system architecture, trip format, coding standards, commit format, decision index                          |
| `standards/decisions/ADR-*.md` | one decision per file, id `ADR-YYYYMMDD-slug`; the old ADR 0001–0004 were renumbered once, before the repo went public |
| `standards/patterns/`          | how to write engine code, tests, trip data and UI here                                                                 |
| `story-index.md`               | the roadmap: steps, status, engine debt, known issues, open decisions                                                  |
| `project.yaml`                 | project type and start date                                                                                            |

- `decision-index.md` is generated (`pnpm gen:adr-index`, ported from the boilerplate). A tier-0 test fails when it's
  stale, so the pre-commit hook and CI both catch a missed regeneration.
- Content lives in exactly one file. Other files link to it.
- `PRODUCT.md` and `DESIGN.md` stay at the repo root, because impeccable and the DESIGN.md format read them there. They
  describe the trip page. `memory-bank/project/product-context.md` describes the framework and links to them.
- `knowledge/` stays as [ADR-20260930-repo-layout](ADR-20260930-repo-layout.md) set it: lessons for planning and building
  trips, loaded by the task that needs them. `memory-bank/` is about the codebase.

### Agent tooling

| Piece                                                                      | Any agent                                                     | Claude Code                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Instructions                                                               | `AGENTS.md`                                                   | `CLAUDE.md` imports `AGENTS.md`, then adds Claude-only pointers                                                                  |
| Skills (our seven workflows + vendored design skills)                      | `.agents/skills/<name>/SKILL.md`                              | `.claude/skills/<name>`, a relative link to the same folder                                                                      |
| Rules by area (engine, tests, trip data, pipeline, packs, UI, memory-bank) | `memory-bank/standards/patterns/*.md` (listed in `AGENTS.md`) | `.claude/rules/*.md` with `paths:`, loaded when a matching file is opened; each points at its pattern file                       |
| Roles (destination researcher, data curator, UX verifier, release checker) | described in `AGENTS.md`                                      | `.claude/agents/*.md`. All four are read-only: no Edit or Write tools                                                            |
| Guards                                                                     | `.husky/` hooks, tests                                        | `.claude/hooks/`: secrets and key files blocked on write, `git add -f` / `--no-verify` blocked, fast tests on stop after a write |

### Third-party design skills

| Skill                                                        | Licence    | How it ships                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| animate, apple-design, review-animations, improve-animations | MIT        | **Vendored** in `.agents/skills/` by the skills CLI, pinned in `skills-lock.json`, licence in `.agents/THIRD_PARTY_NOTICES.md`. ~90 KB, Markdown only                                                               |
| impeccable                                                   | Apache-2.0 | **Declared**: a Claude Code plugin in `.claude/settings.json` (`extraKnownMarketplaces` + `enabledPlugins`), so Claude Code offers to install it when the folder is trusted. Other agents: `npx impeccable install` |
| diagram-design                                               | MIT        | **Declared** the same way. Codex: `codex plugin marketplace add cathrynlavery/diagram-design`                                                                                                                       |
| dataviz                                                      | Anthropic  | **Built into Claude Code**, not redistributable. Other agents follow the chart rules in `DESIGN.md` and `patterns/frontend.md`                                                                                      |

Review animations and improve animations came along because animate routes to them by name.

## Alternatives

| Option                                                   | Why not                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep `docs/` with numbered ADRs                          | Numbered ids collide across pull requests. It also differs from the maintainer's other repos, where agents already know the layout                                                                                                                                                      |
| Vendor impeccable and diagram-design too                 | About 5 MB of third-party code (a 1.1 MB font index, a 536 KB browser script, 140 HTML examples) in a small framework repo; impeccable shipped four releases in a month; vendored as a plain skill it loses its agents and hooks; every update becomes a multi-megabyte diff in history |
| A manifest only (`skills-lock.json`, `.agents/` ignored) | Restoring (`npx skills experimental_install`) is experimental, needs the network and runs a CLI; an agent that skips the step sees no skills                                                                                                                                            |
| Canonical skills in `.claude/skills/`                    | Codex, Cursor and Gemini CLI wouldn't see them                                                                                                                                                                                                                                          |
| A SessionStart hook that loads `knowledge/`              | It spends context on every session, and it's Claude-only. Path-scoped rules and skills load the right lesson when the task needs it                                                                                                                                                     |

## Consequences

- **Security**
  - Vendored skills run with the agent's full permissions. They're pinned (`skills-lock.json` hashes), reviewed as
    diffs on update (`npx skills update -p`), and Markdown only.
  - The impeccable plugin's hooks run a binary it downloads on first use. Claude Code asks before installing a declared
    plugin, and a contributor can decline. The page's design rules don't depend on it.
  - The `.claude/hooks/` guards add to `.husky/` and the tests; they don't replace them. Other agents and people get
    the same protection from git hooks and CI.
- **Operational**
  - The `.claude/skills/*` links are symlinks. On Windows, git needs `core.symlinks=true` (and Developer Mode), or the
    links check out as text files; `.agents/skills/` works either way.
  - `tests/repo/agent-config.test.mjs` and `tests/repo/memory-bank.test.mjs` fail on:
    - a skill whose name doesn't match its folder;
    - a missing link, or a lock entry without its vendored folder;
    - an agent with write tools, or a hook script that doesn't exist;
    - a rule whose `paths` match nothing;
    - an ADR with bad frontmatter, or a stale index;
    - a broken relative link.
  - Moving a file means updating links. The link test names every one that breaks.
- **Cost:** about 90 KB of vendored Markdown. No new runtime dependency; the index generator uses Prettier, which was
  already a dev dependency.

## Read when

You're adding a skill, agent, rule or hook; vendoring or updating a third-party skill; adding an ADR; or moving a file
that `memory-bank/` or `AGENTS.md` links to.
