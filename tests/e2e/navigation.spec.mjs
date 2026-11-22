// Getting around: one view at a time (ADR-20261122-day-views), Back and Forward between views with each one's place,
// jumps that land in the right view, the Back pill, the Sections menu, site search, the offline notice.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { goToView, readingSpot, settle, setStored, viewOn } from '../support/page.mjs';

/* global DAYS -- the trip data, read inside the page */

const top = (page, sel) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().top);
// a landed place sits just under the sticky bar; the legacy suites allowed a few px of sub-pixel overshoot
const LANDED = { min: -5, max: 260 };
const scrollY = (page) => page.evaluate(() => window.scrollY);

test('a tab shows its view at once, at its top, lit in the strip and named in the address', async ({ page }) => {
	await openTrip(page);
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
	const day = await page.evaluate(() => DAYS[1].id);
	await goToView(page, day);
	expect(await scrollY(page)).toBeLessThan(2);
	expect(new URL(page.url()).hash).toBe(`#${day}`);
	// only that view is drawn; the others wait in the page for search and jumps
	await expect(page.locator(`#${day}`)).toBeVisible();
	await expect(page.locator('#top')).toBeHidden();
	await expect(page.locator('#app > [data-sec]:not([data-off])')).toHaveCount(1);
	const lit = page.locator('#tabs .tab[aria-current="true"]');
	if (await page.locator('#tabs').isVisible()) await expect(lit).toHaveAttribute('href', `#${day}`);
	else await expect(page.locator(`#rail [data-rail="${day}"]`)).toHaveAttribute('aria-current', 'page');
});

test('Back and Forward step between views, each at the place the reader left it', async ({ page }) => {
	await openTrip(page);
	const [a, b] = await page.evaluate(() => [DAYS[0].id, DAYS[Math.min(2, DAYS.length - 1)].id]);
	await goToView(page, a);
	for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown'); // the reader scrolls on themselves
	await settle(page);
	const ya = await scrollY(page);
	expect(ya, 'the first day is long enough to scroll').toBeGreaterThan(100);
	await goToView(page, b);
	expect(await scrollY(page), 'a new view opens at its top').toBeLessThan(2);
	await page.keyboard.press('PageDown');
	await settle(page);
	const yb = await scrollY(page);
	await page.goBack();
	await expect(page.locator('html')).toHaveAttribute('data-showing', a);
	await expect.poll(() => scrollY(page), { message: 'back where the reader was' }).toBeGreaterThan(ya - 30);
	expect(Math.abs((await scrollY(page)) - ya)).toBeLessThan(30);
	await page.goForward();
	await expect(page.locator('html')).toHaveAttribute('data-showing', b);
	await expect.poll(async () => Math.abs((await scrollY(page)) - yb), { message: 'and Forward too' }).toBeLessThan(30);
	await page.goBack();
	await page.goBack();
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'top');
});

test('a link to a view opens it, its own address shared or deep-linked', async ({ page }) => {
	const day = 'd2';
	await openTrip(page, `#${day}`);
	await expect(page.locator('html')).toHaveAttribute('data-showing', day);
	await expect(page.locator(`#${day}`)).toBeVisible();
	await page.waitForTimeout(1500); // past the landing hold: it stays at the view's top
	expect(await scrollY(page)).toBeLessThan(40);
});

test('the Back pill returns to the view and the place the reader was before a jump', async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[0].id);
	await goToView(page, day);
	await page.keyboard.press('PageDown');
	await settle(page);
	const before = await scrollY(page);
	// a search hit in another day is a jump: its view first, then the place
	const other = await page.evaluate(() => DAYS[DAYS.length > 2 ? 2 : DAYS.length - 1]);
	const name = (await page.locator(`#${other.id}-s0 .stop-name`).textContent()).trim().slice(0, 6);
	await page.locator('#searchBtn').click();
	await page.locator('#q').fill(name);
	await page.locator('#results-inner .result[data-hit]').first().click();
	await settle(page);
	const pill = page.locator('#backPill');
	await expect(pill).toHaveAttribute('data-show', '1');
	await page.locator('#searchClose').click();
	await pill.click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', day);
	await expect.poll(async () => Math.abs((await scrollY(page)) - before)).toBeLessThan(30);
	await expect(pill).toHaveAttribute('data-show', '0');
});

test('the Sections menu opens a view and closes', async ({ page }) => {
	await openTrip(page);
	await expect(page.locator('#tocBtn'), 'the Sections button is there from the first screen').toHaveAttribute('data-show', '1');
	await page.locator('#tocBtn').click();
	const toc = page.locator('#toc');
	await expect(toc).toBeVisible();
	await toc.locator('a[href="#budget"]').first().click();
	await expect(toc).toBeHidden();
	await expect(page.locator('html')).toHaveAttribute('data-showing', 'budget');
	await settle(page);
	expect(await scrollY(page)).toBeLessThan(2);
});

// Closing a sheet steps back through history. After a jump, the browser's own scroll restoration for that step used to
// win, and the reader landed back at the jumped-to heading, 1,000+ px from where they were reading. On a slow phone it
// still won: it came ~0.8 s after the page's own restore, with an offset saved mid-scroll (up to ~200 px off), so
// Chromium runs these on a CPU slowed like a budget phone's.
for (const how of ['Escape', 'Back']) {
	test(`after a view switch, closing a sheet (${how}) keeps the reader where they were`, async ({ page, browserName }) => {
		if (browserName === 'chromium') await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 6 });
		await openTrip(page);
		const day = await page.evaluate(() => DAYS[1].id);
		await goToView(page, day);
		await page.keyboard.press('PageDown'); // the reader scrolls on themselves (a script's scroll didn't show it)
		await settle(page);
		const y = await scrollY(page);
		await page.locator('#tocBtn').click();
		await expect(page.locator('#toc')).toBeVisible();
		if (how === 'Escape') await page.keyboard.press('Escape');
		else await page.goBack();
		await expect(page.locator('#toc')).toBeHidden();
		await settle(page);
		await expect(page.locator('html')).toHaveAttribute('data-showing', day);
		expect(Math.abs((await scrollY(page)) - y)).toBeLessThan(40);
	});
}

// A reload (the update bar's Update, a pull to refresh) used to land on the browser's old pixel offset, or on the heading
// a jump had put in the address: a day or two from where the reader was. Now it's the same view, at the same place.
test('a reload lands in the same view, where the reader was', async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[Math.min(2, DAYS.length - 1)].id);
	await goToView(page, day);
	for (let i = 0; i < 2; i++) await page.keyboard.press('PageDown');
	await settle(page);
	const before = await readingSpot(page);
	await page.reload();
	await settle(page);
	expect(await viewOn(page)).toBe(day);
	expect(await readingSpot(page)).toEqual(before);
});

// The driver card was five taps and a scroll from the plan (Map tab, All places, the place, Details, Show driver): the
// stops in the plan didn't carry it. A taxi is the seniors' first choice for long legs, so the next stop is one tap away.
test("today's next stop opens its show-the-driver card in one tap, full screen on a phone", async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[1]);
	await setStored(page, { now: `${day.date} 06:00` }); // before the day's first stop: every place in it is still ahead
	await goToView(page, day.id);
	const next = page.locator(`#${day.id} .stop.next`);
	await expect(next).toHaveCount(1);
	// only the current and next stops carry it in the plan: on every stop it cost a 70 px line each at 390 px
	await expect(page.locator(`#${day.id} .stop:not(.now):not(.next) .stop-drv`).first()).toBeHidden();
	const btn = next.locator('.stop-drv [data-driver]');
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
test("a search jump shows the hit's view and lights it, and the search box shows its focus", async ({ page }) => {
	await openTrip(page);
	const day = await page.evaluate(() => DAYS[Math.min(2, DAYS.length - 1)].id);
	const name = (await page.locator(`#${day}-s0 .stop-name`).textContent()).trim().slice(0, 6);
	await page.locator('#searchBtn').click();
	await page.locator('#q').fill(name);
	await expect(page.locator('.search-field')).not.toHaveCSS('box-shadow', 'none');
	await page.locator('#results-inner .result[data-hit]').first().click();
	// the view of whatever the jump landed on is on screen, and lit
	const sec = await page
		.locator('#app .flash')
		.first()
		.evaluate((e) => e.closest('[data-sec]').id);
	await settle(page);
	expect(await viewOn(page)).toBe(sec);
	if (await page.locator('#tabs').isVisible()) await expect(page.locator('.tab[aria-current="true"]').first()).toHaveAttribute('href', `#${sec}`);
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
	expect(await viewOn(page)).toBe('d4');
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

// a shared link like …/trip.html#entry opens that view at its top (WebKit once opened such links ~3,800 px off)
for (const id of ['entry', 'budget', 'checklist']) {
	test(`a link that opens at #${id} shows that view`, async ({ page }) => {
		await openTrip(page, `#${id}`);
		await expect(page.locator('html')).toHaveAttribute('data-showing', id);
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
	// and Now opens its day's view at the stop under way
	await rows.first().click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', /^d\d+$/);
});

test("a stop's link that names a site opens that site's address @demo", async ({ page }) => {
	await openTrip(page);
	// the demo's concert stop links the SITES key "concert"; the page must resolve it, not use the key as the address
	await expect(page.locator('.stop-links a.mlink[href="https://npac-ntch.org/"]')).toHaveCount(1);
	await expect(page.locator('.stop-links a.mlink[href="concert"]')).toHaveCount(0);
});
