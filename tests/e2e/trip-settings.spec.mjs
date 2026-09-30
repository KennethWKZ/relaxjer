// Dates and names on the page come from the trip file, not the engine. The legacy engine hard-coded the first trip's
// (these started as test.fail() debt markers and pass since roadmap step 3). New engine debt goes here the same way:
// a test.fail(true, reason) that states the behaviour we want.
import { test, expect, openTrip } from '../support/fixtures.mjs';

// tagged @demo: the expected dates are the demo trip's
test.describe('trip settings', { tag: '@demo' }, () => {
	test('the header dates come from the trip', async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('#brand-dates')).toHaveText('13–19 Mar');
	});

	test("the after-midnight flight shows the trip's own date", async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('#d6 .stop', { hasText: 'Flight departs' }).locator('.stop-t')).toContainText('19 Mar');
	});

	test("the going-home heading uses the trip's own date", async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('#depart')).toContainText('18 Mar');
	});
});
