// The bottom bar (ADR-20261124-bottom-app-bar): below 1024 px, phones and tablets alike, Today, Days, Map and More take
// the place of the header's date strip and the floating Sections button; a desktop keeps the rail. Each tap on the bar
// is a step Back undoes; Days lists every day down a sheet; More holds the planning sections and the settings, the sky's
// Pause among them; whatever floats at the bottom sits above the bar, which reserves --chrome-bottom.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { BAR, clickOrExplain, goToView, hasBar, overflow, settle, setStored, switchLang, viewOn } from '../support/page.mjs';

/* global DAYS -- the trip data, read inside the page */

const scrollY = (page) => page.evaluate(() => window.scrollY);
const box = (page, sel) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().toJSON());
// a length the page sets in CSS, resolved to px by a throwaway element (the contract is CSS, never a script's measure)
const cssPx = (page, value) =>
	page.evaluate((v) => {
		const p = document.createElement('div');
		p.style.cssText = `position:fixed;visibility:hidden;height:${v}`;
		document.body.append(p);
		const h = p.getBoundingClientRect().height;
		p.remove();
		return h;
	}, value);

test('below 1024 px the bar holds Today, Days, Map and More; a desktop has none', async ({ page }) => {
	await openTrip(page);
	const bar = page.locator(BAR.bar);
	if (!(await hasBar(page))) {
		await expect(bar).toBeHidden();
		expect(await cssPx(page, 'var(--chrome-bottom)'), 'no bar, no room kept for it').toBe(0);
		await expect(page.locator('#rail')).toBeVisible();
		return;
	}
	// the map is there when the trip has one (a trip without positions draws no map view)
	const hasMap = (await page.locator('#app > #map[data-sec]').count()) > 0;
	const items = await page.locator(BAR.item).evaluateAll((es) => es.map((e) => e.dataset.tb));
	expect(items).toEqual(hasMap ? ['top', 'days', 'map', 'more'] : ['top', 'days', 'more']);
	await expect(page.locator(`${BAR.item} .tb-l`)).toHaveText(hasMap ? ['Today', 'Days', 'Map', 'More'] : ['Today', 'Days', 'More']);
	await expect(page.locator('#rail')).toBeHidden();
	await expect(page.locator('#tocBtn'), 'the floating Sections button gives way to the bar').toBeHidden();
	// big enough to hit while walking, the whole width shared out
	for (const b of await page.locator(BAR.item).all()) {
		const r = await b.boundingBox();
		expect(r.height).toBeGreaterThanOrEqual(52);
		expect(r.width).toBeGreaterThanOrEqual(52);
	}
	// it sits on the screen's foot, and --chrome-bottom is exactly what it takes
	const r = await box(page, BAR.bar);
	expect(Math.abs(r.bottom - page.viewportSize().height)).toBeLessThan(1);
	expect(Math.abs((await cssPx(page, 'var(--chrome-bottom)')) - r.height)).toBeLessThan(1);
	// Today is lit on the first view, with today's date on its calendar
	await expect(page.locator(BAR.lit)).toHaveAttribute('data-tb', 'top');
	await expect(page.locator(`${BAR.today} .tb-num`)).toHaveText(/^\d{1,2}$/);
	// both languages, and nothing runs wider than the screen
	await switchLang(page, 'zh');
	await expect(page.locator(`${BAR.item} .tb-l`)).toHaveText(hasMap ? ['今天', '日程', '地图', '更多'] : ['今天', '日程', '更多']);
	expect(await overflow(page)).toEqual([]);
	const wide = await page.locator(BAR.item).evaluateAll((es) => es.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
	expect(wide, 'every label fits its item').toBe(0);
});

test('Days lists every day with its date, weekday and title, today marked, and opens the one picked', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await hasBar(page)), "a desktop's rail lists the days");
	const days = await page.evaluate(() => DAYS.map((d) => ({ id: d.id, date: d.date, title: d.title[1] })));
	const pick = days[Math.min(2, days.length - 1)];
	await setStored(page, { now: `${pick.date} 10:00` });
	await page.locator(BAR.days).click();
	const sheet = page.locator(BAR.daysSheet);
	await expect(sheet).toBeVisible();
	const rows = page.locator(BAR.dayRow);
	await expect(rows).toHaveCount(days.length);
	for (let i = 0; i < days.length; i++) {
		const row = rows.nth(i);
		await expect(row).toHaveAttribute('href', `#${days[i].id}`);
		await expect(row).toContainText(days[i].title);
		await expect(row).toContainText(`Day ${i + 1}`);
		// the short date, a weekday with it, and the whole date for a screen reader
		await expect(row.locator('.dtag')).toContainText(String(+days[i].date.slice(8)));
		await expect(row.locator('.dtag')).toContainText(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
		expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(52);
	}
	await expect(page.locator(`#days [data-day="${pick.id}"] .flag`), 'today is marked').toHaveText('Today');
	await expect(page.locator('#days .flag')).toHaveCount(1);
	// it once waited 30 s for this row to hold still on webkit-390 (about 1 in 160 runs): if it does again, the report
	// shows what moved
	await clickOrExplain(page.locator(`#days [data-day="${pick.id}"]`));
	await expect(sheet).toBeHidden();
	await expect(page.locator('html')).toHaveAttribute('data-showing', pick.id);
	await expect(page.locator(BAR.lit)).toHaveAttribute('data-tb', 'days');
	// the day on screen is lit in the list the next time
	await page.locator(BAR.days).click();
	await expect(page.locator(`#days [data-day="${pick.id}"]`)).toHaveAttribute('aria-current', 'page');
});

test('More opens the planning sections and the settings, and a section from it opens its view', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await hasBar(page)), "a desktop's Sections button holds them");
	await page.locator(BAR.more).click();
	const toc = page.locator('#toc');
	await expect(toc).toBeVisible();
	await expect(toc.locator('h2')).toHaveText('More');
	// every section but the map (it's in the bar) and the days (Days has them), each with its icon
	const secs = await page
		.locator('#rail .rl[href]')
		.evaluateAll((as) =>
			as
				.map((a) => a.getAttribute('href').slice(1))
				.filter((id) => id !== 'top' && id !== 'map' && !document.getElementById(id).classList.contains('day')),
		);
	expect(secs.length).toBeGreaterThan(0);
	for (const id of secs) await expect(toc.locator(`a.toc-sec[href="#${id}"] svg.i`), `#${id} in More`).toHaveCount(1);
	await expect(toc.locator('a[href="#map"]')).toHaveCount(0);
	// the settings: the theme, which maps app, and the rest the trip has
	const settings = toc.locator('.toc-set');
	await expect(settings).toBeVisible();
	await expect(settings.locator('[data-maps-cycle]')).toBeVisible();
	if (page.viewportSize().width < 600) await expect(settings.locator('[data-theme-cycle]')).toBeVisible();
	// the settings rows share one shape: the full width, no browser-default border, one weight
	const rows = await settings.locator(':is([data-theme-cycle], [data-maps-cycle], [data-sky-toggle]):visible').evaluateAll((bs) =>
		bs.map((b) => {
			const st = getComputedStyle(b);
			return { k: b.className, w: b.getBoundingClientRect().width, border: st.borderTopWidth, weight: st.fontWeight };
		}),
	);
	const full = await settings.evaluate((e) => e.clientWidth);
	expect(rows.length).toBeGreaterThan(0);
	for (const r of rows) {
		expect(r.w, `${r.k} spans the row`).toBeGreaterThanOrEqual(full - 1);
		expect(r.border, `${r.k} has no default border`).toBe('0px');
		expect(r.weight, `${r.k} has the rows' weight`).toBe(rows[0].weight);
	}
	// the food section's entry reads as its heading, and the near-me action is named apart from it
	if (await page.locator('#eat .sec-title').count()) {
		const eat = (await page.locator('#eat .sec-title').first().textContent()).trim();
		await expect(toc.locator('a.toc-sec[href="#eat"]')).toHaveText(eat);
		expect((await toc.locator('.toc-near[data-near]:not(.wc)').textContent()).trim()).not.toBe(eat);
	}
	const from = await viewOn(page);
	await toc.locator(`a[href="#${secs[0]}"]`).click();
	await expect(toc).toBeHidden();
	await expect(page.locator('html')).toHaveAttribute('data-showing', secs[0]);
	await expect(page.locator(BAR.lit)).toHaveAttribute('data-tb', 'more');
	await page.goBack();
	await expect(page.locator('html')).toHaveAttribute('data-showing', from);
});

test('Back after a bar tap returns to the view and the place the reader left', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await hasBar(page)), 'the bar is a phone and tablet layout');
	const day = await page.evaluate(() => DAYS[0].id);
	await goToView(page, day);
	for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown');
	await settle(page);
	const y = await scrollY(page);
	expect(y, 'the day is long enough to scroll').toBeGreaterThan(100);
	await page.locator(BAR.today).click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
	expect(new URL(page.url()).hash).toBe('#top');
	expect(await scrollY(page), 'Today opens at its top').toBeLessThan(2);
	await page.goBack();
	await expect(page.locator('html')).toHaveAttribute('data-showing', day);
	await expect.poll(async () => Math.abs((await scrollY(page)) - y), { message: 'back at the place' }).toBeLessThan(30);
	await expect(page.locator(BAR.lit)).toHaveAttribute('data-tb', 'days');
	// the map, then Back
	if (await page.locator(BAR.map).count()) {
		await page.locator(BAR.map).click();
		await expect(page.locator('html')).toHaveAttribute('data-showing', 'map');
		await expect(page.locator(BAR.lit)).toHaveAttribute('data-tb', 'map');
		await page.goBack();
		await expect(page.locator('html')).toHaveAttribute('data-showing', day);
	}
	// a sheet from the bar is a step of its own: Back closes it and stays in the view
	await page.locator(BAR.more).click();
	await expect(page.locator('#toc')).toBeVisible();
	await page.goBack();
	await expect(page.locator('#toc')).toBeHidden();
	await expect(page.locator('html')).toHaveAttribute('data-showing', day);
});

test('nothing at the bottom overlaps the bar, and every sheet opens over it', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await hasBar(page)), 'the bar is a phone and tablet layout');
	const barTop = (await box(page, BAR.bar)).top;
	// the toast, plain and with its Undo, and the Back pill, each where it rests while shown
	await page.evaluate(() => {
		const t = document.getElementById('toast');
		t.textContent = 'A note long enough to reach across most of the phone';
		t.dataset.state = 'open';
	});
	await expect.poll(async () => (await box(page, '#toast')).bottom).toBeLessThanOrEqual(barTop);
	await page.evaluate(() =>
		document.getElementById('toast').insertAdjacentHTML('beforeend', '<button type="button" class="toast-act">Undo</button>'),
	);
	await expect.poll(async () => (await box(page, '#toast')).bottom).toBeLessThanOrEqual(barTop);
	await page.evaluate(() => (document.getElementById('backPill').dataset.show = '1'));
	await expect.poll(async () => (await box(page, '#backPill')).bottom).toBeLessThanOrEqual(barTop);
	// with the pill up, the toast rises above it rather than covering the way back
	await expect.poll(async () => (await box(page, '#toast')).bottom).toBeLessThanOrEqual((await box(page, '#backPill')).top);
	await page.evaluate(() => {
		document.getElementById('toast').dataset.state = 'closed';
		document.getElementById('backPill').dataset.show = '0';
	});
	// the full-screen map ends where the bar begins, so its controls sit above it
	if (await page.locator('#mapstage').count()) {
		const r = await page.evaluate(() => {
			const st = document.getElementById('mapstage');
			st.classList.add('is-full');
			const b = st.getBoundingClientRect().bottom;
			st.classList.remove('is-full');
			return b;
		});
		expect(r).toBeLessThanOrEqual(barTop + 0.5);
	}
	// a sheet opens over the bar: its last line is the sheet's, not the bar's
	for (const open of [BAR.days, BAR.more]) {
		await page.locator(open).click();
		const d = page.locator('dialog[open]');
		await expect(d).toBeVisible();
		const hit = await d.evaluate((dlg) => {
			const r = dlg.getBoundingClientRect();
			const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.bottom, innerHeight) - 4);
			return !!el && dlg.contains(el);
		});
		expect(hit, `${open}'s sheet is on top of the bar`).toBe(true);
		await page.keyboard.press('Escape');
		await expect(d).toHaveCount(0);
	}
	// a view's last row scrolls clear of the bar and of the Back pill above it
	const day = await page.evaluate(() => DAYS[0].id);
	await goToView(page, day);
	await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
	await settle(page);
	const pager = await box(page, `#${day} .pager`);
	expect(pager.bottom, "the day's previous / next buttons clear the bar and the pill").toBeLessThanOrEqual(barTop - 52 - 12);
});

test('the header keeps no date strip and no Pause below 1024 px, and search still opens and closes', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await hasBar(page)), 'the bar is a phone and tablet layout');
	await expect(page.locator('#skyBtn')).toBeHidden();
	await expect(page.locator('#bar .tabs, #bar .tab')).toHaveCount(0);
	// the header is one row until search opens; then the search row takes its place
	const h = (await box(page, '#bar')).height;
	expect(h).toBeLessThan(70);
	await expect(page.locator('#search-row')).toBeHidden();
	await page.locator('#searchBtn').click();
	await expect(page.locator('#search-row')).toBeVisible();
	await expect(page.locator('#bar-main')).toBeHidden();
	await page.locator('#searchClose').click();
	await expect(page.locator('#search-row')).toBeHidden();
	await expect(page.locator('#bar-main')).toBeVisible();
});
