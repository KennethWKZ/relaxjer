// Nothing sticks out sideways and no text is squeezed into a sliver, in both languages, with every list open.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails, overflow, splitWords, squeezed, switchLang } from '../support/page.mjs';

for (const lang of ['en', 'zh']) {
	test(`no sideways overflow or squeezed text (${lang})`, async ({ page }) => {
		await openTrip(page);
		if (lang === 'zh') await switchLang(page, 'zh');
		expect(await overflow(page), 'closed lists').toEqual([]);
		await openAllDetails(page);
		expect(await overflow(page), 'every list open').toEqual([]);
		expect(await squeezed(page)).toEqual([]);
	});
}

// an airport tile's three facts sit side by side in narrow cells: a long word ("Manageable") or a range ("60–75 min")
// used to split mid-word at 390 px and on desktop, where the tiles go two across
for (const lang of ['en', 'zh']) {
	test(`the airport tiles keep every word and range whole (${lang})`, async ({ page }) => {
		await openTrip(page);
		if (lang === 'zh') await switchLang(page, 'zh');
		const cells = page.locator('.method-grid');
		await cells.first().scrollIntoViewIfNeeded(); // Chromium lays out a section only near the screen
		await expect.poll(() => cells.first().innerText()).not.toBe('');
		expect(await splitWords(page, '.mg dd')).toEqual([]);
	});
}

// before the script fills the page, the empty page holds a screen's height: the first paint shows the bar, not the
// footer the trip would push away a moment later
test('the empty page holds the screen, so the footer never shows before the trip', async ({ page }) => {
	await openTrip(page);
	const held = await page.evaluate(() => {
		const app = document.getElementById('app');
		const kids = [...app.childNodes];
		app.replaceChildren();
		const h = app.getBoundingClientRect().height;
		app.replaceChildren(...kids);
		return h >= innerHeight - 1;
	});
	expect(held).toBe(true);
});
