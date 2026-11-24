// The map stays in sight while searching (ADR-20261124-map-first-search). The results and the place finder lie in a
// pane over the map: a sheet at its foot on a phone, a panel down its left on a wide screen. A tapped result's pin is
// marked and brought into the open part of the map, Back finds the list as it was, the sheet's heights answer to its
// buttons and the keyboard as well as a finger, and the day and the area sit behind one button. Trip-agnostic: the
// queries are the trip's own places. The live map can't load offline; the tests that need its pins and its camera use a
// stand-in (tests/support/maplibre-stub.mjs).
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { BAR, FINDER as F, MAP, hasBar, settle, show } from '../support/page.mjs';
import { mapStyleRoute, stubMapLibre } from '../support/maplibre-stub.mjs';
/* global EXTRA */

const rect = (loc) =>
	loc.evaluate((e) => {
		const r = e.getBoundingClientRect();
		return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };
	});
const sideways = (page) => page.locator(MAP.box).evaluate((e) => getComputedStyle(e).getPropertyValue('--pane-side').trim() === '1');
/** a researched food place with a position: its pin id and its name as the page shows it in English */
const aFoodPlace = (page) =>
	page.evaluate(() => {
		const i = (EXTRA.food || []).findIndex((f) => f.lat != null && f.lng != null);
		return i < 0 ? null : { pid: `food${i}`, name: EXTRA.food[i].name_en || EXTRA.food[i].name_trad };
	});

/** the map view, searching for the first place its own list shows */
async function searchFirstPlace(page) {
	await show(page, MAP.stage);
	await page.locator(MAP.list).click();
	const name = (await page.locator('#mapres .mres-n').first().textContent()).trim();
	await page.locator(MAP.close).click();
	await expect(page.locator(MAP.pane)).toBeHidden();
	await page.locator(F.query).fill(name);
	await expect(page.locator('#mapres [data-mres]').first()).toBeVisible();
	await settle(page);
}

/** the map in sight with the pane over it: the whole box on screen under the header, at least 40 % of the screen's
 *  height, the pane inside it, and a part of the map left open above the sheet or beside the panel */
async function mapInSight(page) {
	const vp = page.viewportSize();
	const bar = await rect(page.locator('#bar'));
	const map = await rect(page.locator(MAP.box));
	const pane = await rect(page.locator(MAP.pane));
	expect(map.top, 'the map starts under the header').toBeGreaterThanOrEqual(bar.bottom - 1);
	expect(map.bottom, 'the map ends on screen').toBeLessThanOrEqual(vp.height + 1);
	expect(map.h / vp.height, 'the map takes at least 40 % of the screen').toBeGreaterThanOrEqual(0.4);
	expect(pane.top, 'the results lie over the map, never above it').toBeGreaterThanOrEqual(map.top - 1);
	expect(pane.bottom).toBeLessThanOrEqual(map.bottom + 1);
	if (await sideways(page)) {
		expect(pane.h, 'a wide screen: a panel down the map').toBeGreaterThan(map.h * 0.8);
		expect(map.right - pane.right, 'and the map open beside it').toBeGreaterThanOrEqual(map.w * 0.4);
	} else {
		expect(pane.bottom, 'a phone: a sheet at the map’s foot').toBeGreaterThan(map.bottom - 2);
		expect(pane.top - map.top, 'and the map open above it').toBeGreaterThanOrEqual(Math.min(140, map.h * 0.35));
	}
	return { map, pane };
}

test('a search lays its results over the map, and the map stays in sight', async ({ page }) => {
	await openTrip(page);
	await searchFirstPlace(page);
	await expect(page.locator(F.count)).toHaveText(/^\d+ places?$/);
	await mapInSight(page);
	// the list button closes the pane, and the map is whole again
	await page.locator(MAP.list).click();
	await expect(page.locator(MAP.pane)).toBeHidden();
});

test('a result tapped marks its pin and shows the finder, with the map in sight', async ({ page }) => {
	await page.addInitScript(stubMapLibre);
	await mapStyleRoute(page);
	await openTrip(page);
	const food = await aFoodPlace(page);
	test.skip(!food, 'the trip has no researched food with a position');
	await show(page, MAP.stage);
	await expect(page.locator('.map-wrap.is-live'), 'the stand-in map is up').toBeAttached();
	await page.locator(F.query).fill(food.name);
	await page.locator(F.result(food.pid)).click();
	await expect(page.locator(F.panel)).toBeVisible();
	await expect(page.locator(F.panel).locator('.hang-name')).toHaveText(food.name);
	const pin = page.locator(MAP.pin(food.pid));
	await expect(pin, 'its pin is marked').toHaveClass(/\bsel\b/);
	await expect(page.locator('#livemap .maplibregl-popup'), 'the finder is its card: no popup over the map').toHaveCount(0);
	const { map, pane } = await mapInSight(page);
	// the camera went to the place, aimed at the middle of the map the pane leaves open
	const ease = await page.evaluate(() => window.__ml.ease.at(-1));
	expect(ease.center.join(',')).toBe(await pin.getAttribute('data-ll'));
	if (await sideways(page)) expect(Math.abs(ease.offset[0] * 2 - (pane.right - map.left))).toBeLessThanOrEqual(2);
	else expect(Math.abs(-ease.offset[1] * 2 - (map.bottom - pane.top))).toBeLessThanOrEqual(2);
});

test('Back from the finder returns to the list where it was, at the height it had', async ({ page }) => {
	await openTrip(page);
	const food = await aFoodPlace(page);
	test.skip(!food, 'the trip has no researched food with a position');
	await show(page, MAP.stage);
	await page.locator(MAP.list).click();
	const side = await sideways(page);
	if (!side) await page.locator(MAP.up).click(); // a phone: the whole list
	const res = page.locator(F.results);
	const row = page.locator(F.result(food.pid));
	await row.evaluate((e) => e.scrollIntoView({ block: 'center' }));
	await settle(page);
	const y = await res.evaluate((e) => e.scrollTop);
	await row.click();
	await expect(page.locator(F.panel)).toBeVisible();
	if (!side) await expect(page.locator(MAP.pane), 'the finder at half, so the pin shows above it').toHaveAttribute('data-stop', 'half');
	await page.goBack();
	await expect(page.locator(F.panel)).toBeHidden();
	await expect(res).toBeVisible();
	await expect(row).toBeFocused();
	expect(await res.evaluate((e) => e.scrollTop)).toBe(y);
	if (!side) await expect(page.locator(MAP.pane), 'the list at the height it had').toHaveAttribute('data-stop', 'full');
	await expect(page.locator(F.count)).toHaveText(/^\d+ places?$/);
});

test('the sheet’s heights answer to its buttons, the keyboard and a finger', async ({ page }) => {
	await openTrip(page);
	await searchFirstPlace(page);
	test.skip(await sideways(page), 'a wide screen has a side panel, with no heights');
	const pane = page.locator(MAP.pane);
	const h = async () => (await rect(pane)).h;
	// the sheet springs to a height: measure once it has settled (unchanged across two frames)
	const still = () =>
		pane.evaluate(
			(p) =>
				new Promise((done) => {
					let last = -1;
					const tick = () => {
						const now = p.getBoundingClientRect().height;
						if (now === last) done();
						else {
							last = now;
							requestAnimationFrame(() => requestAnimationFrame(tick));
						}
					};
					tick();
				}),
		);
	await expect(pane).toHaveAttribute('data-stop', 'half');
	const half = await h();
	// by keyboard: the two chevrons step it up and down, each greyed out at its end
	await page.locator(MAP.up).focus();
	await page.keyboard.press('Enter');
	await expect(pane).toHaveAttribute('data-stop', 'full');
	await expect.poll(h).toBeGreaterThan(half + 40);
	await expect(page.locator(MAP.up)).toBeDisabled();
	await page.locator(MAP.down).focus();
	await page.keyboard.press('Space');
	await expect(pane).toHaveAttribute('data-stop', 'half');
	await page.keyboard.press('Space');
	await expect(pane).toHaveAttribute('data-stop', 'peek');
	await expect.poll(h).toBeLessThan(half - 20);
	await expect(page.locator(MAP.down)).toBeDisabled();
	// by finger: its head follows a drag up, and settles at the top; dragged down, at the foot (the finger stays on the
	// screen: WebKit drops moves past its edge)
	const vh = page.viewportSize().height;
	const drag = async (dy) => {
		await still();
		const head = await rect(page.locator(MAP.paneHead));
		const y0 = head.top + 30;
		await page.mouse.move(head.left + 24, y0);
		await page.mouse.down();
		await page.mouse.move(head.left + 24, Math.max(8, Math.min(vh - 8, y0 + dy)), { steps: 6 });
		await page.mouse.up();
	};
	await drag(-400);
	await expect(pane).toHaveAttribute('data-stop', 'full');
	// a hard flick never carries the sheet past the map's top
	const box = await rect(page.locator(MAP.box));
	expect((await rect(pane)).top, 'the sheet stays inside the map').toBeGreaterThanOrEqual(box.top - 1);
	await drag(400);
	await expect(pane).toHaveAttribute('data-stop', 'peek');
});

test('the day and the area sit behind one button over the map; a pick applies and closes its sheet', async ({ page }) => {
	await openTrip(page);
	await show(page, MAP.stage);
	await expect(page.locator(`${MAP.stage} .map-ctrl`), 'one row of chips over the map, not three').toHaveCount(1);
	await expect(page.locator(MAP.cats).first()).toBeVisible();
	const btn = page.locator(MAP.filters);
	await expect(btn).toHaveText(/All days/);
	// by keyboard
	await btn.focus();
	await page.keyboard.press('Enter');
	const sheet = page.locator(MAP.filtersSheet);
	await expect(sheet).toBeVisible();
	const day = sheet.locator('[data-filter]:not([data-filter="all"])').first();
	const id = await day.getAttribute('data-filter');
	await day.click();
	await expect(sheet).toBeHidden();
	await expect(page.locator(MAP.day(id))).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator(MAP.filtersLabel)).toHaveText(/^Day \d+ · /);
	await expect(btn, 'the day’s colour too').toHaveAttribute('data-on', '1');
	// an area: the map moves there (once it's up), and the sheet closes
	await btn.click();
	await expect(sheet).toBeVisible();
	const area = sheet.locator(MAP.area.replace('#mapfilt ', '')).last();
	await area.click();
	await expect(sheet).toBeHidden();
	await expect(area).toHaveAttribute('aria-pressed', 'true');
	// back to every day
	await btn.click();
	await sheet.locator('[data-filter="all"]').click();
	await expect(page.locator(MAP.filtersLabel)).toHaveText('All days');
	await expect(btn).toHaveAttribute('data-on', '0');
});

test('in full screen the results lie over the map too', async ({ page }) => {
	await page.addInitScript(stubMapLibre);
	await mapStyleRoute(page);
	await openTrip(page);
	await show(page, MAP.stage);
	await expect(page.locator('.map-wrap.is-live')).toBeAttached();
	await page.locator(MAP.full).click();
	await expect(page.locator(`${MAP.stage}.is-full`)).toBeVisible();
	await page.locator(MAP.list).click();
	await expect(page.locator(F.results)).toBeVisible();
	const vp = page.viewportSize();
	const map = await rect(page.locator(MAP.box));
	const pane = await rect(page.locator(MAP.pane));
	expect(map.bottom).toBeLessThanOrEqual(vp.height + 1);
	expect(map.h / vp.height).toBeGreaterThanOrEqual(0.5);
	expect(pane.top).toBeGreaterThanOrEqual(map.top - 1);
	if (await sideways(page)) expect(map.right - pane.right).toBeGreaterThanOrEqual(map.w * 0.4);
	else expect(pane.top - map.top).toBeGreaterThanOrEqual(map.h * 0.4);
	// below 1024 px the full-screen map ends at the top of the bottom bar, so the bar stays in sight and one tap away
	if (await hasBar(page)) {
		const bar = await rect(page.locator(BAR.bar));
		expect(map.bottom, 'the map ends above the bar').toBeLessThanOrEqual(bar.top + 0.5);
		await expect
			.poll(async () => (await rect(page.locator(MAP.pane))).bottom, { message: 'the results end above the bar' })
			.toBeLessThanOrEqual(bar.top + 0.5);
		await expect(page.locator(BAR.map)).toBeVisible();
	}
	await page.goBack();
	await expect(page.locator(`${MAP.stage}.is-full`)).toHaveCount(0);
});
