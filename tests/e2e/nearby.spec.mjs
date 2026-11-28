// What hangs under a stop, near it: drinks and rest spots (drinks.json), toilets (toilets.json) and water refill points
// (refill.json, ADR-20261128-water-refill). Each kind shows on its own data: a trip with toilets but no drinks keeps its
// toilet pill (a Japan trip has no drinks step), and a trip without refill data shows no refill row.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { fillAll, MAP, show } from '../support/page.mjs';
import { mapStyleRoute, stubMapLibre } from '../support/maplibre-stub.mjs';

/** Opens the page with one side file's data emptied, as a trip that never ran that step would build it: the build's
 *  `window.<name>=…` is ignored, so the page reads `empty`. (Rewriting the page's script would break its policy hash.) */
const without = (page, name, empty) =>
	page.addInitScript(({ n, v }) => Object.defineProperty(window, n, { configurable: true, get: () => JSON.parse(v), set: () => {} }), {
		n: name,
		v: empty,
	});
/** the ids of every stop whose sheet carries a pill of this kind, once every sheet is drawn */
const stopsWith = (page, sel) =>
	page.evaluate((s) => [...document.querySelectorAll(`#app ${s}`)].map((p) => p.closest('li.stop')?.id).filter(Boolean), sel);

// any trip: the toilet pill comes from toilets.json alone. It sat behind the drinks guard, so a trip with no drinks lost
// every toilet pill too
test('a trip with toilets but no drinks still shows the toilet pill under its stops', async ({ page }) => {
	await openTrip(page);
	await fillAll(page);
	const want = await stopsWith(page, '.near-pill.is-wc');
	test.skip(!want.length, 'this trip has no stop with a toilet near it');
	await without(page, 'DRINKS', '[]');
	await openTrip(page);
	expect(await page.evaluate(() => window.DRINKS.length), 'the page has no drinks').toBe(0);
	await fillAll(page);
	await expect.poll(() => stopsWith(page, '.near-pill.is-wc')).toEqual(want);
	await expect(page.locator('#app .near-pill[data-spots]'), 'and no drink or rest pill').toHaveCount(0);
});

/** the first stop whose sheet carries a refill pill, with its place, once every sheet is drawn; null when none does */
const refillStop = (page) =>
	page.evaluate(() => {
		const b = document.querySelector('#app .near-pill.is-refill');
		return b ? { stop: b.closest('li.stop').id, pk: b.dataset.refill.split('|')[0] } : null;
	});

// any trip with refill data: the pill opens a sheet of the nearest three within reach, each a shop, a tap or an indoor
// place, with its walk, and whose data it is
test('a stop near refill points shows a Refill pill; its sheet lists the nearest three, each marked, with its walk', async ({ page }) => {
	await openTrip(page);
	await fillAll(page);
	const at = await refillStop(page);
	test.skip(!at, 'this trip has no refill point near a stop');
	const pill = page.locator(`#${at.stop} .near-pill.is-refill`).first();
	await expect(pill.locator('svg.i').first(), 'the drop in its own colour').toHaveCSS('color', 'rgb(10, 132, 193)');
	await expect(pill).toContainText('Refill');
	expect((await (await show(page, pill)).boundingBox()).height).toBeGreaterThanOrEqual(44);
	await pill.click();
	const sheet = page.locator('#placeSheet');
	await expect(sheet.locator('.spots-h')).toContainText('Refill near');
	const rows = sheet.locator('.rf-spot');
	const n = await rows.count();
	const winter = await sheet.locator('.rf-winter').count();
	expect(n || winter, 'something to list, or the winter note').toBeTruthy();
	expect(n).toBeLessThanOrEqual(3);
	for (let i = 0; i < n; i++) {
		await expect(rows.nth(i).locator('.rf-k')).toHaveText(/^(Tap|Shop|Indoor)$/);
		await expect(rows.nth(i).locator('.spot-m')).toContainText('min walk');
		await expect(rows.nth(i).locator('a[href*="travelmode=walking"]')).toHaveCount(1);
	}
	if (n) await expect(sheet.locator('.rf-credit'), 'whose data it is').toContainText('Data:');
});

// any trip: without refill.json there is no refill pill, no Refill kind on the map, no Refill tab near me
test('a trip without refill data shows no refill part anywhere', async ({ page }) => {
	await without(page, 'REFILL', '{"checked":null,"spots":[]}');
	await openTrip(page);
	await fillAll(page);
	await expect(page.locator('#app .near-pill.is-refill')).toHaveCount(0);
	await expect(page.locator('#mapfilt [data-cat="refill"]')).toHaveCount(0);
	await expect(page.locator('[data-near="refill"]')).toHaveCount(0);
});

// any trip with refill data: Refill is a kind in the map's Filters sheet; picked, the map shows the refill pins alone, in
// any day, as for toilets
test('Refill is a kind on the map: picked, its pins show, and nothing else', async ({ page }) => {
	await page.addInitScript(stubMapLibre);
	await mapStyleRoute(page);
	await openTrip(page);
	test.skip(!(await page.evaluate(() => window.REFILL && window.REFILL.spots.length)), 'this trip has no refill data');
	await show(page, MAP.stage);
	await expect(page.locator('#mapbox .lpin').first()).toBeAttached();
	await page.locator(MAP.filters).click();
	const sheet = page.locator(MAP.filtersSheet);
	await expect(sheet.locator('.map-legend'), 'the legend names the drop').toContainText('Refill');
	await sheet.locator('[data-cat="refill"]').click();
	await expect(page.locator(MAP.filtersLabel)).toHaveText('All days · Refill');
	const shown = () =>
		page.evaluate(() => [...document.querySelectorAll('#livemap .lpin')].filter((p) => p.style.display !== 'none').map((p) => p.dataset.pid || ''));
	await expect.poll(async () => (await shown()).length).toBeGreaterThan(0);
	expect(
		(await shown()).every((pid) => pid.startsWith('rf-')),
		'only refill pins',
	).toBe(true);
});

// any trip with refill data: the near-me finder has a Refill tab, and the food section's buttons open it
test('near me can find refill', async ({ page }) => {
	await openTrip(page);
	const has = await page.evaluate(() => window.REFILL && window.REFILL.spots.length);
	test.skip(!has, 'this trip has no refill data');
	await (await show(page, '[data-near="refill"]')).click();
	const box = page.locator('#near');
	await expect(box.locator('#near-h')).toHaveText('Refill near me');
	await expect(box.locator('[data-near-meal="refill"]')).toHaveAttribute('aria-pressed', 'true');
	await expect(box.locator('.near-row').first()).toBeVisible({ timeout: 15_000 });
});

// the demo: near Huashan (Day 2, 14:00–16:30) a tap 108 m off, a shop that fills a bottle, and an indoor place; the shop
// is open at the stop's time, the indoor place closed on Mondays, and none is shut for a Taipei March
test.describe('refill on the demo', { tag: '@demo' }, () => {
	test('Huashan lists a tap, a shop and an indoor place, open at the stop’s time', async ({ page }) => {
		await openTrip(page);
		const pill = await show(page, '#d2-s4 .near-pill.is-refill');
		await expect(pill.locator('b')).toHaveText('110m'); // the tap 108 m off, to the nearest 10
		await pill.click();
		const sheet = page.locator('#placeSheet');
		await expect(sheet.locator('.rf-winter'), 'no winter in a Taipei March').toHaveCount(0);
		await expect(sheet.locator('.rf-spot .rf-k')).toHaveText(['Tap', 'Shop', 'Indoor']);
		const shop = sheet.locator('.rf-spot', { hasText: 'Demo Tea Bar' });
		await expect(shop).toContainText('10:00–21:00');
		await expect(shop.locator('.rf-open')).toHaveText('Open 14:00');
		await expect(shop).toContainText('filtered · cold'); // the source's words, in the page's language
		await expect(sheet.locator('.rf-credit')).toContainText('Demo data');
	});

	test('in a Sapporo February the outdoor taps are left out and counted; shops and indoor taps stay', async ({ page }) => {
		await page.goto('/trip-demo-sapporo.html');
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
		await fillAll(page);
		const at = await page.evaluate(() => {
			const b = [...document.querySelectorAll('#app .near-pill.is-refill')].find((x) => x.dataset.refill.startsWith('odori|'));
			return b && b.closest('li.stop').id;
		});
		expect(at, 'a stop at Odori Park').toBeTruthy();
		await (await show(page, `#${at} .near-pill.is-refill`)).click();
		const sheet = page.locator('#placeSheet');
		await expect(sheet.locator('.rf-winter')).toContainText(/\d closed for winter/);
		const kinds = await sheet.locator('.rf-spot .rf-k').allTextContents();
		expect(kinds.length).toBeGreaterThan(0);
		for (const k of kinds) expect(['Shop', 'Indoor', 'Tap']).toContain(k);
		// a tap still listed is an indoor one (the station's)
		for (const row of await sheet.locator('.rf-spot', { has: page.locator('.rf-k', { hasText: /^Tap$/ }) }).all())
			await expect(row).toContainText('In the station');
	});
});
