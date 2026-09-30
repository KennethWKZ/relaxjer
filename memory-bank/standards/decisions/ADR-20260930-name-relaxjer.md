---
id: ADR-20260930-name-relaxjer
date: 2026-09-30
title: 'The Project Is Named RelaxJer'
domain: naming
status: accepted
---

# The Project Is Named RelaxJer

## Summary

**RelaxJer** (Manglish _relax jer_, "just relax"). Decided by Kenneth on 2026-09-30, and the repo was renamed from its
working name, Strollkin, to `relaxjer` (`github.com/KennethWKZ/relaxjer`). There's no domain for now: it's a community
open-source repo, and its only public page is a landing page on GitHub Pages. Of the three names Kenneth shortlisted,
it's the only one nobody owns in search, and it carries the lowest legal risk. Before launch it still needs a formal
MyIPO + SSM check (MyIPO's own site was down during the screen).

## Context

The public repo sits under Kenneth's own account, so a taken GitHub _username_ doesn't matter. What matters is whether
the name is already used out in the world, whether we can own its search results, and whether it's safe to trademark.
Researched on 2026-09-30.

### How it was checked

| Signal                     | Source                                                                                                           | Why it matters                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| What people already search | Google autocomplete, Malaysia locale (`gl=my`)                                                                   | Shows who owns the query today and what Google rewrites it to |
| Competing pages            | Web search (Exa) with exact phrases, plus Bing's rough counts                                                    | Whether we can rank #1 for our own name                       |
| Domains                    | RDAP (Verisign `.com`, Google `.app`) and MYNIC whois (`.my`, `.com.my`), with `google.my` as a positive control | We need a home and the typo domains                           |
| Handles                    | TikTok profile lookups (Instagram and X need a login and weren't reliable, so they're not counted)               | Where Malaysian families share trips                          |
| Packages / code            | npm, GitHub repo search                                                                                          | Developer-facing collisions                                   |
| Trademarks and companies   | WIPO Global Brand DB, TMview / ASEAN TMview, MyIPO, USPTO, SSM company listings                                  | Legal risk (below)                                            |

## Decision

**RelaxJer.** It wins on search and it's the lowest legal risk:

- It's the only one of the three where the exact name is an empty search: nobody owns "relaxjer", so the site can rank
  #1 for its own name quickly.
- Every domain, including the typo ones, was free on 2026-09-30.
- No trademark conflicts turned up in Malaysia or Asia.
- It fits the product: an easy pace and a plan that takes the stress away ("Plan it, then relax jer").

## Alternatives

### The three names, side by side

|                                      | **JomRelax**                                                                                                                                                                          | **RelaxJom**                                                                            | **RelaxJer**                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Meaning                              | "Let's relax"                                                                                                                                                                         | "Relax, let's go" (unusual word order)                                                  | "Just relax" (Manglish _relax jer / relax je_)                                                                                        |
| Who already uses it                  | **Many.** JOM RELAX SPA SDN BHD (a registered company), "Jom Relax Spa" in Johor Bahru, Jom Relax Seafood (on Grab), Jom Relax Cafe, jomrelax.co on Facebook, travel/food blog labels | Two small personal travel blogs (relaxjom.blogspot.com, relaxjom.wordpress.com)         | A small Facebook page ("Mau Relax Jer"), personal posts, and an **LG PuriCare "RELAXJER!" sticker** (LG used the phrase in marketing) |
| Google autocomplete (MY)             | Owned by spas and cafés: "jom relax spa", "…spa johor bahru", "…cafe", "…kulim", "…taiping"                                                                                           | Google flips it into the spa's query: "relax jom" → "jom relax spa", "jom relax spa jb" | Nothing for "relaxjer" (empty, so nobody owns it); "relax jer" drifts to "relax jersey", "relax jerusalem"                            |
| Search-result crowding (Bing, rough) | ~94K for "jomrelax" (broad match)                                                                                                                                                     | ~79 for "relaxjom"                                                                      | ~50 for "relaxjer"                                                                                                                    |
| `.com`                               | **taken** (registered per RDAP; doesn't resolve)                                                                                                                                      | free                                                                                    | free                                                                                                                                  |
| `.my` / `.com.my`                    | free / free                                                                                                                                                                           | free / free                                                                             | free / free                                                                                                                           |
| `.app`                               | free                                                                                                                                                                                  | free                                                                                    | free                                                                                                                                  |
| Typo domains                         | n/a                                                                                                                                                                                   | n/a                                                                                     | relaxje.com, relax-jer.com, relaxje.my: all free                                                                                      |
| TikTok handle                        | free                                                                                                                                                                                  | free                                                                                    | free                                                                                                                                  |
| npm / GitHub repos                   | free / 0                                                                                                                                                                              | free / 0                                                                                | free / 0                                                                                                                              |
| Spelling from hearing                | Easy, but some will type the Malay spelling _relaks_                                                                                                                                  | People say "jom relax" and would search that, landing on the spa                        | Variants _relax je_, _relaxje_, _relaks jer_; buy the typo domains                                                                    |
| Fit with the product                 | "Relax" pulls toward spa/massage, not travel                                                                                                                                          | Same, and the word order feels off                                                      | A relaxed pace for seniors and a stress-free plan                                                                                     |
| Reads well for non-Malaysians        | "Jom" needs explaining                                                                                                                                                                | Same                                                                                    | "Jer" needs explaining; "Relax" carries the meaning                                                                                   |

- **RelaxJom: second.** The exact token is nearly empty (about 79 results), but people would say and search "jom
  relax", which Google hands to the spa. Two travel blogs already use the name.
- **JomRelax: worst.** The .com is taken, and autocomplete and search results are owned by spas, cafés and a registered
  spa company. For a family travel app, sitting next to massage businesses in results is a reputational risk as well.

### Other shortlisted names

| Name          | Meaning                 | Uniqueness (web + autocomplete)                                                                        | Domains (.com / .my / .app) | Note                                         |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------- |
| **JomStroll** | "Let's go for a stroll" | Clean: no suggestions, no exact use; nearest are stroll.com (walking holidays) and Jom Australia Tours | free / free / free          | Keeps the easy-pace idea and the Jom feel    |
| **JomWander** | "Let's go wandering"    | Clean: no suggestions, no exact use                                                                    | free / free / free          | Echoes Wanderlog, the app that inspired this |
| JomRehat      | "Let's rest"            | Everyday phrase ("jom rehat dulu"); an Ipoh shop "Jom Rehat Sebentar"                                  | free / free / –             | Too generic to own                           |
| JomHop        | "Let's hop"             | Google reads it as **Jomashop** (a big US retailer)                                                    | –                           | Avoid                                        |
| JomFam        | "Let's go, family"      | "Jom Family Karaoke" owns the phrase                                                                   | free / free / –             | Weak                                         |
| Strollkin     | stroll + kin            | No exact use, but Google treats "strollkin" as a typo for _strolling_                                  | free / – / free             | Fully unique, weaker search start            |
| ~~JomTravel~~ |                         | Taken: travel agency, TikTok, all domains live                                                         | taken                       | Rejected                                     |

**Strollkin** is the one to pick instead if a registrable mark that works abroad ever matters more: it's the only coined
candidate. The cost is a slower search start, because Google first reads it as _strolling_.

### Trademarks and registered companies

**No trademark filed or registered anywhere for JOMRELAX, RELAXJOM or RELAXJER, with or without spaces.**

- **Searched:** WIPO Global Brand Database (includes MyIPO's ~1.14M Malaysian records), TMview (14 offices incl. MY, EU,
  US, GB, AU, TH, VN, PH, Benelux), and USPTO. The TMview exact-name searches were re-run first-hand on 2026-09-30 and
  returned 0.
- **Not reachable:** MyIPO's own site (Cloudflare 522) and ASEAN TMview (timeouts).
- **Not formal:** company names came from interepo, CreditScan and CTOS pages, not an SSM search.
- This is a database screen, not legal clearance.

| Name         | Closest conflicts                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Risk for a free open-source travel app                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **JomRelax** | **JOM RELAX SPA SDN BHD** (SSM 202101040545, incorporated 2021, KL). **"JOM" is registered in class 39 (travel/transport) by two companies**: Jom Cars & Tours Sdn Bhd (TM2024039842) and Jom Asia Sdn Bhd (2017061202). **JomLetsGo** ("Every adventure starts with Jom!", TM2026020106, class 35, pending) is a kids' activities marketplace, the same family audience. About 196 Malaysian marks contain JOM, and "Relax" is descriptive, so the name leans on JOM. | **Medium**                                                     |
| **RelaxJom** | The same JOM marks. JOM RELAX SPA is the same words reversed                                                                                                                                                                                                                                                                                                                                                                                                           | **Medium**                                                     |
| **RelaxJer** | Nothing in Malaysia or Asia; "jer" appears only as a filler word in unrelated MY marks ("FREE jer", "Pakai tangan jer"). Abroad: **Relax je Kids** (Benelux, 35/41/44, registered: Dutch "relax yourself", kids' services) and **RELAXJET** (France, 35/38/39, registered, one letter off). A "RELAX JER" restaurant listing in Port Klang.                                                                                                                            | **Low**. Only matters if the project targets Benelux or France |

The Jom names share the JOM exposure: JomStroll and JomWander also rest on JOM in the travel class where "JOM" is
registered twice, so they're **Medium** too.

## Consequences

- **Hard to own:** "relax jer" is everyday slang and "relax" is descriptive, so registering it as a mark would likely
  be refused or weak. For a free open-source project, not infringing matters more than owning.
- **Explain the meaning** to foreigners: a line such as "RelaxJer: Malaysian for _just relax_".
- **Spelling variants:** write "RelaxJer (relax je)" on the landing page and in its title. If a domain is ever wanted,
  buy relaxjer.com + relaxje.com (plus relaxjer.my for the local one) and redirect the extras, roughly US$10–15 a year
  per .com.
- **Before launch:** a formal MyIPO + SSM check.

## Read when

You're choosing a domain, a landing-page title, a package name, or considering a trademark.
