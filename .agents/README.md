# .agents/

Skills any AI agent can load: Codex, Cursor and Gemini CLI read `.agents/skills/` directly, and Claude Code reads the
same folders through the links in `.claude/skills/`. Instructions for every agent are in `AGENTS.md`. Why it's laid
out this way: `memory-bank/standards/decisions/ADR-20261001-memory-bank-agent-config.md`.

## RelaxJer's own skills

| Skill              | For                                                               |
| ------------------ | ----------------------------------------------------------------- |
| `trip-intake`      | requirements → a trip folder that passes the contract             |
| `data-sync`        | refresh a trip's places, hours, weather and links (`pnpm resync`) |
| `build-page`       | build the single-file page                                        |
| `verify-page`      | tests, then a real-browser pass and the group's journeys          |
| `publish-htmlapp`  | publish or republish behind a password, and prove the live copy   |
| `destination-pack` | a new country or city: pack, pipeline steps, knowledge, tests     |
| `trip-retro`       | lessons from a trip, proposed as a reviewed change                |

A new skill is a folder `.agents/skills/<name>/SKILL.md` whose frontmatter `name` matches the folder, plus a link
`.claude/skills/<name> -> ../../.agents/skills/<name>`. `tests/repo/agent-config.test.mjs` checks both.

## Design skills from other authors

The trip page was designed with these. The licences and authors are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

| Skill                                                                                | Licence    | In this repo                                                              |
| ------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------- |
| `animate`, `apple-design`, `review-animations`, `improve-animations` (Emil Kowalski) | MIT        | vendored here, pinned in `skills-lock.json`                               |
| `impeccable` (Paul Bakaus)                                                           | Apache-2.0 | declared as a Claude Code plugin in `.claude/settings.json`; not vendored |
| `diagram-design` (Cathryn Lavery)                                                    | MIT        | declared as a Claude Code plugin; not vendored                            |
| `dataviz` (Anthropic)                                                                | —          | built into Claude Code; not redistributable                               |

**Update the vendored ones** with the skills CLI, then review the diff like any other change (they run with the agent's
permissions):

```sh
DISABLE_TELEMETRY=1 npx skills@1.7.0 update -p       # refreshes the folders and skills-lock.json
DISABLE_TELEMETRY=1 npx skills@1.7.0 add emilkowalski/skills --skill <name> -a claude-code -a codex -a cursor -a gemini-cli -y
```

Vendored folders keep their upstream bytes: `.prettierignore` and `.cbmignore` list them, so a format run never
rewrites them.

**Install the declared ones** in agents other than Claude Code (Claude Code offers the plugins when you trust the
folder). Use user scope, so the repo's tree stays clean:

| Skill            | Codex                                                                                                             | Cursor, Gemini CLI, others                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `impeccable`     | `npx impeccable install --providers=codex --scope=global`                                                         | `npx impeccable install --scope=global` (pick providers) |
| `diagram-design` | `codex plugin marketplace add cathrynlavery/diagram-design` then `codex plugin add diagram-design@diagram-design` | `npx skills add cathrynlavery/diagram-design -g`         |

Without them, `DESIGN.md`, `PRODUCT.md` and `memory-bank/standards/patterns/frontend.md` still hold every rule the
page follows.
