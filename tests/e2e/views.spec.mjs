// One view at a time (ADR-20261122-day-views): the day's previous / next buttons, its planning parts as tiles that
// open sheets (ADR-20261128-progressive-disclosure), a stop's own sheet, the Sections button's rules, jumps that land in the right view, the
// desktop's week rail and side panel, and nothing wider than a phone in either language. Any trip.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { BAR, goToView, hasBar, openPart, overflow, settle, setStored, switchLang, VIEWS, viewOn } from '../support/page.mjs';

/* global DAYS -- the trip data, read inside the page */

const scrollY = (page) => page.evaluate(() => window.scrollY);
const desk = (page) => page.viewportSize().width >= 1024;

test("a day's foot has big previous and next buttons, and they step through the trip", async ({ page }) => {
	await openTrip(page);
	const ids = await page.evaluate(() => DAYS.map((d) => d.id));
	await goToView(page, ids[0]);
	const view = page.locator(`#${ids[0]}`);
	// the first day's previous is the overview; its next is the second day
	await expect(view.locator(VIEWS.prev)).toHaveAttribute('href', '#top');
	await expect(view.locator(VIEWS.next)).toHaveAttribute('href', `#${ids[1]}`);
	for (const b of await view.locator(`${VIEWS.prev}, ${VIEWS.next}`).all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(52);
	await view.locator(VIEWS.next).click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', ids[1]);
	expect(await scrollY(page), 'the next day opens at its top').toBeLessThan(2);
	await page.locator(`#${ids[1]} ${VIEWS.prev}`).click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', ids[0]);
	// the last day's next goes on to the sections after the days
	await goToView(page, ids.at(-1));
	await expect(page.locator(`#${ids.at(-1)} ${VIEWS.next}`)).not.toHaveAttribute('href', /#d\d/);
});

test('every planning part of a day opens its sheet, which scrolls on its own, and Back closes it', async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => (DAYS.find((d) => d.blocks.length >= 2) || DAYS[0]).id);
	await goToView(page, day);
	// the tiles on screen (on a phone, past eight, the More tile stands for the rest)
	const parts = page.locator(`#${day} ${VIEWS.part}`).filter({ visible: true });
	const n = await parts.count();
	expect(n, 'the day has tiles').toBeGreaterThan(0);
	for (let i = 0; i < n; i++) {
		const btn = parts.nth(i);
		// each says what it is in a short word under its icon, at the Label size or larger (it follows the phone's text size)
		await expect(btn.locator('.tile-l')).not.toBeEmpty();
		await expect(btn.locator('.tile-ic svg.i')).toHaveCount(1);
		expect(await btn.locator('.tile-l').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(13);
		expect((await btn.boundingBox()).height).toBeGreaterThanOrEqual(44);
		await btn.scrollIntoViewIfNeeded();
		const y = await scrollY(page);
		const sheet = await openPart(page, btn);
		await expect(btn).toHaveAttribute('aria-expanded', 'true');
		await expect(sheet.locator('.bsheet-body')).not.toBeEmpty();
		// the sheet scrolls itself; the page behind stays where it was
		const scrolls = await sheet.evaluate((d) => d.scrollHeight > d.clientHeight + 4);
		if (scrolls) {
			await sheet.evaluate((d) => d.scrollBy(0, 200));
			await expect.poll(() => sheet.evaluate((d) => d.scrollTop)).toBeGreaterThan(0);
		}
		const y2 = await scrollY(page);
		await page.goBack();
		await expect(sheet).toBeHidden();
		await expect(btn).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('html')).toHaveAttribute('data-showing', day);
		await expect.poll(async () => Math.abs((await scrollY(page)) - y2)).toBeLessThan(30);
		expect(Math.abs(y2 - y), 'opening the sheet left the page where it was').toBeLessThan(60);
	}
});

test("an opened stop opens its sheet of what's near it from Nearby and more; its ✕ closes it", async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[1].id);
	await goToView(page, day);
	const stop = page.locator(`#${day} .stop.has-more`).first();
	if (!(await stop.count())) test.skip(true, 'no stop with a place on this day');
	await stop.locator('details.stop-x > summary').click();
	const more = stop.locator(VIEWS.stopMore);
	await expect(more.locator('.ibtn-l'), 'it says what it opens').not.toBeEmpty();
	expect((await more.boundingBox()).width).toBeGreaterThanOrEqual(44);
	const sheet = await openPart(page, more);
	await expect(sheet.locator('.bsheet-h')).not.toBeEmpty();
	await sheet.locator('.bsheet-x').click();
	await expect(sheet).toBeHidden();
	await expect(stop.locator('details.stop-x'), 'the stop stays open behind it').toHaveJSProperty('open', true);
});

test("a link into a part's sheet opens its view and the sheet at that place", async ({ page }) => {
	await openTrip(page);
	const id = await page.evaluate(() => {
		const el = document.querySelector('#app dialog.bsheet [id]');
		return el ? el.id : null;
	});
	if (!id) test.skip(true, 'no place with an id inside a sheet on this trip');
	await page.evaluate((h) => (location.hash = h), `#${id}`);
	const sheet = page.locator(`dialog.bsheet:has(#${id})`);
	await expect(sheet).toBeVisible();
	expect(await viewOn(page)).toBe(await page.locator(`#${id}`).evaluate((e) => e.closest('[data-sec]').id));
	await page.goBack();
	await expect(sheet).toBeHidden();
});

test('the Sections button is there on every view, and steps aside for search, the map and the day buttons', async ({ page }) => {
	await openTrip(page);
	test.skip(await hasBar(page), "a desktop's: below 1024 px the bottom bar's Days and More take its place");
	const fab = page.locator('#tocBtn');
	await expect(fab).toHaveAttribute('data-show', '1');
	// safe-area inset: it sits 16 px above the bottom edge or the phone's home bar (once it has risen into place)
	await expect
		.poll(async () => {
			const box = await fab.boundingBox();
			return page.viewportSize().height - (box.y + box.height);
		})
		.toBeGreaterThanOrEqual(15);
	// search open: hidden
	await page.locator('#searchBtn').click();
	await expect(fab).toHaveAttribute('data-show', '0');
	await page.locator('#searchClose').click();
	await expect(fab).toHaveAttribute('data-show', '1');
	// at a day's foot it would cover the next-day button: it steps aside there, and comes back above it
	const day = await page.evaluate(() => DAYS[0].id);
	await goToView(page, day);
	await expect(fab).toHaveAttribute('data-show', '1');
	await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
	await settle(page);
	const next = page.locator(`#${day} ${VIEWS.next}`);
	const [n, f] = [await next.boundingBox(), await fab.boundingBox()];
	const covers = n.y < f.y + f.height + 10 && n.y + n.height > f.y - 10 && n.x + n.width > f.x - 10;
	await expect(fab).toHaveAttribute('data-show', covers ? '0' : '1');
	// the map view: hidden over the map
	if (await page.locator('#map').count()) {
		await goToView(page, 'map');
		await page.locator('#map .map-wrap').scrollIntoViewIfNeeded();
		await settle(page);
		await expect(fab).toHaveAttribute('data-show', '0');
	}
});

test('a jump from the Now card lands on the stop in its day', async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[1]);
	await setStored(page, { now: `${day.date} 06:00` }); // before the day's first stop: its next stop is the first
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
	const go = page.locator(`#now a[href^="#${day.id}-s"]`).first();
	if (!(await go.count())) test.skip(true, 'the Now card links no stop on this trip');
	const href = await go.getAttribute('href');
	await go.click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', day.id);
	await expect.poll(() => page.locator(href).evaluate((e) => e.getBoundingClientRect().top)).toBeLessThan(300);
	await page.goBack();
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
});

test("a day's ⋯ holds Copy for chat, Copy link and the map, and the map opens over the day; closing it returns to the day", async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[1].id);
	await goToView(page, day);
	// the card keeps one ⋯ beside its title (ADR-20261128-progressive-disclosure): a 44 px button with a name
	const more = page.locator(`#${day} .lantern .l-more`);
	await expect(more).toHaveAttribute('aria-label', /.+/);
	expect((await more.boundingBox()).width).toBeGreaterThanOrEqual(44);
	const sheet = await openPart(page, more);
	// each action has its word (the copy and link buttons were icon-only on a phone)
	for (const sel of ['[data-copy-day]', '[data-copy-link]']) await expect(sheet.locator(`${sel} .rl-t b`)).not.toBeEmpty();
	const btn = sheet.locator('[data-map-day]');
	if (!(await btn.count())) test.skip(true, 'this trip has no map');
	await btn.click();
	await expect(sheet, 'the sheet closes as the map opens').toBeHidden();
	await expect(page.locator('#mapstage.is-full')).toBeVisible();
	await page.goBack();
	await expect(page.locator('#mapstage.is-full')).toHaveCount(0);
	await expect(page.locator('html')).toHaveAttribute('data-showing', day);
	await expect(page.locator(`#${day}`)).toBeVisible();
});

test('a sideways swipe on a day steps to the next day and back (a bonus: the buttons stay the way)', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium' || !page.viewportSize() || page.viewportSize().width >= 1024, 'touch events: phones in Chromium');
	await openTrip(page);
	const [a, b] = await page.evaluate(() => [DAYS[0].id, DAYS[1].id]);
	await goToView(page, a);
	const swipe = (dx) =>
		page.evaluate((dx) => {
			const el = document.querySelector('#app .stop-t');
			const at = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 400 })];
			el.dispatchEvent(new TouchEvent('touchstart', { touches: at(200), changedTouches: at(200), bubbles: true }));
			el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: at(200 + dx), bubbles: true }));
		}, dx);
	await swipe(-160);
	await expect(page.locator('html')).toHaveAttribute('data-showing', b);
	await swipe(160);
	await expect(page.locator('html')).toHaveAttribute('data-showing', a);
});

test('a desktop gets the week rail instead of the bottom bar, and the sheets open as a side panel', async ({ page }) => {
	test.skip(!page.viewportSize() || page.viewportSize().width < 1024, 'desktop only');
	await openTrip(page);
	await expect(page.locator('#rail')).toBeVisible();
	await expect(page.locator(BAR.bar)).toBeHidden();
	await expect(page.locator('#rail [data-rail="top"]')).toHaveAttribute('aria-current', 'page');
	const day = await page.evaluate(() => (DAYS.find((d) => d.blocks.length) || DAYS[0]).id);
	await goToView(page, day);
	await expect(page.locator(`#rail [data-rail="${day}"]`)).toHaveAttribute('aria-current', 'page');
	const sheet = await openPart(page, 0);
	await expect.poll(async () => (await sheet.boundingBox()).x + (await sheet.boundingBox()).width).toBeGreaterThan(page.viewportSize().width - 40);
	const b = await sheet.boundingBox();
	expect(b.width, 'a panel, not the whole width').toBeLessThan(page.viewportSize().width * 0.6);
	expect(b.height, 'the height of the screen').toBeGreaterThan(page.viewportSize().height - 60);
	expect(desk(page)).toBe(true);
});

// a sheet is a phone's width on a desktop too: a five-column table of stays squeezed into the side panel scrolled
// sideways, so a table in a sheet lays out as on a phone, one card per row
test('a table in a sheet reads as one card per row, with nothing to scroll sideways', async ({ page }) => {
	await openTrip(page);
	const at = await page.evaluate(() => {
		for (const d of DAYS) {
			const i = d.blocks.findIndex((b) => b.type === 'table');
			if (i > -1) return `${d.id}-p-b${i}`;
		}
		return null;
	});
	test.skip(!at, 'no day here has a table');
	await goToView(page, at.split('-p-')[0]);
	const sheet = await openPart(page, page.locator(`[data-part="${at}"]`));
	const t = await sheet.evaluate((d) => {
		const wrap = d.querySelector('.tbl-wrap');
		const tr = d.querySelector('.tbl tbody tr');
		return { over: wrap.scrollWidth - wrap.clientWidth, rows: getComputedStyle(tr).display };
	});
	expect(t.over, 'sideways scroll in the table').toBeLessThanOrEqual(1);
	expect(t.rows, 'a row is a card').toBe('grid');
});

for (const lang of ['zh', 'en']) {
	test(`no view runs wider than the screen (${lang})`, async ({ page }) => {
		await openTrip(page);
		await switchLang(page, lang);
		const ids = await page.evaluate(() => [...document.querySelectorAll('#app > [data-sec]')].map((s) => s.id));
		for (const id of ids) {
			await page.evaluate((h) => (location.hash = h), `#${id}`);
			await expect(page.locator('html')).toHaveAttribute('data-showing', id);
			// once its entrance has played: its first blocks slide in from the side
			await page.evaluate(() =>
				Promise.all(
					document
						.getAnimations()
						.filter((a) => a.effect && a.effect.getTiming().iterations !== Infinity)
						.map((a) => a.finished.catch(() => {})),
				),
			);
			expect(await overflow(page), `#${id}`).toEqual([]);
		}
	});
}

test('a decision the planner settled shows a tick on its tile, and its sheet says which option (world page)', async ({ page }) => {
	await page.goto('/trip-world.html');
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	const btn = page.locator('.part.tile:has(.tile-ok)').first();
	if (!(await btn.count())) test.skip(true, 'no settled decision on this trip');
	await expect(btn).toContainText(/已定|chosen/);
	const day = await btn.evaluate((e) => e.closest('[data-sec]').id);
	await page.evaluate((h) => (location.hash = h), `#${day}`);
	await expect(page.locator('html')).toHaveAttribute('data-showing', day);
	const sheet = await openPart(page, btn);
	await expect(sheet.locator('.bsheet-sum .part-pick')).toContainText(/已定|Chosen/);
});

// the map's loading box lies over the whole map until the map is up; the page then sets [hidden] on it. Its own display
// (grid, or flex while it says the map is slow) outranks the browser's [hidden]. The standalone page adds a global
// [hidden] rule, but the artifact build leaves that rule to its host, so the box must hide by its own CSS: the test
// drops the page-level rule first, as a host without it would serve the page
test('the map’s loading box goes once the map is up, slow or not, by its own CSS', async ({ page }) => {
	await openTrip(page);
	const msg = page.locator('#mapmsg');
	test.skip(!(await msg.count()), 'a trip without a live map has no loading box');
	await goToView(page, 'map');
	await expect(msg, 'it shows while the map loads').toBeVisible();
	await page.evaluate(() => {
		for (const s of document.querySelectorAll('style')) s.textContent = s.textContent.replace('[hidden]{display:none!important}', '');
	});
	for (const slow of [false, true]) {
		await msg.evaluate((el, s) => {
			el.classList.toggle('slow', s);
			el.hidden = true; // what 17-map-maplibre.js mapMsg('ok') does once the map is up
		}, slow);
		await expect(msg, slow ? 'the slow-map notice hides too' : 'the box hides').toBeHidden();
		await msg.evaluate((el) => (el.hidden = false));
	}
});
