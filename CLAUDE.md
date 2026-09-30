@AGENTS.md

## Claude Code specifics

- Code graph: codebase-memory-mcp project `Users-kennethwkz-Repositories-relaxjer`. `.cbmignore` keeps trips, builds
  and data fixtures out of it.
- The "why" lives in `docs/` (ADRs, roadmap). Check there before re-deciding layout or test conventions.
- Skills, agents and hooks under `.claude/` arrive in roadmap step 6. Until then, `.husky/pre-commit` is the guard.
