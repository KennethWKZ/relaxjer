// Which app the Map and Directions links open: Google Maps by default, Apple Maps when the phone picks it in the
// Sections menu. The choice is kept on the phone, and the whole-day route stays on Google (it carries every stop).
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openSections } from '../support/page.mjs';

const mapLinks = (page) =>
	page.locator('.stop-links a.mlink').evaluateAll((as) => as.map((a) => a.href).filter((h) => /maps\.apple\.com|google\.com\/maps/.test(h)));

async function pickApple(page) {
	await openSections(page); // the Sections button is there from the first screen
	const row = page.locator('[data-maps-cycle]');
	await expect(row).toContainText('Google Maps');
	await row.click();
	await expect(page.locator('[data-maps-cycle]')).toContainText('Apple Maps');
}

test('Map and Directions open Google Maps unless the phone picks Apple Maps', async ({ page }) => {
	await openTrip(page);
	const before = await mapLinks(page);
	expect(before.length, 'the plan has map links').toBeGreaterThan(0);
	expect(before.every((h) => h.startsWith('https://www.google.com/maps/'))).toBe(true);

	await pickApple(page);
	const after = await mapLinks(page);
	expect(after.length).toBe(before.length);
	expect(after.every((h) => h.startsWith('https://maps.apple.com/?'))).toBe(true);
	// directions keep their mode: Apple's dirflg (r transit, d drive, w walk)
	expect(after.filter((h) => h.includes('daddr=')).every((h) => /[?&]dirflg=[rdw]\b/.test(h))).toBe(true);
	// a trip place with a pin opens at its position, not a text search that could land on a namesake
	expect(after.some((h) => /[?&]ll=-?\d+\.\d+,-?\d+\.\d+/.test(h) || /daddr=-?\d+\.\d+%2C-?\d+\.\d+/.test(h))).toBe(true);

	// the whole-day route stays on Google: an Apple Maps link can't carry the stops in between
	const whole = page.locator('a.l-leg.all').first();
	if (await whole.count()) {
		await expect(whole).toHaveAttribute('href', /google\.com\/maps\/dir/);
		await expect(whole, 'and says so').toContainText('Google');
	}

	// kept on this phone
	await page.reload();
	await expect.poll(async () => (await mapLinks(page)).every((h) => h.startsWith('https://maps.apple.com/?'))).toBe(true);
});
