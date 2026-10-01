// Your own stops: "+" under a timeline dot, clash warnings near fixed times, and share links that others can import.
// The #add= link format is a contract: links already sent to a group chat must keep working after the refactor.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { settle } from '../support/page.mjs';

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
		await expect(sheet.locator('[data-add-t]')).toHaveValue('16:30');
		await sheet.locator('[data-add-save]').click();
		const mine = page.locator('#d2 .stop.mine');
		await expect(mine).toHaveCount(1);
		await expect(mine.locator('.mine-tag')).toHaveText('Added');
		await expect(page.locator('#d2 [data-mine-share]'), 'without group sync, a link is how stops travel').toBeVisible();
		// sits between the 14:00 stop and the 17:00 stop
		const order = await page.locator('#d2 .sched > li.stop').evaluateAll((ls) => ls.map((l) => (l.classList.contains('mine') ? 'mine' : l.id)));
		expect(order.indexOf('mine')).toBe(order.indexOf('d2-s4') + 1);
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
