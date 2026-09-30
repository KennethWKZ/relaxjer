# Engine and browser lessons

What the first trip taught about the page in real browsers. Each lesson is backed by a test where one could be written.

## Scrolling and section skipping

- **`content-visibility: auto` needs scroll anchoring.** Without it (Safari at the time), the page jumped thousands of
  px while scrolling up. Turn section skipping on only when `CSS.supports('overflow-anchor', 'auto')`.
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

## Layout at 390 px

- **A `nowrap` link ran about 200 px off a 390 px screen in English** ("Shopping (10 shops…)"). Wrap with balanced lines
  instead. The same fix cured a home-screen button 1.4 px too wide. Test both languages at 390 px; English runs longer.

## Maps and sheets

- **Google `AdvancedMarker` content must be a `div`**, not a `button`, or clicks recurse.
- **The place sheet strips ids** from its copy, so use `data-` attributes inside sheets.

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
