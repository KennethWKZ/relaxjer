// The page renders every section from trip data alone, offline, without errors, and keeps closed lists unbuilt.
import { test, expect, openTrip } from '../support/fixtures.mjs';

const TABS = ['map', 'airport', 'entry', 'optional', 'wish', 'eat', 'budget', 'weather', 'checklist', 'rules'];
// every day of the trip gets a section and a tab
const daySections = (page) =>
	page.evaluate(() => {
		/* global DAYS */
		return DAYS.map((d) => d.id);
	});

test('renders every section with no outside network', async ({ page, blocked }) => {
	await openTrip(page);
	const days = await daySections(page);
	expect(days.length, 'the trip has days').toBeGreaterThan(0);
	for (const id of [...days, ...TABS]) await expect(page.locator(`#${id}[data-sec]`), `section #${id}`).toBeAttached();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	// the guard aborted every outside request and the page still rendered; list what it tried, for the report
	test.info().annotations.push({ type: 'blocked hosts', description: [...new Set(blocked)].sort().join(', ') || 'none' });
});

test('each tab points at a section that exists', async ({ page }) => {
	await openTrip(page);
	const targets = await page.locator('.tab[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href').slice(1)));
	expect(targets.length).toBeGreaterThanOrEqual(TABS.length + (await daySections(page)).length);
	for (const id of targets) await expect(page.locator(`[id="${id}"]`), `tab target #${id}`).toBeAttached();
});

test('closed lists are not built until opened', async ({ page }) => {
	await openTrip(page);
	const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);
	expect(nodes, 'DOM size at first paint').toBeLessThan(9000);
	await expect(page.locator('.wishcard')).toHaveCount(0);
	const group = page.locator('#wish details.wgroup').first();
	await group.locator('summary').click();
	await expect(group, 'the list opened').toHaveAttribute('open', '');
	await expect(group.locator('.wishcard').first(), 'and was built on open').toBeAttached();
});

test('a closed wishlist place is flagged in the wishlist and left out of day suggestions @demo', async ({ page }) => {
	await openTrip(page);
	// it fits Day 2, next to an open place that also fits Day 2
	await expect(page.locator('#d2')).toContainText('Demo Soup Dumplings');
	await expect(page.locator('#d2')).not.toContainText('Demo Closed Shop');
	for (const g of await page.locator('#wish details.wgroup summary').all()) await g.click();
	const card = page.locator('#wish .wishcard', { hasText: 'Demo Closed Shop' });
	await expect(card.locator('.warn')).toContainText('Reported closed');
});
