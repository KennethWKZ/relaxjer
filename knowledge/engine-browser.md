# Engine and browser lessons

What the first trip taught about the page in real browsers. Each lesson is backed by a test where one could be written.

## Scrolling and section skipping

- **`content-visibility: auto` needs scroll anchoring that holds,** and `CSS.supports('overflow-anchor', 'auto')`
  can't tell: WebKit answers yes (macOS, Linux and iOS alike) but doesn't hold the position. Without it, the page jumps
  thousands of px while scrolling up. On CI's slower Linux WebKit, a scrolled-to target kept moving, so clicks timed
  out ("element is not stable", "outside of the viewport") and the e2e job ran 40+ minutes (2026-10-01). Section
  skipping is for Chromium-family browsers only (`01-storage.js`), and the sections' 16 px gutter bleed stays in every
  browser, since it's layout, not skipping.
- **Its paint containment clips children** that bleed out with negative margins.
- **`innerText` of a skipped section is `''`.** Search and copy must read the data, not the DOM.
- **WebKit reports `overflow-anchor` support but doesn't hold a jump's target** while skipped sections draw. Tab and
  Sections-menu jumps landed 770–900 px off target on WebKit, and deep links (`…#entry`) 3,800–10,000 px off. Fix: every
  jump re-lands a few times over about 1.2 s (`holdLanding()`), and stops on touch, another jump, or Back.
  (`tests/e2e/navigation.spec.mjs`)
- **Smooth scrolls across undrawn sections stop short.** Snap to the target at `scrollend`. Tab and menu jumps are
  instant, with a landing glow instead of a long smooth scroll.
- **Full redraws must keep the reader's place** (a language switch, a data refresh):
  - anchor on an element near the top of the screen;
  - remember open `<details>` by their nearest id, so lists built on open reopen too;
  - carry the old section heights over;
  - hold the spot for 2 s, and let go on touch, scroll or a deliberate programmatic scroll.
- **A reload must keep the reader's place too** (2026-10-07: the update bar's Update landed Android Chrome a day or two
  early). The browser restores a pixel offset before skipped sections above have drawn at their real height, and a tab
  jump left its heading in the address, which the page jumped to on load. So the page saves the same spot on `pagehide`,
  on `visibilitychange` to hidden (iPhone Safari doesn't always send `pagehide`) and before Update, and a reload within
  30 minutes restores it with scroll restoration set to manual. WebKit still scrolled to the address's `#heading` at
  load, after the page's own restore, so that reload drops the `#heading` from the address first.
- **A hold must let go of any scroll the reader starts, however small.** The 2 s "keep my place" hold took a page move
  of over 2 px a frame as the reader's scroll; a smooth scroll's first frame moves less, and the hold's correction (an
  instant scroll) cancelled it, so the page wouldn't move at all for 2 s after a reload. Any page move matched by the
  content counts now; scroll anchoring moves the page but not the content, so it still doesn't.

## Layout at 390 px

- **A `nowrap` link ran about 200 px off a 390 px screen in English** ("Shopping (10 shops…)"). Wrap with balanced lines
  instead. The same fix cured a home-screen button 1.4 px too wide. Test both languages at 390 px; English runs longer.

## Maps and sheets

- **Google `AdvancedMarker` content must be a `div`**, not a `button`, or clicks recurse.
- **The place sheet strips ids** from its copy, so use `data-` attributes inside sheets.
- **A phone keyboard covers a bottom sheet instead of shrinking the page** (2026-10-02: the group couldn't see what
  they typed). iPhone Safari never resizes the layout for its keyboard, and Android Chrome doesn't either since 108. So the
  page watches `visualViewport`, one path on both phones and the one the e2e test covers: while the keyboard is up over an open
  sheet, it lifts the sheet to sit on the keyboard (`.kb-up`, `--kb`, `--vvh`) and scrolls the focused field into view.
  A `position: fixed` child of a dialog with a `transform` is placed by the dialog, not the screen. Not
  `interactive-widget=resizes-content` in the viewport tag: it gives Android a second, untested path, and WebKit logs
  that it doesn't know the key (it failed every WebKit test on CI, 2026-10-02).
- **Closing a sheet after a tab jump threw the reader back to the jumped-to heading** (2026-10-07, both engines, Esc,
  ✕, outside tap and Back). A sheet's close steps back through history, and the browser restores the scroll position it
  saved for the jump's step, not where the reader had scrolled to since. An overlay now remembers `scrollY` and puts it
  back once the step back has settled (`keepPlace` in `19-back-button.js`). Only a person's own scroll showed it (a
  script's `scrollBy` didn't), so its e2e test scrolls with PageDown.

## Home-screen apps

- **A paused home-screen app keeps the copy it loaded.** With no service worker (see `hosting.md`), the page carries a
  build id and compares it with the live copy's when it comes back online, then offers a reload only when there's
  something new. It never offers one while offline: a reload then is a blank page. (`tests/e2e/update.spec.mjs`)
- **Location:** never ask on load. A card says why and asks on a tap, and it comes back when the browser has forgotten
  the answer (Safari on iPhone does). A "no" turns the card into steps to switch it back on.
  (`tests/e2e/location.spec.mjs`)

## Tests

- **Playwright's WebKit is close to iOS Safari, not identical.** Scroll, jump and install behaviour still get a pass on
  a real iPhone.
- **WebKit desktop flakes about once in 140 runs** under full parallel load, a different test each time. Re-run the test
  alone before chasing it.
