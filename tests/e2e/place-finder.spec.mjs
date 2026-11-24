// The place finder and the place details (ADR-20261122-place-finder-best-day). The map's search shows how a place fits
// the plan (each day's nearest stop, the day it fits best) and adds it there; the add sheet opens a place before adding
// it, and Back finds the list as it was; Google's rating and photos reach stops and Optional cards (a stand-in key, with
// Google's library stubbed in the page); and Google's results in the map's search stay while the phone keeps moving.
// Trip-agnostic: the places and days come from the trip's own data. The live map itself can't load offline, so a
// result's pin on the map is checked by eye (verify-page), not here.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { FINDER as F, overflow, setStored, show, switchLang } from '../support/page.mjs';
import { stubGoogle, stubMovingGeo } from '../support/google-stub.mjs';
/* global DAYS, EXTRA, TRIP */

/** the trip clock three days before its first day: every day still ahead */
async function beforeTrip(page, url) {
	if (url) {
		await page.goto(url);
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	} else await openTrip(page);
	const first = await page.evaluate(() => DAYS[0].date);
	const d = new Date(`${first}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 3);
	await setStored(page, { now: `${d.toISOString().slice(0, 10)} 09:00` });
}
/** a researched food place with a position: its map pin id and its name as the page shows it in English */
const aFoodPlace = (page) =>
	page.evaluate(() => {
		const i = (EXTRA.food || []).findIndex((f) => f.lat != null && f.lng != null);
		return i < 0 ? null : { pid: `food${i}`, name: EXTRA.food[i].name_en || EXTRA.food[i].name_trad };
	});
const noSideways = (loc) => loc.evaluate((el) => el.scrollWidth - el.clientWidth);

test('a place found on the map shows each day’s nearest stop and the best day, and adds it there', async ({ page }) => {
	await beforeTrip(page);
	const food = await aFoodPlace(page);
	test.skip(!food, 'the trip has no researched food with a position');
	const q = page.locator(F.query);
	await show(page, q); // the map view
	await q.fill(food.name);
	const hit = page.locator(F.result(food.pid));
	await hit.click();
	const panel = page.locator(F.panel);
	await expect(panel).toBeVisible();
	await expect(page.locator(F.results), 'the finder takes the results’ place').toBeHidden();
	await expect(panel.locator('.hang-name')).toHaveText(food.name);
	await expect(page.locator(F.best)).toContainText(/Best fit\s*Day \d+/);
	const [day, key] = (await page.locator(F.addBest).getAttribute('data-fit-add')).split('|');
	expect(await page.evaluate((id) => DAYS.some((d) => d.id === id), day)).toBe(true);
	// the other days, nearest stop first, each one tap from adding (or saying why not)
	const others = page.locator(F.otherDays);
	expect(await others.count()).toBeLessThanOrEqual(3);
	for (const r of await others.all()) await expect(r).toContainText(/Day \d+/);

	// Back, the button: the results as they were, on the place that was tapped
	await page.locator(F.back).click();
	await expect(panel).toBeHidden();
	await expect(page.locator(F.results)).toBeVisible();
	await expect(hit).toBeFocused();
	await expect(q).toHaveValue(food.name);
	// Back, the phone's: the same
	await hit.click();
	await expect(panel).toBeVisible();
	await page.goBack();
	await expect(panel).toBeHidden();
	await expect(page.locator(F.results)).toBeVisible();

	// one tap into the add sheet: the best day, at a time right after the stop it follows
	await hit.click();
	await page.locator(F.addBest).click();
	const sheet = page.locator(F.sheet);
	await expect(sheet.locator(F.dayPicked)).toHaveAttribute('data-add-day', day);
	await expect(sheet.locator('[data-add-t]')).toHaveValue(/^\d\d:\d\d$/);
	await expect(sheet.locator('.add-place .hang-name')).toHaveText(food.name);
	await sheet.locator(F.save).click();
	const mine = page.locator(`#${day} .stop.mine`);
	await expect(mine).toHaveCount(1);
	await expect(mine).toContainText(food.name);
	// right after the stop it was measured from, unless that stop's key is an added stop
	if (/^\d+$/.test(key)) {
		const order = await page.locator(`#${day} .sched > li.stop`).evaluateAll((ls) => ls.map((l) => (l.classList.contains('mine') ? 'mine' : l.id)));
		expect(order.indexOf('mine')).toBeGreaterThan(order.indexOf(`${day}-s${key}`));
	}
	await expect(panel, 'the page redrew: the finder steps aside').toBeHidden();
	expect(await page.evaluate(() => history.state && history.state.tpOverlay), 'no Back step left behind').toBeFalsy();
});

test('the shop box’s shops, which have no pin, are found by the map’s search and open in the finder', async ({ page }) => {
	await beforeTrip(page);
	const shop = await page.evaluate(() => (window.SHOPS || []).find((x) => x.lat != null && x.lng != null) || null);
	test.skip(!shop, 'the trip has no shop box');
	const q = page.locator(F.query);
	await show(page, q); // the map view
	await q.fill(shop.name_trad);
	const hit = page.locator(F.result(`buy-${shop.id}`));
	await hit.click();
	await expect(page.locator(F.panel)).toBeVisible();
	await expect(page.locator(`${F.panel} .hang-name`)).toHaveText(shop.name_en || shop.name_trad);
	await page.locator(F.back).click();
	await expect(hit).toBeFocused();
});

test('the add sheet opens a place before adding it, and Back finds the list as it was', async ({ page }) => {
	page.on('dialog', (d) => d.accept());
	await beforeTrip(page);
	await (await show(page, '[data-add-gap]')).click();
	const sheet = page.locator(F.sheet);
	const rows = sheet.locator(F.listRow);
	await expect(rows.first()).toBeVisible();
	// a place down the list, so the list is scrolled when it's tapped
	const at = Math.min(6, (await rows.count()) - 1);
	const pick = rows.nth(at);
	const name = (await pick.locator('.idea-n').textContent()).trim();
	await pick.scrollIntoViewIfNeeded();
	const y = await sheet.evaluate((d) => d.scrollTop);

	await pick.click();
	const prev = sheet.locator(F.preview);
	await expect(prev).toBeVisible();
	await expect(sheet.locator(F.list)).toBeHidden();
	await expect(prev.locator('.add-place .hang-name, .add-name').first()).toHaveText(name);
	await expect(prev.locator(F.save)).toBeVisible();
	await expect(prev.locator('.add-days')).toBeVisible();

	// Back, the button: the list, scrolled where it was, on the place tapped
	await prev.locator(F.previewBack).click();
	await expect(prev).toBeHidden();
	await expect(sheet.locator(F.list)).toBeVisible();
	expect(await sheet.evaluate((d) => d.scrollTop)).toBe(y);
	await expect(sheet.locator(F.listAdd).nth(at)).toBeFocused();
	// Back, the phone's: the list again, and the sheet stays open
	await pick.click();
	await expect(prev).toBeVisible();
	await page.goBack();
	await expect(sheet.locator(F.list)).toBeVisible();
	await expect(sheet).toHaveAttribute('open', '');
	// the ＋ on the row opens the same preview; Add adds it
	await sheet.locator(F.listAdd).nth(at).click();
	await expect(prev).toBeVisible();
	await prev.locator(F.save).click();
	await expect(sheet).not.toHaveAttribute('open', '');
	await expect(page.locator('.stop.mine').filter({ hasText: name })).toHaveCount(1);
	expect(await page.evaluate(() => history.state && history.state.tpOverlay), 'no Back step left behind').toBeFalsy();
});

test('closing the add sheet from a preview leaves no Back step behind', async ({ page }) => {
	await beforeTrip(page);
	await (await show(page, '[data-add-gap]')).click();
	const sheet = page.locator(F.sheet);
	await sheet.locator(F.listRow).first().click();
	await expect(sheet.locator(F.preview)).toBeVisible();
	await sheet.locator('[data-close]').first().click();
	await expect(sheet).not.toHaveAttribute('open', '');
	await expect.poll(() => page.evaluate(() => !!(history.state && history.state.tpOverlay))).toBe(false);
});

for (const lang of ['en', 'zh']) {
	test(`the finder and the preview fit a phone in ${lang}`, async ({ page }) => {
		await beforeTrip(page);
		await switchLang(page, lang);
		const food = await aFoodPlace(page);
		test.skip(!food, 'the trip has no researched food with a position');
		const q = page.locator(F.query);
		await show(page, q); // the map view
		await q.fill(await page.evaluate((pid) => EXTRA.food[+pid.slice(4)].name_trad, food.pid));
		await page.locator(F.result(food.pid)).click();
		const panel = page.locator(F.panel);
		await expect(panel).toBeVisible();
		expect(await noSideways(panel), 'the finder runs wider than its box').toBeLessThanOrEqual(0);
		expect(await overflow(page)).toEqual([]);
		for (const b of await panel.locator('button, a').all()) {
			const r = await b.boundingBox();
			expect(r.height, await b.textContent()).toBeGreaterThanOrEqual(44);
		}
		await page.locator(F.addBest).click();
		const sheet = page.locator(F.sheet);
		await expect(sheet.locator(F.save)).toBeVisible();
		expect(await noSideways(sheet), 'the add sheet runs wider than the screen').toBeLessThanOrEqual(0);
		await sheet.locator('[data-close]').first().click();
		await (await show(page, '[data-add-gap]')).click();
		await sheet.locator(F.listRow).first().click();
		await expect(sheet.locator(F.preview)).toBeVisible();
		expect(await noSideways(sheet), 'the preview runs wider than the screen').toBeLessThanOrEqual(0);
	});
}

test('without a key: no Google parts on stops or cards, and details from the trip’s own data', async ({ page }) => {
	await beforeTrip(page);
	await expect(page.locator(F.google)).toHaveCount(0);
	const food = await aFoodPlace(page);
	test.skip(!food, 'the trip has no researched food with a position');
	const q = page.locator(F.query);
	await show(page, q); // the map view
	await q.fill(food.name);
	await page.locator(F.result(food.pid)).click();
	await page.locator(F.detailsBtn).click();
	const card = page.locator(`${F.sheet} ${F.detailsCard}`);
	await expect(card.locator('.hang-name')).toHaveText(food.name);
	await expect(card.locator(F.googleBox)).toHaveCount(0);
	await expect(card.locator('[data-add]')).toBeVisible();
});

test.describe('with the planner’s key (a stand-in, Google stubbed in the page)', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(stubGoogle);
	});

	test('a stop’s Info opens its details, found by name near its pin, with Google’s rating, hours and photo', async ({ page }) => {
		await beforeTrip(page, '/trip-gkey.html');
		const btn = page.locator(`.stop-links ${F.google}`).first();
		await show(page, btn); // its stop's sheet
		await btn.click();
		const card = page.locator(`${F.sheet} ${F.detailsCard}`);
		await expect(card).toBeVisible();
		await expect(card.locator('.gstars')).toContainText('4.6');
		await expect(card.locator('.gphotos img')).toHaveCount(1);
		await expect(card.locator('.ghours li')).toHaveCount(7);
		const calls = await page.evaluate(() => window.__gCalls);
		// a place without a pinned Google id is looked up by id only (Google's free tier), and fetched once
		for (const s of calls.search) expect(s.fields).toEqual(['id']);
		expect(calls.fetch.length).toBe(1);
		// a second look in this page view costs nothing more
		await page.locator(`${F.sheet} [data-close]`).first().click();
		await btn.click();
		await expect(card.locator('.gstars')).toContainText('4.6');
		expect((await page.evaluate(() => window.__gCalls.fetch)).length).toBe(1);
	});

	test('an Optional card shows Google’s rating and photos in the card itself', async ({ page }) => {
		await beforeTrip(page, '/trip-gkey.html');
		const card = page
			.locator('#optional article.hang')
			.filter({ has: page.locator(F.google) })
			.first();
		test.skip(!(await card.count()), 'the trip has no optional plan with a mapped place');
		await show(page, card.locator(F.google)); // the Optional view
		await card.locator(F.google).click();
		await expect(card.locator(`${F.googleBox} .gstars`)).toContainText('4.6');
		await expect(card.locator(F.google)).toBeHidden();
	});

	test('the add sheet’s preview brings Google’s part with it, once per place', async ({ page }) => {
		await beforeTrip(page, '/trip-gkey.html');
		await (await show(page, '[data-add-gap]')).click();
		const sheet = page.locator(F.sheet);
		await sheet.locator(F.listRow).first().click();
		await expect(sheet.locator(`${F.preview} ${F.googleBox} .gstars`)).toContainText('4.6');
		await sheet.locator(F.previewBack).click();
		await sheet.locator(F.listRow).first().click();
		await expect(sheet.locator(`${F.preview} ${F.googleBox} .gstars`)).toContainText('4.6');
		expect((await page.evaluate(() => window.__gCalls.fetch)).length).toBe(1);
	});
});

// The planner's report: "the result shows, then suddenly it's gone and says no result". Each location fix redrew the
// results from the page's own places, which don't match a Google query.
// CI's slower WebKit: each fix (every 150 ms here) rebuilt the whole list, so "Search Google" was swapped out under the
// tap ("element was detached from the DOM, retrying") until the test timed out. A fix that changes nothing on the list,
// or only its distances, keeps its rows
test('a location fix keeps the map’s result rows, so a tap on one still lands', async ({ page }) => {
	await page.addInitScript(stubGoogle);
	await page.addInitScript(stubMovingGeo);
	await beforeTrip(page);
	const q = page.locator(F.query);
	await show(page, q); // the map view
	await q.fill('noodles');
	await page.locator('#mapres [data-mapsort="near"]').click();
	await page.waitForFunction(() => window.__fixes >= 2);
	const button = await page.locator(F.googleSearch).elementHandle();
	await page.waitForFunction((n) => window.__fixes >= n, (await page.evaluate(() => window.__fixes)) + 5);
	expect(await button.evaluate((b) => b.isConnected), 'the same "Search Google" button after five more fixes').toBe(true);
	await button.click();
	await expect(page.locator(F.googleResult)).toHaveCount(2);
});

test('Google’s results in the map’s search stay while the phone’s location keeps updating', async ({ page }) => {
	await page.addInitScript(stubGoogle);
	await page.addInitScript(stubMovingGeo);
	await beforeTrip(page);
	const q = page.locator(F.query);
	await show(page, q); // the map view
	await q.fill('noodles');
	// follow the phone: the list's "Nearest" asks for location
	await page.locator('#mapres [data-mapsort="near"]').click();
	await page.waitForFunction(() => window.__fixes >= 2);
	await page.locator(F.googleSearch).click();
	const res = page.locator(F.googleResult);
	await expect(res).toHaveCount(2);
	await page.waitForFunction((n) => window.__fixes >= n, (await page.evaluate(() => window.__fixes)) + 8);
	await expect(res, 'the results are still there after eight more fixes').toHaveCount(2);
	await expect(page.locator(F.results)).toContainText('Google');
	await expect(res.first().locator('[data-gdist]'), 'their distances follow the phone').not.toHaveText('');
	// they asked in the trip's own country, in the page's language
	const req = (await page.evaluate(() => window.__gCalls.search)).at(-1);
	expect(req.language).toBe('en');
	expect(req.region || '').toBe(await page.evaluate(() => (TRIP.destination || '').toLowerCase()));
	// a result opens in the finder; Back returns to Google's results, not the page's
	await res.first().click();
	await expect(page.locator(F.panel)).toBeVisible();
	await expect(page.locator(F.panel)).toContainText('Stand-in Noodle Bar');
	await page.locator(F.back).click();
	await expect(res).toHaveCount(2);
	// the page's results only when the person asks
	await page.locator(F.googleBack).click();
	await expect(res).toHaveCount(0);
	// in Chinese, Google answers in Chinese
	await switchLang(page, 'zh');
	await show(page, q); // the map view
	await q.fill('noodles');
	await page.locator(F.googleSearch).click();
	await expect(res).toHaveCount(2);
	expect((await page.evaluate(() => window.__gCalls.search)).at(-1).language).toMatch(/^zh/);
});
