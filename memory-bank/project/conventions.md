---
created: 2026-10-01
updated: 2026-10-01
---

# Conventions: Pointer File

This file holds **no convention of its own**. It exists because the memory-bank layout has one, and filling it would
copy rules that live elsewhere.

| Concern                                     | Source of truth                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The rules that bind, and what enforces them | [`../standards/coding-standards.md`](../standards/coding-standards.md), indexing `../standards/patterns/*` |
| Words to use in code and docs               | [`glossary.md`](./glossary.md)                                                                             |
| Commit messages                             | [`../standards/commit-message-format.md`](../standards/commit-message-format.md)                           |
| ADR frontmatter, sections, ids, the index   | `.claude/rules/memory-bank.md`, and `pnpm gen:adr-index`                                                   |
| The trip page's design                      | `DESIGN.md` and `PRODUCT.md` at the repo root                                                              |
| Finishing a task                            | `AGENTS.md` § Finishing a task                                                                             |

**Don't add conventions here.** Add them to the matching `../standards/patterns/*.md` file, or to
`.claude/rules/memory-bank.md` for the memory-bank's own contract.
