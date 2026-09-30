---
created: 2026-10-01
updated: 2026-10-01
---

# Affordances and Signifiers

How every control on a RelaxJer page shows what it does, before and after it's touched. The group uses the page
one-handed, outdoors in glare and in dark rooms, and some of them are seniors. A control they can't recognise doesn't
exist for them. This file extends [`frontend.md`](./frontend.md). The rules are testable, and each names its source
(the list at the end; researched 2026-10-01).

## The words

| Term                | Meaning here                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| affordance          | what a control lets you do, whether or not anyone can tell. On a screen we only control the **perceived** affordance: what people believe [1]                  |
| signifier           | the visible cue that says what can be done and where: a fill, a border, an underline, a chevron, a label [1]                                                   |
| false affordance    | something that looks operable but isn't, such as a static chip styled like a button. The inverse, an operable control with no signifier, is just as bad [2][3] |
| feedback            | proof the action registered: the press state, the landing glow, a toast [1][7]                                                                                 |
| feedforward         | what tells you the result before you act: a label, a count, a chevron's direction                                                                              |
| mapping, constraint | the layout that ties a control to what it changes, and the limits that rule out a wrong action [1]                                                             |

## Rules

### Targets and spacing

1. **Every tappable thing is at least 44 × 44 px, and nothing is below 24 × 24**, except links inside sentences
   [14][15][16].
   _Check:_ at 390 and 360 px, measure `getBoundingClientRect()` on `a, button, summary, input, [role=tab]`, and fail
   anything under 44.
2. **Actions used while walking are 52 px or more, and 56 px where they fit:** Back, Sections, a card's main action,
   the driver card. 44 px is about 8 mm on a phone. NN/g asks for 1 cm and more when moving [5], and older adults tapped
   most accurately at 14 mm or more [18]. Save the biggest sizes for one or two actions per screen.
3. **At least 8 px between neighbouring targets** [5][15].
   _Check:_ the smallest gap between sibling target boxes.
4. **The whole row is the target** for a `summary`, a list row or a card that acts [17].
   _Check:_ tapping each inner corner of the row does the same thing.

### Buttons and links

5. **Links inside text stay underlined.** Link blue against body text is under the 3:1 that a colour-only link needs
   (2.9:1 light, 1.8:1 dark), so the underline is required, not decoration [13][14][17].
6. **No ghost buttons for actions.** An acting control has a fill, or a border of at least 3:1, plus a verb or an icon.
   Weak signifiers cost 22% more time and 25% more fixations in NN/g's eye-tracking [2][3][4].
7. **One primary action per card.** The others are quieter [17].
8. **Only tappable things look tappable.** A static chip or tag never shares a look with a tappable one [1][4].
   _Check:_ every element styled like a button has a handler, and every handler's element looks like one.

### Icon-only controls

9. **Icon-only only for the conventional glyphs:** search, close, back, previous and next, map pin, directions. Any
   other icon keeps a visible label at every width, unless 4 of 5 seniors can name the action from the icon alone
   [8][15][16].
10. **Every icon-only control has an accessible name**, and the same target size as its labelled form. `title` does
    nothing on touch [15].

### Disclosure and "more"

11. **Every `<summary>` shows a chevron that turns when it opens, plus a label saying what's inside**, with a count for
    lists [9][15][17].
    _Check:_ a `summary` without a chevron fails.
12. **A down chevron opens in place; a right chevron goes somewhere else.** Never mix the two [9].
13. **Don't hide what most readers need.** Facts used every day render open; a closed `details` needs a reason [17].

### Scrollers and tabs

14. **A sideways scroller shows that there's more**, on each side where there is: the next item clipped by at least a
    quarter, or an edge fade. A hidden scrollbar needs a substitute [10][11][19].
    _Check:_ at 390 and 360 px, and at the start, middle and end of the scroll, every side with more has a cue.
15. **Nothing is reachable only by scrolling sideways or dragging.** The Sections sheet repeats the day strip. Keep
    `overscroll-behavior-x: contain`, because an edge swipe means Back [11][14].
16. **A selected state uses two cues** (fill plus weight, an underline or an icon), and selected against unselected is
    at least 3:1 or carries a non-colour cue [14][15].

### Feedback and states

17. **Press feedback starts on touch-down, within 100–150 ms,** and the result shows somewhere the thumb isn't covering
    (a toast, the next view) [7][15].
18. **Five states look different:** enabled, pressed, focused, disabled and loading. Disabled is dimmed but readable.
    Loading is disabled plus `aria-busy` plus visible text [7][14].
19. **Focus is a 3 px ring at 3:1 or more against whatever it sits on** (paper, a lantern, ink, glass, the night theme),
    and never hidden under the sticky bar [14].
20. **Landing cues reach 3:1 and last at least 1.5 s**, with a static version under reduced motion, so a jump always
    shows where it arrived [1].

### Gestures

21. **No gesture-only actions.** Every swipe, drag, long-press or double-tap has a visible tap equivalent, and nothing
    answers to both a tap and a drag [11][14][15][18].

### Glass and contrast

22. **Glass only on bars that float above content.** Content and the controls inside it stay opaque [6][15].
    _Check:_ `backdrop-filter` appears only on `.bar` and `.day-bar`.
23. **Text on glass is 4.5:1 or more and icons 3:1 or more, against the worst backdrop in both themes.**
    `prefers-reduced-transparency` and `prefers-contrast: more` both switch the glass to solid paper with a border
    [6][15].
24. **Labels are 4.5:1 or more (7:1 for a primary action). Icons, borders and state marks are 3:1 or more**, in both
    themes and on all seven lanterns. A tint of 14% or less is decoration, never the only signifier [14][15].

### Seniors and sunlight

25. **The squint test, before a UI change ships:** desaturate, halve the brightness and blur 1.5 px. Each screen's main
    control should still be found within 10 s. A pale container fill doesn't signal "tap me" (`paper-2` on `paper` is
    about 1.1:1) [4][15][16].

## Where the page falls short today

From the 2026-10-01 audit of `DESIGN.md` and `engine/src/style.css`. The contrast figures are token arithmetic, not
measured pixels: confirm each in a browser before fixing it. Each fix is an engine change, so it follows
[`engine.md`](./engine.md): `pnpm test:all`, parity, and a pass at 390 px and desktop in Chromium and WebKit. The story
index tracks them as step 6c.

| Keep, strengthen or fix | What                                                                                                                                                                                                                                                             | Rule   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Fix                     | Targets under 44 px: the language switch `.seg button` (38), `.ghours summary` (36), `.plan-alt > summary` and `.flt-d > summary` (40), `.mres-seg .seg-btn` (34), `.add-sort .seg-btn` (36), `.stop-knot .knot-add` (32); 6 px gaps in `.links-row` and `.tabs` | 1, 3   |
| Fix                     | No `:disabled` or `[aria-busy]` styles, while the location buttons set `disabled`; `button { color: inherit }` likely hides the browser's disabled grey                                                                                                          | 18     |
| Fix                     | The focus ring nearly vanishes on lantern paper (about 1.2:1 on red). Inside `.lantern`, draw it in the day's ink (`var(--ci)`)                                                                                                                                  | 19     |
| Fix                     | The lantern buttons `.l-btn` are ghost buttons (a 40% ink border, about 2:1): give them a tint fill and a stronger border                                                                                                                                        | 6      |
| Fix                     | The day strip `.tabs` hides its scrollbar and has no edge cue; on Persimmon, Peach and Gold days the selected tab differs from the others by hue alone                                                                                                           | 14, 16 |
| Fix                     | `.plan-alt` and `.flt-d` summaries have no chevron, so they read as text, not controls                                                                                                                                                                           | 11     |
| Fix                     | The tappable `.tag.pinbtn` looks like a static `.tag`                                                                                                                                                                                                            | 8      |
| Fix                     | The segmented language switch shows its selected option as white on grey (about 1.2:1); the filter buttons invert to ink. Make them match, at 44 px                                                                                                              | 16     |
| Strengthen              | The landing glow is weak on light lanterns (Gold about 1.5:1) and disappears under reduced motion. Use a static 3:1 outline held for 1.5–3 s instead                                                                                                             | 20     |
| Strengthen              | Press feedback: make the press-in instant (160 ms today), and keep the scale, since the grey fill step washes out in sun                                                                                                                                         | 17, 25 |
| Strengthen              | `prefers-contrast: more` keeps the glass translucent and the link buttons borderless: make both solid, with a 1 px border                                                                                                                                        | 23     |
| Strengthen              | Icon-only on phones: label the Website link (a generic glyph), the theme toggle and Install; keep the Sections button's label, since it's the day strip's fallback                                                                                               | 9      |
| Keep                    | The 44 px floor for the main controls, and the 52 px Back and Sections buttons                                                                                                                                                                                   | 1, 2   |
| Keep                    | Link buttons: fill, icon and verb together (blue on grey is 5.7:1)                                                                                                                                                                                               | 6      |
| Keep                    | `details.more` summaries: a 48 px full-row target with a label, a count and a turning chevron                                                                                                                                                                    | 4, 11  |
| Keep                    | Underlined links; hover only on fine pointers; glass only on the sticky bars; reduced transparency already solid                                                                                                                                                 | 5, 22  |

## How to check a change

`verify-page` step 3 and the `ux-verifier` agent run rules 1, 3, 11, 14, 16, 19 and 24 as measurements, and rule 25 by
eye. Record a failing rule as a finding with its number.

## Sources

Checked on 2026-10-01; dates are each page's own.

1. D. Norman: [Signifiers, not affordances](https://jnd.org/signifiers-not-affordances/) (ACM _Interactions_, 2008);
   [Affordances and Design](https://jnd.org/affordances-and-design/) (2008);
   [preface to _The Design of Everyday Things_, revised edition](https://jnd.org/preface-design-of-everyday-things-revised-edition/) (2013).
2. K. Moran, NN/g: [Flat UI Elements Attract Less Attention and Cause Uncertainty](https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/) (2017).
3. K. Moran, NN/g: [Long-Term Exposure to Flat Design](https://www.nngroup.com/articles/flat-design-long-exposure/) (2015).
4. H. Loranger, NN/g: [Beyond Blue Links: Making Clickable Elements Recognizable](https://www.nngroup.com/articles/clickable-elements/) (2015).
5. A. Harley, NN/g: [Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/) (2019).
6. R. Budiu, NN/g: [Liquid Glass Is Cracked, and Usability Suffers in iOS 26](https://www.nngroup.com/articles/liquid-glass/) (2025).
7. NN/g: [Button States: Communicate Interaction](https://www.nngroup.com/articles/button-states-communicate-interaction/) (2025).
8. A. Harley, NN/g: [Icon Usability](https://www.nngroup.com/articles/icon-usability/) (2014).
9. NN/g: [Accordion Icons: Which Signifiers Work Best?](https://www.nngroup.com/articles/accordion-icons/) (2020).
10. NN/g: [Tabs, Used Right](https://www.nngroup.com/articles/tabs-used-right/) (2024).
11. NN/g: [The Illusion of Completeness](https://www.nngroup.com/articles/illusion-of-completeness/) (2016);
    [Using Swipe to Trigger Contextual Actions](https://www.nngroup.com/articles/contextual-swipe/) (2017);
    [Carousels on Mobile Devices](https://www.nngroup.com/articles/mobile-carousels/) (2018).
12. K. Kane, NN/g: [Usability for Older Adults: Challenges and Changes](https://www.nngroup.com/articles/usability-for-senior-citizens/) (2019).
13. NN/g: [Guidelines for Visualizing Links](https://www.nngroup.com/articles/guidelines-for-visualizing-links/) (2004, editor's note 2026).
14. W3C, WCAG 2.2 Understanding:
    [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
    [2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html),
    [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html),
    [2.4.11 Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html),
    [2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html),
    [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html),
    [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
15. Apple Human Interface Guidelines: [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons),
    [Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
    [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility),
    [Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures),
    [Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls),
    [Color](https://developer.apple.com/design/human-interface-guidelines/color) (2024–2025).
16. Google: [Android accessibility, touch targets](https://developer.android.com/guide/topics/ui/accessibility/apps);
    [Usability Hasn't Peaked](https://research.google/pubs/usability-hasnt-peaked-exploring-how-expressive-design-overcomes-the-usability-plateau/) (CHI 2026).
17. GOV.UK Design System: [Details](https://design-system.service.gov.uk/components/details/),
    [Button](https://design-system.service.gov.uk/components/button/),
    [Links](https://design-system.service.gov.uk/styles/links/); USWDS: [Accordion](https://designsystem.digital.gov/components/accordion/).
18. L. Leitão and P. Silva: [Target and Spacing Sizes for Smartphone User Interfaces for Older Adults](https://mural.maynoothuniversity.ie/id/eprint/6045/)
    (PLoP 2012, 40 participants; older phones, so read it as direction, not a spec).
19. P. Hamer: [Modern Scroll Shadows Using Scroll-Driven Animations](https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/) (CSS-Tricks, 2025).

Where they disagree: WCAG and Apple settle on 44 px, NN/g on about 1 cm, and the older-adult study on 14 mm. This file
takes 44 px as the floor and larger sizes for the few walking-time actions.
