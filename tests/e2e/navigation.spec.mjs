// Getting around: instant tab jumps with a landing ring, the Back pill, the Sections menu, site search, offline notice.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { settle, setStored } from '../support/page.mjs';

/* global DAYS -- the trip data, read inside the page */

const top = (page, sel) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().top);
// a landed section sits just under the sticky bar; the legacy suites allowed a few px of sub-pixel overshoot
const LANDED = { min: -5, max: 260 };

test('a tab jump is instant and lands with a ring that holds, then goes', async ({ page }) => {
	await openTrip(page);
	// watch from the tap: scroll positions for 600 ms, and when the landing ring comes and goes (for up to 4 s)
	const run = await page.evaluate(
		() =>
			new Promise((done) => {
				const seen = new Set();
				const glow = { on: null, off: null };
				const sec = document.getElementById('budget');
				const mo = new MutationObserver(() => {
					const lit = !!sec.querySelector('.landed');
					if (lit && glow.on == null) glow.on = performance.now() - t0;
					if (!lit && glow.on != null && glow.off == null) glow.off = performance.now() - t0;
				});
				mo.observe(sec, { subtree: true, attributes: true, attributeFilter: ['class'] });
				const t0 = performance.now();
				document.querySelector('.tab[href="#budget"]').click();
				const tick = () => {
					if (performance.now() - t0 < 600) seen.add(Math.round(scrollY));
					if (performance.now() - t0 < 4000 && glow.off == null) requestAnimationFrame(tick);
					else {
						mo.disconnect();
						done({ positions: seen.size, ...glow });
					}
				};
				requestAnimationFrame(tick);
			}),
	);
	// Instant: the first frame already lands; a few corrections follow while undrawn sections above get their real
	// height (content-visibility). A smooth scroll over this distance would show dozens of positions.
	expect(run.positions, 'distinct scroll positions during the jump').toBeLessThanOrEqual(6);
	const t = await top(page, '#budget');
	expect(t).toBeGreaterThanOrEqual(LANDED.min);
	expect(t).toBeLessThan(LANDED.max);
	expect(run.on, 'the landing glow appeared').not.toBeNull();
	expect(run.off, 'and faded').not.toBeNull();
	// affordances rule 20: long enough to find where you landed (1.5 s or more), gone before it's noise
	expect(run.off - run.on, 'the ring holds 1.5–3 s').toBeGreaterThanOrEqual(1500);
	expect(run.off - run.on).toBeLessThanOrEqual(3000);
});

test('the Back pill returns to where the reader was before a jump', async ({ page }) => {
	await openTrip(page);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.3));
	await settle(page);
	const before = await page.evaluate(() => scrollY);
	await page.locator('.tab[href="#rules"]').first().click();
	await settle(page);
	const pill = page.locator('#backPill');
	await expect(pill).toHaveAttribute('data-show', '1');
	await pill.click();
	await settle(page);
	expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(30);
	await expect(pill).toHaveAttribute('data-show', '0');
});

test('the Sections menu jumps to a section and closes', async ({ page }) => {
	await openTrip(page);
	// the Sections button floats in once the reader has scrolled past the top
	await page.evaluate(() => window.scrollBy(0, 1200));
	await settle(page);
	await expect(page.locator('#tocBtn')).toHaveAttribute('data-show', '1');
	await page.locator('#tocBtn').click();
	const toc = page.locator('#toc');
	await expect(toc).toBeVisible();
	await toc.locator('a[href="#budget"]').first().click();
	await expect(toc).toBeHidden();
	await settle(page);
	const t = await top(page, '#budget');
	expect(t).toBeGreaterThanOrEqual(LANDED.min);
	expect(t).toBeLessThan(LANDED.max);
});

test('site search finds a stop and jumps to it @demo', async ({ page }) => {
	await openTrip(page);
	await page.locator('#searchBtn').click();
	await page.locator('#q').fill('Yehliu');
	const hit = page.locator('#results-inner .result[data-hit]').first();
	await expect(hit).toBeVisible();
	const text = (await hit.textContent()).trim();
	await hit.click();
	await settle(page);
	// Day 4 is on screen, and its title (the text that matched) sits under the sticky bar
	const d4 = await top(page, '#d4');
	expect(d4).toBeGreaterThanOrEqual(LANDED.min);
	expect(d4).toBeLessThan(await page.evaluate(() => innerHeight / 2));
	await expect(page.locator('#d4')).toContainText(text.split('→')[0].trim());
});

test('going offline shows a notice, coming back hides it', async ({ page, context }) => {
	await openTrip(page);
	const note = page.locator('#netOff');
	await expect(note).toBeHidden();
	await context.setOffline(true);
	await page.evaluate(() => window.dispatchEvent(new Event('offline')));
	await expect(note).toBeVisible();
	await context.setOffline(false);
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await expect(note).toBeHidden();
});

// a shared link like …/trip.html#entry: WebKit opened it ~3,800 px off (the legacy page too) until it got the same
// landing hold as a tab jump
for (const id of ['entry', 'budget', 'checklist']) {
	test(`a link that opens at #${id} lands on it`, async ({ page }) => {
		await openTrip(page, `#${id}`);
		await expect.poll(() => top(page, `#${id}`), { timeout: 4000 }).toBeGreaterThanOrEqual(LANDED.min);
		await page.waitForTimeout(1500); // past the landing hold: it must stay put
		const t = await top(page, `#${id}`);
		expect(t, `#${id} top after load`).toBeGreaterThanOrEqual(LANDED.min);
		expect(t, `#${id} top after load`).toBeLessThanOrEqual(LANDED.max);
	});
}

// any trip: on a trip day the sheet opens with Now and Next, each marked with the day's knot: filled, then a ring
test('on a trip day the Sections sheet leads with Now and Next, marked as on the day', async ({ page }) => {
	await openTrip(page);
	const at = await page.evaluate(() => {
		const d = DAYS.find((x) => x.schedule.filter((it) => /^~?\d{1,2}:\d\d/.test(String(it.t || ''))).length >= 2);
		const m = /(\d{1,2}):(\d\d)/.exec(d.schedule.find((it) => /^~?\d{1,2}:\d\d/.test(String(it.t || ''))).t);
		return `${d.date} ${m[1].padStart(2, '0')}:${m[2]}`; // the day's first timed stop, as it starts
	});
	await setStored(page, { now: at });
	await page.evaluate(() => window.scrollBy(0, 1200));
	await settle(page);
	await page.locator('#tocBtn').click();
	const rows = page.locator('#toc .toc-now');
	await expect(rows.first()).toHaveClass(/\bis-now\b/);
	await expect(rows.nth(1)).toHaveClass(/\bis-next\b/);
	const knot = (i) =>
		rows
			.nth(i)
			.locator('.toc-k')
			.evaluate((e) => {
				const k = getComputedStyle(e, '::before'); // WebKit hands back no plain copy of a style object
				return { content: k.content, backgroundColor: k.backgroundColor, borderTopColor: k.borderTopColor };
			});
	const [now, next] = [await knot(0), await knot(1)];
	expect(now.content, 'the knot shows').not.toBe('none');
	expect(now.backgroundColor, 'Now is filled with the knot colour').toBe(now.borderTopColor);
	expect(next.backgroundColor, 'Next is a ring').not.toBe(next.borderTopColor);
});
