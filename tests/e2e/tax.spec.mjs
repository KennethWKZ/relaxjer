// The tourist tax refund (TAX, ADR-20261128-tax-refund): a tile in Today's bookings opens its sheet: the minimum spend
// and the deadline, the shop coupons (a tap on one's barcode opens it full screen on white, sharp; one past its last day
// folds to Expired), how it works, card or cash, and the airport's places and Wi-Fi. Any trip: each test reads the
// trip's own TAX and skips what it lacks.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';
import { couponsOn } from '../../engine/src/core/tax.mjs';
/* global TAX */

const TILE = '#top [data-part="top-p-tax"]';
const SHEET = '#top-p-tax';

/** the trip's TAX and its coupons split on the page's own day (the pinned trip clock) */
async function tripTax(page) {
	const t = await page.evaluate(() => (typeof TAX === 'undefined' ? null : JSON.parse(JSON.stringify(TAX))));
	const today = await page.evaluate(() => {
		const k = Object.keys(localStorage).find((x) => /now$/.test(x));
		return k ? JSON.parse(localStorage.getItem(k)).slice(0, 10) : new Date().toISOString().slice(0, 10);
	});
	return { t, ...couponsOn(t && t.coupons, today) };
}
async function openTax(page) {
	await (await show(page, TILE)).click();
	const sh = page.locator(SHEET);
	await expect(sh).toBeVisible();
	return sh;
}

test("a Tax refund tile in Today's bookings opens its sheet: the rules, the steps, card or cash, the airport", async ({ page }) => {
	await openTrip(page);
	const { t, good } = await tripTax(page);
	test.skip(!t, 'this trip has no TAX');
	const tile = page.locator(TILE);
	await expect(tile).toContainText('Tax refund');
	if (good.length) await expect(tile.locator('.tile-n')).toHaveText(String(good.length));
	const sh = await openTax(page);
	if (t.steps) await expect(sh.locator('.tax-steps > li')).toHaveCount(t.steps.length);
	if (t.methods) await expect(sh.locator('.tier')).toHaveCount(t.methods.length);
	if (t.airport && t.airport.rows) await expect(sh.locator('.tax-place')).toHaveCount(t.airport.rows.length);
	if (t.deadline) await expect(sh.locator('.tax-lead')).toContainText(t.deadline[1]);
	if (t.airport && t.airport.wifi) {
		await expect(sh.locator('.tax-wifi code').first()).toHaveText(t.airport.wifi.ssid);
		expect((await sh.locator('.tax-copy').first().boundingBox()).height).toBeGreaterThanOrEqual(44);
	}
});

test('a coupon opens full screen on white: a landscape one turned to fill an upright phone, a tall one fitted whole; a double tap zooms; ✕, Escape and Back close it', async ({
	page,
}) => {
	await openTrip(page);
	const { good } = await tripTax(page);
	const withImg = good.find((c) => c.img);
	test.skip(!withImg, 'this trip has no coupon with an image that is still good');
	const sh = await openTax(page);
	const btn = sh.locator(`.coupon[data-coupon-id="${withImg.id}"] .coupon-img`);
	await btn.scrollIntoViewIfNeeded();
	// the coupon's own image, not the 1 px stand-in a photo shows before the page's images arrive
	await expect.poll(() => btn.locator('img').evaluate((i) => i.naturalWidth), { message: 'the coupon image is drawn' }).toBeGreaterThan(50);
	await btn.click();
	const view = page.locator('#couponView');
	const box = view.locator('.cv-scroll');
	const img = view.locator('img');
	await expect(view).toBeVisible();
	await expect(view).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(view.locator('.cv-tip')).toHaveText('Turn the brightness up for a quicker scan');
	await expect.poll(() => img.evaluate((i) => i.naturalWidth)).toBeGreaterThan(50);
	const upright = await page.evaluate(() => innerHeight > innerWidth);
	const wide = await img.evaluate((i) => i.naturalWidth > i.naturalHeight);
	// turned only for a landscape coupon on a phone held upright, and then it fills the long edge
	if (wide && upright) await expect(box).toHaveClass(/is-turned/);
	else await expect(box).not.toHaveClass(/is-turned/);
	const onScreen = () =>
		view.evaluate((d) => {
			const b = d.querySelector('.cv-scroll');
			const r = d.querySelector('img').getBoundingClientRect();
			return {
				side: b.scrollWidth - b.clientWidth,
				l: r.left,
				t: r.top,
				r: innerWidth - r.right,
				b: innerHeight - r.bottom,
				w: r.width,
				h: r.height,
			};
		});
	const s1 = await onScreen();
	expect(s1.side, 'nothing to scroll sideways').toBeLessThanOrEqual(0);
	for (const k of ['l', 't', 'r', 'b']) expect(s1[k], `the whole coupon on the screen (${k})`).toBeGreaterThanOrEqual(-1);
	if (wide && upright) expect(s1.h, 'its long side along the screen').toBeGreaterThan(s1.w);
	// the ✕ stays reachable, turned or not
	const x = view.locator('.cv-x');
	expect((await x.boundingBox()).width).toBeGreaterThanOrEqual(44);
	// a double tap zooms in from the full-size image, upright; a second one zooms back out
	await img.dblclick();
	await expect(box).toHaveClass(/is-zoomed/);
	await expect(box).not.toHaveClass(/is-turned/);
	const z = await img.evaluate((i) => ({ w: i.getBoundingClientRect().width, n: i.naturalWidth / devicePixelRatio }));
	expect(z.w).toBeGreaterThanOrEqual(z.n - 2);
	await img.dblclick();
	await expect(box).not.toHaveClass(/is-zoomed/);
	// a tall coupon (a store flyer, 1100 × 1540) is fitted whole and upright
	await img.evaluate((i) => {
		i.src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="1540"><rect width="1100" height="1540" fill="#c42a1f"/></svg>')}`;
	});
	await expect.poll(() => img.evaluate((i) => i.naturalHeight)).toBe(1540);
	await expect(box).not.toHaveClass(/is-turned/);
	const s2 = await onScreen();
	expect(s2.side).toBeLessThanOrEqual(0);
	for (const k of ['l', 't', 'r', 'b']) expect(s2[k], `the whole flyer on the screen (${k})`).toBeGreaterThanOrEqual(-1);
	await x.click();
	await expect(view).toBeHidden();
	await btn.click();
	await expect(view).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(view, 'Escape closes it').toBeHidden();
	await btn.click();
	await expect(view).toBeVisible();
	await page.goBack();
	await expect(view, 'Back closes it').toBeHidden();
});

test('a coupon past its last day is greyed and folded to one row, Expired', async ({ page }) => {
	await openTrip(page);
	const { gone } = await tripTax(page);
	test.skip(!gone.length, 'no coupon of this trip is past its last day on the test clock');
	const sh = await openTax(page);
	const row = sh.locator(`details.coupon.is-gone[data-coupon-id="${gone[0].id}"]`);
	await row.scrollIntoViewIfNeeded();
	await expect(row).toHaveJSProperty('open', false);
	await expect(row.locator('.coupon-badge')).toHaveText('Expired');
	await expect(row.locator('.coupon-img')).toBeHidden();
	await row.locator('summary').click();
	await expect(row).toHaveJSProperty('open', true);
	expect(Number(await row.locator('.coupon-b').evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(1);
	// the good ones come first
	const order = await sh.locator('.coupon').evaluateAll((cs) => cs.map((c) => c.classList.contains('is-gone')));
	expect(order.indexOf(true)).toBeGreaterThanOrEqual(order.lastIndexOf(false));
});

// tagged @demo: the demo's shop box (under its free shopping stop) carries the row into the sheet
test('the shop box links into the Tax refund sheet', { tag: '@demo' }, async ({ page }) => {
	await openTrip(page);
	await (await show(page, '#free-shops .tax-go')).click();
	await expect(page.locator(SHEET)).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
});
