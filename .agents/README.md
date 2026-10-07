# .agents/

Skills any AI agent can load: Codex, Cursor and Gemini CLI read `.agents/skills/` directly, and Claude Code reads the
same folders through the links in `.claude/skills/`. Instructions for every agent are in `AGENTS.md`. Why it's laid
out this way: `memory-bank/standards/decisions/ADR-20261001-memory-bank-agent-config.md`.

## RelaxJer's own skills

| Skill              | For                                                               |
| ------------------ | ----------------------------------------------------------------- |
| `planner-setup`    | a fresh clone → the tools, the install, the demo opened, the keys |
| `trip-intake`      | requirements → a trip folder that passes the contract             |
| `trip-customize`   | the planner's changes → the trip's data, and where each one shows |
| `data-sync`        | refresh a trip's places, hours, weather and links (`pnpm resync`) |
| `build-page`       | build the single-file page                                        |
| `verify-page`      | tests, then a real-browser pass and the group's journeys          |
| `publish-htmlapp`  | publish or republish behind a password, and prove the live copy   |
| `sync-setup`       | group sync for a trip on the planner's own Firebase (`pnpm sync`) |
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

## A real browser for pages that block scripts

Ticket resellers refuse plain fetches and most automated browsers, so an agent reads them through a Chrome that a person
started, attached over the Chrome DevTools Protocol. Any agent can do this, through
[Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) or Playwright's `connectOverCDP`.

1. **Start Chrome with a debugging port and its own profile.** Chrome refuses the port on your everyday profile. Keep
   this profile between runs, since a site that let it in once tends to remember it:

   ```sh
   # macOS; on Linux run google-chrome, on Windows chrome.exe, with the same two flags
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --remote-debugging-port=9222 --user-data-dir="$HOME/.relaxjer-research-chrome"
   ```

2. **Attach the agent.** As an MCP server: `npx chrome-devtools-mcp@1.10.1 --browser-url=http://127.0.0.1:9222`. From
   a script: `chromium.connectOverCDP('http://127.0.0.1:9222')` (Playwright).
3. **Open the site's home page first,** and set the currency there (below). Go at a person's pace: a few seconds on
   each page, one site at a time. If a check or a cookie banner appears, the person handles it in that window, then
   the agent goes on. An agent never solves a CAPTCHA, signs in or pays.

What each reseller let through on the first trip (2026-10-07, Chrome 154, macOS):

| Site     | Plain fetch | Chrome launched by Playwright, fresh profile | Chrome started by hand, fresh profile, attached          |
| -------- | ----------- | -------------------------------------------- | -------------------------------------------------------- |
| Trip.com | HTTP 432    | HTTP 432                                     | read it, once the home page had been opened first        |
| Klook    | CAPTCHA     | HTTP 403                                     | HTTP 403, even its home page; an everyday profile got in |
| KKday    | CAPTCHA     | read it with a window; HTTP 403 headless     | read it                                                  |

Klook's check (DataDome) also caught the everyday profile once an agent had loaded a dozen pages in a few minutes, and
fresh profiles had been turned away from the same address: it asked for a slider, which the person completes.

**Setting the currency** (checked 2026-10-07):

| Site     | How                                                                                       | Kept in                          |
| -------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Trip.com | `curr=MYR` in the address                                                                 | the address                      |
| Klook    | the language and currency button in the header (`EN(MY) · USD`) → Currency → the currency | the `klk_currency` cookie        |
| KKday    | the currency button in the header (`USD ⌄`) → the currency                                | the `currency` cookie, HTTP-only |

Use the site's own menu. Klook ignored `?currency=MYR` in the address, and writing KKday's cookie by hand changed the
label to RM but left the USD number. A fresh KKday profile on a Malaysian address already opened in RM.

**Security:** while the port is open, any program on the machine can drive that browser. Chrome listens on
`127.0.0.1` only by default; leave it so. Sign in to nothing in that profile, and quit Chrome when the research is done.
