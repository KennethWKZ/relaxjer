// An optional plan suggested at a stop (OPTIONAL[].near, trip-format.md): a "Nearby options" chip under that day's
// stop opens the plan's card in a sheet over the day, so nobody loses their place, with a way on to the Optional list.
import { test, expect, openTrip } from '../support/fixtures.mjs';

/* global OPTIONAL, DAYS, GEO -- the trip data, read inside the page */

// any trip: every plan suggested at a stop is there (unless its place is shut that day) and opens its own card
test('a plan suggested at a stop shows under it and opens its card over the day', async ({ page }) => {
	await openTrip(page);
	const want = await page.evaluate(() =>
		OPTIONAL.flatMap((o) =>
			(o.near || []).map((n) => {
				const d = DAYS.find((x) => x.id === n.day);
				const g = (GEO && GEO.places && GEO.places[o.place]) || {};
				return {
					id: o.id,
					shut: (g.closed_dates || []).includes(d.date),
					stops: d.schedule.flatMap((it, i) => (it.place === n.place ? [`${d.id}-s${i}`] : [])),
				};
			}),
		),
	);
	test.skip(!want.length, 'this trip suggests no optional plan at a stop');
	for (const w of want)
		for (const s of w.stops) await expect(page.locator(`#${s} .stop-opts a[href="#${w.id}"]`), `${w.id} under ${s}`).toHaveCount(w.shut ? 0 : 1);

	const w = want.find((x) => !x.shut);
	test.skip(!w, 'every suggested plan is shut on its day');
	const chip = page.locator(`#${w.stops[0]} .stop-opts a[href="#${w.id}"]`);
	await chip.click();
	const sheet = page.locator('#placeSheet');
	await expect(sheet).toBeVisible();
	await expect(sheet.locator('.hang-name')).toHaveText(await page.locator(`#${w.id} .hang-name`).textContent());
	await expect(page.locator(`#${w.stops[0]}`), 'the day stays where it was').toBeInViewport();
	expect(new URL(page.url()).hash, 'no jump to the Optional list').not.toBe(`#${w.id}`);
	await sheet.locator('.psheet-go').click();
	await expect(sheet).toBeHidden();
	await expect(page.locator(`#${w.id}`), 'on to its card in the Optional list').toBeInViewport();
});

// tagged @demo: the demo suggests its observatory at the Day 6 free afternoon, 1.2 km away
test('the demo suggests its observatory at one stop only, with the distance', { tag: '@demo' }, async ({ page }) => {
	await openTrip(page, '#d6');
	const row = page.locator('#d6-s2 .stop-opts');
	await expect(row.locator('.sn-h')).toHaveText('Nearby options');
	await expect(row.locator('a.eat-chip')).toHaveText('101 Observatory 1.2 km');
	await expect(page.locator('.stop-opts'), 'only where the trip suggests it').toHaveCount(1);
});
