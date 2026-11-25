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
- **On a slow phone, Chromium's own scroll restoration for a history step comes late and wins.** Closing a sheet with
  Back (or Esc) steps back through history; the page restores the reader's place ~30 ms later, but on a CPU slowed like
  a budget phone's the browser restored ~0.8 s after that, with an offset it had saved mid-scroll: 8–211 px off. Seen as
  a CI-only flake during the first trip. Fix: a step the page restores itself is `history.scrollRestoration = 'manual'`
  (set before an overlay's `pushState`; the new step takes the mode from the one it leaves). The test runs on a CPU
  slowed 6× in Chromium. (`tests/e2e/navigation.spec.mjs`)
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
- **A number broke at its dash wherever a line ran out:** "Manageabl" over "e" and "About 60–" over "75 min" in the
  airport tiles, then "NT$110–" over "150" in lists, "08:00–" over "23:00" in hours lines and "Tel 02-" over
  "2579-5880". Fixing the tiles alone left 38–69 split ranges per page: they were measured with every section drawn
  and every list open, in both browsers, widths and languages, and the rest came from text written with bare `esc()`.
  Fix: text people read goes through `fmt()` or `escText()`, which keep a range, its short unit and a phone number on
  one line (`keepRanges()`, `engine/src/app/02-helpers.js`); a tile's cell never shrinks below its longest word. The stacked time column
  is the one deliberate split. (`tests/e2e/layout.spec.mjs`, `tests/unit/core.test.mjs`)

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
- **A field outside a form gets nothing from Enter.** A phone keyboard's Search, Go or Done key sends Enter; with no form
  and no handler, nothing happens, and the keyboard stays over what the field found (a live trip's map search). Every
  typing field now says what its key does (`enterkeyhint`), and Enter acts, then lets go of the field so the keyboard goes
  down (22-events.js; a name field's change saves it as it lets go). `tests/repo/engine-fields.test.mjs` keeps every
  field's `enterkeyhint`; `tests/e2e/keyboard.spec.mjs`, `map-search.spec` and `sync.spec` press it.
- **The page comes back lower once the keyboard goes.** iPhone Safari moves the page while its keyboard is up and puts
  it back as it closes, so a map lined up under the header while typing ended with its foot, and the results sheet's
  last row ("Search Google"), behind the bottom bar. When the map's search lets go of its field, the page waits for the
  viewport's resizes to stop, then lines the map up again (`stageAfterKeyboard`, 16-map.js). The map-search test moves
  the page down first, as the phone did.
- **An input method's Enter picks characters.** While a Chinese or Japanese input method is composing, Enter belongs
  to it. Chromium says so with `isComposing`; Safari sends that Enter just after composition ends, with `keyCode` 229.
  A handler that read `key === 'Enter'` alone saved a half-typed name or jumped a search, so every Enter goes through
  `enterKey` (02-helpers.js), and the tier-0 test refuses a bare one.
- **A swipe on a short sheet scrolled the page behind it** (2026-11-25, iPhone: Food near me on Breakfast, a place's
  Info). A modal `<dialog>` makes the page inert to taps, not to scrolling: a sheet shorter than the screen has nothing
  of its own to scroll, so the swipe went through to the page, and `overscroll-behavior: contain` doesn't help an element
  that can't scroll. A longer sheet (Lunch, Dinner) scrolled itself and hid it. Fix: while any `dialog.sheet` is open,
  `html` and `body` are `overflow: hidden` (with `scrollbar-gutter: stable`, so desktop doesn't shift); the page keeps
  its place. (`tests/e2e/navigation.spec.mjs`)
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
- **Playwright has no on-screen keyboard.** A test can show that a field lets go (it loses focus) and that a composing
  Enter is left alone, not that the phone's keyboard goes down or where the page sits once it has. Those get a look on
  a real phone.
- **WebKit desktop flakes about once in 140 runs** under full parallel load, a different test each time. A test that
  fails twice, or is always the same test, isn't that: a pass alone doesn't clear it
  (`memory-bank/standards/patterns/testing.md`, "When a test fails only sometimes").
