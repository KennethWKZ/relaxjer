---
id: ADR-20261001-page-csp
date: 2026-10-01
title: 'The Trip Page Carries Its Own Content-Security-Policy, and MapLibre Loads With Subresource Integrity'
domain: security
status: accepted
---

# The Trip Page Carries Its Own Content-Security-Policy, and MapLibre Loads With Subresource Integrity

## Summary

The single-file page now carries a Content-Security-Policy in a `<meta>` tag: each of its inline scripts is allowed by
its hash, nothing else inline runs, and code, data and images may only come from or go to the hosts the page uses.
MapLibre, the one library it loads from a CDN, loads with a subresource-integrity hash. Decided by Kenneth on
2026-10-01, with group sync ([ADR-20261001-group-sync](ADR-20261001-group-sync.md)), whose keys sit in the page. Audited
against ht-ml.app before shipping.

## Context

Once the page holds sync keys, any script that runs in it can read them. The page already ran outside code: MapLibre
5.24.0 from cdnjs (jsDelivr as fallback) with no integrity check, and Google's Maps JavaScript API, which Google changes
weekly and can't be pinned. The host serves one file and sets no headers worth having, so a policy has to travel in the
page itself.

## Decision

- **The build writes the policy** (`engine/build.mjs`, `contentSecurityPolicy`) into the standalone page:
  - `script-src`: a `sha256` hash per inline script, the two MapLibre CDNs and `blob:` (map workers). No `'unsafe-inline'`.
  - `connect-src`: the page itself (the update check), the map tiles, every `https://` host a destination pack's code
    names (bike-share counts), and the trip's sync database when it has one.
  - `img-src`, `font-src`, `style-src`, `worker-src`, `manifest-src` as narrow as the page allows; `default-src`,
    `object-src`, `base-uri` and `form-action` are `'none'`.
  - A page built with a Google key adds Google's documented allowlist for the Maps JavaScript API, including
    `'unsafe-eval'` and wildcard Google domains.
- **MapLibre loads with `integrity` and `crossorigin`.** Both CDNs serve the pinned files byte for byte, so one hash
  each covers both. A file that doesn't match fails like a download: the next CDN, then the drawn map.
- **Every e2e test fails on a refusal** (`tests/support/fixtures.mjs` turns `securitypolicyviolation` into an error),
  `tests/e2e/policy.spec.mjs` pins the policy's shape, and `tests/repo/hardening.test.mjs` keeps the integrity hashes.
- **The host was audited first** (`pnpm publish:trip trips/<slug> --audit`, read-only): ht-ml.app sends only
  `content-type` and its own cache tag, adds no tags, and re-serialises the markup but serves every inline script byte
  for byte, so the hashes hold. The hardened page, served at the live address with the real Google key, rendered on an
  iPhone and an Android phone with the Google map and nothing refused. After each publish, the script now checks that
  the live policy reads the same as the built one and that nothing was refused.

## Alternatives

| Option                                        | Why not                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `'unsafe-inline'` for scripts                 | Any injected inline script would run; hashes cost nothing in a built file |
| Nonces and `'strict-dynamic'` (Google's pick) | A nonce must change per response; a static file can't                     |
| A policy header                               | ht-ml.app sets no headers for the page                                    |
| Pinning Google Maps                           | Google ships it weekly by design; its allowlist is what Google documents  |

## Consequences

- **Security:** a tampered MapLibre file doesn't run, and any script that does run can only reach the listed hosts.
  Residual: on a page with a Google key, Google's wildcard domains are reachable, so a tampered Google script could
  still send data to a Google-hosted endpoint; `'self'` covers only the trip's own ht-ml.app subdomain.
- **Operational:** a MapLibre version bump needs new hashes (the command is in `17-map-maplibre.js`). A new outside host
  in the engine needs a line in the policy, and a pack's hosts are picked up from its code. If ht-ml.app's upload scan
  ever changed the policy, the publish stops with a rollback copy in hand.
- **Cost:** none.

## Read when

You're adding an outside host, a CDN library, an inline script, or a Google feature to the page; bumping MapLibre; or
changing how the host serves pages.
