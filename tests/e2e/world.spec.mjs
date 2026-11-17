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

async function openWorld(page) {
	await page.goto('/trip-world.html');
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
});
