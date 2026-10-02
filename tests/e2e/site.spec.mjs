// The landing page (site/), with its motion on, as a visitor sees it: the settling postcards and the drifting sky never
// widen the page, no lantern or flock sits behind a word, and every demo's Pause is a 44 px disc off the screen it
// controls that pauses and plays, and the theme button switches day and night. Global setup stages site/ beside the trip page; the fixtures fail on page errors, a
// refused policy and any outside request.
import { test, expect } from '../support/fixtures.mjs';
import { SITE } from '../support/page.mjs';

// every scroll in this file is instant: the page scrolls smoothly, and a smooth scroll would be measured part-way
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// the landing page depends on neither the trip nor the engine, so a run on another trip or the legacy engine would
// only repeat these
test.skip(!!(process.env.TRIP_DIR || process.env.LEGACY_ENGINE_DIR), 'the landing page does not depend on the trip or the engine');
// these walk the whole page with its motion on; on CI WebKit paints the sky's blur and glow in software, 5 to 15 times
// slower than a laptop, so there they get 120 s (a file-level test.slow(callback) doesn't reach the tests' timeout)
test.beforeEach(({ browserName }) => {
	if (browserName === 'webkit') test.setTimeout(120_000);
});

for (const colorScheme of ['light', 'dark']) {
	test.describe(`landing page, ${colorScheme}`, () => {
		test.use({ colorScheme, reducedMotion: 'no-preference' });

		test.beforeEach(async ({ page }) => {
			await page.goto('/site/index.html');
			// the page scrolls smoothly, which these checks don't measure; and in WebKit Playwright's own scroll-into-view
			// before a click then glides in over the next frames, so a press could start on a button and end on the card
			// behind it. Every scroll here is instant, Playwright's too.
			await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
		});

		test('never wider than the screen, top to bottom', async ({ page }) => {
			const height = await page.evaluate(() => document.documentElement.scrollHeight);
			const wider = [];
			for (let y = 0; y < height; y += 600) {
				await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
				await frame(page);
				// a postcard is widest part-way through settling, so seek each one-shot animation through its run and
				// measure at each point, rather than hoping a frame lands there (the looping demos stay inside their screens).
				// What moves with the scroll (clouds, lanterns, the sun) can't be seeked: the 600 px steps are its coverage.
				// clientWidth, not innerWidth, so a browser that draws a scrollbar can't hide up to 15 px of overflow
				const by = await page.evaluate(() => {
					const over = () => document.documentElement.scrollWidth - document.documentElement.clientWidth;
					let worst = over();
					for (const a of document.getAnimations()) {
						if (a.timeline !== document.timeline || a.playState !== 'running') continue;
						const end = a.effect.getComputedTiming().endTime;
						if (!Number.isFinite(end)) continue;
						const at = a.currentTime;
						for (const f of [0, 0.2, 0.4, 0.6, 0.8]) {
							a.currentTime = end * f;
							worst = Math.max(worst, over());
						}
						a.currentTime = at;
					}
					return worst;
				});
				if (by > 0) wider.push(`${by}px at ${y}`);
			}
			expect(wider).toEqual([]);
		});

		test('no lantern or flock sits behind a word', async ({ page }) => {
			const behind = await page.evaluate(async (sky) => {
				const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
				// a colour's alpha, whatever form it computes to: rgba(…, a), color(srgb … / a), oklch(… / a)
				const alpha = (c) => {
					if (c === 'transparent') return 0;
					const m = c.match(/\/\s*([\d.]+)(%?)\s*\)$/) || (c.startsWith('rgba(') && c.match(/,\s*([\d.]+)(%?)\s*\)$/));
					return m ? parseFloat(m[1]) / (m[2] ? 100 : 1) : 1;
				};
				// words on the bare sky; a word on a card, a table or a stamp has its own ground. Which words those are doesn't
				// change with the scroll, so they're found once; only where they sit is read at each scroll position
				const bare = [];
				const walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
				for (let n = walk.nextNode(); n; n = walk.nextNode()) {
					if (!n.nodeValue.trim() || n.parentElement.closest('[aria-hidden="true"], .sr-only')) continue;
					let ground = false;
					for (let a = n.parentElement; a && a.tagName !== 'MAIN'; a = a.parentElement) {
						const s = getComputedStyle(a);
						if (s.backgroundImage !== 'none' || alpha(s.backgroundColor) > 0) {
							ground = true;
							break;
						}
					}
					if (!ground) bare.push(n);
				}
				const bareText = () => {
					const out = [];
					for (const n of bare) {
						const range = document.createRange();
						range.selectNodeContents(n);
						for (const q of range.getClientRects()) if (q.width && q.height) out.push({ q, text: n.nodeValue.trim().slice(0, 40) });
					}
					return out;
				};
				const found = [];
				// the art floats with the scroll, so look with it near the top, the middle and the foot of the screen
				// (only the art's own opacity is read: .scene itself never fades)
				for (const d of document.querySelectorAll(sky)) {
					if (+getComputedStyle(d).opacity < 0.05) continue;
					for (const at of [0.15, 0.5, 0.85]) {
						scrollTo({ top: Math.max(0, d.getBoundingClientRect().top + scrollY - innerHeight * at), behavior: 'instant' });
						await frame();
						const r = d.getBoundingClientRect();
						const hit = bareText().find(({ q }) => q.left < r.right - 2 && q.right > r.left + 2 && q.top < r.bottom - 2 && q.bottom > r.top + 2);
						if (hit) {
							found.push(`${d.className} (${d.getAttribute('style')}) behind "${hit.text}"`);
							break;
						}
					}
				}
				return found;
			}, SITE.sky);
			expect(behind).toEqual([]);
		});

		test('the sun keeps to the screen and sets as the page scrolls, and holds still without motion', async ({ page }) => {
			const sunAt = (f) =>
				page.evaluate(
					async ({ f, sun }) => {
						scrollTo({ top: Math.round((document.documentElement.scrollHeight - innerHeight) * f), behavior: 'instant' });
						await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
						const el = document.querySelector(sun);
						const r = el.getBoundingClientRect();
						return { y: r.top + r.height / 2, dusk: +getComputedStyle(el, '::after').opacity };
					},
					{ f, sun: SITE.sun },
				);
			if (await page.evaluate(() => CSS.supports('animation-timeline: scroll()'))) {
				const morning = await sunAt(0);
				const afternoon = await sunAt(0.55);
				const evening = await sunAt(0.88);
				expect(afternoon.y, 'the sun sinks down the screen').toBeGreaterThan(morning.y + 50);
				expect(evening.y).toBeGreaterThan(afternoon.y);
				expect(morning.dusk, 'no dusk colour in the morning').toBeLessThan(0.05);
				expect(evening.dusk, 'the dusk colour by evening').toBeGreaterThan(0.9);
			}
			// reduced motion: the sun stays at the top of the page and scrolls away with it
			await page.emulateMedia({ reducedMotion: 'reduce' });
			expect((await sunAt(0.55)).y).toBeLessThan(0);
		});

		test('every demo pauses and plays from a 44 px disc off its screen', async ({ page }) => {
			const demos = page.locator(SITE.demo);
			const count = await demos.count();
			expect(count).toBeGreaterThanOrEqual(8);
			// a card settles once, on arrival; that isn't what this measures, so they all arrive together, and settle once
			await page.evaluate(() => document.querySelectorAll('.settle').forEach((c) => c.classList.add('in')));
			for (let i = 0; i < count; i++) {
				const demo = demos.nth(i);
				const pause = demo.locator(SITE.pause);
				await demo.evaluate((d) => d.scrollIntoView({ block: 'center', behavior: 'instant' }));
				await frame(page);
				await expect(pause).toBeVisible();
				// measure the card at rest: before it settles (and while it does) it sits tilted and offset
				await expect
					.poll(
						() =>
							demo.evaluate((d) => {
								const card = d.closest('.settle');
								if (!card) return true;
								const moving = card
									.getAnimations({ subtree: true })
									.some((a) => a.playState === 'running' && Number.isFinite(a.effect.getComputedTiming().endTime));
								return card.classList.contains('in') && !moving;
							}),
						{ message: `demo ${i}'s card settles` },
					)
					.toBe(true);
				const where = await demo.evaluate((d, { pause, screen }) => {
					const q = d.querySelector(pause).getBoundingClientRect();
					const over = [...d.querySelectorAll(screen)].some((s) => {
						const r = s.getBoundingClientRect();
						return q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top;
					});
					return { w: q.width, h: q.height, over };
				}, SITE);
				expect(where.w, `demo ${i} Pause width`).toBeGreaterThanOrEqual(44);
				expect(where.h, `demo ${i} Pause height`).toBeGreaterThanOrEqual(44);
				expect(where.over, `demo ${i} Pause sits on its screen`).toBe(false);
				const name = (await pause.textContent()).replace(/\s+/g, ' ').trim();
				expect(name, `demo ${i}`).toMatch(/^Pause the .+ demo$/);
				await pause.click();
				await expect(pause, `demo ${i} after Pause`).toHaveText(/^\s*Play the .+ demo\s*$/);
				await pause.click();
				await expect(pause, `demo ${i} after Play`).toHaveText(/^\s*Pause the .+ demo\s*$/);
			}
		});

		test('the theme button switches day and night, remembers it, and going back follows the system again', async ({ page }) => {
			const other = colorScheme === 'dark' ? 'light' : 'dark';
			const button = page.locator(SITE.theme);
			const look = () =>
				page.evaluate(
					({ shot }) => ({
						theme: document.documentElement.dataset.theme || 'system',
						shot: document.querySelector(shot).currentSrc,
						sky: getComputedStyle(document.documentElement).getPropertyValue('--sky-1').trim(),
					}),
					SITE,
				);
			const start = await look();
			await expect(button).toBeVisible();
			await expect(button).toHaveAccessibleName(colorScheme === 'dark' ? 'Switch to day' : 'Switch to night');
			const box = await button.boundingBox();
			expect(Math.min(box.width, box.height), 'a 44 px tap').toBeGreaterThanOrEqual(44);

			await button.click();
			await expect(page.locator('html')).toHaveAttribute('data-theme', other);
			const switched = await look();
			expect(switched.sky, 'the sky changes with it').not.toBe(start.sky);
			await expect.poll(async () => (await look()).shot, { message: "the hero phone shows the other theme's screen" }).toMatch(`-${other}.`);

			await page.reload();
			await expect(page.locator('html'), 'the choice is remembered').toHaveAttribute('data-theme', other);

			await button.click();
			await expect(page.locator('html'), 'back to the system: no choice held').not.toHaveAttribute('data-theme', /./);
			expect((await look()).sky).toBe(start.sky);
			await page.reload();
			await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
		});
	});
}
