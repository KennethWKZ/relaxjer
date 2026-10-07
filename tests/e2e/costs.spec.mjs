// Every group cost also shows a per-person share, and home-currency figures follow the editable rate.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails } from '../support/page.mjs';

// every "NT$a–b for 5" text run, with whether the page put a per-person share right after it
// every "NT$… for 5" in the page text: followed by its share (shared), or already stating it (stated: "NT$600 each,
// NT$3,000 for 5"), never both
const groupFigures = (page) =>
	page.evaluate(() => {
		const out = [];
		const walk = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
		const num = (s) => +s.replace(/,/g, '');
		for (let n; (n = walk.nextNode());) {
			for (const m of n.textContent.matchAll(/NT\$([\d,]+)(?:–([\d,]+))? for 5(?! \(NT\$)/g)) {
				const next = n.nextSibling;
				const [lo, hi] = [num(m[1]), num(m[2] || m[1])];
				const per = (v) => (v / 5).toLocaleString('en-US');
				const stated = lo % 5 === 0 && hi % 5 === 0 && n.textContent.includes(`NT$${per(lo)}${hi > lo ? `–${per(hi)}` : ''} each`);
				out.push({
					text: m[0],
					idea: !!n.parentElement.closest('.idea'),
					stated,
					shared: !!(next && next.classList && next.classList.contains('each-i')),
				});
			}
		}
		return out;
	});

test('each "for 5" group figure shows a per-person share once', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const figures = await groupFigures(page);
	expect(figures.length, 'demo trip has group figures').toBeGreaterThan(5);
	expect(figures.filter((f) => f.shared === f.stated)).toEqual([]);
});

test('a share the text already states is not repeated @demo', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const stated = (await groupFigures(page)).filter((f) => f.stated);
	expect(stated.length, 'demo trip states a share itself somewhere').toBeGreaterThan(0);
	expect(stated.filter((f) => f.shared)).toEqual([]);
});

test('a group figure in a free-time idea row also gets a per-person share @demo', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const ideas = (await groupFigures(page)).filter((f) => f.idea && !f.stated);
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

test('the rate takes a home currency worth far more, or far less, than the destination’s', async ({ page }) => {
	await openTrip(page);
	const rm = page.locator('#app [data-rm]').first();
	await rm.scrollIntoViewIfNeeded();
	const r = (v) => Math.round(v < 100 ? Math.round(v) : Math.round(v / 10) * 10).toLocaleString('en-US');
	for (const rate of [32, 0.25]) {
		await page.locator('#rate').fill(String(rate));
		const [a, b] = (await rm.getAttribute('data-rm')).split(',').map(Number);
		for (const n of [r(a / rate), r(b / rate)]) await expect(rm).toContainText(n);
	}
});

// the reserve line and the shared-cost rows had no home-currency figure, while the pool line had one
test('the budget gives every shared amount in the home currency too', async ({ page }) => {
	await openTrip(page);
	const missing = await page.evaluate(() => {
		const out = [];
		document.querySelectorAll('#budget dl.kv > div').forEach((row) => {
			if (!row.querySelector('[data-rm]')) out.push(row.querySelector('dt')?.textContent.trim().slice(0, 30));
		});
		const note = document.querySelector('#budget .sec-lede ~ p.note');
		if (note && /\d/.test(note.textContent) && !note.querySelector('[data-rm]')) out.push('reserve line');
		return out;
	});
	expect(missing).toEqual([]);
});
