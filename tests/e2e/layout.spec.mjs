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

// a price, time or date range used to break after its dash ("NT$110–" over "150"), in lists, hours lines and tables,
// and a phone number at a hyphen ("Tel 02-" over "2579-5880")
for (const lang of ['en', 'zh']) {
	test(`no number range or phone number splits across lines (${lang})`, async ({ page }) => {
		await openTrip(page);
		if (lang === 'zh') await switchLang(page, 'zh');
		await openAllDetails(page);
		// Chromium leaves sections far off screen undrawn, and their text has no lines to measure
		await page.evaluate(() => document.querySelectorAll('#app > section').forEach((s) => (s.style.contentVisibility = 'visible')));
		// a stop's time column stacks its range on purpose ("10:45–" over "14:30"), and a photo credit's file name may break
		const ranges = await splitWords(page, '#app', '.stop-t, .credits', true);
		expect(ranges).toEqual([]);
	});
}

// trips carry a phone number in a place's Tel line, the demo none (its contract): a made-up one in the page's own Tel
// span, in a line too narrow for it (notes go through keepRanges, which tests/unit/core.test.mjs covers)
test('a Tel number in a narrow line stays whole', async ({ page }) => {
	await openTrip(page);
	await page.evaluate(() => {
		const p = document.createElement('p');
		p.id = 'phone-probe';
		p.className = 'xsmall';
		p.style.width = '6rem';
		p.innerHTML = 'Hours 10:00 · Tel <span class="sel">00-1111-1111</span>';
		document.getElementById('app').prepend(p);
	});
	expect(await splitWords(page, '#phone-probe')).toEqual([]);
});

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
