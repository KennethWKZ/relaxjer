// Find food near me's All tab (ADR-20261128-near-me-all): every place to eat or drink at once (the food slots and
// wishlist food of every meal, the drinks and rest spots), nearest first, the ones shut right now left out and counted,
// the wishlist's tag kept; the meal for the hour stays the first pick, and the phone remembers All once chosen. And a
// wishlist chip past a short walk says how to get there: the metro, a drive on a car day, or far. The first test runs on
// any trip; the demo's are @demo.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { fillAll, show } from '../support/page.mjs';

/** opens Find food near me from the food section and waits for its list (no location: it counts from the plan) */
async function openNearMe(page) {
	await (await show(page, '#app button[data-near=""]')).click();
	const box = page.locator('#near');
	await expect(box).toBeVisible();
	await expect(box.locator('.near-row').first().or(box.locator('.near-list:empty'))).toBeAttached({ timeout: 15_000 });
	return box;
}
const closeNear = async (page) => {
	await page.locator('#near [data-close]').first().click();
	await expect(page.locator('#near')).toBeHidden();
};
/** "350 m" / "1.2 km" → km */
const kmOf = (t) => {
	const m = t.match(/([\d.]+)\s*(km|m)\b/);
	return m ? (m[2] === 'km' ? +m[1] : +m[1] / 1000) : null;
};

test('near me has an All tab: nearest first, the closed ones counted; it opens on the meal for the hour until All is picked', async ({ page }) => {
	await openTrip(page);
	let box = await openNearMe(page);
	const meal = box.locator('[data-near-meal][aria-pressed="true"]');
	await expect(meal, 'the meal for the hour first').not.toHaveAttribute('data-near-meal', 'all');
	const all = box.locator('[data-near-meal="all"]');
	await expect(all).toHaveText('All');
	await all.click();
	await expect(all).toHaveAttribute('aria-pressed', 'true');
	await expect(box.locator('#near-h')).toHaveText('Open near me now');
	const rows = box.locator('.near-row');
	const n = await rows.count();
	if (n) {
		const ks = (await box.locator('.near-dist').allTextContents()).map(kmOf);
		expect(ks, 'nearest first').toEqual([...ks].sort((a, b) => a - b));
		for (const tag of await box.locator('.near-tag').allTextContents()) expect(tag).toBe('Wish');
	}
	const hidden = box.locator('.near-hidden');
	if (await hidden.count()) await expect(hidden).toHaveText(/^\d+ closed now and left out\.$/);
	// remembered on this phone: All again next time, and after a reload
	await closeNear(page);
	box = await openNearMe(page);
	await expect(box.locator('[data-near-meal="all"]')).toHaveAttribute('aria-pressed', 'true');
	await closeNear(page);
	await page.reload();
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	box = await openNearMe(page);
	await expect(box.locator('[data-near-meal="all"]')).toHaveAttribute('aria-pressed', 'true');
	// a meal picked: back to the meal for the hour next time
	await box.locator('[data-near-meal="lunch"]').click();
	await closeNear(page);
	box = await openNearMe(page);
	await expect(box.locator('[data-near-meal][aria-pressed="true"]')).not.toHaveAttribute('data-near-meal', 'all');
});

test.describe('near me and the wishlist chips on the demo', { tag: '@demo' }, () => {
	test.use({ tripNow: '2027-03-14 17:30' }); // Day 2, back at the hotel: near me counts from there

	test('All lists the wishlist food open now with its tag, and leaves out what is shut now', async ({ page }) => {
		await openTrip(page);
		const box = await openNearMe(page);
		await box.locator('[data-near-meal="all"]').click();
		const wish = box.locator('.near-row', { hasText: 'Demo Soup Dumplings' });
		await expect(wish).toHaveCount(1); // open 11:00–21:00, listed once though it suits lunch and dinner
		await expect(wish.locator('.near-tag')).toHaveText('Wish');
	});

	test('a wishlist chip past a short walk gives the metro from the stop’s station, and its card the station', async ({ page }) => {
		await openTrip(page);
		await fillAll(page);
		const chip = page.locator('#d2-s3-more .stop-eat .eat-chip.is-wish', { hasText: 'Demo Soup Dumplings' });
		await expect(chip.locator('.eat-r')).toHaveText(/^MRT · ≈ \d+ min$/); // from Longshan Temple's station to Zhongshan's: walks at the group's pace and a ride
		const near = page.locator('#d6-s1-more .stop-eat .eat-chip.is-wish', { hasText: 'Demo Soup Dumplings' });
		await expect(near.locator('.eat-r'), 'a short walk keeps its distance').toHaveText('1.1 km');
		await expect(page.locator('#wish-w-dumpling')).toContainText('Zhongshan');
	});
});
