// The budget as what's been paid and what's still to come, and the group's travel insurance
// (ADR-20261128-budget-paid-insurance). Any trip: each test reads the trip's own rows and skips what it doesn't have.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';
import { budgetTally, roundHome } from '../../engine/src/core/money.mjs';
/* global BUDGET, TRIP */

const glance = '#budget-glance';
const sheet = (key) => `#budget-p-${key}`;
const tile = (key) => `#budget [data-part="budget-p-${key}"]`;

/** the trip's rows and currency, and the tally the page should show (the trip's own rate) */
async function tripBudget(page) {
	const t = await page.evaluate(() => ({ rows: BUDGET.rows, cur: TRIP.currency || {} }));
	const home = t.cur.home && t.cur.home !== t.cur.sym && t.cur.rate > 0 ? t.cur.home : null;
	return { ...t, home, tally: budgetTally(t.rows, { rate: home ? t.cur.rate : 1, home }) };
}
const fig = (v, approx) => (approx ? roundHome(v) : Math.round(v)).toLocaleString('en-US');

test('the budget leads with what was paid, in the home currency, a converted sum marked ≈', async ({ page }) => {
	await openTrip(page, '#budget');
	const b = await tripBudget(page);
	test.skip(!b.tally.paidItems.length, 'nothing paid on this trip yet: the estimate total leads');
	const amt = page.locator(`${glance} .amt`);
	await expect(amt).toHaveText(`${b.tally.paidApprox ? '≈ ' : ''}${b.home || b.cur.sym}${b.home ? ' ' : ''}${fig(b.tally.paid, b.tally.paidApprox)}`);
	// one line for what's still to come, with each person's share
	if (b.tally.todo[1] > 0) await expect(page.locator(`${glance} .bg-todo`)).toContainText(fig(b.tally.todo[1], b.tally.todoApprox));
	// a new rate redraws it
	if (b.home && b.tally.paidApprox) {
		await show(page, '#rate');
		await page.locator('#rate').fill(String(b.cur.rate * 2));
		const t2 = budgetTally(b.rows, { rate: b.cur.rate * 2, home: b.home });
		await expect(amt).toHaveText(`≈ ${b.home} ${fig(t2.paid, true)}`);
	}
});

test('a deposit shows under Paid and its balance under To pay; a booking number waits in the opened row', async ({ page }) => {
	await openTrip(page, '#budget');
	const b = await tripBudget(page);
	const split = b.rows.find((r) => r && r.parts && r.parts.some((p) => p.paid) && r.parts.some((p) => !p.paid));
	test.skip(!split, 'no payment in parts on this trip');
	await page.locator(tile('paid')).click();
	await expect(page.locator(sheet('paid'))).toBeVisible();
	await expect(page.locator(`${sheet('paid')} .pay-part`).first()).toBeVisible();
	const withRef = page.locator(`${sheet('paid')} details.pay`).first();
	if (await withRef.count()) {
		await expect(withRef.locator('.pay-ref')).toBeHidden();
		await withRef.locator('summary').click();
		await expect(withRef.locator('.pay-ref')).toBeVisible();
	}
	await page.keyboard.press('Escape');
	await page.locator(tile('rows')).click();
	await expect(page.locator(`${sheet('rows')} .pay-part`).first(), 'the balance still to pay').toBeVisible();
});

test('a price not known yet is listed under To pay and never counted', async ({ page }) => {
	await openTrip(page, '#budget');
	const b = await tripBudget(page);
	test.skip(!b.tally.tbdItems.length, 'no row without a price on this trip');
	await page.locator(tile('rows')).click();
	const s = page.locator(sheet('rows'));
	await expect(s.locator('.pay.is-tbd')).toHaveCount(b.tally.tbdItems.length);
	await expect(s.locator('.pay.is-tbd').first()).toContainText(/Price TBD|价钱待定/);
	// the sum is the tally's, which leaves the row out, and says so
	await expect(s.locator('.pay-sum')).toContainText(fig(b.tally.todo[1], b.tally.todoApprox));
	await expect(s.locator('.pay-sum')).toContainText(/not counting|不含/);
});

test('every amount in the trip’s currency in the budget lists also shows in the home currency', async ({ page }) => {
	await openTrip(page, '#budget');
	const b = await tripBudget(page);
	test.skip(!b.home, 'no home currency on this trip');
	for (const key of ['paid', 'rows']) {
		const t = page.locator(tile(key));
		if (!(await t.count())) continue;
		await t.click();
		const missing = await page
			.locator(`${sheet(key)} .pay-a`)
			.evaluateAll(
				(cells, home) => cells.filter((c) => !c.textContent.trim().startsWith(home) && !c.closest('.is-tbd') && !c.querySelector('[data-rm]')).length,
				b.home,
			);
		expect(missing, `${key}: a trip-currency amount without its home-currency line`).toBe(0);
		await page.keyboard.press('Escape');
	}
});

test('the Insurance tile shows only when the trip has a policy, and its numbers are big tel: and wa.me links', async ({ page }) => {
	await openTrip(page);
	const has = await page.evaluate(() => typeof INSURANCE !== 'undefined' && INSURANCE.policies.length); // eslint-disable-line no-undef
	const ins = page.locator('#top [data-part="top-p-ins"]');
	if (!has) {
		await expect(ins).toHaveCount(0);
		return;
	}
	await show(page, ins);
	await ins.click();
	const s = page.locator('#top-p-ins');
	await expect(s).toBeVisible();
	const tels = s.locator('a[href^="tel:"]');
	expect(await tels.count()).toBeGreaterThan(0);
	// measured as laid out (offsetHeight): the sheet's rise scales its box by a hair while it settles
	const tall = (l) => l.evaluate((e) => e.offsetHeight);
	for (const a of await tels.all()) {
		expect(await a.getAttribute('href')).toMatch(/^tel:\+?\d{6,}$/);
		expect(await tall(a), 'a 44 px target').toBeGreaterThanOrEqual(44);
	}
	for (const a of await s.locator('a[href*="wa.me"]').all()) {
		expect(await a.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d{6,}$/);
		expect(await tall(a), 'WhatsApp as big as the call').toBeGreaterThanOrEqual(44);
	}
	// (the short trip, pnpm test:e2e:short, carries no insurance: the same test there proves the tile stays away)
});
