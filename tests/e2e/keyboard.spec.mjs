// The phone keyboard's Enter key on every field the page types into: it acts and lets go of the field, so a phone puts
// its keyboard away and what the field found shows; and while a Chinese or Japanese input method is still composing,
// its Enter picks the characters and the page leaves it alone (isComposing, or Safari's keyCode 229 as composition ends).
// Playwright has no on-screen keyboard: "lets go" is asserted as the field losing focus. The map's own search is in
// map-search.spec; the group-sync name fields in sync.spec. Trip-agnostic.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';
/* global DAYS */

/** an Enter that an input method still holds: the browser says so, or (Safari, as composition ends) keyCode 229 */
const composingEnter = (loc) =>
	loc.evaluate((el) => {
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }));
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }));
	});

test('the page search: Enter jumps to the first find and puts the keyboard away; a composing Enter does neither', async ({ page }) => {
	await openTrip(page);
	await page.locator('#searchBtn').click();
	const q = page.locator('#q');
	// a stop of the first day, as navigation.spec finds one (the first .stop-name in the page may be a drawn-later day)
	const first = await page.evaluate(() => DAYS[0].id);
	const name = (await page.locator(`#${first}-s0 .stop-name`).textContent()).trim().slice(0, 6);
	await q.fill(name);
	await expect(page.locator('#results-inner .result[data-hit]').first()).toBeVisible();
	const before = await page.evaluate(() => scrollY);
	await composingEnter(q);
	await expect(q, 'the input method keeps its Enter').toBeFocused();
	expect(await page.evaluate(() => scrollY), 'and nothing jumps').toBe(before);
	await q.press('Enter');
	await expect(q, 'Enter lets go of the field').not.toBeFocused();
});

test('the add sheet’s place search: Enter puts the keyboard away and leaves the results; a composing Enter keeps it', async ({
	page,
	browserName,
}) => {
	await openTrip(page);
	const gap = await show(page, '[data-add-gap]');
	// WebKit under load can stop drawing frames, and a click then waits on "stable" forever (frontend.md): press it
	if (browserName === 'webkit') await gap.press('Enter');
	else await gap.click();
	const sheet = page.locator('#placeSheet');
	const q = sheet.locator('[data-addq]');
	const first = await page.evaluate(() => DAYS[0].id);
	const name = (await page.locator(`#${first}-s0 .stop-name`).textContent()).trim().slice(0, 4);
	await q.fill(name);
	await expect(sheet.locator('[data-add-res]')).toBeVisible();
	await composingEnter(q);
	await expect(q, 'the input method keeps its Enter').toBeFocused();
	await q.press('Enter');
	await expect(q, 'Enter lets go of the field').not.toBeFocused();
	await expect(sheet.locator('[data-add-res]'), 'the results stay').toBeVisible();
	await expect(sheet).toHaveAttribute('open', '');
});
