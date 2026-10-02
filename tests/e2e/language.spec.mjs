// Switching language redraws the page but keeps the reader where they were, the tab's title and the header's name follow it,
// and the choice is remembered.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { readingSpot, scrollBy, settle, switchLang } from '../support/page.mjs';
/* global TRIP -- the trip data, read inside the page */

for (const tab of ['d3', 'airport', 'wish', 'budget']) {
	test(`language switch keeps the reader in #${tab}`, async ({ page }) => {
		await openTrip(page);
		await page.locator(`.tab[href="#${tab}"]`).first().click();
		await settle(page);
		await scrollBy(page, 400);
		const before = await readingSpot(page);
		expect(before.sec).toBeTruthy();
		await switchLang(page, 'zh');
		expect((await readingSpot(page)).sec).toBe(before.sec);
		await switchLang(page, 'en');
		expect((await readingSpot(page)).sec).toBe(before.sec);
	});
}

test("the tab's title and the header's name follow the language", async ({ page }) => {
	await openTrip(page);
	const trip = await page.evaluate(() => ({ brand: TRIP.brand, en: (TRIP.name || [])[1] || TRIP.brand, year: TRIP.start.slice(0, 4) }));
	await switchLang(page, 'en');
	await expect(page).toHaveTitle(`${trip.en} ${trip.year}`);
	await expect(page.locator('a.brand'), 'the brush mark stays, named in English').toHaveAccessibleName(trip.en);
	await expect(page.locator('a.brand .brand-name')).toHaveText(trip.brand);
	await switchLang(page, 'zh');
	await expect(page).toHaveTitle(`${trip.brand} ${trip.year}`);
	await expect(page.locator('a.brand')).toHaveAccessibleName(trip.brand);
});

test('the chosen language survives a reload @demo', async ({ page }) => {
	await openTrip(page);
	await switchLang(page, 'zh');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
	await expect(page.locator('#d1')).toContainText('士林夜市');
});
