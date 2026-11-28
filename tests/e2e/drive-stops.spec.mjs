// Rest stops along a long drive (drive-stops.json, ADR-20261128-drive-stops): folded under the row the group is in
// while it drives, shut until tapped, in order along the way, each with how far in, its kind and its hours that day.
// Reference only: nothing is planned or timed from them. On the day, while the drive is under way, the one ahead by the
// clock is marked Next. The first test runs on any trip that has the file; the Sapporo demo's drive to the zoo is @demo.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openStop } from '../support/page.mjs';
/* global TRIP, DAYS */

/** the rows (ids) that carry a drive's rest stops, in page order */
const driveRows = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll('.stop-dstops')].map((b) => b.closest('li.stop').id))]);

/** opens a row's drive fold and returns it with its rows */
async function openFold(page, sid, i = 0) {
	const row = await openStop(page, sid);
	const box = row.locator('.stop-dstops').nth(i);
	const tog = box.locator('.sn-tog');
	await tog.scrollIntoViewIfNeeded();
	await expect(tog, 'shut until asked for').toHaveAttribute('aria-expanded', 'false');
	await expect(box.locator('.drv-list')).toBeHidden();
	await tog.click();
	await expect(tog).toHaveAttribute('aria-expanded', 'true');
	await expect(box.locator('.drv-list')).toBeVisible();
	return { box, tog, rows: box.locator('.drv-stop') };
}

test("a long drive's rest stops fold under the row it drives in: shut until tapped, in order, how far in, for reference only", async ({ page }) => {
	await openTrip(page);
	const ids = await driveRows(page);
	test.skip(!ids.length, 'this trip has no long drive with rest stops (drive-stops.json)');
	const times = await page.locator('#app .stop-t').allTextContents();
	const { box, tog, rows } = await openFold(page, ids[0]);
	const n = await rows.count();
	expect(n).toBeGreaterThan(0);
	await expect(tog).toContainText(`${n} stop${n > 1 ? 's' : ''} on the way`);
	const mins = await rows.evaluateAll((rs) => rs.map((r) => +r.dataset.min));
	expect(mins, 'in order along the way').toEqual([...mins].sort((a, b) => a - b));
	for (const r of await rows.all()) {
		await expect(r.locator('.spot-m')).toContainText(/≈ .+ · [\d.]+\skm in/);
		await expect(r.locator('.drv-k')).toHaveText(/^(Service area|Parking area|Roadside station|Fuel|Convenience store)$/);
		await expect(r.locator('.spot-a a'), 'directions there, in the phone’s maps app').toHaveAttribute(
			'href',
			/(google\.com\/maps\/dir\/|maps\.apple\.com\/).*-?\d+\.\d+%2C-?\d+\.\d+/,
		);
	}
	await expect(box).toContainText('For reference, not part of the plan');
	expect(await page.locator('#app .stop-t').allTextContents(), 'no time in the plan moved').toEqual(times);
	expect((await tog.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test.describe("the Sapporo demo's drive to the zoo", { tag: '@demo' }, () => {
	test.skip(!!(process.env.TRIP_DIR || process.env.LEGACY_ENGINE_DIR), 'the Sapporo demo, on this engine');
	test.use({ tripNow: null }); // its own clock, set below on the drive's own (moved) date

	/** opens the Sapporo demo at a time on Day 5 (the live demo moves its dates into this year: read the moved one) */
	async function atDay5(page, hhmm) {
		await page.goto('/trip-demo-sapporo.html');
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
		await page.evaluate((t) => {
			const key = TRIP.storageKey || `rj.${TRIP.start}.`;
			localStorage.setItem(`${key}now`, JSON.stringify(`${DAYS.find((d) => d.id === 'd5').date} ${t}`));
			localStorage.setItem(`${key}lang`, JSON.stringify('en'));
		}, hhmm);
		await page.reload();
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	}

	test('under way, the stop ahead by the clock is marked Next, once; before it sets off and on the way back, none', async ({ page }) => {
		await atDay5(page, '09:20'); // set off at 08:30: 50 minutes gone
		expect(await driveRows(page)).toEqual(['d5-s1', 'd5-s4']); // the row it leaves in, each way
		const { box, tog, rows } = await openFold(page, 'd5-s1');
		await expect(tog).toContainText('5 stops on the way');
		await expect(tog).toContainText('2 open 24 h');
		await expect(rows).toHaveCount(5);
		await expect(box.locator('.drv-stop.is-next')).toHaveCount(1);
		await expect(rows.nth(2)).toHaveClass(/is-next/); // 74 min in: the first still ahead of 50
		await expect(rows.nth(2).locator('.drv-flag')).toHaveText('Next');
		await expect(rows.nth(1).locator('.drv-24')).toHaveCount(0);
		await expect(rows.nth(0).locator('.drv-24')).toHaveText('Open 24 h');
		await expect(box.locator('.drv-winter'), 'a February in Sapporo: which are open 24 h').toContainText('Open 24 h');
		await expect(box).toContainText('“Next” is guessed from the time since setting off');
		const back = await openFold(page, 'd5-s4');
		await expect(back.box.locator('.drv-stop.is-next'), 'the way back is not under way').toHaveCount(0);
	});

	test('before the drive sets off nothing is marked, and the plan keeps its times', async ({ page }) => {
		await atDay5(page, '08:00');
		const { box } = await openFold(page, 'd5-s1');
		await expect(box.locator('.drv-stop.is-next')).toHaveCount(0);
		await expect(page.locator('#d5-s2 .stop-t')).toContainText('10:45');
	});
});
