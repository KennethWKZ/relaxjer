// The native layer (ADR-20261117-native-layer): when the trip's country pack names a local language the group doesn't
// read, each stop and place shows its local words under its name, one tap copies them. A trip without it shows none.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails, show, switchLang } from '../support/page.mjs';
/* global DAYS, PLACES -- the trip data, read inside the page */

test('the demo (Taiwan) has no native layer: nothing new under its stops @demo', async ({ page }) => {
	await openTrip(page);
	await expect(page.locator('.mlink.native')).toHaveCount(0);
	await expect(page.locator('.stop-native')).toHaveCount(0);
});

test('the native layer: local words under each named stop, in their language, one tap to copy', async ({ page }) => {
	await openTrip(page);
	const chips = page.locator('.stop .mlink.native');
	test.skip((await page.locator('.mlink.native').count()) === 0, "this trip's pack has no native layer");

	// every stop whose place has a local spelling (or that has its own) shows it, and nothing else does
	const want = await page.evaluate(() =>
		DAYS.flatMap((d) => d.schedule.map((it) => it.native || (it.place && PLACES[it.place] && PLACES[it.place].trad) || '')).filter(Boolean),
	);
	await expect(chips).toHaveCount(want.length);

	const first = chips.first();
	await show(page, first); // its stop's sheet
	const lang = await first.locator('.nat-t').getAttribute('lang');
	expect(lang, 'the words carry their language, so the right glyphs and voice are used').toMatch(/^[a-z]{2,3}(-|$)/);
	const words = (await first.locator('.nat-t').textContent()).trim();
	expect(want).toContain(words);
	const box = await first.boundingBox();
	expect(box.height, '44 px target').toBeGreaterThanOrEqual(44);
	await expect(first, 'the button says what it copies, in the page language').toHaveAccessibleName(
		new RegExp(words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
	);

	// tap: the local words, and only them, go to the clipboard, and a toast says so (in both page languages)
	for (const l of ['zh', 'en']) {
		if (await page.locator('dialog.bsheet[open]').count()) await page.keyboard.press('Escape'); // the stop's sheet covers the header
		await expect(page.locator('dialog.bsheet[open]')).toHaveCount(0);
		await switchLang(page, l);
		await page.evaluate(() => {
			window.__copied = [];
			Object.defineProperty(navigator, 'clipboard', {
				configurable: true,
				value: { writeText: (t) => (window.__copied.push(t), Promise.resolve()) },
			});
		});
		const chip = page.locator('.stop .mlink.native').first();
		await show(page, chip);
		await chip.click();
		await expect.poll(() => page.evaluate(() => window.__copied)).toEqual([words]);
		await expect(page.locator('#toast')).toContainText(words);
	}
});

test('the native layer fits a phone: no chip runs past its card', async ({ page }) => {
	await openTrip(page);
	test.skip((await page.locator('.mlink.native').count()) === 0, "this trip's pack has no native layer");
	await openAllDetails(page); // every view and every stop's sheet drawn, at a sheet's width
	const over = await page.evaluate(() =>
		[...document.querySelectorAll('.mlink.native')]
			.filter((b) => b.offsetParent)
			.filter((b) => {
				const r = b.getBoundingClientRect();
				const card = b.closest('.bsheet-body, .stop-b, .block, article, li') || document.body;
				return r.right > card.getBoundingClientRect().right + 1;
			})
			.map((b) => b.textContent.trim()),
	);
	expect(over).toEqual([]);
});
