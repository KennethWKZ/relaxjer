// An optional plan suggested at a stop (OPTIONAL[].near, trip-format.md): a "Nearby options" chip under that day's
// stop opens the plan's card in a sheet over the day, so nobody loses their place, with a way on to the Optional list.
// They sit inside the opened stop (ADR-20261128-progressive-disclosure), under a row with their count and a chevron,
// open with the stop, a tap folds them.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openStop } from '../support/page.mjs';

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
	await openStop(page, w.stops[0]); // its day's view, the stop opened
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

// any trip: the row says how many plans it holds and opens with the stop; a tap on the row (44 px, a chevron that turns,
// a fill once open) folds or opens it for this page view
test("a stop's nearby options open with the stop and fold to their count on a tap", async ({ page }) => {
	await openTrip(page);
	const stop = await page.evaluate(() => {
		const el = document.querySelector('#app .stop-opts');
		return el ? el.closest('li.stop').id : null;
	});
	test.skip(!stop, 'this trip suggests no optional plan at a stop');
	await openStop(page, stop);
	const tog = page.locator(`#${stop} .stop-opts [data-opts]`);
	const list = page.locator(`#${stop} .stop-opts .sn-list`);
	const n = await list.locator('a.eat-chip').count();
	await expect(tog).toContainText(new RegExp(`^${n} nearby options?$`));
	expect((await tog.boundingBox()).height).toBeGreaterThanOrEqual(44);
	await expect(tog.locator('svg.chev')).toHaveCount(1);
	await expect(tog).toHaveAttribute('aria-expanded', 'true');
	await expect(list).toBeVisible();
	await tog.click(); // fold them, then open them again as a reader does
	await expect(tog).toHaveAttribute('aria-expanded', 'false');
	await expect(list).toBeHidden();
	// the colours as the reader sees them once the finger lifts: a tap leaves the row pressed (:active, Paper 3) for a
	// moment, and on CI's WebKit that pressed colour stood in for both the shut and the open one
	const offRow = () => page.mouse.move(1, 1);
	await offRow();
	// and once the fold has played out: read mid-turn (or before its first frame, under load) the chevron still points
	// the open way; a second at most, for a WebKit that stops drawing frames under load (frontend.md)
	const shut = await tog.evaluate(async (e) => {
		const chev = e.querySelector('.chev');
		getComputedStyle(chev).transform; // the fold's turn starts here, so it's among the animations below
		const played = Promise.all(e.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
		await Promise.race([played, new Promise((r) => setTimeout(r, 1000))]);
		return { bg: getComputedStyle(e).backgroundColor, turn: getComputedStyle(chev).transform };
	});
	await tog.click();
	await expect(tog).toHaveAttribute('aria-expanded', 'true');
	await expect(list).toBeVisible();
	await expect(list.locator('a.eat-chip').first()).toBeVisible();
	await offRow();
	// two cues for open: the row fills and the chevron turns
	await expect.poll(() => tog.evaluate((e) => getComputedStyle(e).backgroundColor), { message: 'the open row fills' }).not.toBe(shut.bg);
	await expect.poll(() => tog.locator('.chev').evaluate((c) => getComputedStyle(c).transform)).not.toBe(shut.turn);
	// the row's tap is the toggle's, not the stop's sheet
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	// kept for this page view: a language switch redraws the day and it stays as it was; folded, it stays folded
	await tog.click();
	await expect(tog).toHaveAttribute('aria-expanded', 'false');
	await page.locator('#langBtn').click();
	await expect(page.locator(`#${stop} .stop-opts [data-opts]`)).toHaveAttribute('aria-expanded', 'false');
	await page.locator('#langBtn').click();
	// a reload forgets the fold (it opens with the stop again) and reopens the stop the reader had open
	await page.reload();
	await expect(page.locator(`#${stop} details.stop-x`)).toHaveJSProperty('open', true);
	await expect(page.locator(`#${stop} .stop-opts [data-opts]`)).toHaveAttribute('aria-expanded', 'true');
});

// tagged @demo: the demo suggests its observatory at the Day 6 free afternoon, 1.2 km away
test('the demo suggests its observatory at one stop only, with the distance', { tag: '@demo' }, async ({ page }) => {
	await openTrip(page, '#d6');
	const row = page.locator('#d6-s2 .stop-opts');
	await expect(row.locator('.sn-h')).toHaveText('1 nearby option');
	await expect(row.locator('a.eat-chip')).toHaveText('101 Observatory 1.2 km');
	await expect(page.locator('.stop-opts'), 'only where the trip suggests it').toHaveCount(1);
});
