// Getting around: instant tab jumps with a landing ring, the Back pill, the Sections menu, site search, offline notice.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { readingSpot, settle, setStored } from '../support/page.mjs';

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
	// instant: the page's CSS makes a plain scrollTo smooth, and CI's Linux WebKit started that scroll so late that settle()
	// had already read the page as still, so `before` was taken at the top and the page moved on under the test
	await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight * 0.3, behavior: 'instant' }));
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

// Closing a sheet steps back through history. After a tab jump, the browser's own scroll restoration for that step
// used to win, and the reader landed back at the jumped-to heading, 1,000+ px from where they were reading.
for (const how of ['Escape', 'Back']) {
	test(`after a tab jump, closing a sheet (${how}) keeps the reader where they were`, async ({ page }) => {
		await openTrip(page);
		const day = await page.evaluate(() => DAYS[1].id);
		await page.locator(`.tab[href="#${day}"]`).first().click();
		await settle(page);
		for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown'); // the reader scrolls on themselves (a script's scroll didn't show it)
		await settle(page);
		const y = await page.evaluate(() => scrollY);
		await expect(page.locator('#tocBtn')).toHaveAttribute('data-show', '1');
		await page.locator('#tocBtn').click();
		await expect(page.locator('#toc')).toBeVisible();
		if (how === 'Escape') await page.keyboard.press('Escape');
		else await page.goBack();
		await expect(page.locator('#toc')).toBeHidden();
		await settle(page);
		expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThan(40);
	});
}

// A reload (the update bar's Update, a pull to refresh) used to land on the browser's old pixel offset, before the
// sections above had drawn at their real height (Chromium skips drawing them), or on the heading a tab jump had put in the
// address: a day or two from where the reader was.
for (const via of ['scroll', 'tab jump']) {
	test(`a reload lands where the reader was (after a ${via})`, async ({ page }) => {
		await openTrip(page);
		const day = await page.evaluate(() => DAYS[Math.min(2, DAYS.length - 1)].id);
		if (via === 'tab jump') await page.locator(`.tab[href="#${day}"]`).first().click();
		else await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start', behavior: 'instant' }), day);
		await settle(page);
		for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown');
		await settle(page);
		const before = await readingSpot(page);
		await page.reload();
		await settle(page);
		expect(await readingSpot(page)).toEqual(before);
	});
}

// The driver card was five taps and a scroll from the plan (Map tab, All places, the place, Details, Show driver): the
// stops in the plan didn't carry it. A taxi is the seniors' first choice for long legs, so the next stop is one tap away.
test("today's next stop opens its show-the-driver card in one tap, full screen on a phone", async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[1]);
	await setStored(page, { now: `${day.date} 06:00` }); // before the day's first stop: every place in it is still ahead
	const next = page.locator(`#${day.id} .stop.next`);
	await expect(next).toHaveCount(1);
	// only the current and next stops carry it: on every stop it cost a 70 px line each at 390 px
	await expect(page.locator(`#${day.id} .stop:not(.now):not(.next) [data-driver]`).first()).toBeHidden();
	const btn = next.locator('[data-driver]');
	if (!(await btn.count())) test.skip(true, "this trip's next stop has no place");
	await btn.scrollIntoViewIfNeeded();
	await btn.click();
	const card = page.locator('#driver');
	await expect(card).toBeVisible();
	await expect(page.locator('#drv-name')).not.toBeEmpty();
	const vp = page.viewportSize();
	if (vp.width < 600) {
		// it opens with a short scale (style.css @starting-style): measure once it has settled
		await expect.poll(async () => (await card.boundingBox()).width, { message: 'the whole width of the phone' }).toBeGreaterThanOrEqual(vp.width - 1);
		expect((await card.boundingBox()).height, 'and its whole height').toBeGreaterThanOrEqual(vp.height - 1);
	}
	// actions used while walking are 52 px or more (affordances rule 2)
	const heights = await card.locator('.links-row > *').evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
	for (const h of heights) expect(h).toBeGreaterThanOrEqual(52);
});

// From the pre-departure pass: a search jump left the old day's tab lit, and the search box showed no focus ring
test("a search jump lights the hit's day in the strip, and the search box shows its focus", async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[Math.min(2, DAYS.length - 1)].id);
	const name = (await page.locator(`#${day}-s0 .stop-name`).textContent()).trim().slice(0, 6);
	await page.locator('#searchBtn').click();
	await page.locator('#q').fill(name);
	await expect(page.locator('.search-field')).not.toHaveCSS('box-shadow', 'none');
	await page.locator('#results-inner .result[data-hit]').first().click();
	// the strip lights the section of whatever the jump landed on
	const sec = await page
		.locator('#app .flash')
		.first()
		.evaluate((e) => e.closest('[data-sec]').id);
	await settle(page);
	await expect(page.locator('.tab[aria-current="true"]').first()).toHaveAttribute('href', `#${sec}`);
});

test('site search finds a stop and jumps to it @demo', async ({ page }) => {
	await openTrip(page);
	await page.locator('#searchBtn').click();
	await page.locator('#q').fill('Yehliu');
	const hit = page.locator('#results-inner .result[data-hit]').first();
	await expect(hit).toBeVisible();
	const text = (await hit.textContent()).trim();
	await hit.click();
	const landed = await page.locator('#d4 .flash').elementHandle(); // the flash fades after 1.3 s: hold on to it now
	await settle(page);
	// the text that matched sits just under the sticky bar, in Day 4, like any other jump (it used to land mid-screen)
	const at = await landed.evaluate((e) => e.getBoundingClientRect().top);
	expect(at).toBeGreaterThanOrEqual(LANDED.min);
	expect(at).toBeLessThan(LANDED.max);
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

test("a stop's link that names a site opens that site's address @demo", async ({ page }) => {
	await openTrip(page);
	// the demo's concert stop links the SITES key "concert"; the page must resolve it, not use the key as the address
	await expect(page.locator('.stop-links a.mlink[href="https://npac-ntch.org/"]')).toHaveCount(1);
	await expect(page.locator('.stop-links a.mlink[href="concert"]')).toHaveCount(0);
});
