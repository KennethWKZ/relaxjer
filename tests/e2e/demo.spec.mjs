// The live demo (pages.yml → /relaxjer/demo/): the demo trip built with its clock set, so a visitor lands on a day under
// way rather than on a countdown. Global setup builds trip-demo.html the way the workflow does, with the workflow's
// clock. And a page with no Google key, like the demo, never offers a Google search it could only fail.
import { test, expect, openTrip } from '../support/fixtures.mjs';

test.describe('the live demo', { tag: '@demo' }, () => {
	test.skip(!!(process.env.TRIP_DIR || process.env.LEGACY_ENGINE_DIR), 'the live demo is the demo trip, on this engine');
	test.use({ tripNow: null }); // no test clock: the page runs on its own demo clock

	test('opens on Day 3 with a stop under way, not on a countdown', async ({ page }) => {
		await page.goto('/trip-demo.html');
		await expect(page.locator('#app [data-sec]').first()).toBeAttached();
		await expect(page.locator('#d3 .stop.now')).toContainText('Xinbeitou');
		await expect(page.locator('.now-day')).toHaveText('Day 3');
		await expect(page.locator('.now-num'), 'no "days to go" countdown on a day under way').toHaveCount(0);
	});
});

test('a page without a Google key offers no Google search when adding a stop', async ({ page }) => {
	await openTrip(page);
	await page.locator('[data-add-gap]').first().click();
	const sheet = page.locator('#placeSheet');
	await sheet.locator('[data-addq]').fill('zzqx nowhere');
	await expect(sheet.locator('[data-add-res]')).toContainText("The page doesn't have this place.");
	await expect(sheet.locator('[data-add-g]')).toHaveCount(0);
});
