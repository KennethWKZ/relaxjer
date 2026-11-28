// Skipping a planned stop (ADR-20261128-skip-planned-stops): any planned stop but a flight or the lodging has Skip when
// opened; a skipped stop folds into one "N skipped" line at the day's foot, greyed and struck through, with Put back;
// Undo on the toast brings it back; a fixed time asks once more; a skipped stop is out of Now and Next; a stop whose
// place is closed that day says so with Skip beside it; and after a skip the page only suggests moving the next stops
// earlier. Group sync's two-phone case is in sync.spec.mjs.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { fillAll, openDayMenu, openSkipFold, setStored, show, SKIP, skipStop } from '../support/page.mjs';

/* global DAYS, TRIP, AIRPORT */

/** the first planned stop that has a Skip, fixed or not, with its day, date, start minute and English name */
const pick = (page, { fixed = false, place = false } = {}) =>
	page.evaluate(
		({ fixed, place }) => {
			for (const d of DAYS)
				for (let i = 0; i < d.schedule.length; i++) {
					const it = d.schedule[i];
					const li = document.getElementById(`${d.id}-s${i}`);
					const geo = window.GEO && window.GEO.places && window.GEO.places[it.place];
					if (!li || !li.querySelector('.stop-acts [data-skip]') || !!it.fixed !== fixed || (place && !geo)) continue;
					const name = (Array.isArray(it.what) ? it.what[1] : String(it.what)).replace(/\*\*/g, '');
					return { day: d.id, date: d.date, i, sid: `${d.id}-s${i}`, s: li.dataset.s == null ? null : +li.dataset.s, name, place: it.place || '' };
				}
			return null;
		},
		{ fixed, place },
	);
const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

test.describe('skipping a planned stop', () => {
	test('Skip folds the stop into one line at the day’s foot, struck through; Undo and Put back bring it back', async ({ page }) => {
		await openTrip(page);
		const s = await pick(page);
		test.skip(!s, 'this trip has no stop to skip');
		await show(page, `#${s.sid}`);
		await page.locator(`${SKIP.onString(s.sid)} > summary`).click();
		const btn = page.locator(SKIP.act(s.sid));
		await expect(btn, 'a labelled icon, like the stop’s other actions').toContainText('Skip');
		expect((await btn.boundingBox()).height, 'a 44 px target').toBeGreaterThanOrEqual(44);
		await btn.click();

		await expect(page.locator('#toast')).toContainText(`Skipped ${s.name}`);
		await expect(page.locator(SKIP.onString(s.sid)), 'off the string').toHaveCount(0);
		await expect(page.locator(SKIP.sum(s.day))).toContainText('1 skipped');
		await expect(page.locator(`${SKIP.sum(s.day)} svg.chev`), 'a fold: a chevron that turns').toHaveCount(1);
		const row = page.locator(SKIP.row(s.sid));
		await expect(row, 'folded: shut until opened').toBeHidden();
		await page.locator('#toast [data-toast-act]').click();
		await expect(page.locator(SKIP.fold(s.day)), 'Undo: no fold').toHaveCount(0);
		await expect(page.locator(SKIP.onString(s.sid)), 'back on the string').toHaveCount(1);

		// skipped again; opened, the fold shows it greyed and struck through, with Put back
		await skipStop(page, s.sid);
		const keep = page.locator(SKIP.keep(s.day));
		if (await keep.count()) await keep.click(); // the suggestion, where there is one: not taken
		await openSkipFold(page, s.day);
		await expect(row).toBeVisible();
		await expect(row.locator('.skip-tag')).toHaveText('Skipped');
		const look = await row.locator('.stop-name').evaluate((e) => ({ line: getComputedStyle(e).textDecorationLine, ink: getComputedStyle(e).color }));
		expect(look.line).toContain('line-through');
		const nameInk = await page
			.locator(`#${s.day} .stop-x .stop-name`)
			.first()
			.evaluate((e) => getComputedStyle(e).color);
		expect(look.ink, 'greyed against the stops still on').not.toBe(nameInk);
		const back = page.locator(SKIP.back(s.sid));
		expect((await back.boundingBox()).height).toBeGreaterThanOrEqual(44);
		await back.click();
		await expect(page.locator('#toast')).toContainText(`Put back ${s.name}`);
		await expect(page.locator(SKIP.fold(s.day))).toHaveCount(0);
		await expect(page.locator(SKIP.onString(s.sid))).toHaveCount(1);
		// kept on the phone: nothing is skipped after a reload
		await page.reload();
		await expect(page.locator(SKIP.fold(s.day))).toHaveCount(0);
	});

	test('a skip is kept on the phone, found by search marked skipped, and listed struck in Days', async ({ page }) => {
		await openTrip(page);
		const s = await pick(page);
		test.skip(!s, 'this trip has no stop to skip');
		await skipStop(page, s.sid);
		await page.reload();
		await expect(page.locator(SKIP.sum(s.day)), 'still skipped after a reload').toContainText('1 skipped');
		await page.locator('#searchBtn').click();
		await page.locator('#q').fill(s.name.slice(0, 14));
		await expect(page.locator('#results-inner .result[data-hit]', { hasText: 'Skipped' }).first()).toBeVisible();
		await page.keyboard.press('Escape');
		// Days (a phone's sheet, a desktop's rail list): the stop's line is struck, with its tag
		const dd = page.locator(`a.dd-stop[href="#${s.sid}"]`);
		if (await dd.count()) {
			await expect(dd).toHaveClass(/is-skipped/);
			await expect(dd).toContainText('Skipped');
		}
	});

	test('a booked (fixed) stop asks once more before it is skipped', async ({ page }) => {
		await openTrip(page);
		const s = await pick(page, { fixed: true });
		test.skip(!s, 'this trip has no fixed stop that can be skipped');
		let asked = '';
		page.once('dialog', (d) => {
			asked = d.message();
			d.dismiss();
		});
		await skipStop(page, s.sid);
		await expect.poll(() => asked).toContain('This one is booked. Skip it anyway?');
		await expect(page.locator(SKIP.fold(s.day)), 'Cancel: nothing skipped').toHaveCount(0);
		page.once('dialog', (d) => d.accept());
		await page.locator(SKIP.act(s.sid)).click();
		await expect(page.locator(SKIP.sum(s.day))).toContainText('1 skipped');
	});

	test('flights and the lodging have no Skip; every other planned stop has one', async ({ page }) => {
		await openTrip(page);
		const r = await page.evaluate(() => {
			const hotels = new Set([TRIP.hotel || 'hotel', ...DAYS.map((d) => d.hotel).filter(Boolean)]);
			const terminals = new Set(((typeof AIRPORT !== 'undefined' && AIRPORT.terminals) || []).map((t) => t.place));
			const out = { wrong: [], missing: [], some: 0 };
			for (const d of DAYS)
				d.schedule.forEach((it, i) => {
					const li = document.getElementById(`${d.id}-s${i}`);
					if (!li) return;
					const has = !!li.querySelector('.stop-acts [data-skip]');
					const never = !!it.rel || hotels.has(it.place) || terminals.has(it.place) || it.icon === 'plane' || it.icon === 'bed';
					if (never && has) out.wrong.push(`${d.id}-s${i}`);
					// a stop that opens (has something inside) and isn't a flight or the lodging offers Skip
					if (!never && !has && li.querySelector('details.stop-x') && !d.schedule.every((x) => x.rel)) out.missing.push(`${d.id}-s${i}`);
					if (has) out.some++;
				});
			return out;
		});
		expect(r.wrong, 'a flight or the lodging with Skip').toEqual([]);
		expect(r.missing, 'a planned stop without Skip').toEqual([]);
		expect(r.some).toBeGreaterThan(0);
	});

	test('a skipped stop is neither Now nor Next', async ({ page }) => {
		await openTrip(page);
		const s = await page.evaluate(() => {
			// a timed stop with Skip that isn't its day's first timed one, so a minute before it there's a Now or a Next
			for (const d of DAYS) {
				const timed = d.schedule
					.map((it, i) => ({ it, i, li: document.getElementById(`${d.id}-s${i}`) }))
					.filter((x) => x.li && x.li.dataset.s != null);
				for (const x of timed.slice(1))
					if (x.li.querySelector('.stop-acts [data-skip]') && !x.it.fixed)
						return { day: d.id, date: d.date, sid: `${d.id}-s${x.i}`, s: +x.li.dataset.s };
			}
			return null;
		});
		test.skip(!s, 'no timed stop to skip after a day’s first');
		await setStored(page, { now: `${s.date} ${hm(Math.max(0, s.s - 5))}` });
		await expect(page.locator(`#now a[href="#${s.sid}"]`), 'five minutes before it, it’s Next').not.toHaveCount(0);
		await skipStop(page, s.sid);
		await expect(page.locator(SKIP.sum(s.day))).toContainText('1 skipped');
		await expect(page.locator(`#now a[href="#${s.sid}"]`), 'skipped: not Now or Next').toHaveCount(0);
	});

	test('a stop whose place is closed that day says so, with Skip right there', async ({ page }) => {
		await openTrip(page);
		const s = await pick(page, { place: true });
		test.skip(!s, 'no stop with a place to skip');
		// the data refresh's closed date for that place, on that stop's day (as geo.json carries it)
		await page.addInitScript(
			({ pid, date }) => {
				let g;
				Object.defineProperty(window, 'GEO', {
					configurable: true,
					get: () => g,
					set: (v) => {
						g = v;
						if (v && v.places && v.places[pid]) v.places[pid].closed_dates = [date];
					},
				});
			},
			{ pid: s.place, date: s.date },
		);
		await page.reload();
		await show(page, `#${s.sid}`);
		await expect(page.locator(SKIP.shut(s.sid)), 'before the trip: that day').toContainText('Closed that day');
		await setStored(page, { now: `${s.date} 07:00` });
		await show(page, `#${s.sid}`);
		const shut = page.locator(SKIP.shut(s.sid));
		await expect(shut).toContainText('Closed today');
		await expect(shut, 'seen without opening the stop').toBeVisible();
		await shut.locator('[data-skip]').click();
		await expect(page.locator(SKIP.sum(s.day))).toContainText('1 skipped');
	});
});

// tagged @demo: Day 3's Thermal Valley, its times and the soak after it are the demo trip's
test.describe('skipping a planned stop, on the demo', { tag: '@demo' }, () => {
	test('after a skip the page only suggests moving the next stops earlier; putting it back moves them back', async ({ page }) => {
		await openTrip(page);
		const t = (sid) => page.locator(`#${sid} > .stop-t`);
		const onRoute = page.locator('#d3 .route-line .rl-p', { hasText: 'Thermal Valley' });
		await fillAll(page);
		await expect(onRoute, 'on the day’s route before').toHaveCount(1);
		await expect(t('d3-s5')).toContainText('15:00');
		await skipStop(page, 'd3-s4');
		const ask = page.locator(SKIP.ask('d3'));
		await expect(ask, 'greyed where it was, with the question').toContainText('Thermal Valley');
		await expect(ask).toContainText('Move the next stops 90 min earlier?');
		await expect(t('d3-s5'), 'nothing moved by itself').toContainText('15:00');
		await page.locator(SKIP.pull('d3')).click();
		await expect(page.locator('#toast')).toContainText('Moved the next stops 90 min earlier');
		await expect(t('d3-s5')).toContainText('13:30');
		await expect(t('d3-s5')).toContainText('was 15:00');
		await expect(t('d3-s6'), 'the rest of the day with it').toContainText('16:30');
		await expect(page.locator('#d3 .shift-bar')).toContainText('Moved 90 min earlier');
		await expect(ask, 'asked once').toHaveCount(0);
		// the route goes round it: Thermal Valley is off the day's route line; the map's list strikes it on Day 3
		await fillAll(page);
		await expect(onRoute).toHaveCount(0);
		await expect(page.locator('#d3 .route-line'), 'the museum to the hotel, now').toContainText('hotel');
		await expect(page.locator('[data-ml="d3"] .pinbtn.is-skipped')).toHaveCount(1);

		await openSkipFold(page, 'd3');
		await page.locator(SKIP.back('d3-s4')).click();
		await expect(page.locator('#toast')).toContainText('the stops after it are back at their times');
		await expect(t('d3-s5')).toContainText('15:00');
		await expect(page.locator('#d3 .shift-bar')).toHaveCount(0);
	});

	test('a fixed time never moves for a skip: the suggestion stops before it, and none when it’s next', async ({ page }) => {
		await openTrip(page);
		// Day 5: dinner at 18:00, then the fixed 19:10 meet and 19:30 concert. Skipping dinner suggests nothing
		await skipStop(page, 'd5-s4');
		await expect(page.locator(SKIP.sum('d5'))).toContainText('1 skipped');
		await expect(page.locator(SKIP.ask('d5'))).toHaveCount(0);
		await expect(page.locator('#d5-s5 > .stop-t')).toContainText('19:10');
	});

	test('Back to the original plan puts skips back too, after asking, with Undo', async ({ page }) => {
		await openTrip(page);
		page.on('dialog', (d) => d.accept());
		await setStored(page, { skips: { [await page.evaluate(() => DAYS[2].schedule[4]._key)]: { at: 1 } } });
		await expect(page.locator(SKIP.sum('d3'))).toContainText('1 skipped');
		// rare actions live in the day's ⋯ sheet, not under the string (ADR-20261128-progressive-disclosure, amended)
		await expect(page.locator('#d3 .sched [data-reset-all], #d3 .sched [data-mine-share]'), 'nothing loud at the day’s foot').toHaveCount(0);
		const menu = await openDayMenu(page, 'd3');
		await expect(menu.locator('[data-mine-share]')).toContainText('Share my changes');
		const reset = menu.locator('[data-reset-all]');
		await expect(reset).toContainText('Back to the original plan');
		await expect(reset, 'in red, as the settings row').toHaveClass(/is-bad/);
		await reset.click();
		await expect(menu, 'the sheet closes once it’s done').toBeHidden();
		await expect(page.locator(SKIP.fold('d3'))).toHaveCount(0);
		await page.locator('#toast [data-toast-act]').click();
		await expect(page.locator(SKIP.sum('d3')), 'Undo').toContainText('1 skipped');
	});
});
