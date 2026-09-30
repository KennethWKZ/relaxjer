// Page probes shared by the e2e specs, ported from the legacy Playwright (Python) suites.
import { expect } from '@playwright/test';

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
		const SCROLLERS = '.tabs,.map-ctrl,.tbl-wrap,.scroll-x,.maplibregl-map,.week';
		for (const sec of document.querySelectorAll('#app > section')) {
			const s = sec.getBoundingClientRect();
			for (const e of sec.querySelectorAll('*')) {
				if (e.closest(SCROLLERS) || e.closest('details:not([open]) > :not(summary)')) continue;
				const r = e.getBoundingClientRect();
				if (!r.width || !r.height) continue;
				const excess = Math.max(s.left - r.left, r.right - s.right);
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

/** Opens every closed <details> so build-on-open lists render, then waits for layout. */
export async function openAllDetails(page) {
	await page.evaluate(() =>
		document.querySelectorAll('#app details:not([open])').forEach((d) => {
			d.open = true;
		}),
	);
	await page.waitForTimeout(300);
}

/** Switches the UI language through the page's own control. */
export async function switchLang(page, lang) {
	await page.locator(`.seg [data-lang="${lang}"]`).first().click();
	await expect(page.locator('html')).toHaveAttribute('lang', lang === 'en' ? 'en' : 'zh-Hans');
	await settle(page);
}

/** Sets per-device state the way the page stores it (JSON under the tp5. prefix), then reloads. */
export async function setStored(page, entries) {
	await page.evaluate((e) => {
		for (const [k, v] of Object.entries(e)) localStorage.setItem(`tp5.${k}`, JSON.stringify(v));
	}, entries);
	await page.reload();
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
}
