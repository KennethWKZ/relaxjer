// Affordance rules from memory-bank/standards/patterns/affordances.md, measured on the page (rule numbers in brackets):
// every control can be hit, looks like what it is, and shows its state.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails, scrollBy } from '../support/page.mjs';

test('every control is at least 44 px [1]', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const small = await page.evaluate(() => {
		const out = new Set();
		for (const e of document.querySelectorAll('#bar a, #bar button, #app a, #app button, #app summary, #app input, #app select, #app [role=tab]')) {
			const r = e.getBoundingClientRect();
			if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
			// a link inside a sentence (inline, with other text around it) is exempt; so is an input whose label is the target
			if (e.tagName === 'A' && getComputedStyle(e).display.startsWith('inline') && e.parentElement.textContent.trim() !== e.textContent.trim())
				continue;
			const label = e.tagName === 'INPUT' && e.closest('label');
			const box = label ? label.getBoundingClientRect() : r;
			if (Math.min(box.width, box.height) >= 43.5) continue;
			out.add(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} ${Math.round(box.width)}×${Math.round(box.height)}`);
		}
		return [...out];
	});
	expect(small).toEqual([]);
});

test('neighbouring buttons and tabs keep 8 px apart [3]', async ({ page }) => {
	await openTrip(page);
	const gaps = await page.evaluate(() =>
		[...document.querySelectorAll('.links-row, .tabs')].map((e) => parseFloat(getComputedStyle(e).columnGap) || 0).filter((g) => g < 8),
	);
	expect(gaps).toEqual([]);
});

test('every disclosure shows a chevron [11]', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const bare = await page.evaluate(() =>
		[...document.querySelectorAll('#app summary')]
			.filter((s) => s.getBoundingClientRect().height && !s.querySelector('svg.chev'))
			.map((s) => `${s.parentElement.className}: ${s.textContent.trim().slice(0, 30)}`),
	);
	expect(bare).toEqual([]);
});

test('the day strip fades the edge that has more days [14]', async ({ page }) => {
	await openTrip(page);
	const tabs = page.locator('#tabs');
	const cue = () =>
		tabs.evaluate((t) => ({ more: t.scrollWidth > t.clientWidth + 2, l: t.classList.contains('more-l'), r: t.classList.contains('more-r') }));
	await tabs.evaluate((t) => t.scrollTo({ left: 0, behavior: 'instant' }));
	const start = await cue();
	if (!start.more) {
		expect(start, 'everything fits: no fade').toEqual({ more: false, l: false, r: false });
		return;
	}
	await expect.poll(cue).toEqual({ more: true, l: false, r: true });
	await tabs.evaluate((t) => t.scrollTo({ left: t.scrollWidth, behavior: 'instant' }));
	await expect.poll(cue).toEqual({ more: true, l: true, r: false });
});

test('selected tab and language show more than a colour change [16]', async ({ page }) => {
	await openTrip(page);
	const tab = await page
		.locator('.tab[aria-current="true"]')
		.first()
		.evaluate((e) => ({ w: +getComputedStyle(e).fontWeight, shadow: getComputedStyle(e).boxShadow }));
	expect(tab.w).toBeGreaterThanOrEqual(750);
	expect(tab.shadow).not.toBe('none');
	const [on, off] = await Promise.all(
		['true', 'false'].map((p) =>
			page
				.locator(`.seg [data-lang][aria-pressed="${p}"]`)
				.first()
				.evaluate((e) => getComputedStyle(e).backgroundColor),
		),
	);
	const ink = await page.evaluate(() => getComputedStyle(document.body).color);
	expect(on, 'the chosen language is filled with ink').toBe(ink);
	expect(off).not.toBe(on);
});

test('lantern buttons are filled, and tappable chips differ from static tags [6, 8]', async ({ page }) => {
	await openTrip(page);
	const alpha = await page
		.locator('.lantern .l-btn')
		.first()
		.evaluate((e) => {
			const m = getComputedStyle(e).backgroundColor.match(/[\d.]+/g) || [];
			return m.length === 4 ? +m[3] : m.length ? 1 : 0;
		});
	expect(alpha, 'a tint fill, not a ghost outline').toBeGreaterThan(0);
	const looks = await page.evaluate(() => {
		const host = document.querySelector('#app');
		const tag = Object.assign(document.createElement('span'), { className: 'tag', textContent: 'x' });
		const chip = Object.assign(document.createElement('button'), { className: 'tag pinbtn', textContent: 'x' });
		host.append(tag, chip);
		const k = (e) => ['color', 'backgroundColor', 'borderTopColor'].map((p) => getComputedStyle(e)[p]).join('|');
		const res = [k(tag), k(chip)];
		tag.remove();
		chip.remove();
		return res;
	});
	expect(looks[1]).not.toBe(looks[0]);
});

test('the focus ring on a lantern is drawn in the day’s ink [19]', async ({ page }) => {
	await openTrip(page);
	const btn = page.locator('.lantern .l-btn').first();
	await btn.scrollIntoViewIfNeeded();
	await page.keyboard.press('Tab'); // keyboard modality, so programmatic focus shows the ring
	await btn.focus();
	const [ring, ink] = await btn.evaluate((e) => [getComputedStyle(e).outlineColor, getComputedStyle(e.closest('.lantern')).color]);
	expect(ring).toBe(ink);
});

test('disabled is dimmed, and a location request in flight says so [18]', async ({ page }) => {
	await page.addInitScript(() => {
		navigator.permissions.query = () => Promise.resolve({ state: 'prompt', onchange: null });
		navigator.geolocation.watchPosition = () => 1; // never answers: the button stays busy
		navigator.geolocation.clearWatch = () => {};
	});
	await openTrip(page);
	const dim = await page.evaluate(() => {
		const b = Object.assign(document.createElement('button'), { disabled: true, textContent: 'x' });
		document.querySelector('#app').append(b);
		const o = +getComputedStyle(b).opacity;
		b.remove();
		return o;
	});
	expect(dim).toBeLessThan(1);
	const on = page.locator('#now [data-geo-on]');
	if (!(await on.count())) return; // no location card on this trip's date
	await on.click();
	await expect(on).toHaveAttribute('aria-busy', 'true');
	await expect(on).toBeDisabled();
	await expect(on).toContainText('Finding you');
});

test('a website link keeps its word, and phones switch the theme from the Sections sheet [9]', async ({ page }) => {
	await openTrip(page);
	const bare = await page.evaluate(
		() =>
			[...document.querySelectorAll('#app a.mlink')]
				.filter((a) => a.querySelector('use[href="#i-ext"]') && a.getBoundingClientRect().width)
				.filter((a) => {
					const r = document.createRange();
					r.selectNodeContents(a);
					return !a.textContent.trim() || a.querySelector('.dlbl');
				}).length,
	);
	expect(bare, 'website links with no visible word').toBe(0);
	if ((page.viewportSize()?.width || 0) >= 600) return;
	await expect(page.locator('#themeBtn')).toBeHidden();
	await scrollBy(page, 1200); // the Sections button shows once you're past the first screen
	await expect(page.locator('#tocBtn')).toHaveAttribute('data-show', '1');
	await page.locator('#tocBtn').click();
	const row = page.locator('[data-theme-cycle]');
	await expect(row).toContainText('Theme');
	const before = await row.textContent();
	await row.click();
	await expect(page.locator('[data-theme-cycle]')).not.toHaveText(before);
});

test('a jump holds a ring on where it landed, even with reduced motion [20]', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openTrip(page);
	await page.locator('.tab.day').nth(1).click();
	const ring = () =>
		page.evaluate(() => (document.querySelector('.landed') ? getComputedStyle(document.querySelector('.landed')).boxShadow : 'none'));
	await expect.poll(ring).not.toBe('none');
	await page.waitForTimeout(1200);
	expect(await ring(), 'still there after a second').not.toBe('none');
});

test('high contrast makes the bars solid and edges the link buttons [23]', async ({ page }) => {
	await page.emulateMedia({ contrast: 'more' });
	await openTrip(page);
	const [bar, link] = await page.evaluate(() =>
		[getComputedStyle(document.querySelector('#bar')), getComputedStyle(document.querySelector('#app .mlink'))].map((c) => [
			c.backdropFilter || c.webkitBackdropFilter || 'none',
			c.boxShadow,
		]),
	);
	expect(bar[0]).toBe('none');
	expect(link[1]).not.toBe('none');
});
