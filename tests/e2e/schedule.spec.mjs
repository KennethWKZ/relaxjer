// Timeline rules: fixed times never move; flight-tied times follow the flight; a push-back only suggests and stops at
// the next fixed item.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { setStored } from '../support/page.mjs';

// tagged @demo: stop ids, times and dates are the demo trip's
test.describe('timeline rules', { tag: '@demo' }, () => {
	const time = (page, stop) => page.locator(`#${stop} .stop-t`).first();

	test.beforeEach(({ page }) => page.on('dialog', (d) => d.accept()));

	// the flight editor is a <details>; the page's redraw keeps it open, so only open it when it is closed
	async function openFlightEditor(page) {
		const d = page.locator('#d1 details.flt-d');
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
		await page.locator('#d5 .shift-bar [data-shift-edit]').click();
		const sheet = page.locator('#placeSheet');
		await expect(sheet.locator('.shift-sheet')).toBeVisible();
		await sheet.locator('[data-shift-clear]').click();
		await expect(page.locator('#d5 .shift-bar')).toHaveCount(0);
		await expect(time(page, 'd5-s3')).toContainText('14:30–17:30');
		await expect(page.locator('#d5 .stop.shifted')).toHaveCount(0);
	});
});
