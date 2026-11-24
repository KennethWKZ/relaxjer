// The live sky (ADR-20261122-day-views): in a world with a sky, TRIP.sky picks it ('live', 'globe', 'pile', 'off'; the
// world's own by default). It snows by itself, with a Pause this phone remembers: in the header on a desktop, in the
// bottom bar's More below 1024 px (ADR-20261124-bottom-app-bar); under reduced motion it's still and the Pause is gone;
// the globe shakes and settles; the piling snow builds up; with no sky the world keeps its scroll's night. The planner's
// preview panel is only in a page built with --preview.
// Pages: tests/support/global-setup.mjs builds the trip under test in Snow Light Path once per sky.
import { test, expect } from '../support/fixtures.mjs';
import { STORE_KEY } from '../support/store-key.mjs';
import { BAR, goToView, hasBar, skyPause, VIEWS } from '../support/page.mjs';

/* global DAYS -- the trip data, read inside the page */

const PAGE = { live: '/trip-world.html', globe: '/trip-world-globe.html', pile: '/trip-world-pile.html', off: '/trip-world-off.html' };
const open = async (page, url) => {
	await page.goto(url);
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
};
const snowing = (page) => page.locator('html').getAttribute('data-snowing');
const sky = (page) => page.evaluate(() => window.RJ_SKY.state());

for (const mode of ['live', 'globe', 'pile']) {
	test.describe(`the ${mode} sky`, () => {
		test('snows by itself, and its Pause stops it and is remembered after a reload', async ({ page }) => {
			await open(page, PAGE[mode]);
			await expect(page.locator('html')).toHaveAttribute('data-sky-now', mode);
			await expect(page.locator('html')).toHaveAttribute('data-snowing', '1');
			// the band of sky at the top of the view, snow drawn behind the words (its canvas under the band's text)
			const band = page.locator(`#top ${VIEWS.band}`);
			await expect(band).toBeVisible();
			const order = await band.evaluate((b) => {
				const cv = b.querySelector('canvas');
				const col = b.querySelector('.band-col');
				const z = (e) => Number(getComputedStyle(e).zIndex) || 0;
				return { canvas: !!cv || innerWidth >= 1024, under: !cv || z(cv) < z(col) };
			});
			expect(order).toEqual({ canvas: true, under: true });
			const btn = await skyPause(page);
			await expect(btn).toBeVisible();
			expect((await btn.boundingBox()).width).toBeGreaterThanOrEqual(44);
			expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(44);
			await expect(btn).toHaveAttribute('aria-pressed', 'false');
			await btn.click();
			await expect(btn).toHaveAttribute('aria-pressed', 'true');
			await expect.poll(() => snowing(page)).toBeNull();
			expect(await page.evaluate((k) => localStorage.getItem(`${k}skyPaused`), STORE_KEY)).toBe('true');
			await page.reload();
			await expect(page.locator('#app [data-sec]').first()).toBeAttached();
			const again = await skyPause(page);
			await expect(again).toHaveAttribute('aria-pressed', 'true');
			expect(await snowing(page)).toBeNull();
			await again.click();
			await expect(page.locator('html')).toHaveAttribute('data-snowing', '1');
		});

		test('under reduced motion it holds still, and the Pause is gone', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await open(page, PAGE[mode]);
			await expect(page.locator(`#top ${VIEWS.band}`)).toBeVisible();
			await page.waitForTimeout(400);
			expect(await snowing(page)).toBeNull();
			await expect(page.locator(VIEWS.skyBtn)).toBeHidden();
			if (await hasBar(page)) {
				await page.locator(BAR.more).click();
				await expect(page.locator('#toc')).toBeVisible();
				await expect(page.locator(BAR.skyRow), 'nothing moves, so More offers no Pause').toBeHidden();
				await page.keyboard.press('Escape');
			}
			for (const b of await page.locator(VIEWS.shake).all()) await expect(b).toBeHidden(); // every view's band has one
			expect((await sky(page)).running).toBe(false);
		});
	});
}

test("the sky's colour follows the view's weather and day, and stops while the page is hidden", async ({ page }) => {
	await open(page, PAGE.live);
	const day = await page.evaluate(() => DAYS[1].id);
	await goToView(page, day);
	await expect(page.locator('html')).toHaveAttribute('data-wx', /^(heavy|light|shower|clear|night)$/);
	const tint = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sky-tint').trim());
	await goToView(page, 'top');
	await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sky-tint').trim())).not.toBe(tint);
	// hidden: nothing runs
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect.poll(() => snowing(page)).toBeNull();
	await page.evaluate(() => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
		document.dispatchEvent(new Event('visibilitychange'));
	});
	await expect(page.locator('html')).toHaveAttribute('data-snowing', '1');
});

// a desktop's pause sits in the header's top row; below 1024 px it's in More and the header keeps only search, the
// currency and the language beside the name. The trip's name is whole when it fits, else the trip's short name
// (TRIP.brandShort), never a name cut off with …
test("the pause is in the header on a desktop and in More below 1024 px, and the trip's name is never cut", async ({ page }) => {
	await open(page, PAGE.live);
	if (await hasBar(page)) await expect(page.locator(VIEWS.skyBtn), 'not in the header').toBeHidden();
	else await expect(page.locator(`#bar-main ${VIEWS.skyBtn}`)).toBeVisible();
	const name = await page.locator('.brand-name').evaluate((e) => ({
		cut: e.scrollWidth > e.clientWidth + 1,
		shown: [...e.children].filter((c) => !c.hidden).map((c) => c.className),
		short: e.querySelector('.bn-short').textContent !== e.querySelector('.bn-full').textContent,
	}));
	expect(name.shown).toHaveLength(1);
	if (page.viewportSize().width >= 1024) expect(name.shown, 'a desktop has room for the whole brand').toEqual(['bn-full']);
	// a trip without a short name keeps the old way, its brand cut with …
	if (name.short) expect(name.cut, 'the name shown is whole').toBe(false);
});

test('the snow globe: Shake whirls the snow up, and it settles in about five seconds', async ({ page }) => {
	await open(page, PAGE.globe);
	const shake = page.locator(`#top ${VIEWS.shake}`);
	await expect(shake).toBeVisible();
	expect((await shake.boundingBox()).height).toBeGreaterThanOrEqual(44);
	await shake.click();
	await expect.poll(async () => (await sky(page)).energy).toBeGreaterThan(0.5);
	await expect.poll(async () => (await sky(page)).energy, { timeout: 9000, message: 'settled' }).toBeLessThan(0.05);
});

// a phone's and a tablet's pile on the band's drift at the top of the view; a desktop's on the snowy ground under the page
test('the piling snow builds up where the snow lands', async ({ page }) => {
	await open(page, PAGE.pile);
	// it piles at the pace of the falling snow, which slows on a busy machine (the sky drops to every other frame)
	await expect.poll(() => page.evaluate(() => window.RJ_SKY.piled()), { timeout: 30000, message: 'snow piling up' }).toBeGreaterThan(1.5);
});

test('with no sky the world keeps its own night behind the page, and nothing falls', async ({ page }) => {
	await open(page, PAGE.off);
	await expect(page.locator('html')).toHaveAttribute('data-sky-on', '0');
	await expect(page.locator(VIEWS.band)).toHaveCount(0);
	await expect(page.locator(VIEWS.skyBtn)).toBeHidden();
	await expect(page.locator('body > .world-sky')).toBeAttached();
	expect(await page.locator('body > .world-sky').evaluate((e) => getComputedStyle(e).display)).not.toBe('none');
	expect(await snowing(page)).toBeNull();
});

test('the default world draws no sky at all', async ({ page }) => {
	await page.goto('/trip.html');
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	test.skip(!!(await page.locator('html').getAttribute('data-world')), "this trip's pack names a world");
	await expect(page.locator(VIEWS.band)).toHaveCount(0);
	await expect(page.locator(VIEWS.skyBtn)).toBeHidden();
	await expect(page.locator('canvas.bar-cv, canvas.band-cv')).toHaveCount(0);
});

test('the preview panel is only in a page built with --preview, and its choices are for looking only', async ({ page }) => {
	for (const url of ['/trip.html', PAGE.live]) {
		await open(page, url);
		await expect(page.locator('#pvChip, #pvPanel'), `${url} carries no preview panel`).toHaveCount(0);
	}
	await open(page, '/trip-world-preview.html');
	// what the panel could have touched on the phone: the sky's pause, the theme, the clock
	const saved = () => page.evaluate((k) => ['skyPaused', 'theme', 'now', 'lang'].map((n) => localStorage.getItem(k + n)), STORE_KEY);
	const before = await saved();
	const chip = page.locator('#pvChip');
	await expect(chip).toBeVisible();
	await chip.click();
	const panel = page.locator('#pvPanel');
	await expect(panel).toBeVisible();
	await expect(panel).toContainText(/只为比较方案|For comparing looks/);
	// another sky, a weather, the snow, the theme, the clock: each takes effect
	await panel.locator('input[name="pv-sky"][value="globe"]').check({ force: true });
	await expect(page.locator('html')).toHaveAttribute('data-sky-now', 'globe');
	await expect(page.locator(`#top ${VIEWS.shake}`)).toBeVisible();
	await page.locator('#pvChip').click();
	await expect(panel).toBeHidden();
	await page.locator('#pvChip').click();
	await panel.locator('input[name="pv-wx"][value="clear"]').check({ force: true });
	await expect(page.locator('html')).toHaveAttribute('data-wx', 'clear');
	await panel.locator('input[name="pv-snow"][value="off"]').check({ force: true });
	await expect.poll(() => snowing(page)).toBeNull();
	await panel.locator('input[name="pv-theme"][value="dark"]').check({ force: true });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await panel.locator('input[name="pv-clock"][value="trip"]').check({ force: true });
	await expect(page.locator('#rail .flag').first()).toBeAttached();
	await panel.locator('input[name="pv-sky"][value="off"]').check({ force: true });
	await expect(page.locator(VIEWS.band)).toHaveCount(0);
	// nothing it chose was saved on the phone
	expect(await saved()).toEqual(before);
});
