// The live demo (pages.yml → /relaxjer/demo/): the demo trip built with its clock set, so a visitor lands on a day under
// way rather than on a countdown. Global setup builds trip-demo.html the way the workflow does, with the workflow's
// clock, and in each visitor's own year. And a page with no Google key, like the demo, never offers a Google search it could only fail.
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

	// the demo's data is one March; a visitor sees it in their own year, moved by whole weeks so each weekday holds
	for (const [today, year, day3] of [
		['2028-06-01T09:00:00+08:00', '2028', 'Mon 13 Mar'],
		['2031-01-15T09:00:00+08:00', '2031', 'Mon 17 Mar'],
	]) {
		test(`a visitor in ${year} sees the trip in ${year}, every weekday where it was`, async ({ page }) => {
			await page.clock.setFixedTime(new Date(today));
			await page.goto('/trip-demo.html');
			await expect(page.locator('#app [data-sec]').first()).toBeAttached();
			await expect(page).toHaveTitle(new RegExp(` ${year}$`));
			await expect(page.locator('.now-day')).toHaveText('Day 3');
			await expect(page.locator('#now')).toContainText(day3);
			await expect(page.locator('#d3 .stop.now')).toContainText('Xinbeitou');
			expect(await page.locator('body').innerText(), 'no date left behind in the data’s own year').not.toContain('2027');
		});
	}

	test.describe('on a first visit', () => {
		test.use({ tripLang: null }); // nothing stored: the page picks its own language

		test('greets the visitor in English, says it is a demo, and never asks where they are', async ({ page }) => {
			await page.goto('/trip-demo.html');
			await expect(page.locator('#app [data-sec]').first()).toBeAttached();
			await expect(page.locator('html'), 'a visitor from the English landing page reads English').toHaveAttribute('lang', 'en');
			await expect(page.locator('#demoStrip')).toContainText('Demo trip');
			await expect(page.locator('#demoStrip').getByRole('link', { name: 'Back to RelaxJer' })).toHaveAttribute('href', '../');
			// the visitor isn't on the trip: where they are can't tell the group's progress
			await expect(page.locator('#now .geo-ask')).toHaveCount(0);
			await expect(page.locator('[data-late-loc]')).toHaveCount(0);
		});
	});
});

test.describe('a trip page that is not the live demo', () => {
	test.use({ tripLang: null });

	test('opens in Chinese, with no demo strip', async ({ page }) => {
		await openTrip(page);
		await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
		await expect(page.locator('#demoStrip')).toHaveCount(0);
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
