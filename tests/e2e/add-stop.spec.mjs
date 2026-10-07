// Your own stops: "+" under a timeline dot, clash warnings near fixed times, and share links that others can import.
// The #add= link format is a contract: links already sent to a group chat must keep working after the refactor.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { settle, setStored } from '../support/page.mjs';
/* global DAYS, FLIGHTS */

// tagged @demo: day ids, gaps and times are the demo trip's
test.describe('your own stops', { tag: '@demo' }, () => {
	test.beforeEach(({ page }) => page.on('dialog', (d) => d.accept()));

	test('"+" after a stop offers nearby places and adds the pick in time order', async ({ page }) => {
		await openTrip(page);
		await page.locator('[data-add-gap="d2|4"]').click(); // after Huashan, 14:00–16:30
		const sheet = page.locator('#placeSheet');
		const pick = sheet.locator('[data-add-res] [data-add]').first();
		await expect(pick).toBeVisible();
		await pick.click();
		await expect(sheet.locator('[data-add-day][aria-pressed="true"]')).toHaveAttribute('data-add-day', 'd2');
		// Huashan ends 16:30; the suggestion is when the group can get to the pick from there
		await expect(sheet.locator('[data-add-t]')).toHaveValue(/^16:(3|4|5)\d$/);
		await expect(sheet.locator('[data-add-leg] .ok-note')).toContainText('Works');
		await sheet.locator('[data-add-save]').click();
		const mine = page.locator('#d2 .stop.mine');
		await expect(mine).toHaveCount(1);
		await expect(mine.locator('.mine-tag')).toHaveText('Added');
		await expect(page.locator('#d2 [data-mine-share]'), 'without group sync, a link is how stops travel').toBeVisible();
		// sits between the 14:00 stop and the 17:00 stop
		const order = await page.locator('#d2 .sched > li.stop').evaluateAll((ls) => ls.map((l) => (l.classList.contains('mine') ? 'mine' : l.id)));
		expect(order.indexOf('mine')).toBe(order.indexOf('d2-s4') + 1);
	});

	// the pre-departure pass measured Change and ✕ at 39 × 44 px, Change as a bare clock on phones, and the pink of
	// "Add to plan" and "Added" at 2.7:1 in dark mode
	test("an added stop's Change and Remove are full targets, Change says so, and the pink reads at night", async ({ page }) => {
		await openTrip(page);
		await setStored(page, { theme: 'dark' }); // the page's own theme switch, not the system's
		await page.locator('[data-add-gap="d2|4"]').click();
		const sheet = page.locator('#placeSheet');
		await expect(sheet.locator('[data-add-res] [data-add]').first()).toHaveCSS('color', 'rgb(241, 154, 184)');
		await sheet.locator('[data-add-res] [data-add]').first().click();
		await sheet.locator('[data-add-save]').click();
		const mine = page.locator('#d2 .stop.mine');
		await expect(mine.locator('.mine-tag')).toHaveCSS('color', 'rgb(241, 154, 184)');
		await expect(mine.locator('[data-mine-edit]')).toContainText('Change');
		await expect(mine.locator('[data-mine-edit] span')).toBeVisible();
		for (const b of ['[data-mine-edit]', '[data-mine-del]']) {
			const box = await mine.locator(b).boundingBox();
			expect(box.width, b).toBeGreaterThanOrEqual(44);
			expect(box.height, b).toBeGreaterThanOrEqual(44);
		}
	});

	test('with the phone keyboard up, the sheet sits above it and the field being typed in shows', async ({ page }) => {
		await openTrip(page);
		await page.locator('[data-add-gap="d2|4"]').click();
		const sheet = page.locator('#placeSheet');
		await sheet.locator('[data-add-res] [data-add]').first().click();
		const field = sheet.locator('[data-add-t]');
		await field.focus();
		// an iPhone keyboard: the lower 340 px of what you see, and the page itself doesn't shrink
		const keyboard = (px) =>
			page.evaluate((px) => {
				const vv = window.visualViewport;
				delete vv.height;
				if (px) {
					const h = vv.height - px;
					Object.defineProperty(vv, 'height', { configurable: true, get: () => h });
				}
				vv.dispatchEvent(new Event('resize'));
				return vv.height;
			}, px);
		const visible = await keyboard(340);
		await expect(page.locator('html')).toHaveClass(/kb-up/);
		const box = await sheet.boundingBox();
		expect(box.y, 'the sheet’s top stays on screen').toBeGreaterThanOrEqual(0);
		expect(box.y + box.height, 'the sheet ends where the keyboard starts').toBeLessThanOrEqual(visible + 1);
		const f = await field.boundingBox();
		expect(f.y + f.height, 'the time being typed shows above the keyboard').toBeLessThanOrEqual(visible + 1);
		expect(f.y).toBeGreaterThanOrEqual(box.y);
		await keyboard(0);
		await expect(page.locator('html')).not.toHaveClass(/kb-up/);
	});

	test('adding a stop close to a fixed time warns before saving', async ({ page }) => {
		await openTrip(page);
		await page.locator('[data-add-gap="d5|4"]').click();
		const sheet = page.locator('#placeSheet');
		await sheet.locator('[data-add-res] [data-add]').first().click();
		await sheet.locator('[data-add-t]').fill('19:00');
		await sheet.locator('[data-add-t]').dispatchEvent('input');
		await expect(sheet.locator('[data-add-clash]')).toContainText('19:10');
	});

	test('a share link adds the shared stops on another phone', async ({ page }) => {
		const pack = [['d3', '16:00', 'Demo Shared Stop', 25.1366, 121.5069, '', 'Beitou (demo)']];
		const b64u = Buffer.from(JSON.stringify(pack)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		await openTrip(page, `#add=${b64u}`);
		const sheet = page.locator('#placeSheet');
		await expect(sheet).toContainText('1 shared stops');
		await sheet.locator('[data-mine-import]').click();
		await settle(page);
		await expect(page.locator('#d3 .stop.mine')).toContainText('Demo Shared Stop');
		await page.reload();
		await expect(page.locator('#d3 .stop.mine'), 'kept on this phone').toContainText('Demo Shared Stop');
	});

	test('the add sheet checks the time against getting there, and offers the soonest that works', async ({ page }) => {
		await openTrip(page);
		await page.locator('[data-add-gap="d2|4"]').click(); // after Huashan, 14:00–16:30
		const sheet = page.locator('#placeSheet');
		await sheet.locator('[data-add-res] [data-add]').last().click(); // the farthest of the nearby picks
		const leg = sheet.locator('[data-add-leg]');
		await expect(leg.locator('.leg-line').first(), 'from the stop before').toContainText('From');
		await expect(leg.locator('.ok-note'), 'the suggested time works').toContainText('Works');
		await sheet.locator('[data-add-t]').fill('16:30'); // the moment Huashan ends: no time to get there
		await sheet.locator('[data-add-t]').dispatchEvent('input');
		await expect(leg.locator('.warn', { hasText: 'Too early' })).toBeVisible();
		const use = leg.locator('[data-add-use-time]');
		const soonest = await use.getAttribute('data-add-use-time');
		await use.click();
		await expect(sheet.locator('[data-add-t]')).toHaveValue(soonest);
		await expect(leg.locator('.ok-note')).toContainText('Works');
	});

	test('a day with many added stops gets a word before one more', async ({ page }) => {
		const pack = [1, 2, 3, 4].map((i) => ['d2', `1${i}:00`, `Demo Busy ${i}`, 25.04 + i / 1000, 121.53, '', '']);
		await openTrip(page, `#add=${Buffer.from(JSON.stringify(pack)).toString('base64url')}`);
		await page.locator('#placeSheet [data-mine-import]').click();
		await settle(page);
		await page.locator('[data-add-gap="d2|4"]').click();
		const sheet = page.locator('#placeSheet');
		await sheet.locator('[data-add-res] [data-add]').first().click();
		await expect(sheet.locator('[data-add-clash] .crowd-note')).toContainText('already has 4 added stops');
		await sheet.locator('[data-add-day="d3"]').click();
		await expect(sheet.locator('[data-add-clash] .crowd-note'), 'another day is fine').toHaveCount(0);
	});

	test('removing an added stop can be undone from the toast', async ({ page }) => {
		const pack = [['d3', '16:00', 'Demo Undo Stop', 25.1366, 121.5069, '', '']];
		await openTrip(page, `#add=${Buffer.from(JSON.stringify(pack)).toString('base64url')}`);
		await page.locator('#placeSheet [data-mine-import]').click();
		await settle(page);
		await page.locator('#d3 .stop.mine [data-mine-del]').click();
		await expect(page.locator('#d3 .stop.mine')).toHaveCount(0);
		const undo = page.locator('#toast [data-toast-act]');
		await expect(undo).toHaveText('Undo');
		await undo.click();
		await expect(page.locator('#d3 .stop.mine')).toContainText('Demo Undo Stop');
		await page.reload();
		await expect(page.locator('#d3 .stop.mine'), 'back for good').toContainText('Demo Undo Stop');
	});
});

// From the pre-departure pass: a time already past today got no word, and on the leaving day the sheet offered
// "Use 19:40" after the group had to leave for the airport, with the going-home deadline hidden behind a fixed-time note.
test('the add sheet says a time has passed, and on the leaving day offers nothing after the group must leave', async ({ page }) => {
	await openTrip(page);
	const t = await page.evaluate(() => {
		// the leaving day, as Plan.dayRoles reads it: the evening before an after-midnight take-off, else the flight's day
		const [h, m] = String(FLIGHTS.ret.dep).split(':').map(Number);
		const eve = h * 60 + m < 720 ? new Date(Date.parse(FLIGHTS.ret.date) - 864e5).toISOString().slice(0, 10) : FLIGHTS.ret.date;
		return { day: DAYS[1], leave: DAYS.find((d) => d.date === eve) || DAYS[DAYS.length - 1] };
	});
	const pick = async (dayId, time) => {
		await page.locator(`[data-add-gap^="${dayId}|"]:visible`).last().click(); // stops already past are folded away
		const sheet = page.locator('#placeSheet');
		await sheet.locator('[data-add-res] [data-add]').first().click();
		await sheet.locator('[data-add-t]').fill(time);
		await sheet.locator('[data-add-t]').dispatchEvent('change');
		return sheet;
	};
	await setStored(page, { now: `${t.day.date} 15:00` });
	let sheet = await pick(t.day.id, '09:00');
	await expect(sheet.locator('[data-add-leg]')).toContainText(/That time has passed|这个时间已经过了/);
	await page.keyboard.press('Escape');
	await setStored(page, { now: `${t.leave.date} 10:00` });
	sheet = await pick(t.leave.id, '23:30');
	await expect(sheet.locator('[data-add-clash]')).toContainText(/Too late: leave here by|太晚了：这里最晚/);
	const by = await sheet.locator('[data-add-clash]').textContent();
	const deadline = /(\d{2}):(\d{2})/.exec(by);
	for (const b of await sheet.locator('[data-add-use-time]').all()) {
		const [h, m] = (await b.getAttribute('data-add-use-time')).split(':').map(Number);
		expect(h * 60 + m, 'never offered after the time to leave').toBeLessThanOrEqual(+deadline[1] * 60 + +deadline[2]);
	}
});
