---
id: ADR-20261122-adr-index-by-domain
date: 2026-11-22
title: 'Decisions Are Grouped by a Closed List of Domains, Each With a One-Line Rule'
domain: tooling
status: accepted
decision: 'ADR files stay flat and date-based; each ADR has one domain from a closed list and a one-line decision, and the index groups by domain.'
---

# Decisions Are Grouped by a Closed List of Domains, Each With a One-Line Rule

## Summary

The 31 decisions stay as flat, date-based files in `decisions/`. Each one now names exactly one domain from a closed
list of seven, carries a one-line `decision` field, and may add `tags` for the other topics it touches. The generated
index groups the decisions by domain, with the current ones first and the superseded ones folded away. An accepted
decision is never rewritten: a small change is a dated amendment, and a real change is a new ADR that supersedes it.

## Context

- The folder held 31 ADRs in one flat list, sorted by date. A reader scanning the index saw 31 rows with no grouping.
- The `domain` field was free text. It had drifted to ten values (`engine`, `data`, `tooling`, `hosting`, `layout`,
  `frontend`, `agents`, `security`, `testing`, `naming`), so the same topic could sit under two labels.
- The index showed only the title. To learn what a decision said, an agent had to open the file.
- Edits to accepted decisions had no rule, so bodies were rewritten in place and history was lost.
- `memory-bank/` is already categorised by folder (`project/`, `standards/`, `standards/decisions/`,
  `standards/patterns/`), as the boilerplate does. Nothing in that layout needs to move for this change.

## Decision

1. **Files stay flat.** Files sit in `decisions/` as `ADR-YYYYMMDD-slug.md`: no moves, no renames. Links in code, pull
   requests and history keep working. Ids stay date-based, never a counter.
2. **A closed list of seven domains**, defined once in `DOMAINS` in `scripts/docs-update/adr/gen-decision-index.mjs`.
   The generator refuses any other value.

   | Domain      | Covers                                                                          | ADRs                                                                                                                                              | Pattern files                   |
   | ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
   | `engine`    | how a trip becomes the page: views, sections, day logic, packs                  | split-follows-pushback, native-layer, currency-switch, day-views, place-finder-best-day                                                           | `engine.md`                     |
   | `trip-data` | a trip's data, the pipeline that refreshes it, and the keys it needs            | google-keys, day-split, option-chips, traffic-aware-drives, resync-cost-guard                                                                     | `trip-data.md`, `pipeline.md`   |
   | `sync`      | group sync between phones                                                       | group-sync, sync-planners                                                                                                                         | none                            |
   | `hosting`   | where the page and demos are published, the page security policy                | live-page-on-relaxjer, page-csp, live-demo-on-pages, second-demo-and-site-worlds                                                                  | none                            |
   | `design`    | type, colour, illustrations, motion, names and controls                         | name-relaxjer, embed-brush-font, landing-postcards, destination-themes, world-motion, world-stickers                                              | `frontend.md`, `affordances.md` |
   | `tooling`   | repo layout, toolchain, CI and releases, dependency rules, agent setup and docs | repo-layout, memory-bank-agent-config, feature-docs-planner-skills, project-tooling, ci-image-and-releases, squash-merges, release-age-exceptions | none                            |
   | `testing`   | test tiers, the checks that gate a merge, e2e rules                             | test-strategy, required-ci                                                                                                                        | `testing.md`                    |

   The old labels map by subject, not by name: `data` goes to `trip-data` or `sync`; `layout` goes to
   `tooling` or `design`; `security` goes to `hosting`; `agents` goes to `tooling`; `frontend` and `naming` go to `design`.
   A decision that crosses topics adds `tags: [...]` with other domains from the same list (for example `day-split` is
   `trip-data` with the tag `engine`).

3. **The index groups by domain.** One heading per domain, current decisions (`proposed`, `accepted`, `amended`) listed
   first, and superseded or deprecated ones folded under a `<details>` per domain. Each row shows the one-line decision,
   so an agent reads one table. The index stays generated; `pnpm gen:adr-index --check` runs in verify.
4. **Replace, don't rewrite.** An accepted ADR is frozen. A clarification goes in a dated `## Amendment YYYY-MM-DD`
   section at its end, and the status becomes `amended`. A real change is a new ADR with `supersedes`, and the old one
   gets `superseded_by` and status `superseded`. The generator checks that both sides name each other and the ids exist.
   The eight ADRs that are already `amended` keep their bodies; they are not split now.
5. **A one-line `decision` on every ADR**, under 160 characters, required by the generator.
6. **Patterns hold today's rules, ADRs hold the reasons.** Each domain with a pattern file links every current ADR of
   its domain from a "Decisions behind these rules" list at the end of that file. `tests/repo/memory-bank.test.mjs` fails
   when a link is missing. The `sync`, `hosting` and `tooling` domains have no pattern file, so they are exempt; their
   rules live in their ADRs and in `.claude/rules/`.
7. **The contract is stated once**, in `.claude/rules/memory-bank.md`. `AGENTS.md` and the generator point to it.

## Alternatives

- **Folders by topic** (`decisions/engine/…`). Rejected. Every existing link and pull-request reference to an ADR path
  breaks. A decision that spans two topics has no single home. It also departs from the boilerplate, whose folders
  hold project documents, not decisions.
- **Keep flat files and free-text domains, and sort the index by date.** Rejected. Labels had already drifted, and
  the reader still scans 31 rows with no grouping.
- **Sequential numbers with folders.** Rejected. Parallel branches would collide, and a renumber on merge would break
  links. The date-based id already avoids both.
- **Open tags only, with no required domain.** Rejected. Without one domain per decision, some decisions would have
  no group, and the index could not promise a home for each.
- **A hand-written index.** Rejected. It drifts; the generator and its `--check` keep it honest.

## Consequences

- **Security:** no runtime effect. The security-relevant decisions (the page policy, the Google key rules) keep their
  wording and move only to the `hosting` domain. The index shows decisions already in the public repository.
- **Operational:** a new decision needs a domain from the list, a one-line rule and, if its domain has a pattern file, a
  link from that file. A new domain is a reviewed change to `DOMAINS` plus a row in this table. Old wording stays
  visible in the history of each file, because accepted bodies are not rewritten.
- **Cost:** none beyond the seconds the tier-0 test takes. The index is one file of about 100 lines.

## Read when

- Adding, amending or superseding an ADR: `.claude/rules/memory-bank.md` for the fields and the replace rule.
- Choosing a domain for a new decision, or proposing a new one: the table above and `DOMAINS` in
  `scripts/docs-update/adr/gen-decision-index.mjs`.
- Wondering why the ADR folder is flat: the Alternatives section here.
