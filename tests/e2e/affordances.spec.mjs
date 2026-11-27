// Affordance rules from memory-bank/standards/patterns/affordances.md, measured on the page (rule numbers in brackets):
// every control can be hit, looks like what it is, and shows its state.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { auditList, BAR, goToView, hasBar, LIST, openAllDetails, openSections, rowLook, setStored, show } from '../support/page.mjs';
/* global DAYS -- the trip data, read inside the page */

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

test('neighbouring buttons keep 8 px apart [3]', async ({ page }) => {
	await openTrip(page);
	const gaps = await page.evaluate(() =>
		[...document.querySelectorAll('.links-row')].map((e) => parseFloat(getComputedStyle(e).columnGap) || 0).filter((g) => g < 8),
	);
	expect(gaps).toEqual([]);
});

// measured, not read from CSS: the pre-departure pass found route legs, stop links, food chips, drink pills, the map's
// filters and pin tags 4–6 px apart. A segmented control (one control in parts), links inside a sentence and the rows of a
// grouped list (full-width rows of 52 px or more, split by a hairline: rule 3's exception) are exempt.
test('neighbouring targets in any container sit at least 8 px apart [3]', async ({ page }) => {
	await openTrip(page);
	await openAllDetails(page);
	const close = await page.evaluate(() => {
		const T = [...document.querySelectorAll('#app a, #app button, #app summary')].filter((e) => {
			const r = e.getBoundingClientRect();
			return r.width > 2 && r.height > 2 && getComputedStyle(e).display !== 'inline' && !e.parentElement.closest('.seg') && !e.closest('.gl');
		});
		const out = new Set();
		for (const a of T)
			for (const b of T) {
				if (a === b || a.parentElement !== b.parentElement) continue;
				const x = a.getBoundingClientRect(),
					y = b.getBoundingClientRect();
				const vov = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top),
					hov = Math.min(x.right, y.right) - Math.max(x.left, y.left);
				const g = vov > 4 && y.left >= x.right - 0.5 ? y.left - x.right : hov > 4 && y.top >= x.bottom - 0.5 ? y.top - x.bottom : null;
				if (g != null && g < 7.5) out.add(`${a.parentElement.className}: ${Math.round(g)} px`);
			}
		return [...out];
	});
	expect(close).toEqual([]);
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

// the day strip scrolled sideways, and the group didn't see the days behind its edge: below 1024 px the bar's Days lists
// every day as a row of its own, down the sheet, and nothing in the header scrolls sideways
test('every day is reachable without scrolling sideways [14][15]', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await hasBar(page)), "a desktop's rail lists every day down the page");
	await page.locator(BAR.days).click();
	const rows = page.locator(BAR.dayRow);
	await expect(rows).toHaveCount(await page.evaluate(() => DAYS.length));
	const sideways = await page.evaluate(
		() =>
			[...document.querySelectorAll('#bar *, #days *')].filter(
				(e) => e.scrollWidth > e.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(e).overflowX),
			).length,
	);
	expect(sideways, 'no sideways scroller in the header or the Days sheet').toBe(0);
	for (const r of await rows.all())
		expect((await r.boundingBox()).width, "each row the sheet's width").toBeGreaterThan(page.viewportSize().width * 0.8);
});

// the photo rows and the map's filters scroll sideways too, and had no cue at all
test('every other sideways row fades the edge that has more [14]', async ({ page }) => {
	await openTrip(page);
	const rows = page.locator('#app .photos, #app .map-ctrl');
	const n = await rows.count();
	let checked = 0;
	for (let i = 0; i < n; i++) {
		const row = rows.nth(i);
		// a jump past sections not drawn yet (content-visibility) can land off the row, and headless Chromium can leave a
		// section undrawn while it is on screen (real Chrome, scrolled by a person, cues every row): check the rows it drew
		let drawn = false;
		await show(page, row); // its view on screen first
		for (let k = 0; k < 5 && !drawn; k++) {
			await row.scrollIntoViewIfNeeded();
			await page.waitForTimeout(100);
			drawn = await row.evaluate((t) => {
				const r = t.getBoundingClientRect();
				return r.top >= 0 && r.bottom <= innerHeight && t.checkVisibility({ contentVisibilityAuto: true });
			});
		}
		if (!drawn) continue;
		const cue = () =>
			row.evaluate((t) => ({ more: t.scrollWidth > t.clientWidth + 2, l: t.classList.contains('more-l'), r: t.classList.contains('more-r') }));
		await row.evaluate((t) => t.scrollTo({ left: 0, behavior: 'instant' }));
		if (!(await cue()).more) continue;
		checked++;
		await expect.poll(cue).toEqual({ more: true, l: false, r: true });
		await row.evaluate((t) => t.scrollTo({ left: t.scrollWidth, behavior: 'instant' }));
		await expect.poll(cue).toEqual({ more: true, l: true, r: false });
	}
	test.skip(!checked, 'nothing scrolls sideways at this width');
});

test('the lit item in the bar or the rail shows more than a colour change, and the language button names the other language [16]', async ({
	page,
}) => {
	await openTrip(page);
	if (await hasBar(page)) {
		// the lit item: bold, and its icon's tile filled; the others neither
		const look = (sel) =>
			page.locator(sel).evaluate((e) => ({ w: +getComputedStyle(e).fontWeight, fill: getComputedStyle(e.querySelector('.tb-ic')).backgroundColor }));
		const on = await look(BAR.lit);
		const off = await look(`${BAR.item}:not([aria-current]) >> nth=0`);
		expect(on.w).toBeGreaterThanOrEqual(750);
		expect(off.w).toBeLessThan(750);
		expect(on.fill).not.toBe(off.fill);
	} else {
		const row = await page
			.locator('#rail .rl[aria-current="page"]')
			.evaluate((e) => ({ w: +getComputedStyle(e.querySelector('b')).fontWeight, ring: getComputedStyle(e).boxShadow }));
		expect(row.w).toBeGreaterThanOrEqual(750);
		expect(row.ring).not.toBe('none');
	}
	const btn = page.locator('#langBtn');
	await expect(btn, 'reading English: the button offers 中').toHaveText('中');
	await btn.click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
	await expect(btn).toHaveText('EN');
});

// with a mouse, hover never hides what the page says: a press on a search result or a tab shows over the hover fill at
// once, and the lit tab keeps its day's tint under the pointer
test('with a mouse, a press shows over the hover fill, and the lit tab keeps its tint under the pointer [16][17]', async ({ page }) => {
	await openTrip(page);
	test.skip(!(await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)), 'a touch screen has no hover');
	// the style a state ends on, without waiting out its transition
	const look = (loc) =>
		loc.evaluate((e) => {
			for (const a of e.getAnimations()) a.finish();
			const s = getComputedStyle(e);
			return { fill: s.backgroundColor, transform: s.transform };
		});
	const pointAt = async (loc) => {
		const b = await loc.boundingBox();
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
	};

	// a search result: hover greys it, and a press greys it further
	await page.locator('#searchBtn').click();
	const first = await page.evaluate(() => DAYS[0].id);
	const name = (await page.locator(`#${first}-s0 .stop-name`).textContent()).trim().slice(0, 6);
	await page.locator('#q').fill(name);
	const hit = page.locator('#results-inner .result[data-hit]').first();
	await expect(hit).toBeVisible();
	await pointAt(hit);
	const hover = await look(hit);
	await page.mouse.down();
	const down = await hit.evaluate((e) => getComputedStyle(e).backgroundColor);
	await page.mouse.move(0, 0);
	await page.mouse.up();
	expect(down, 'a pressed result shows over its hover fill, at once').not.toBe(hover.fill);
	await page.keyboard.press('Escape');

	// the bar: at a tablet's width with a mouse
	await page.setViewportSize({ width: 800, height: 900 });
	await expect(page.locator(BAR.bar)).toBeVisible();
	const lit = page.locator(`${BAR.lit} .tb-ic`);
	const off = page.locator(`${BAR.item}:not([aria-current]) .tb-ic`).first();
	await pointAt(off);
	const offHover = await look(off);
	await page.mouse.down();
	const offDown = await off.evaluate((e) => getComputedStyle(e).transform);
	await page.mouse.move(0, 0);
	await page.mouse.up();
	expect(offDown, 'a pressed tab sinks at once').not.toBe('none');
	const litRest = await look(lit);
	await pointAt(lit);
	const litHover = await look(lit);
	expect(litHover.fill, 'the lit tab keeps its tint under the pointer').not.toBe(offHover.fill);
	expect(litHover.fill, 'and the hover still shows on it').not.toBe(litRest.fill);
});

// the lists that take the reader somewhere, and the settings (ADR-20261124-grouped-lists): the rail on a desktop, Days and
// More below 1024 px, the desktop's Sections sheet. One column of full-width rows, 52 px or more, each ending in what it
// does (› to go somewhere, ⌃⌄ for a choice, nothing for an action), split by hairlines that start where the words do;
// the part of the trip on screen lit with two cues, its ring 3:1 on every lantern in both themes; the focus ring inside
// the card at 3:1; the press shows on touch-down
test('every go-to list is one column of 52 px rows ending in ›, split by inset hairlines, the lit row with two cues [2][3][12][16][17][19]', async ({
	page,
}) => {
	await openTrip(page);
	const bar = await hasBar(page);
	const day = await page.evaluate(() => DAYS[Math.min(1, DAYS.length - 1)].id);
	await goToView(page, day);
	// the list that names each day: Days below 1024 px, the rail beside the view on a desktop
	const dayList = bar ? '#days' : '#rail';
	if (bar) await page.locator(BAR.days).click();
	await expect(page.locator(dayList)).toBeVisible();
	expect(await auditList(page, dayList), `${dayList}: rows`).toEqual([]);
	await expect(page.locator(`${dayList} ${LIST.row}`).first()).toBeVisible();
	const lit = page.locator(`${dayList} ${LIST.lit}`);
	await expect(lit, 'the day on screen is lit').toHaveCount(1);
	await expect(lit).toHaveAttribute('href', `#${day}`);
	const on = await rowLook(lit);
	const off = await rowLook(page.locator(`${dayList} ${LIST.row}:not([aria-current])`).first());
	expect(on.weight, 'heavier words').toBeGreaterThanOrEqual(750);
	expect(off.weight).toBeLessThan(750);
	expect(on.fill, 'a tint').not.toBe(off.fill);
	// the ring on each of the seven lanterns, whatever days the trip has, in both themes: the lit row dressed in each in turn
	for (const scheme of ['light', 'dark']) {
		await page.emulateMedia({ colorScheme: scheme });
		for (let k = 1; k <= 7; k++) {
			const look = await rowLook(lit, `--c:var(--l${k});--ci:var(--l${k}-ink)`);
			expect(look.ringContrast, `lantern ${k}, ${scheme}: the ring against its row and its card`).toBeGreaterThanOrEqual(3);
		}
	}
	await page.emulateMedia({ colorScheme: 'light' });
	// the focus ring: inside the card (a negative offset, so the card's clip never cuts it) and 3:1 on it
	const first = page.locator(`${dayList} ${LIST.row}`).first();
	await page.keyboard.press('Tab');
	await first.focus();
	const f = await rowLook(first);
	expect(f.outlineOffset, 'the ring is drawn inside the row').toBeLessThan(0);
	expect(f.outlineContrast).toBeGreaterThanOrEqual(3);
	// pressed: the row greys and its mark sinks on touch-down, before any release
	const press = page.locator(`${dayList} ${LIST.row}:not([aria-current])`).last();
	await press.scrollIntoViewIfNeeded();
	const pb = await press.boundingBox();
	await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
	const rest = await rowLook(press);
	await page.mouse.down();
	const down = await press.evaluate((e) => ({ fill: getComputedStyle(e).backgroundColor, scale: getComputedStyle(e.firstElementChild).scale }));
	await page.mouse.move(0, 0);
	await page.mouse.up();
	expect(down.fill, 'the row greys at once').not.toBe(rest.fill);
	expect(down.scale, 'its mark sinks').toBe('0.9');

	// the menu with the sections and the settings: More below 1024 px, the Sections sheet on a desktop
	if (bar) await page.keyboard.press('Escape');
	// a planning section on screen (the first the trip has), so its row is lit
	const sec = await page
		.locator('#rail .rl[href]')
		.evaluateAll((as) =>
			as
				.map((a) => a.getAttribute('href').slice(1))
				.find((id) => id !== 'top' && id !== 'map' && !document.getElementById(id).classList.contains('day')),
		);
	await goToView(page, sec);
	await openSections(page);
	expect(await auditList(page, '#toc'), '#toc: rows').toEqual([]);
	await expect(page.locator(`#toc ${LIST.lit}`), 'the section on screen is lit').toHaveAttribute('href', `#${sec}`);
	// a choice (the maps app at every width) with its value; the audit above checked each row's end mark
	await expect(page.locator(`#toc ${LIST.pick}[data-maps-cycle] ${LIST.value}`), 'a choice shows its value').toHaveText(/Maps|地图/);
	// the cards are one column: every card spans the same width
	const widths = await page
		.locator(`#toc ${LIST.card}`)
		.evaluateAll((cs) => [...new Set(cs.filter((c) => c.getClientRects().length).map((c) => Math.round(c.getBoundingClientRect().width)))]);
	expect(widths, 'one column of cards').toHaveLength(1);
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
	const btn = await show(page, '.lantern .l-btn');
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

// a first visit follows the phone's own light or dark setting, until the reader picks one; a pick is kept whatever the
// phone says after
for (const colorScheme of ['light', 'dark']) {
	test(`a first visit follows the phone's ${colorScheme} setting`, async ({ page }) => {
		await page.emulateMedia({ colorScheme });
		await openTrip(page);
		await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
		expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(colorScheme);
	});
}
test('a theme the reader picked is kept, whatever the phone says', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await openTrip(page);
	await setStored(page, { theme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
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
	await openSections(page);
	const row = page.locator('[data-theme-cycle]');
	await expect(row).toContainText('Theme');
	const before = await row.textContent();
	await row.click();
	await expect(page.locator('[data-theme-cycle]')).not.toHaveText(before);
});

test('a jump holds a ring on where it landed, even with reduced motion [20]', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openTrip(page);
	// a link to a place in another view (a stop of the second day): its view, then the place, ringed
	await page.evaluate(() => (location.hash = `#${DAYS[1].id}-s1`));
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
