// The landing page (site/), with its motion on, as a visitor sees it: the settling postcards and the drifting sky never
// widen the page, no lantern or flock sits behind a word, and every demo's Pause is a 44 px disc off the screen it
// controls that pauses and plays. Global setup stages site/ beside the trip page; the fixtures fail on page errors, a
// refused policy and any outside request.
import { test, expect } from '../support/fixtures.mjs';
import { SITE } from '../support/page.mjs';

const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// the landing page depends on neither the trip nor the engine, so a run on another trip or the legacy engine would
// only repeat these
test.skip(!!(process.env.TRIP_DIR || process.env.LEGACY_ENGINE_DIR), 'the landing page does not depend on the trip or the engine');

for (const colorScheme of ['light', 'dark']) {
	test.describe(`landing page, ${colorScheme}`, () => {
		test.use({ colorScheme, reducedMotion: 'no-preference' });

		test.beforeEach(async ({ page }) => {
			await page.goto('/site/index.html');
		});

		test('never wider than the screen, top to bottom', async ({ page }) => {
			const height = await page.evaluate(() => document.documentElement.scrollHeight);
			const wider = [];
			for (let y = 0; y < height; y += 600) {
				await page.evaluate((top) => scrollTo(0, top), y);
				await frame(page);
				// a postcard is widest part-way through settling, so seek each one-shot animation through its run and
				// measure at each point, rather than hoping a frame lands there (the looping demos stay inside their screens)
				const by = await page.evaluate(() => {
					const over = () => document.documentElement.scrollWidth - innerWidth;
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
				// words on the bare sky; a word on a card, a table or a stamp has its own ground
				const bareText = () => {
					const out = [];
					const walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
					for (let n = walk.nextNode(); n; n = walk.nextNode()) {
						if (!n.nodeValue.trim() || n.parentElement.closest('[aria-hidden="true"], .sr-only')) continue;
						let ground = false;
						for (let a = n.parentElement; a && a.tagName !== 'MAIN'; a = a.parentElement) {
							const s = getComputedStyle(a);
							if (s.backgroundImage !== 'none' || !/^(transparent|rgba\(.*,\s*0\))$/.test(s.backgroundColor)) {
								ground = true;
								break;
							}
						}
						if (ground) continue;
						const range = document.createRange();
						range.selectNodeContents(n);
						for (const q of range.getClientRects()) if (q.width && q.height) out.push({ q, text: n.nodeValue.trim().slice(0, 40) });
					}
					return out;
				};
				const found = [];
				for (const d of document.querySelectorAll(sky)) {
					if (+getComputedStyle(d).opacity < 0.05) continue;
					scrollTo(0, Math.max(0, d.getBoundingClientRect().top + scrollY - innerHeight / 2));
					await frame();
					const r = d.getBoundingClientRect();
					const hit = bareText().find(({ q }) => q.left < r.right - 2 && q.right > r.left + 2 && q.top < r.bottom - 2 && q.bottom > r.top + 2);
					if (hit) found.push(`${d.className} (${d.getAttribute('style')}) behind "${hit.text}"`);
				}
				return found;
			}, SITE.sky);
			expect(behind).toEqual([]);
		});

		test('every demo pauses and plays from a 44 px disc off its screen', async ({ page }) => {
			const demos = page.locator(SITE.demo);
			const count = await demos.count();
			expect(count).toBeGreaterThanOrEqual(8);
			for (let i = 0; i < count; i++) {
				const demo = demos.nth(i);
				const pause = demo.locator(SITE.pause);
				await demo.scrollIntoViewIfNeeded();
				await expect(pause).toBeVisible();
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
	});
}
