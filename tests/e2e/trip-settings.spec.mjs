// Dates and names on the page come from the trip file, not the engine. The legacy engine hard-coded the first trip's
// (these started as test.fail() debt markers and pass since roadmap step 3). New engine debt goes here the same way:
// a test.fail(true, reason) that states the behaviour we want.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { setStored } from '../support/page.mjs';

/* global DAYS, FLIGHTS -- the trip data, read inside the page */

// tagged @demo: the expected dates are the demo trip's
test.describe('trip settings', { tag: '@demo' }, () => {
	test('the header dates come from the trip', async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('#brand-dates')).toHaveText('13–19 Mar');
	});

	test("the after-midnight flight shows the trip's own date", async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('#d6 .stop', { hasText: 'Flight departs' }).locator('.stop-t')).toContainText('19 Mar');
	});

	test("the going-home heading uses the trip's own date", async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('#depart')).toContainText('18 Mar');
	});
});

// any trip, any length: the day roles come from the data (Plan.dayRoles), not from ids d1…d7
test('the airport evening sits on the day the group leaves, with the take-off date', async ({ page }) => {
	await openTrip(page);
	const r = await page.evaluate(() => {
		const early = +FLIGHTS.ret.dep.slice(0, 2) < 12;
		const eve = early ? new Date(Date.parse(FLIGHTS.ret.date) - 864e5).toISOString().slice(0, 10) : FLIGHTS.ret.date;
		const leave = (DAYS.find((d) => d.date === eve) || DAYS.at(-1)).id;
		const flight = early ? (DAYS.find((d) => d.date === FLIGHTS.ret.date && d.id !== leave) || {}).id : null;
		return { leave, flight, day: +FLIGHTS.ret.date.slice(8), early };
	});
	const budget = page.locator(`#${r.leave} #leave-budget`);
	await expect(budget, `the airport evening is on ${r.leave}`).toHaveCount(1);
	await expect(page.locator('#leave-budget'), 'and only there').toHaveCount(1);
	if (r.early) await expect(budget.locator('.leave-line li').last()).toContainText(`(${r.day}`); // "Take-off (19th)"
	if (r.flight) await expect(page.locator(`#${r.flight} .add-stop`), 'no stops to add on the flight-only day').toHaveCount(0);
	await expect(page.locator(`#${r.leave} .add-stop`), 'the airport evening can take added stops').toHaveCount(1);
});

test("the shop list shows the free-time day's own opening hours", async ({ page }) => {
	await openTrip(page);
	const dow = await page.evaluate(() => {
		const early = +FLIGHTS.ret.dep.slice(0, 2) < 12;
		const eve = early ? new Date(Date.parse(FLIGHTS.ret.date) - 864e5).toISOString().slice(0, 10) : FLIGHTS.ret.date;
		return (DAYS.find((d) => d.freeFrom) || DAYS.find((d) => d.date === eve) || DAYS.at(-1)).dow[1];
	});
	const rows = page.locator('#free-shops .idea-m');
	test.skip((await rows.count()) === 0, 'this trip lists no shops');
	for (const t of await rows.allTextContents())
		if (/\d{1,2}:\d{2}|24 h|closed/.test(t)) expect(t, 'hours are for the free-time day').toContain(` ${dow} `);
});

test("before the trip, the card names the first night's hotel", async ({ page }) => {
	await openTrip(page);
	// the day before this trip starts, whatever trip it is
	const start = await page.evaluate(() => TRIP.start);
	await setStored(page, { now: `${new Date(Date.parse(start) - 864e5).toISOString().slice(0, 10)} 09:00` });
	const name = await page.evaluate(() => {
		/* global PLACES, TRIP */
		return PLACES[DAYS[0].hotel || TRIP.hotel || 'hotel'].name[1];
	});
	await expect(page.locator('#now')).toContainText(name);
});
