---
paths:
  - 'memory-bank/**'
  - 'scripts/docs-update/**'
---

# Memory-bank and ADR contract

- One decision per file in `memory-bank/standards/decisions/`, named `<id>.md`. Frontmatter: `id`, `date`, `title`,
  `domain`, `status` (`proposed`, `accepted`, `amended`, `superseded`, `deprecated`), `decision`, and the optional
  `tags`, `supersedes` and `superseded_by`. The first heading repeats the title.
- `domain` is one value from the closed list in `DOMAINS` (`scripts/docs-update/adr/gen-decision-index.mjs`); the
  generator refuses anything else. A decision that crosses topics adds `tags: [...]` with other domains from that list.
  Pick the domain by what the decision is about, not by its old label.
- `decision` is the rule in one plain line, under 160 characters. The index shows it, so an agent reads one table
  instead of opening every file.
- Replace, don't rewrite. An accepted ADR is frozen. A small clarification goes in a dated `## Amendment YYYY-MM-DD`
  section at its end, and the status becomes `amended`. A real change is a new ADR with `supersedes: [ADR-…]`; the old
  one gets `superseded_by: ADR-…` and status `superseded`. The generator checks that both sides link and the ids exist.
- Sections, in order: Summary, Context, Decision, Alternatives, Consequences (security, operational, cost), Read when.
- Rules live in the pattern files, reasons in the ADRs. Each domain that has a pattern file links every current ADR of
  its domain under "Decisions behind these rules"; `tests/repo/memory-bank.test.mjs` fails when one is missing.
- Ids are `ADR-YYYYMMDD-kebab-slug`, and the date matches the frontmatter date. Never a counter; never renumber or reuse
  a merged id. A collision means the newcomer takes a fresh slug.
- After adding or editing an ADR, run `pnpm gen:adr-index`. Never hand-edit `decision-index.md`: the tier-0 test fails
  when it's stale.
- Content lives in exactly one file. `project/conventions.md` stays a pointer; how-to lives in `standards/patterns/`;
  decisions live in ADRs. Link; don't copy.
- Relative links must resolve (the tier-0 test checks every one). Moving a file means fixing its links in the same
  change.
- Nothing in `memory-bank/` carries a real trip's details. Say "the first trip".
