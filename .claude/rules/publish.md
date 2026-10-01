---
paths:
  - 'scripts/publish-trip.mjs'
  - 'knowledge/hosting.md'
  - '.claude/hooks/guard-publish.mjs'
  - 'tests/repo/guard-publish.test.mjs'
---

# Publishing

Read the `publish-htmlapp` skill and `knowledge/hosting.md`. Publishing reaches the group, and the host can't delete.

- One door: the package script, alone in Bash, which Claude Code asks the planner about every time. The hook denies
  every other route (another spelling, a chained command, a context-mode shell, a direct share with the update key, any
  read of the publish secrets or the Keychain item). Don't add a second door.
- The script reads its secrets itself and redacts every output; a new output path gets a test that proves it
  (`tests/unit/publish.test.mjs`).
- A real trip never goes on GitHub Pages or any public host.
- A change to what the page may load or reach is checked with the script's read-only audit before it's published.
