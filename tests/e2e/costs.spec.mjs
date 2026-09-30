// Every group cost also shows a per-person share, and home-currency figures follow the editable rate.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails } from '../support/page.mjs';

// every "NT$a–b for 5" text run, with whether the page put a per-person share right after it
const groupFigures = (page) =>
	page.evaluate(() => {
		const out = [];
		const walk = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
		for (let n; (n = walk.nextNode());) {
			for (const m of n.textContent.matchAll(/NT\$[\d,]+(?:–[\d,]+)? for 5(?! \(NT\$)/g)) {
				const next = n.nextSibling;
				out.push({ text: m[0], idea: !!n.parentElement.closest('.idea'), shared: !!(next && next.classList && next.classList.contains('each-i')) });
			}
		}
		return out;
	});

test('each "for 5" group figure is followed by a per-person share', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const figures = await groupFigures(page);
	expect(figures.length, 'demo trip has group figures').toBeGreaterThan(5);
	expect(figures.filter((f) => !f.shared)).toEqual([]);
});

test('a group figure in a free-time idea row also gets a per-person share @demo', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const ideas = (await groupFigures(page)).filter((f) => f.idea);
	expect(ideas.length).toBeGreaterThan(0);
	expect(ideas.filter((f) => !f.shared)).toEqual([]);
});

test('a bold group figure also gets a per-person share @demo', async ({ page }) => {
	await openTrip(page);
	const cost = page.locator('#optional', { hasText: 'NT$3,000' }).locator('strong', { hasText: 'NT$3,000' }).first();
	await expect(cost.locator('xpath=following-sibling::*[1]')).toHaveClass(/each-i/);
});

test('a group cost row shows the share of five @demo', async ({ page }) => {
	await openTrip(page);
	// Day 2 dinner: "NT$1,500–2,250 for 5" → each NT$300–450
	const row = page.locator('#d2 .block', { hasText: 'NT$1,500–2,250 for 5' }).first();
	await expect(row.locator('.each-i').first()).toContainText('NT$300–450');
});

test('home-currency figures follow the rate and the rate is remembered', async ({ page }) => {
	await openTrip(page);
	const rm = page.locator('#app [data-rm]').first();
	await rm.scrollIntoViewIfNeeded();
	const expected = async (rate) => {
		const [a, b] = (await rm.getAttribute('data-rm')).split(',').map(Number);
		const r = (v) => Math.round(v < 100 ? Math.round(v) : Math.round(v / 10) * 10).toLocaleString('en-US');
		return [r(a / rate), r(b / rate)];
	};
	await page.locator('#rate').fill('7');
	for (const n of await expected(7)) await expect(rm).toContainText(n);
	await page.reload();
	await expect(page.locator('#rate')).toHaveValue('7');
	for (const n of await expected(7)) await expect(page.locator('#app [data-rm]').first()).toContainText(n);
});
