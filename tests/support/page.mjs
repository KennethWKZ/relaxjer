// Page probes shared by the e2e specs, ported from the legacy Playwright (Python) suites.
import { expect, test } from '@playwright/test';
import { STORE_KEY } from './store-key.mjs';

/* global TRIP -- the trip data, read inside the page */

/**
 * Clicks, and if the click times out (Playwright waits for the target to be visible, enabled and still), attaches
 * what it was waiting on before failing: the target's box over 10 frames and every animation running on the page.
 * For a click that fails only rarely, on a slow runner, where re-running never shows why (bottom-bar's Days row).
 */
export async function clickOrExplain(loc, { timeout = 15_000 } = {}) {
	try {
		await loc.click({ timeout });
	} catch (err) {
		const what = await loc
			.evaluate(
				(el) =>
					new Promise((done) => {
						const name = (e) =>
							e && e.nodeType === 1
								? `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${[...e.classList].map((c) => `.${c}`).join('')}`
								: String(e);
						const box = (e) => {
							const r = e.getBoundingClientRect();
							return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100);
						};
						const scroller = el.closest('dialog, [data-sec]');
						const frames = [];
						const tick = () => {
							frames.push({ t: Math.round(performance.now()), box: box(el), scrollTop: scroller ? scroller.scrollTop : null, scrollY });
							if (frames.length < 10) requestAnimationFrame(tick);
							else
								done({
									target: name(el),
									frames,
									animations: document.getAnimations().map((a) => ({
										on: name(a.effect && a.effect.target),
										kind: a.constructor.name,
										name: a.animationName || a.transitionProperty || '',
										state: a.playState,
										time: a.currentTime,
										iterations: a.effect ? String(a.effect.getTiming().iterations) : null, // Infinity reads as null in JSON
									})),
								});
						};
						requestAnimationFrame(tick);
					}),
			)
			.catch((e) => ({ unavailable: String(e) }));
		await test.info().attach('click-diagnostics', { body: JSON.stringify(what, null, 2), contentType: 'application/json' });
		throw err;
	}
}

/** Waits until scrollY has not moved for 5 frames' worth of polls (legacy SETTLE). */
export async function settle(page) {
	await page.evaluate(
		() =>
			new Promise((done) => {
				let last = -1,
					same = 0;
				const tick = () => {
					same = Math.abs(scrollY - last) < 1 ? same + 1 : 0;
					last = scrollY;
					if (same >= 5) done();
					else setTimeout(tick, 100);
				};
				tick();
			}),
	);
}

/** What the reader is looking at: the section and the nearest element with an id, just under the sticky bar. */
export function readingSpot(page) {
	return page.evaluate(() => {
		const bar = document.querySelector('.bar');
		const y = (bar ? bar.getBoundingClientRect().bottom : 0) + 60;
		const el = document.elementFromPoint(innerWidth / 2, y);
		return { sec: el?.closest('[data-sec]')?.id ?? null, id: el?.closest('[id]')?.id ?? null };
	});
}

/** Scrolls by dy the way a reader would (wheel where supported, else a plain scroll), then settles. */
export async function scrollBy(page, dy) {
	await page.evaluate((d) => window.scrollBy(0, d), dy);
	await settle(page);
}

/** Elements that stick out sideways: page-level horizontal scroll, and anything wider than its section. */
export function overflow(page) {
	return page.evaluate(() => {
		const out = [];
		const de = document.documentElement;
		if (de.scrollWidth > de.clientWidth + 1) out.push(`page scrolls sideways: ${de.scrollWidth} > ${de.clientWidth}`);
		const SCROLLERS = '.map-ctrl,.tbl-wrap,.scroll-x,.maplibregl-map,.week';
		for (const sec of document.querySelectorAll('#app > section')) {
			const s = sec.getBoundingClientRect();
			for (const e of sec.querySelectorAll('*')) {
				if (e.closest(SCROLLERS) || e.closest('details:not([open]) > :not(summary)')) continue;
				const r = e.getBoundingClientRect();
				if (!r.width || !r.height) continue;
				// a view's band of sky runs edge to edge on purpose (its words keep to the column): the screen bounds it
				const bleed = e.closest('[data-band]') && !e.closest('.band-col');
				const excess = bleed ? Math.max(-r.left, r.right - innerWidth) : Math.max(s.left - r.left, r.right - s.right);
				if (excess <= 0.5) continue;
				// an ancestor inside the section that clips it keeps it from showing
				let clipped = false;
				for (let a = e.parentElement; a && a !== sec; a = a.parentElement) {
					const cs = getComputedStyle(a);
					if (/(hidden|clip|auto|scroll)/.test(cs.overflowX)) {
						clipped = true;
						break;
					}
				}
				if (!clipped) out.push(`#${sec.id} ${e.tagName.toLowerCase()}.${[...e.classList].join('.')} sticks out ${excess.toFixed(1)} px`);
			}
		}
		return [...new Set(out)].slice(0, 20);
	});
}

/** Text squeezed into a sliver: 3 or more lines at under 7 characters' width while the parent has room (legacy squeeze.py). */
export function squeezed(page) {
	return page.evaluate(() => {
		const out = [];
		for (const e of document.querySelectorAll('#app *')) {
			const texts = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
			const own = texts
				.map((n) => n.textContent)
				.join('')
				.trim();
			if (own.length < 6) continue;
			const r = e.getBoundingClientRect();
			if (r.width <= 2 || r.height <= 2) continue; // not drawn, or a screen-reader-only label
			const fs = parseFloat(getComputedStyle(e).fontSize) || 16;
			// lines of this element's own text only: child blocks (a share line, a currency line) are deliberate
			const tops = new Set();
			for (const t of texts) {
				const range = document.createRange();
				range.selectNodeContents(t);
				for (const x of range.getClientRects()) tops.add(Math.round(x.top));
			}
			const lines = tops.size;
			const pw = e.parentElement ? e.parentElement.getBoundingClientRect().width : r.width;
			if (r.width < 1.5 * fs || (lines >= 3 && r.width / fs < 7 && pw > 2.5 * r.width))
				out.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${own.slice(0, 30)}" ${Math.round(r.width)}px × ${lines} lines`);
		}
		return out.slice(0, 20);
	});
}

/** Words (letters and digits; a number with its separators, "1,200", "10:45" or "02-2629-6860"; a range of them) that the browser split
 *  across two lines inside `sel`, leaving out text inside `skip` (with `numbers`, only number runs): "Manageabl" over "e" in an airport tile's cell. */
export function splitWords(page, sel, skip = null, numbers = false) {
	return page.evaluate(
		([sel, skip, numbers]) => {
			// numbers: only number runs (a range, a phone number, a date), so Chinese wrapping between characters is left alone
			const re = numbers ? /\d[\d,.:/]*(?:[–-]\d[\d,.:/]*)+/g : /[\p{L}\p{N}](?:[\p{L}\p{N}–]|[:,./-](?=\d))*/gu;
			const out = [];
			for (const el of document.querySelectorAll(sel)) {
				const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
				for (let n; (n = walker.nextNode());) {
					if (skip && n.parentElement.closest(skip)) continue;
					for (const m of n.textContent.matchAll(re)) {
						if (/^\p{Script=Han}/u.test(m[0]) && !/\d/.test(m[0])) continue; // Chinese breaks between characters
						const range = document.createRange();
						range.setStart(n, m.index);
						range.setEnd(n, m.index + m[0].length);
						const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
						if (tops.size > 1) out.push(m[0]);
					}
				}
			}
			return out;
		},
		[sel, skip, numbers],
	);
}

/**
 * Figures in the trip's currency (TRIP.currency.sym and a digit) in the page's text, other than the originals a
 * converted figure keeps beside it (.cv-o) or under it ([data-rm]): [{ where, text }]. With `all`, the originals too.
 */
export function tripAmounts(page, all = false) {
	return page.evaluate((all) => {
		if (window.RJ_FILL) window.RJ_FILL(); // the sheets too: they're built on first open
		const sym = TRIP.currency.sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const re = new RegExp(`(?<![A-Za-z0-9])${sym}[ \\u00a0\\u202f]?\\d`);
		const out = [];
		const walk = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
		for (let n = walk.nextNode(); n; n = walk.nextNode()) {
			const el = n.parentElement;
			if (!re.test(n.textContent) || el.closest('script, template')) continue;
			if (!all && el.closest('.cv-o, [data-rm]')) continue;
			out.push({ where: el.closest('[id]')?.id ?? '?', text: n.textContent.trim().slice(0, 80) });
		}
		return out;
	}, all);
}

/** The header's currency button: it names the currency the figures would switch to. */
export const curBtn = (page) => page.locator('#bar #curBtn');

/* ───────── the bottom bar (ADR-20261124-bottom-app-bar): below 1024 px Today, Days, Map and More; a desktop keeps the
   rail and the Sections button ───────── */

export const BAR = {
	bar: '#tabbar',
	item: '#tabbar .tb',
	today: '#tabbar [data-tb="top"]',
	days: '#daysBtn',
	map: '#tabbar [data-tb="map"]',
	more: '#moreBtn',
	daysSheet: '#days',
	dayRow: '#days [data-day]',
	lit: '#tabbar .tb[aria-current]',
	skyRow: '#toc [data-sky-toggle]',
};

/* ───────── grouped lists (ADR-20261124-grouped-lists): the rail, Days, More and the Sections sheet ───────── */

export const LIST = {
	card: '.gl',
	head: '.gl-h',
	row: '.gl > .rl',
	/** a row that goes somewhere: a link to a view, or Group sync's row that opens its sheet */
	go: '.gl > a.rl, .gl > .rl.toc-sync',
	pick: '.gl > .rl.rl-pick',
	act: '.gl > .rl.rl-act',
	lit: '.gl > .rl[aria-current]',
	tile: '.rl-sq',
	value: '.rl-v',
	/** the mark at a row's end: › (chev-r) for one that goes somewhere, ⌃⌄ (updown) for a choice */
	end: '.rl-ch',
};

/** What's wrong with the grouped lists under `root`, one line each: a row under 52 px, a row narrower than its card (one
 *  column), a row whose end mark doesn't say what it does (› to go, ⌃⌄ for a choice, nothing for an action), a choice
 *  with no value, or a hairline that is missing or doesn't start where the words do. */
export async function auditList(page, root) {
	// a sheet that just opened is still growing from 0.96: measure it once it has arrived
	await page.locator(root).evaluate((r) => Promise.all(r.getAnimations({ subtree: true }).map((a) => a.finished)));
	return page.locator(root).evaluate((r, L) => {
		const out = [];
		for (const card of r.querySelectorAll(L.card)) {
			if (!card.getClientRects().length) continue;
			const rows = [...card.children].filter((e) => e.matches('.rl') && e.getClientRects().length);
			rows.forEach((e, i) => {
				const b = e.getBoundingClientRect();
				const name = e.textContent.trim().replace(/\s+/g, ' ').slice(0, 28);
				// layout sizes (offset*), so a sheet still scaling in doesn't read as short rows
				if (e.offsetHeight < 52) out.push(`${name}: ${e.offsetHeight} px tall`);
				if (e.offsetLeft !== card.offsetLeft + card.clientLeft || Math.abs(e.offsetWidth - card.clientWidth) > 1)
					out.push(`${name}: narrower than its card`);
				const kind = e.matches(L.go.replaceAll('.gl > ', '')) ? 'go' : e.matches('.rl-pick') ? 'pick' : 'act';
				const want = { go: '#i-chev-r', pick: '#i-updown', act: null }[kind];
				const end = e.querySelector(`:scope > ${L.end} use`);
				const got = end ? end.getAttribute('href') : null;
				if (got !== want) out.push(`${name}: a ${kind} row ends in ${got}, not ${want}`);
				if (kind === 'pick' && !(e.querySelector(L.value) || {}).textContent) out.push(`${name}: a choice with no value`);
				if (i === 0) return;
				const h = getComputedStyle(e, '::before');
				const words = e.querySelector('.rl-t').getBoundingClientRect();
				const from = b.left + parseFloat(h.left);
				if (h.content === 'none' || parseFloat(h.height) < 1 || /rgba\(0, 0, 0, 0\)|transparent/.test(h.backgroundColor))
					out.push(`${name}: no hairline above`);
				else if (Math.abs(from - words.left) > 2 || from < e.firstElementChild.getBoundingClientRect().right)
					out.push(`${name}: its hairline starts at ${Math.round(from - b.left)} px, not where the words do (${Math.round(words.left - b.left)})`);
			});
		}
		return out;
	}, LIST);
}

/** How a grouped-list row looks: its fill, ring, the weight of its name, and the ring's contrast against its card (with
 *  `dress`, its day colours swapped for these for the measure, then put back). */
export function rowLook(row, dress = null) {
	return row.evaluate((e, dress) => {
		const was = e.getAttribute('style');
		// no transition, so the measure reads the new colours, not a step on the way (interpolated in oklab)
		if (dress) e.setAttribute('style', `${dress};transition:none`);
		const rgb = (s) => {
			const m = s.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/);
			if (m) return m.slice(1, 4).map((x) => +x * 255);
			const c = s.match(/rgba?\(([^)]+)\)/);
			if (!c) throw new Error(`a colour this measure can't read: ${s}`);
			return c[1]
				.split(/[ ,/]+/)
				.slice(0, 3)
				.map(Number);
		};
		const lum = (c) =>
			c
				.map((v) => v / 255)
				.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
				.reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
		const ratio = (a, b) => {
			const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p);
			return (x + 0.05) / (y + 0.05);
		};
		const st = getComputedStyle(e);
		const card = getComputedStyle(e.parentElement).backgroundColor;
		const look = {
			fill: st.backgroundColor,
			ring: st.boxShadow,
			weight: +getComputedStyle(e.querySelector('.rl-t b')).fontWeight,
			// against both its neighbours: the card around the row and the row's own tint
			ringContrast: st.boxShadow === 'none' ? 0 : Math.min(ratio(st.boxShadow, card), ratio(st.boxShadow, st.backgroundColor)),
			outlineContrast: ratio(st.outlineColor, card),
			outlineOffset: parseFloat(st.outlineOffset),
		};
		if (dress) e.setAttribute('style', was || '');
		return look;
	}, dress);
}

/** True where the bottom bar stands (a phone, a tablet), false on a desktop. */
export const hasBar = (page) => page.locator(BAR.bar).isVisible();

/** Opens the menu with the sections and the settings the way a reader does: the bar's More on a phone and a tablet, the
 *  round Sections button on a desktop (there from the first screen of every view). */
export async function openSections(page) {
	if (await hasBar(page)) await page.locator(BAR.more).click();
	else {
		await expect(page.locator('#tocBtn')).toHaveAttribute('data-show', '1');
		await page.locator('#tocBtn').click();
	}
	await expect(page.locator('#toc')).toBeVisible();
}

/** The sky's Pause where a reader finds it: in the header on a desktop; in the bar's More on a phone and a tablet (this
 *  opens More when it's closed). */
export async function skyPause(page) {
	if (!(await hasBar(page))) return page.locator('#skyBtn');
	if (!(await page.locator('#toc').evaluate((d) => d.open))) await page.locator(BAR.more).click();
	await expect(page.locator('#toc')).toBeVisible();
	return page.locator(BAR.skyRow);
}

/* ───────── views (ADR-20261122-day-views): one part of the trip on screen at a time ───────── */

/** The view on screen: its section's id (#top, #d3, #budget…). */
export const viewOn = (page) => page.locator('html').getAttribute('data-showing');

/** Builds every closed sheet and list, as a search does: a part's sheet is drawn the first time it opens
 *  (06-render-blocks.js), so a check that reads the whole page fills them first. */
export const fillAll = (page) => page.evaluate(() => window.RJ_FILL && window.RJ_FILL());

/** Shows a view the way a reader does and waits for it: on a phone and a tablet the bottom bar (Today and the map
 *  straight from it, a day from Days, any other section from More); on a desktop the week rail. */
export async function goToView(page, id) {
	if (await hasBar(page)) {
		const direct = page.locator(`${BAR.bar} a[href="#${id}"]`);
		if (await direct.count()) await direct.click();
		else if (await page.locator(`#app > #${id}.day`).count()) {
			await page.locator(BAR.days).click();
			await page.locator(`#days [data-day="${id}"]`).click();
		} else {
			await page.locator(BAR.more).click();
			await page.locator(`#toc a[href="#${id}"]`).first().click();
		}
	} else await page.locator(`#rail [data-rail="${id}"]`).click();
	await expect(page.locator('html')).toHaveAttribute('data-showing', id);
	await settle(page);
}

/** The parts of the page the views add: summary buttons, their sheets, a stop's sheet, the day's pager, the rail. */
export const VIEWS = {
	part: '.part[data-part]',
	sheet: 'dialog.bsheet',
	openSheet: 'dialog.bsheet[open]',
	stopMore: '.stop-more',
	pager: '.pager',
	prev: '.pager [data-pager="prev"]',
	next: '.pager [data-pager="next"]',
	rail: '#rail',
	band: '[data-band]',
	skyBtn: '#skyBtn',
	shake: '[data-shake]',
};

/** Opens a summary button's sheet in the view on screen (its button by index, or a locator) and returns the sheet. */
export async function openPart(page, which = 0) {
	const view = await viewOn(page);
	const btn = typeof which === 'number' ? page.locator(`#${view} ${VIEWS.part}`).nth(which) : which;
	const id = await btn.getAttribute('data-part');
	await btn.scrollIntoViewIfNeeded();
	await btn.click();
	const sheet = page.locator(`dialog#${id}`);
	await expect(sheet).toBeVisible();
	return sheet;
}

/** Brings what a locator (or selector) names on screen the way a reader gets there: its view first (by the address,
 *  as a tab or a shared link does), then its sheet when it lives in one, then scrolled into sight. */
export async function show(page, target) {
	const loc = (typeof target === 'string' ? page.locator(target) : target).first();
	if (!(await loc.count())) await fillAll(page); // it waits in a sheet not opened yet
	const at = await loc.evaluate((e) => ({ view: e.closest('#app > [data-sec]')?.id || '', sheet: e.closest('dialog.bsheet')?.id || '' }));
	if (at.view && (await viewOn(page)) !== at.view) {
		await page.evaluate((h) => (location.hash = h), `#${at.view}`);
		await expect(page.locator('html')).toHaveAttribute('data-showing', at.view);
	}
	if (at.sheet && !(await page.locator(`dialog#${at.sheet}`).evaluate((d) => d.open))) {
		const btn = page.locator(`[data-part="${at.sheet}"]`).first();
		await btn.scrollIntoViewIfNeeded();
		await btn.click();
		await expect(page.locator(`dialog#${at.sheet}`)).toBeVisible();
	}
	await loc.scrollIntoViewIfNeeded();
	return loc;
}

/** Opens the sheet a place inside one lives in (a block in a day, a stop's links), so its contents can be read. */
export async function revealIn(page, inner) {
	if (!(await inner.count())) await fillAll(page);
	const id = await inner.first().evaluate((e) => (e.closest('dialog.bsheet') || {}).id || '');
	if (!id) return;
	const btn = page.locator(`[data-part="${id}"]`).first();
	await btn.scrollIntoViewIfNeeded();
	await btn.click();
	await expect(page.locator(`dialog#${id}`)).toBeVisible();
}

/** Opens every closed <details> so build-on-open lists render, and for the page-wide audits draws every view and every
 *  sheet in place (one view at a time and sheets that open on a tap would hide most of the page from them); waits for
 *  layout. Each sheet is drawn as wide as it opens: a phone sheet's width (the column plus its gutters), and on a
 *  desktop the side panel's. */
export async function openAllDetails(page) {
	await fillAll(page);
	await page.evaluate(() => {
		document.documentElement.classList.add('rj-audit');
		const st = document.createElement('style');
		st.textContent = `html.rj-audit #app > [data-off] { display: block !important; }
			html.rj-audit #app dialog.bsheet { display: block; position: static; inset: auto; margin: 12px -16px; width: auto;
				max-width: none; height: auto; max-height: none; transform: none; opacity: 1; box-shadow: none; overflow: visible; }
			@media (min-width: 1024px) { html.rj-audit #app dialog.bsheet { margin: 12px 0; max-width: min(500px, 42vw); } }`;
		document.head.append(st);
		// a stop's sheet lives in its row, and the map's filter sheet in the map's stage; drawn in place they would get that
		// narrow column (or a margin meant for the view's padding), so they move to the foot of their view, where they get
		// a sheet's width (their ids and content stay the same)
		document
			.querySelectorAll('#app dialog.ssheet, #app dialog.bsheet')
			.forEach((d) => d.parentElement !== d.closest('[data-sec]') && d.closest('[data-sec]').append(d));
		// below 1024 px a sheet is drawn edge to edge, so it reaches out over its view's own side padding (16 px on most
		// views, none on the map's)
		if (innerWidth < 1024)
			document.querySelectorAll('#app dialog.bsheet').forEach((d) => {
				d.style.marginInline = `-${parseFloat(getComputedStyle(d.parentElement).paddingLeft) || 0}px`;
			});
		document.querySelectorAll('#app details:not([open])').forEach((d) => {
			d.open = true;
		});
	});
	await page.waitForTimeout(300);
}

/** Switches the UI language through the page's own control. */
export async function switchLang(page, lang) {
	const want = lang === 'en' ? 'en' : 'zh-Hans';
	// the header's one language button names the other language, so it's only there to click when we need a change
	if ((await page.locator('html').getAttribute('lang')) !== want) await page.locator(`#langBtn[data-lang="${lang}"]`).click();
	await expect(page.locator('html')).toHaveAttribute('lang', want);
	await settle(page);
}

/** Sets per-device state the way the page stores it (JSON under the trip's prefix), then reloads. */
export async function setStored(page, entries) {
	await page.evaluate(
		({ e, key }) => {
			for (const [k, v] of Object.entries(e)) localStorage.setItem(`${key}${k}`, JSON.stringify(v));
		},
		{ e: entries, key: STORE_KEY },
	);
	await page.reload();
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
}

/** The place finder (the map's search) and the add sheet's preview, as tests/e2e/place-finder.spec.mjs reaches them. */
export const FINDER = {
	query: '#mapq',
	results: '#mapres',
	result: (pid) => `#mapres [data-mres="${pid}"]`,
	googleSearch: '#mapres [data-gsearch]',
	googleResult: '#mapres [data-gfind]',
	googleBack: '#mapres [data-gback]',
	panel: '#mapfind',
	back: '#mappane [data-find-back]', // the finder's way back sits in the list pane's head
	count: '#panet',
	best: '#mapfind .pf-best',
	addBest: '#mapfind .pf-best [data-fit-add]',
	otherDays: '#mapfind .pf-day',
	detailsBtn: '#mapfind [data-find-detail]',
	sheet: '#placeSheet',
	list: '[data-addfind]',
	listRow: '[data-add-res] [data-add-peek]',
	listAdd: '[data-add-res] [data-add]',
	preview: '[data-addprev]',
	previewBack: '[data-add-back]',
	save: '[data-add-save]',
	dayPicked: '[data-add-day][aria-pressed="true"]',
	google: '[data-gplace]',
	googleBox: '.gplace',
	detailsCard: '.pdet',
};

/** The map view's parts (ADR-20261124-map-first-search), as tests/e2e/map-search.spec.mjs reaches them: the stage, the
 *  map's box, the list pane over it and its height buttons, the List button, the Filters button and its sheet. */
export const MAP = {
	stage: '#mapstage',
	box: '#mapbox',
	pane: '#mappane',
	paneHead: '#mappane .pane-head',
	up: '#mappane [data-pane="up"]',
	down: '#mappane [data-pane="down"]',
	close: '#mappane [data-pane="close"]',
	list: '[data-maplist]',
	filters: '[data-mapfilters]',
	filtersLabel: '#mapfilt-l',
	filtersSheet: '#mapfilt',
	day: (id) => `#mapfilt [data-filter="${id}"]`,
	area: '#mapfilt [data-view]',
	cats: '.map-chips .map-ctrl [data-cat]',
	pin: (pid) => `#livemap .lpin[data-pid="${pid}"]`,
	full: '[data-mapfull="1"]',
	exit: '.map-exit',
};

/** The landing page's (site/) parts the e2e checks: a looping demo, its Pause, the screen it plays on, the sky's art, the theme button and the hero phone's screenshot. */
export const SITE = {
	demo: '[data-demo]',
	pause: '.pause',
	screen: '.screen',
	sky: '.scene .lit, .scene .birds',
	sun: '.scene .sun',
	theme: '.nav-theme',
	shot: '.desk .phone img',
};
