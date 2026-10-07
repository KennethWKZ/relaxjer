// A day that splits (DAYS[].split, trip-format.md): part of the group's own plan hangs, folded, on the string where it
// forks, with its go / wait / skip rule, a switch between its plans (remembered on the phone), each plan's docks,
// directions and route, and a note on the stop where they come back.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { settle, setStored } from '../support/page.mjs';
/* global DAYS */

const card = (page) => page.locator('#d5-split details.split-card');
// opens the day at #d5 and waits for its smooth scroll to stop: a tap while it's still moving can miss on a slow phone
const openDay = async (page) => {
	await openTrip(page, '#d5');
	await settle(page);
};
// unfolds the split card, and makes sure it took
const unfold = async (page) => {
	await expect(async () => {
		if (!(await card(page).evaluate((d) => d.open))) await card(page).locator('summary').click();
		await expect(card(page)).toHaveAttribute('open', '', { timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
};

// tagged @demo: the demo's Day 5 split, its times and its plans
test.describe('a day that splits', { tag: '@demo' }, () => {
	test('it hangs where it forks, folded on the default plan, and each rejoin stop says so', async ({ page }) => {
		await openTrip(page, '#d5');
		const order = await page.locator('#d5 .sched > li.stop').evaluateAll((ls) => ls.map((l) => l.id));
		expect(order.indexOf('d5-split'), 'after the gondola, before the rest at 14:30').toBe(order.indexOf('d5-s2') + 1);
		await expect(card(page)).not.toHaveAttribute('open', '');
		await expect(card(page).locator('[data-split-sum]')).toHaveText('Long · ≈16 km · back ≈16:20');
		await expect(page.locator('#d5-s4 .split-back')).toHaveText('Rejoining here: One of us (Short)');
		await expect(page.locator('#d5-s5 .split-back')).toHaveText('Rejoining here: One of us (Long)');
		await expect(page.locator('#d3 .split-back'), 'only the day that splits').toHaveCount(0);
	});

	test('open, it shows the rule and the default plan; the switch shows another, and the phone remembers it', async ({ page }) => {
		await openDay(page);
		const c = card(page);
		await unfold(page);
		await expect(c.locator('.decide .opt')).toHaveCount(3);
		const long = c.locator('[data-split-opt="long"]');
		await expect(long).toBeVisible();
		await expect(c.locator('[data-split-opt="short"]')).toBeHidden();
		await expect(long.locator('.warn')).toContainText('Head back by 16:00');
		await expect(long.locator('.split-alt')).toContainText('Demo dock D');
		// live counts are asked for when it opens; the tests are offline, so it says it can't tell
		await expect(long.locator('.yb-live').first()).toHaveText(/unavailable|bikes to rent/);
		const dir = long.locator('a[href*="google.com/maps/dir"]');
		await expect(dir).toHaveAttribute('href', /travelmode=bicycling/);
		await expect(dir).toHaveAttribute('href', /waypoints=/);

		await c.locator('[data-split-pick="d5|short"]').click();
		await expect(c.locator('[data-split-pick="d5|short"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(c.locator('[data-split-pick="d5|long"]')).toHaveAttribute('aria-pressed', 'false');
		await expect(c.locator('[data-split-opt="short"]')).toBeVisible();
		await expect(long).toBeHidden();
		await expect(c.locator('[data-split-sum]')).toHaveText('Short · ≈8 km · back ≈15:30');
		await page.reload();
		await expect(card(page).locator('[data-split-sum]'), 'remembered on this phone').toHaveText('Short · ≈8 km · back ≈15:30');
	});

	test('a plan with a route opens the map full screen', async ({ page }) => {
		await openDay(page);
		await unfold(page);
		await card(page).locator('[data-split-opt="long"] [data-split-map]').click();
		await expect(page.locator('html')).toHaveClass(/map-full-on/);
	});
});

// A push-back moved the stops around the fork but not the fork itself, and the rejoin stop lost its "Rejoining here"
// note (it was looked up by its new time): on any trip, a day that splits follows a push-back from its first stop.
test('a push-back moves the fork and the rejoin with the stops, and the plans keep their own times', async ({ page }) => {
	await openTrip(page);
	const c = await page.evaluate(() => {
		const d = DAYS.find((x) => x.split);
		if (!d) return null;
		const tm = (t) => {
			const m = /(\d{1,2}):(\d\d)/.exec(String(t || ''));
			return m ? +m[1] * 60 + +m[2] : null;
		};
		const rows = d.schedule.map((it, i) => ({ i, s: tm(Array.isArray(it.t) ? it.t[0] : it.t), fixed: !!it.fixed }));
		const from = rows.find((r) => r.s != null && !r.fixed);
		const held = (s) => rows.some((r) => r.fixed && r.s != null && r.s > from.s && r.s <= s); // a fixed stop on the way holds the push
		const at = tm(d.split.at);
		const o = d.split.options.find((x) => x.default) || d.split.options[0]; // the plan the card shows
		const join = rows.find((r) => r.s === tm(o.join));
		const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
		return {
			id: d.id,
			date: d.date,
			from: from.s,
			forkMoves: at >= from.s && !held(at),
			fork: hm(at + 30),
			joinI: join && join.i,
			joinMoves: join && !held(join.s),
			join: join && hm(join.s + 30),
			toEnd: !rows.some((r) => r.fixed && r.s > from.s),
		};
	});
	test.skip(!c, 'this trip has no day that splits');
	const shift = {};
	shift[c.date] = [{ from: c.from, min: 30 }];
	await setStored(page, { shift });
	if (c.forkMoves) await expect(page.locator(`#${c.id}-split .stop-t`)).toContainText(c.fork);
	// the day's banner says where the push ends: at the next fixed stop, or the end of the day
	if (c.toEnd) await expect(page.locator(`#${c.id} .shift-bar`)).toContainText(/to the end of the day|一直到当天结束/);
	if (c.joinI != null) {
		await expect(page.locator(`#${c.id}-s${c.joinI} .split-back`), 'the rejoin stop still says so').toHaveCount(1);
		if (c.joinMoves) await expect(page.locator(`#${c.id}-split .split-opt:not([hidden])`)).toContainText(c.join);
	}
});

// From the pre-departure pass: on a split day after the fork, the Now card only showed "Next", with nothing about the
// part of the group on its own plan
test('between the fork and the rejoin, the Now card says where the others are', async ({ page }) => {
	await openTrip(page);
	const c = await page.evaluate(() => {
		const d = DAYS.find((x) => x.split);
		if (!d) return null;
		const tm = (t) => {
			const m = /(\d{1,2}):(\d\d)/.exec(String(t || ''));
			return m ? +m[1] * 60 + +m[2] : null;
		};
		const o = d.split.options.find((x) => x.default) || d.split.options[0];
		const at = tm(d.split.at) + 10;
		const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
		return at < tm(o.join) ? { id: d.id, now: `${d.date} ${hm(at)}` } : null;
	});
	test.skip(!c, 'this trip has no day that splits');
	await setStored(page, { now: c.now });
	await expect(page.locator(`#now a[href="#${c.id}-split"]`)).toBeVisible();
});

// a plan with no distance or return time showed "Name · " with a stray dot
test('no split summary ends in a stray dot', async ({ page }) => {
	await openTrip(page);
	const sums = await page.locator('[data-split-sum]').allTextContents();
	test.skip(!sums.length, 'this trip has no day that splits');
	for (const t of sums) expect(t.trim()).not.toMatch(/·$/);
});
