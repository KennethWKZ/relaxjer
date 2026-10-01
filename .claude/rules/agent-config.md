---
paths:
  - '.agents/**'
  - '.claude/**'
  - 'AGENTS.md'
  - 'CLAUDE.md'
---

# Agent config

Read ADR-20261001-memory-bank-agent-config. `AGENTS.md` is for every agent; `CLAUDE.md` adds only what Claude Code adds.

- A skill is `.agents/skills/<name>/SKILL.md` (frontmatter `name` matching the folder, and a description that says when
  to use it) plus the link `.claude/skills/<name> -> ../../.agents/skills/<name>`. List it in `AGENTS.md`,
  `.agents/README.md`, the README's skills table and `guides/getting-started.md`.
- A role is `.claude/agents/<name>.md` with an explicit, read-only `tools` list (never Edit or Write): it reports, and
  the main agent edits. List it in `AGENTS.md` § Roles and `guides/getting-started.md`.
- A hook names a script in `.claude/hooks/` and has a test in `tests/repo/agent-config.test.mjs`. A path-scoped rule
  in `.claude/rules/` points at its source of truth and matches at least one file.
- Vendored skills keep their upstream bytes and stay pinned in `skills-lock.json`.
- Lessons are proposed, not self-applied: a new rule for an agent lands as a reviewed change with the test that gates
  it (`trip-retro`).
