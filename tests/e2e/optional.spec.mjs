// An optional plan suggested at a stop (OPTIONAL[].near, trip-format.md): a "Nearby options" chip under that day's
// stop opens the plan's card in a sheet over the day, so nobody loses their place, with a way on to the Optional list.
// The chips fold to their count behind a chevron: closed on a phone, open on a wider screen, a tap away either way.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';

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
	await show(page, `#${w.stops[0]}`); // its day's view
	const tog = page.locator(`#${w.stops[0]} .stop-opts [data-opts]`);
	if ((await tog.getAttribute('aria-expanded')) !== 'true') await tog.click();
	await chip.click();
	const sheet = page.locator('#placeSheet');
	await expect(sheet).toBeVisible();
	await expect(sheet.locator('.hang-name')).toHaveText(await page.locator(`#${w.id} .hang-name`).textContent());
	await expect(page.locator(`#${w.stops[0]}`), 'the day stays where it was').toBeInViewport();
	expect(new URL(page.url()).hash, 'no jump to the Optional list').not.toBe(`#${w.id}`);
	await sheet.locator('.psheet-go').click();
	await expect(sheet).toBeHidden();
	await expect(page.locator('html'), 'on to the Optional view').toHaveAttribute('data-showing', 'optional');
	await expect(page.locator(`#${w.id}`), 'and its card there').toBeInViewport();
});

// any trip: the row says how many plans it holds; a phone shows only that, a wider screen the chips too, and a tap on the
// row (44 px, a chevron that turns, a fill once open) opens or closes it for this page view
test("a stop's nearby options fold to their count and open on a tap", async ({ page }) => {
	await openTrip(page);
	const stop = await page.evaluate(() => {
		const el = document.querySelector('#app .stop-opts');
		return el ? el.closest('li.stop').id : null;
	});
	test.skip(!stop, 'this trip suggests no optional plan at a stop');
	await show(page, `#${stop}`);
	const tog = page.locator(`#${stop} .stop-opts [data-opts]`);
	const list = page.locator(`#${stop} .stop-opts .sn-list`);
	const n = await list.locator('a.eat-chip').count();
	await expect(tog).toContainText(new RegExp(`^${n} nearby options?$`));
	expect((await tog.boundingBox()).height).toBeGreaterThanOrEqual(44);
	await expect(tog.locator('svg.chev')).toHaveCount(1);
	const phone = page.viewportSize().width < 600;
	await expect(tog).toHaveAttribute('aria-expanded', String(!phone));
	if (phone) await expect(list).toBeHidden();
	else await tog.click(); // a wider screen opens with them showing: close first, then open as a phone does
	await expect(tog).toHaveAttribute('aria-expanded', 'false');
	await expect(list).toBeHidden();
	const shut = await tog.evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, turn: getComputedStyle(e.querySelector('.chev')).transform }));
	await tog.click();
	await expect(tog).toHaveAttribute('aria-expanded', 'true');
	await expect(list).toBeVisible();
	await expect(list.locator('a.eat-chip').first()).toBeVisible();
	// two cues for open: the chevron turns and the row fills
	const open = await tog.evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, turn: getComputedStyle(e.querySelector('.chev')).transform }));
	expect(open.bg).not.toBe(shut.bg);
	await expect.poll(() => tog.locator('.chev').evaluate((c) => getComputedStyle(c).transform)).not.toBe(shut.turn);
	// the row's tap is the toggle's, not the stop's sheet
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	// kept for this page view: a language switch redraws the day and it stays open, a reload forgets it
	await page.locator('#langBtn').click();
	await expect(page.locator(`#${stop} .stop-opts [data-opts]`)).toHaveAttribute('aria-expanded', 'true');
	await page.locator('#langBtn').click();
	await page.reload();
	await expect(page.locator(`#${stop} .stop-opts [data-opts]`)).toHaveAttribute('aria-expanded', String(!phone));
});

// tagged @demo: the demo suggests its observatory at the Day 6 free afternoon, 1.2 km away
test('the demo suggests its observatory at one stop only, with the distance', { tag: '@demo' }, async ({ page }) => {
	await openTrip(page, '#d6');
	const row = page.locator('#d6-s2 .stop-opts');
	await expect(row.locator('.sn-h')).toHaveText('1 nearby option');
	await expect(row.locator('a.eat-chip')).toHaveText('101 Observatory 1.2 km');
	await expect(page.locator('.stop-opts'), 'only where the trip suggests it').toHaveCount(1);
});
