// Destination worlds (ADR-20261117-destination-themes): a pack's `theme` dresses the page (data-world on <html>, its
// paper, day colours, marks and icon); a trip whose pack sets none is the default world. trip.html is the trip under
// test as it is; trip-world.html is the same trip in Snow Light Path with a mark on every day (tests/support/world-trip.mjs).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { ROOT, resolveTrip } from '../support/stage.mjs';
import { loadTrip } from '../support/trip-contract.mjs';
import { STORE_KEY } from '../support/store-key.mjs';
import { WORLD } from '../support/world-trip.mjs';
import { MARKS } from '../../engine/src/core/motif.mjs';
import fs from 'node:fs';
/* global DAYS */

const tripDir = resolveTrip().dir;
const { paper } = await import(pathToFileURL(path.join(ROOT, 'engine', 'src', 'themes', `${WORLD.theme}.mjs`)).href);

// the theme the trip's own packs pick (the city's over the country's), as the build reads it
async function themeOf(dir) {
	const { TRIP } = loadTrip(dir);
	if (!TRIP.destination) return null;
	const files = [path.join(ROOT, 'destinations', TRIP.destination, 'pack.mjs')];
	if (TRIP.region) files.push(path.join(ROOT, 'destinations', TRIP.destination, 'regions', TRIP.region, 'pack.mjs'));
	let theme = null;
	for (const f of files) theme = (await import(pathToFileURL(f).href)).theme ?? theme;
	return theme;
}

// trip-world-off.html is the same trip with the live sky off (TRIP.sky 'off'), where the world's own backdrop and the
// scene above Now and Next show as they do in a world without a sky
async function openWorld(page, file = 'trip-world.html') {
	await page.goto(`/${file}`);
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
}

// the trip's clock on a planned stop that's under way (a clock time, not fixed, with a later stop after it), then reload
async function clockOnAStop(page) {
	const at = await page.evaluate(() => {
		for (const d of DAYS) {
			const ts = d.schedule.map((it) => (it.fixed || it.rel ? null : /^~?(\d{1,2}):(\d{2})/.exec(typeof it.t === 'string' ? it.t : '')));
			for (let i = 0; i < ts.length - 1; i++) {
				const next = ts.slice(i + 1).find(Boolean);
				if (ts[i] && next && +next[1] * 60 + +next[2] > +ts[i][1] * 60 + +ts[i][2] + 5)
					return { day: d.id, when: `${d.date} ${String(+ts[i][1]).padStart(2, '0')}:${String(+ts[i][2] + 1).padStart(2, '0')}` };
			}
		}
		return null;
	});
	test.skip(!at, 'no planned stop with a later one after it');
	await page.evaluate(({ key, when }) => localStorage.setItem(`${key}now`, JSON.stringify(when)), { key: STORE_KEY, when: at.when });
	await page.goto(`${new URL(page.url()).pathname}#${at.day}`);
	await page.reload();
	await expect(page.locator('.stop.now').first()).toBeAttached();
	return page.locator('.stop.now').first();
}

const lum = (hex) => {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test("the trip's own page: data-world only when its pack names a theme, and the default world draws its lanterns", async ({ page }) => {
	await openTrip(page);
	const theme = await themeOf(tripDir);
	expect(await page.locator('html').getAttribute('data-world')).toBe(theme);
	if (theme) return;
	const days = await page.evaluate(() => DAYS.length);
	await expect(page.locator('.week .lantern-mark')).toHaveCount(days);
	await expect(page.locator('.day-mark')).toHaveCount(0);
	await page.waitForTimeout(400);
	await expect(page.locator('.world-hello'), 'no greeting outside a world').toHaveCount(0);
	await expect(page.locator('.day-art, .world-hero'), 'no illustrations outside a world').toHaveCount(0);
	await expect(page.locator('.world-sky, .world-end'), 'no sky behind the page outside a world').toHaveCount(0);
});

test("a pack's world: its name on <html>, its paper in the browser bar, every day's mark and its own icon", async ({ page }) => {
	await openWorld(page);
	await expect(page.locator('html')).toHaveAttribute('data-world', WORLD.theme);
	// the browser bar: the world's papers as built (the page then follows the phone's own light or dark choice)
	const html = await (await page.request.get('/trip-world.html')).text();
	expect(html).toContain(`<meta name="theme-color" content="${paper.light}" media="(prefers-color-scheme: light)">`);
	expect(html).toContain(`<meta name="theme-color" content="${paper.dark}" media="(prefers-color-scheme: dark)">`);
	const days = await page.evaluate(() => DAYS.length);
	await expect(page.locator('.week .day-mark svg')).toHaveCount(days);
	await expect(page.locator('.lantern-mark')).toHaveCount(0);
	// each day's panel names its mark in the page's language
	await page.goto('/trip-world.html#d1');
	await expect(page.locator('#d1 .l-motif')).toHaveText(MARKS[await page.evaluate(() => DAYS[0].motif)].name[1]);
	// no img/icon/ in the copy: the world drew the home-screen and tab icons
	for (const sel of ['link[rel="apple-touch-icon"]', 'link[rel="icon"]'])
		await expect(page.locator(sel)).toHaveAttribute('href', /^data:image\/png;base64,/);
});

for (const file of ['trip.html', 'trip-world.html'])
	test(`${file}: every day colour carries its text in light and dark, and in a world stands out on its paper`, async ({ page }) => {
		await page.goto(`/${file}`);
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
		const world = await page.locator('html').getAttribute('data-world');
		for (const mode of ['light', 'dark']) {
			const v = await page.evaluate((m) => {
				document.documentElement.dataset.theme = m;
				const cs = getComputedStyle(document.documentElement);
				const g = (n) => cs.getPropertyValue(n).trim().toLowerCase();
				return { paper: g('--paper'), days: [1, 2, 3, 4, 5, 6, 7].map((n) => [g(`--l${n}`), g(`--l${n}-ink`)]) };
			}, mode);
			v.days.forEach(([c, ink], i) => {
				expect(contrast(c, ink), `${mode} --l${i + 1} text`).toBeGreaterThanOrEqual(4.5);
				if (world) expect(contrast(c, v.paper), `${mode} --l${i + 1} on the paper`).toBeGreaterThanOrEqual(3);
			});
		}
	});

test.describe('motion in a world', () => {
	test('the first open: a short snowfall inside the now card, gone once it has played, and never again on this phone', async ({ page }) => {
		await openWorld(page);
		await expect(page.locator('#now + .world-hello i')).toHaveCount(12);
		// laid over the now card, from its top corner, never past its foot
		const [card, fx] = await Promise.all([page.locator('#now').boundingBox(), page.locator('.world-hello').boundingBox()]);
		for (const k of ['x', 'y', 'width']) expect(Math.abs(card[k] - fx[k]), k).toBeLessThan(1.5);
		expect(fx.height).toBeGreaterThan(40);
		expect(fx.height).toBeLessThanOrEqual(card.height + 1.5);
		await expect(page.locator('.world-hello'), 'removed after it plays').toHaveCount(0, { timeout: 5000 });
		await page.reload();
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
		await page.waitForTimeout(400);
		await expect(page.locator('.world-hello')).toHaveCount(0);
	});

	test("a day's picture moves only while it's on screen, its parts inside the picture's own box", async ({ page }) => {
		await openWorld(page);
		const day = await page.evaluate(() => DAYS.find((d) => Object.hasOwn(window.WORLD_ACTORS || {}, d.motif))?.id);
		test.skip(!day, 'no day here has a picture with moving parts');
		await page.goto(`/trip-world.html#${day}`);
		const art = page.locator(`#${day} .day-art`);
		await expect(art).toHaveClass(/\bis-live\b/);
		const parts = art.locator('.art-actor');
		await expect(parts.first()).toBeAttached();
		await expect.poll(() => parts.first().evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
		// decoration inside a picture that clips it: nothing moves over the card's words
		expect(await art.evaluate((el) => [el.getAttribute('aria-hidden'), getComputedStyle(el).overflow])).toEqual(['true', 'hidden']);
		for (const p of await parts.all()) expect(await p.evaluate((el) => el.closest('.lantern > .day-art') !== null)).toBe(true);
		// off screen (after the jump's landing hold: another view on screen), it stops and costs nothing
		await page.waitForTimeout(1600);
		await page.evaluate(() => (location.hash = '#top'));
		await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
		await expect(art).not.toHaveClass(/\bis-live\b/);
		for (const p of await parts.all()) expect(await p.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
	});

	test('the sky behind the page: behind everything, never wider than the screen, and moving only with the scroll', async ({ page }) => {
		await openWorld(page, 'trip-world-off.html');
		const sky = page.locator('body > .world-sky');
		test.skip(!(await sky.count()), 'this world draws no sky');
		const box = await sky.evaluate((el) => {
			const cs = getComputedStyle(el);
			return [el.getAttribute('aria-hidden'), cs.position, cs.zIndex, cs.pointerEvents];
		});
		expect(box).toEqual(['true', 'fixed', '-1', 'none']);
		await expect(page.locator('#foot + .world-end')).toHaveAttribute('aria-hidden', 'true');
		const layers = page.locator('.world-sky > i, .world-end > i');
		expect(await layers.count()).toBeGreaterThan(3);
		// nothing in it runs on the clock (WCAG 2.2.2): every animation it has follows the scroll, or there are none
		const clocks = await layers.evaluateAll((els) =>
			els.flatMap((el) =>
				el
					.getAnimations()
					.filter((a) => typeof ScrollTimeline === 'undefined' || !(a.timeline instanceof ScrollTimeline || a.timeline instanceof ViewTimeline))
					.map((a) => `${el.className || 'end'}: ${a.animationName}`),
			),
		);
		expect(clocks, 'sky animations on a clock').toEqual([]);
		const state = () => layers.evaluateAll((els) => els.map((el) => `${getComputedStyle(el).opacity} ${getComputedStyle(el).transform}`));
		const top = await state();
		await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight * 0.55, behavior: 'instant' }));
		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
		if (await page.evaluate(() => CSS.supports('animation-timeline: scroll()')))
			await expect.poll(state, { message: 'scrolled down the trip, the sky has moved on' }).not.toEqual(top);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways scroll').toBeLessThanOrEqual(0);
	});

	test('the stop under way: only its candle flickers', async ({ page }) => {
		await openWorld(page);
		const now = await clockOnAStop(page);
		const anim = (loc) => loc.evaluate((el) => getComputedStyle(el.querySelector('.stop-knot'), '::after').animationName);
		expect(await anim(now)).toContain('snowlight-flame');
		const other = page.locator('.stop:not(.now):not(.fixed)').first();
		expect(await anim(other)).toBe('none');
	});
});

test.describe('reduced motion in a world', () => {
	test.use({ reducedMotion: 'reduce' });

	test('no snowfall on the first open, and no flicker: the stop under way keeps its light and its Now flag', async ({ page }) => {
		await openWorld(page);
		await page.waitForTimeout(400);
		await expect(page.locator('.world-hello')).toHaveCount(0);
		const now = await clockOnAStop(page);
		expect(await now.evaluate((el) => getComputedStyle(el.querySelector('.stop-knot'), '::after').animationName)).toBe('none');
		await expect(now.locator('.flag')).toBeVisible();
	});

	test('the pictures hold still: every part at rest where it is drawn, and no snow falls', async ({ page }) => {
		await openWorld(page);
		const pics = page.locator('.day-art, .world-hero');
		test.skip(!(await pics.count()), 'this world has no pictures');
		for (const pic of await pics.all()) {
			expect(await pic.evaluate((el) => [getComputedStyle(el, '::before').animationName, getComputedStyle(el, '::after').animationName])).toEqual([
				'none',
				'none',
			]);
			for (const p of await pic.locator('.art-actor').all())
				expect(await p.evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el).opacity])).toEqual(['none', '1']);
		}
		// the sky behind the page is a calm, still night: nothing in it follows even the scroll
		for (const layer of await page.locator('.world-sky > i, .world-end > i').all())
			expect(await layer.evaluate((el) => [getComputedStyle(el).animationName, el.getAnimations().length])).toEqual(['none', 0]);
	});
});

test("a world's illustrations: each day's activity across the top of its card, and the scene above Now/Next", async ({ page }) => {
	const art = path.join(ROOT, 'engine', 'src', 'themes', `${WORLD.theme}-art`);
	test.skip(!fs.existsSync(art), 'this world has no illustrations');
	const drawn = new Set(fs.readdirSync(art).map((f) => f.replace(/\.svg$/, '')));
	await openWorld(page, 'trip-world-off.html');
	const days = await page.evaluate(() => DAYS.map((d) => [d.id, d.motif]));
	for (const [id, motif] of days) {
		const pic = page.locator(`#${id} .lantern > .day-art > img:not(.art-actor)`);
		if (drawn.has(motif)) {
			await expect(pic, `${id} (${motif})`).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
			await expect(page.locator(`#${id} .day-art`)).toHaveAttribute('aria-hidden', 'true');
		} else await expect(pic, `${id} (${motif}): no picture`).toHaveCount(0);
	}
	if (drawn.has('hero')) {
		await expect(page.locator('#top > .world-hero + .now-card')).toHaveCount(1);
		const box = await page.locator('.world-hero').boundingBox();
		// the whole scene from 600 px; on a phone a strip of it, and a ribbon on a trip day, so Now and Next keep the first screen
		const tripDay = (await page.locator('#now .now-day').count()) > 0;
		const tall = box.width >= 560 ? 300 : tripDay ? 88 : 150;
		expect(box.width / box.height).toBeCloseTo(640 / tall, 1);
		await expect(page.locator('.world-hero .art-actor'), 'the scene crops on a phone, so nothing in it moves on its own').toHaveCount(0);
	}
});
