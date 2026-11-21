// The figures can lead with the group's home currency: the header's currency button (beside the language button, naming
// the currency it switches to) and the Sections menu make the same choice, kept on the phone. Every figure in the trip's
// currency then shows converted, its original beside or under it, at a rate the phone can change and reset. Any trip
// with a home currency of its own; a trip without one has no button.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import * as Money from '../../engine/src/core/money.mjs';
import { curBtn, openSections, overflow, tripAmounts } from '../support/page.mjs';
import { STORE_KEY } from '../support/store-key.mjs';
/* global TRIP -- the trip data, read inside the page */

const currency = (page) => page.evaluate(() => TRIP.currency);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cvNums = async (el) => (await el.getAttribute('data-cv')).split(',').map(Number);

test('the currency button shows every figure in the home currency and back, and the phone keeps the choice', async ({ page }) => {
	await openTrip(page);
	const cur = await currency(page);
	if (!Money.canSwitch(cur)) {
		await expect(curBtn(page), 'no home currency of its own: no button').toBeHidden();
		return;
	}
	const btn = curBtn(page);
	await expect(btn, 'it names the currency it switches to').toHaveText(cur.home);
	await expect(btn).toHaveAccessibleName(new RegExp(`Show amounts in ${reEsc(cur.home)}`));
	const before = await tripAmounts(page);
	expect(before.length, 'the page shows figures in the trip currency').toBeGreaterThan(0);
	await expect(page.locator('#app .cv')).toHaveCount(0);

	await btn.click();
	await expect(btn, 'and now the way back').toHaveText(cur.sym);
	await expect(btn).toHaveAccessibleName(new RegExp(`Show amounts in ${reEsc(cur.sym)}`));
	await expect(page.locator('#app .cv').first()).toBeAttached();
	expect(await tripAmounts(page), 'every figure in the trip currency shows in the home currency').toEqual([]);
	expect((await tripAmounts(page, true)).length, 'the originals stay beside or under them').toBeGreaterThan(0);
	// a converted figure is the home currency at the trip's rate, and says it's rough
	const cv = page.locator('#app .cv').first();
	const [a, b] = await cvNums(cv);
	await expect(cv).toHaveText(Money.homeAmount(a, b, cur.rate, cur.home));
	if (await page.locator('#app .total .amt').count())
		expect(await page.locator('#app .total .amt').first().textContent(), 'a total leads with the home currency').toMatch(
			new RegExp(`^[^\\d]*${reEsc(cur.home)} \\d`),
		);

	await page.reload();
	await expect(btn, 'kept on this phone').toHaveText(cur.sym);
	expect(await tripAmounts(page)).toEqual([]);

	await btn.click();
	await expect(btn).toHaveText(cur.home);
	await expect(page.locator('#app .cv')).toHaveCount(0);
	expect((await tripAmounts(page)).length, 'every figure back in the trip currency').toBe(before.length);
});

test("the rate is one value in the budget and the Sections menu: figures follow it as it's typed, it's kept, and the trip's rate comes back", async ({
	page,
}) => {
	await openTrip(page);
	const cur = await currency(page);
	test.skip(!Money.canSwitch(cur), 'this trip has no home currency of its own');
	const r1 = +(cur.rate * 2).toFixed(2);
	const r2 = +(cur.rate / 2).toFixed(2);

	// trip currency first: the home-currency lines follow the budget's field
	const rm = page.locator('#app [data-rm]').first();
	const [a, b] = (await rm.getAttribute('data-rm')).split(',').map(Number);
	await page.locator('#rate').fill(String(r1));
	await expect(rm).toHaveText(Money.homeText(a, b, r1, cur.home));

	// home currency first: so do the converted figures
	await curBtn(page).click();
	const cv = page.locator('#app .cv').first();
	const [c, d] = await cvNums(cv);
	await expect(cv).toHaveText(Money.homeAmount(c, d, r1, cur.home));

	// the Sections menu holds the same rate
	await openSections(page);
	const field = page.locator('#toc-rate');
	await expect(field).toHaveValue(String(r1));
	await field.fill(String(r2));
	await expect(cv).toHaveText(Money.homeAmount(c, d, r2, cur.home));
	// an unusable rate is flagged and changes nothing
	await field.fill('0');
	await expect(field).toHaveAttribute('aria-invalid', 'true');
	await expect(cv).toHaveText(Money.homeAmount(c, d, r2, cur.home));
	await field.fill(String(r2));
	await expect(field).toHaveAttribute('aria-invalid', 'false');

	// kept on this phone, in both fields
	await page.reload();
	await expect(page.locator('#rate')).toHaveValue(String(r2));
	await expect(page.locator('#app .cv').first()).toHaveText(Money.homeAmount(c, d, r2, cur.home));

	// "use the trip's rate": the phone forgets its own, so a republished rate would reach it too
	await openSections(page);
	await expect(page.locator('#toc .toc-cur'), "the trip's rate shows").toContainText(`= ${cur.sym}${cur.rate}`);
	const reset = page.locator('#toc [data-rate-reset]');
	await expect(reset).toBeVisible();
	await reset.click();
	await expect(reset, 'nothing left to reset').toBeHidden();
	await expect(page.locator('#toc-rate')).toHaveValue(String(cur.rate));
	await expect(page.locator('#rate')).toHaveValue(String(cur.rate));
	await expect(page.locator('#app .cv').first()).toHaveText(Money.homeAmount(c, d, cur.rate, cur.home));
	expect(await page.evaluate((k) => localStorage.getItem(`${k}rate`), STORE_KEY)).toBeNull();
});

test('the Sections menu makes the same choice as the header button, its pressed side filled and ticked [16]', async ({ page }) => {
	await openTrip(page);
	const cur = await currency(page);
	test.skip(!Money.canSwitch(cur), 'this trip has no home currency of its own');
	await openSections(page);
	const side = (k) => page.locator(`#toc .toc-cur [data-amounts="${k}"]`);
	await expect(side('trip')).toHaveAttribute('aria-pressed', 'true');
	await expect(side('home')).toHaveAttribute('aria-pressed', 'false');
	await side('home').click();
	await expect(side('home')).toHaveAttribute('aria-pressed', 'true');
	await expect(side('trip')).toHaveAttribute('aria-pressed', 'false');
	await expect(side('home'), 'focus stays on the choice').toBeFocused();
	await expect(curBtn(page), 'the header button follows').toHaveText(cur.sym);
	expect(await tripAmounts(page)).toEqual([]);
	// two cues: the pressed side's fill differs, and it carries a tick the other doesn't
	const fill = (k) => side(k).evaluate((e) => getComputedStyle(e).backgroundColor);
	expect(await fill('home')).not.toBe(await fill('trip'));
	await expect(side('home').locator('svg.i')).toHaveCount(1);
	await expect(side('trip').locator('svg.i')).toHaveCount(0);
	// every control in the block is a 44 px target
	for (const el of await page.locator('#toc .toc-cur :is(button, input):visible').all()) {
		expect((await el.boundingBox()).height, await el.evaluate((e) => e.outerHTML.slice(0, 60))).toBeGreaterThanOrEqual(44);
	}
	await side('trip').click();
	await expect(curBtn(page)).toHaveText(cur.home);
	await expect(page.locator('#app .cv')).toHaveCount(0);
});

for (const lang of ['zh', 'en']) {
	test.describe(`in ${lang}`, () => {
		test.use({ tripLang: lang });

		test('the header fits the currency button beside the language button, and the switch makes nothing run off sideways', async ({ page }) => {
			await openTrip(page);
			const cur = await currency(page);
			test.skip(!Money.canSwitch(cur), 'this trip has no home currency of its own');
			// the trip-currency page's own overflow is layout.spec's to report; here, nothing new once the figures convert
			let before = [];
			for (const mode of ['trip', 'home']) {
				if (mode === 'home') await curBtn(page).click();
				await page.waitForTimeout(300); // the press-in eases back
				const h = await page.evaluate(() => {
					const box = (e) => e.getBoundingClientRect();
					const btns = [...document.querySelectorAll('#bar-main .icon-btn')].filter((e) => box(e).width).map(box);
					const brand = document.querySelector('#bar-main .brand-name');
					return {
						row: document.querySelector('#bar-main').scrollWidth - document.querySelector('#bar-main').clientWidth,
						btns: btns.map((r) => ({ l: r.left, r: r.right, w: r.width, h: r.height })),
						brandRight: box(document.querySelector('#bar-main .brand')).right,
						brandCut: brand.scrollWidth - brand.clientWidth,
						brandLen: [...TRIP.brand].length,
						cur: document.querySelector('#curBtn').nextElementSibling.id,
					};
				});
				expect(h.row, `${mode}: the header row doesn't scroll`).toBeLessThanOrEqual(0);
				expect(h.cur, 'the currency button sits right before the language button').toBe('langBtn');
				for (const b of h.btns) expect(Math.min(b.w, b.h), `${mode}: a header button under 44 px`).toBeGreaterThanOrEqual(44);
				for (let i = 1; i < h.btns.length; i++) expect(h.btns[i].l - h.btns[i - 1].r, `${mode}: buttons 8 px apart`).toBeGreaterThanOrEqual(7.5);
				expect(h.brandRight, `${mode}: the brand stays clear of the buttons`).toBeLessThanOrEqual(h.btns[0].l);
				// the phone header was sized for a brush brand of up to six characters
				if (h.brandLen <= 6) expect(h.brandCut, `${mode}: the brand isn't cut off`).toBeLessThanOrEqual(1);
				const out = await overflow(page);
				if (mode === 'trip') before = out;
				else
					expect(
						out.filter((x) => !before.includes(x)),
						'in the home currency, nothing new sticks out sideways',
					).toEqual([]);
			}
		});
	});
}
