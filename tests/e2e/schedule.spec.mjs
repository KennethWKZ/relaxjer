// Timeline rules: fixed times never move; flight-tied times follow the flight; a push-back only suggests and stops at
// the next fixed item.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { fillAll, goToView, optRoute, setStored, show } from '../support/page.mjs';
/* global DAYS, GEO, SITES */

// tagged @demo: stop ids, times and dates are the demo trip's
test.describe('timeline rules', { tag: '@demo' }, () => {
	const time = (page, stop) => page.locator(`#${stop} .stop-t`).first();

	test.beforeEach(({ page }) => page.on('dialog', (d) => d.accept()));

	// the flight editor is a <details>; the page's redraw keeps it open, so only open it when it is closed
	async function openFlightEditor(page) {
		const d = page.locator('#d1 details.flt-d');
		await show(page, d); // Day 1's view
		if (!(await d.evaluate((el) => el.open))) await d.locator('summary').click();
	}

	test('a delayed landing moves the flight-tied Day 1 times, and reset restores them', async ({ page }) => {
		await openTrip(page);
		await expect(time(page, 'd1-s0')).toContainText('13:30');
		await expect(time(page, 'd1-s4')).toContainText('18:30'); // arrival + 245 min, but never before 18:30
		await openFlightEditor(page);
		await page.locator('[data-flt="arr"]').fill('15:30');
		await page.locator('[data-flt-save="arr"]').click();
		await expect(time(page, 'd1-s0')).toContainText('15:30');
		await expect(time(page, 'd1-s2')).toContainText('16:35–17:20');
		await expect(time(page, 'd1-s4')).toContainText('19:35');
		await expect(time(page, 'd2-s1'), 'other days do not move').toContainText('09:30–11:00');
		await openFlightEditor(page);
		await page.locator('[data-flt-reset="arr"]').click();
		await expect(time(page, 'd1-s0')).toContainText('13:30');
	});

	test('a push-back moves later stops only up to the next fixed time, and warns about the clash', async ({ page }) => {
		await openTrip(page);
		// Day 5, running an hour late from the 14:30 rest stop (stored the way the page stores it)
		await setStored(page, { shift: { '2027-03-17': [{ from: 14 * 60 + 30, min: 60 }] } });
		await expect(time(page, 'd5-s2'), 'earlier stops stay').toContainText('11:00–14:00');
		await expect(page.locator('#d5-s3')).toHaveClass(/shifted/);
		await expect(time(page, 'd5-s3')).toContainText('15:30–18:30');
		await expect(time(page, 'd5-s4')).toContainText('19:00');
		await expect(page.locator('#d5-s4 .warn'), 'dinner now runs into the fixed 19:10').toContainText('19:10');
		for (const fixed of ['d5-s5', 'd5-s6']) await expect(page.locator(`#${fixed}`)).not.toHaveClass(/shifted/);
		await expect(time(page, 'd5-s5')).toContainText('19:10');
		await expect(time(page, 'd5-s6')).toContainText('19:30–21:00');
		await expect(page.locator('#d5 .shift-bar')).toContainText('+60 min');
	});

	test('the push-back sheet can undo a push', async ({ page }) => {
		await openTrip(page);
		await setStored(page, { shift: { '2027-03-17': [{ from: 14 * 60 + 30, min: 30 }] } });
		await (await show(page, '#d5 .shift-bar [data-shift-edit]')).click();
		const sheet = page.locator('#placeSheet');
		await expect(sheet.locator('.shift-sheet')).toBeVisible();
		await sheet.locator('[data-shift-clear]').click();
		await expect(page.locator('#d5 .shift-bar')).toHaveCount(0);
		await expect(time(page, 'd5-s3')).toContainText('14:30–17:30');
		await expect(page.locator('#d5 .stop.shifted')).toHaveCount(0);
	});
});

// the forecast's source and check date only lived in a chip's tooltip, which a phone never shows
test('the Weather section says where the forecast comes from and when it was checked', async ({ page }) => {
	await openTrip(page);
	const has = await page.evaluate(() => !!(window.FORECAST && window.FORECAST.checked && Object.keys(window.FORECAST.days || {}).length));
	if (!has) {
		// a trip whose days are still beyond the forecast: give it one, as the refresh would
		const first = await page.evaluate(() => DAYS[0].date);
		await page.addInitScript((d) => {
			// the page sets window.FORECAST = null when it has none, or a forecast with no trip days yet: keep this one
			// unless the page brings a real forecast
			let fc = { checked: d, days: { [d]: { x: { tmin: 20, tmax: 26, rain: 30, mm: 1, code: 3 } } } };
			Object.defineProperty(window, 'FORECAST', {
				configurable: true,
				get: () => fc,
				set: (v) => {
					if (v && v.days && Object.keys(v.days).length) fc = v;
				},
			});
		}, first);
		await page.reload();
	}
	const line = page.locator('#weather [data-fc-checked]');
	await expect(line).toHaveCount(1);
	await expect(line).toContainText('Open-Meteo');
});

test("a day card's site links show, on its cards and on each option of a choice", async ({ page }) => {
	await openTrip(page);
	const want = await page.evaluate(() =>
		DAYS.flatMap((d) =>
			(d.blocks || []).flatMap((b) =>
				[...(b.sites || []), ...(b.opts || []).map((o) => o.site).filter(Boolean)].map((s) => ({ day: d.id, url: SITES[s].url })),
			),
		),
	);
	test.skip(!want.length, 'no day card on this trip links a site');
	await fillAll(page); // the day cards' sheets are built on first open
	for (const { day, url } of want) await expect(page.locator(`#${day} a[href="${url}"]`).first(), `${day}: ${url}`).toBeAttached();
});

// Google has no public-transit route in Japan (ADR-20261126-own-leg-minutes): a leg it can't time shows the minutes the
// trip gives it, and a leg with neither shows none rather than a guess
test("a route leg Google can't time shows the trip's own minutes", async ({ page }) => {
	await openTrip(page);
	const own = await page.evaluate(() => {
		const legs = (typeof GEO !== 'undefined' && GEO && GEO.legs) || {};
		for (const d of DAYS)
			for (const [i, l] of (d.route || []).entries()) {
				const min = l.slice(3).find((x) => typeof x === 'number');
				const ofDay = (k) => k.startsWith(`${d.id}:`) && /^\d+$/.test(k.slice(d.id.length + 1)); // not a decide option's '<day>:<k>:<i>'
				const stored = Object.entries(legs).some(([k, o]) => ofDay(k) && o.from === l[0] && o.to === l[1] && o.mode === l[2]);
				if (min && !stored && !legs[`${d.id}:${i}`]) return { day: d.id, i, min };
			}
		return null;
	});
	test.skip(!own, 'this trip has no leg with its own minutes and no Google time');
	await goToView(page, own.day);
	const leg = page.locator(`#${own.day}-route .rl-m`).nth(own.i);
	await expect(leg.locator('small')).toHaveText(`${own.min}′`);
	await expect(leg).toHaveAttribute('aria-label', new RegExp(`${own.min}`));
});

// a decide option's own route (ADR-20261127-decide-option-route): its card draws the day route's line, each leg with the
// time stored for the option ('<day>:<k>:<i>' in geo.json), else the trip's own minutes, a walk at the group's pace
test("a decide option's own route shows on its card with its legs' times", async ({ page }) => {
	await openTrip(page);
	const opt = await page.evaluate(() => {
		const legs = (typeof GEO !== 'undefined' && GEO && GEO.legs) || {};
		for (const d of DAYS)
			for (const b of d.blocks || [])
				for (const o of b.type === 'decide' ? b.opts : [])
					if (o.route)
						return {
							scope: `${d.id}:${o.k}`,
							legs: o.route.map((l, i) => {
								const t = legs[`${d.id}:${o.k}:${i}`];
								const google = t && t.from === l[0] && t.to === l[1] && t.mode === l[2] ? t.min : null;
								const own = l.slice(3).find((x) => typeof x === 'number') || null;
								return { mode: l[2], google, own };
							}),
						};
		return null;
	});
	test.skip(!opt, 'no decide option on this trip has its own route');
	const line = await show(page, optRoute(page, opt.scope));
	await expect(line).toBeVisible();
	await expect(line.locator('.rl-p')).toHaveCount(opt.legs.length + 1);
	const legs = line.locator('.rl-m');
	await expect(legs).toHaveCount(opt.legs.length);
	for (const [i, l] of opt.legs.entries()) {
		const small = legs.nth(i).locator('small');
		if (l.google != null && l.mode !== 'walking') await expect(small).toHaveText(`${l.google}′`);
		else if (l.google != null)
			expect(parseInt(await small.textContent(), 10)).toBeGreaterThanOrEqual(l.google); // at the group's pace
		else if (l.own) await expect(small).toHaveText(l.mode === 'walking' ? /^\d+′$/ : `${l.own}′`);
		else await expect(small).toHaveCount(0); // no time rather than a guess, or the day's
	}
	// the line sits inside the option's own card, under its name
	await expect(line.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " opt ")]')).toHaveCount(1);
});
