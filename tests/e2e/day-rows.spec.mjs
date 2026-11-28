// A day as one row, the same in the week on Today, Days, the rail and the map's list (ADR-20261128-progressive-disclosure):
// its short name (days[].short, else the first place of its route and how many), the seal beside its date when it holds
// a fixed time, and its forecast on the right only while the day is inside the forecast. Any trip; one @demo test.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';
import { shortFromTitle } from '../../engine/src/core/plan.mjs';
/* global DAYS */

const week = '#top .week .wk';

test("each day's row in the week says its short name, or the first place of its route and how many", async ({ page }) => {
	await openTrip(page);
	const { days, en } = await page.evaluate(() => ({
		days: DAYS.map((d) => ({ short: d.short, title: d.title })),
		en: document.documentElement.lang.startsWith('en'),
	}));
	const L = (t) => (en ? t[1] : t[0]);
	const want = days.map((d) => (d.short ? L(d.short) : shortFromTitle(L(d.title), en ? 'en' : 'zh')));
	await show(page, week);
	await expect(page.locator(`${week} .wk-title`)).toHaveText(want);
	// one line each, the name giving way to an ellipsis rather than a second line
	const lines = await page.locator(`${week} .wk-title`).evaluateAll((ts) => ts.map((t) => getComputedStyle(t).whiteSpace));
	expect(lines.every((w) => w === 'nowrap')).toBe(true);
});

test('the demo writes short names, and a day without one reads its first place and how many', { tag: '@demo' }, async ({ page }) => {
	await openTrip(page);
	await show(page, week);
	await expect(page.locator(`${week} .wk-title`).nth(1)).toHaveText('Old town walk');
	await expect(page.locator(`${week} .wk-title`).nth(4), 'Day 5 has no short name').toHaveText('Maokong Gondola +1 more');
});

test('a day with a fixed time, and only such a day, has the seal beside its date', async ({ page }) => {
	await openTrip(page);
	const fixed = await page.evaluate(() => DAYS.map((d) => d.schedule.some((it) => it.fixed)));
	await show(page, week);
	const seals = await page.locator(week).evaluateAll((rows) => rows.map((r) => r.querySelectorAll('.wk-date .day-seal').length));
	expect(seals).toEqual(fixed.map((f) => (f ? 1 : 0)));
	if (fixed.some(Boolean)) await expect(page.locator(`${week} .day-seal`).first()).toHaveAttribute('aria-label', /fixed time/);
});

test("a day's forecast shows on its row only inside the forecast", async ({ page }) => {
	await openTrip(page);
	const first = await page.evaluate(() => DAYS[0].date);
	// a forecast that covers the first day only, as the refresh writes once a trip comes inside the 16 days
	await page.addInitScript((d) => {
		// any spot the trip or the day names reads the same forecast
		const day = new Proxy({}, { get: () => ({ tmin: -6, tmax: -3, rain: 60, mm: 2, code: 73 }) });
		let fc = { checked: d, days: { [d]: day } };
		Object.defineProperty(window, 'FORECAST', {
			configurable: true,
			get: () => fc,
			set: (v) => {
				if (v && v.days && Object.keys(v.days).length) fc = v;
			},
		});
	}, first);
	await page.reload();
	await show(page, week);
	const wx = await page.locator(week).evaluateAll((rows) => rows.map((r) => r.querySelectorAll('.day-wx').length));
	expect(wx[0], 'the first day, inside the forecast').toBe(1);
	expect(
		wx.slice(1).every((n) => n === 0),
		'the others show nothing',
	).toBe(true);
	const first0 = page.locator(`${week} .day-wx`).first();
	await expect(first0).toHaveText('-3°');
	await expect(first0).toHaveAttribute('aria-label', /forecast: .+, high -3°/);
});
