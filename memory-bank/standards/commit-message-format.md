---
created: 2026-10-01
updated: 2026-10-01
---

# Commit Message Format

Conventional Commits, because `CHANGELOG.md` is built from them (release-please, `release-please-config.json`). commitlint checks them
on every commit (`.husky/commit-msg`, `commitlint.config.mjs`).

## Shape

```
<type>(<scope>): <what changed, as the reader or user would say it>

<optional body: why, in prose; or dash bullets for a list of changes>
```

## Subject

- **Type** is one of `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `style`, `chore`, `revert`,
  `wip`. A wrong type means a missing changelog line.
- **Scope** is the area: `engine`, `pipeline`, `tw` (or another pack), `tests`, `agents`, `design`, `deps`. Leave it out
  when no one area fits.
- **Say the behaviour, not the code**, lower case, no full stop:
  - `feat(engine): offer an update when a newer copy is live`
  - `fix(engine): allowing location from near me clears the location card at once`
  - not `feat(engine): add checkBuildId() to 22-events.js`
- Aim for 72 characters; commitlint's hard limit is 100.

## Body

- Optional. Leave it out when the subject says it all.
- **Prose** for the why: what was wrong or missing, and what the change does about it. Wrap at about 72 characters.
- **Dash bullets** for a list of separate changes, or an "Also:" list after the prose.
- Name commands, flags and user-facing words where they help (`pnpm resync --trip trips/<slug>`). Avoid internal
  function names unless the change is about them.
- No real trip details, ever: the pre-push history scan blocks a commit whose added lines carry them, and so does its
  message's diff. Say "the first trip" or "the demo".

## Enforcement

| Rule                                                | commitlint rule                                                    | Level   |
| --------------------------------------------------- | ------------------------------------------------------------------ | ------- |
| a known type, a subject                             | `type-enum`, `type-empty`, `subject-empty`                         | error   |
| lower-case type                                     | `type-case`                                                        | error   |
| subject not Sentence/Start/UPPER case, no full stop | `subject-case`, `subject-full-stop`                                | error   |
| subject + type at most 100 chars                    | `header-max-length` (config-conventional)                          | error   |
| a blank line before the body                        | `body-leading-blank`                                               | warning |
| body lines at most 150 chars                        | `body-max-line-length` (this repo relaxes 100 → 150, as a warning) | warning |
| footer lines at most 100 chars                      | `footer-max-line-length`                                           | error   |

Merge, revert, `fixup!` and `squash!` commits are skipped by commitlint's defaults.
