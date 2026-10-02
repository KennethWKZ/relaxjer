// Nothing sticks out sideways and no text is squeezed into a sliver, in both languages, with every list open.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails, overflow, squeezed, switchLang } from '../support/page.mjs';

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
