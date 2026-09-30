---
paths:
  - 'memory-bank/**'
  - 'scripts/docs-update/**'
---

# Memory-bank and ADR contract

- One decision per file in `memory-bank/standards/decisions/`, named `<id>.md`. Frontmatter: `id`, `date`, `title`,
  `domain`, `status` (`proposed`, `accepted`, `amended`, `superseded`, `deprecated`). The first heading repeats the title.
- Sections, in order: Summary, Context, Decision, Alternatives, Consequences (security, operational, cost), Read when.
- Ids are `ADR-YYYYMMDD-kebab-slug`, and the date matches the frontmatter date. Never a counter; never renumber or reuse
  a merged id. A collision means the newcomer takes a fresh slug.
- After adding or editing an ADR, run `pnpm gen:adr-index`. Never hand-edit `decision-index.md`: the tier-0 test fails
  when it's stale.
- A later decision that changes an ADR marks the old one `amended` or `superseded`, with a link both ways.
- Content lives in exactly one file. `project/conventions.md` stays a pointer; how-to lives in `standards/patterns/`;
  decisions live in ADRs. Link; don't copy.
- Relative links must resolve (the tier-0 test checks every one). Moving a file means fixing its links in the same
  change.
- Nothing in `memory-bank/` carries a real trip's details. Say "the first trip".
