/* ───────── views: one part of the trip on screen at a time (ADR-20261122-day-views) ─────────
   Every tab is a view: the overview, each day, and each section the tabs list. A view is its <section data-sec> in
   #app; the others stay in the page (search, copy, the map and every jump read them) but aren't drawn ([data-off]).
   The address names the view (#d3, #budget…) or a place inside one (#d3-s2), and every way in (a tab, the week list,
   the rail, the day's previous / next buttons, the Sections menu, search, the Now card, a map pin's list link) shows
   that view first. Each history step remembers its own place, so Back and Forward return to the same view at the same
   scroll (the back-navigation rules in memory-bank/standards/patterns/frontend.md). The page restores every step
   itself, so the browser's own restoration is off for good. */
let curView = '';
let curVid = 0;
let vseq = Date.now() % 1e9;
let lastY = 0;
const viewY = new Map(); // history step (its vid) → where the reader was in it
try {
	history.scrollRestoration = 'manual';
} catch {
	/* an old browser: its own restore */
}
addEventListener('scroll', () => (lastY = window.scrollY), { passive: true });
const viewSecs = () => $$('#app > [data-sec]');
/** the view (its section id) an element sits in, '' for none */
function viewOf(el) {
	const s = el && el.closest && el.closest('#app > [data-sec]');
	return s ? s.id : '';
}
/** the element an address names (#d3, #d3-s2, #wish-x…), building its lazy list if it waits in one */
function hashTarget(h = location.hash) {
	const id = decodeURIComponent(String(h || '').replace(/^#/, ''));
	if (!id || /^add=/.test(id)) return null;
	return document.getElementById(id) || lazyFor(id);
}
/** an address naming a card the page builds only when it's asked for (a meal, a wishlist place: the page shows compact
 *  rows) has nothing to land on, so it opens the card in its sheet, as a tap on its row does. True when it did */
function cardFromHash(h = location.hash) {
	const id = decodeURIComponent(String(h || '').replace(/^#/, ''));
	if (!id || /^add=/.test(id) || hashTarget(h)) return false;
	const card = placeCardHTML(id);
	if (card) openSheet(card, id);
	return !!card;
}
// the views in tab order, as drawn (a trip without a live map draws no map view)
const viewIds = () => viewSecs().map((s) => s.id);
const viewIdx = (id) => viewIds().indexOf(id);

/** shows one view: the others aren't drawn, the tab and the rail light it, the sky takes its weather. y: scroll to */
function showView(id, y) {
	const secs = viewSecs();
	if (!secs.length) return;
	if (!secs.some((s) => s.id === id)) id = secs[0].id;
	const prev = curView;
	curView = id;
	secs.forEach((s) => s.toggleAttribute('data-off', s.id !== id));
	document.documentElement.dataset.showing = id;
	active = ''; // relight even when the redraw left the same id lit
	setActive(id);
	railMark();
	skyView(id);
	if (y != null) window.scrollTo({ top: y, behavior: 'instant' });
	lastY = window.scrollY;
	if (prev && prev !== id) viewEnter(id, prev);
	requestAnimationFrame(fabSync);
}
// the new view slides in a little from the side it lies on (days later in the trip from the right), in 220 ms; a fade
// alone under reduced motion. Tens of times a day, so it stays small: 16 px and the page's own ease-out
function viewEnter(id, prev) {
	const sec = document.getElementById(id);
	if (!sec || !sec.animate) return;
	const dir = Math.sign(viewIdx(id) - viewIdx(prev)) || 1;
	const still = noMotion();
	const kf = still
		? [{ opacity: 0.4 }, { opacity: 1 }]
		: [
				{ opacity: 0, transform: `translateX(${dir * 16}px)` },
				{ opacity: 1, transform: 'none' },
			];
	[...sec.children]
		.filter((c) => !c.matches('dialog, .day-bar') && c.getClientRects().length)
		.slice(0, 3)
		.forEach((c, i) =>
			c.animate(kf, { duration: still ? 160 : 220, delay: still ? 0 : i * 30, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }),
		);
}
// the step being left keeps where the reader was, in its own state (a reload) and here (Forward)
function viewLeave(y = window.scrollY) {
	viewY.set(curVid, y);
	history.replaceState(Object.assign({}, history.state, { y, view: curView, vid: curVid }), '');
}
/** to another view, as a new history step, at its top. The view on screen again: back to its top */
function goView(id, replace) {
	if (mapFullOn) mapFull(false);
	whenSettled(() => {
		if (id === curView) {
			window.scrollTo({ top: 0, behavior: noMotion() ? 'instant' : 'smooth' });
			return;
		}
		viewLeave();
		const st = { tpView: 1, view: id, vid: ++vseq };
		if (replace) history.replaceState(st, '', `#${id}`);
		else history.pushState(st, '', `#${id}`);
		curVid = st.vid;
		pinN++;
		showView(id, 0);
		focusView(id);
		syncBackPill();
	});
}
// a click in the rail leaves the focus in the rail, which scrolls on its own (Safari, which doesn't focus a clicked
// link, scrolls the area last clicked), and a day's previous / next button leaves with its view: Page Down and Space
// then moved the rail, or nothing. The new view's heading takes the focus instead (a screen reader says where it
// arrived), without a scroll. A tab in the strip keeps it: the strip only scrolls sideways
function focusView(id) {
	const a = document.activeElement;
	if (a && a !== document.body && !a.closest('#rail, #app > [data-off]')) return;
	const h = document.querySelector(`#${id} h1, #${id} h2`);
	if (!h) return;
	if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
	h.focus({ preventScroll: true });
}
/** after a full redraw (the first one, a language switch, a refresh): the view on screen stays; the first draw starts at
 *  the address's view, else the overview */
function viewApply() {
	if (!curView) {
		const el = hashTarget();
		const v = (el && viewOf(el)) || 'top';
		const st = history.state || {};
		curVid = st.vid || ++vseq;
		history.replaceState(Object.assign({}, st, { view: v, vid: curVid }), '');
		curView = v;
	}
	showView(curView);
}
/** an element in any view, on screen: its view first, then its sheet if it lives in one, then the element itself */
function landOn(el, ring) {
	if (!el) return;
	const v = viewOf(el);
	if (v && v !== curView) showView(v, 0);
	if (el.matches('#app > [data-sec]')) {
		window.scrollTo({ top: 0, behavior: 'instant' });
		return;
	}
	let p = el.closest('details');
	while (p) {
		p.open = true;
		p = p.parentElement && p.parentElement.closest('details');
	}
	const sheet = el.closest('dialog.bsheet');
	if (sheet) {
		partOpen(sheet, sheet === el ? null : el);
		return;
	}
	scrollToEl(el, 'start');
	if (ring) {
		flash(el);
		landed(el); // the ring holds 1.5 s on where the reader landed, a still outline under reduced motion
	}
}
// Back and Forward between our own steps (19-back-button.js hands every step that isn't an overlay's here)
function viewPop() {
	const st = history.state || {};
	viewY.set(curVid, lastY);
	if (!st.vid) {
		// a step the browser made from an address: a typed #…, or a link from outside the page
		const el = hashTarget();
		curVid = ++vseq;
		history.replaceState(Object.assign({}, st, { view: el ? viewOf(el) || curView : curView, vid: curVid }), '');
		if (el) landOn(el, true);
		syncBackPill();
		return;
	}
	curVid = st.vid;
	const v = st.view || viewOf(hashTarget()) || curView;
	const y = viewY.has(st.vid) ? viewY.get(st.vid) : st.y;
	pinN++;
	if (v !== curView) showView(v, y == null ? 0 : y);
	else if (y != null) window.scrollTo({ top: y, behavior: 'instant' });
	if (y != null) holdY(y);
	syncBackPill();
}
// a restored place can sit below what has drawn yet (pictures, lazy lists): put it back as the view grows, for a
// moment, unless the reader scrolls first
function holdY(y) {
	const n = pinN;
	let took = false;
	const IN = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
	const mine = () => (took = true);
	IN.forEach((ev) => addEventListener(ev, mine, { passive: true }));
	[60, 200, 450, 900].forEach((ms, i, all) =>
		setTimeout(() => {
			if (!took && pinN === n && Math.abs(window.scrollY - y) > 2) window.scrollTo({ top: y, behavior: 'instant' });
			if (i === all.length - 1) IN.forEach((ev) => removeEventListener(ev, mine));
		}, ms),
	);
}
addEventListener('hashchange', () => {
	const st = history.state;
	if (st && st.vid === curVid) return; // our own step, or one popstate already took
	if (!(st && st.vid) && cardFromHash()) return; // a card's address typed or pasted in, not a step of ours
	viewPop();
});

/* ───────── planning parts: a summary button in the view, the part itself in a sheet ─────────
   On a phone the sheet comes up from the bottom and scrolls on its own; from 1024 px it's a panel at the side. Back
   closes it (openDialog gives it a history step). A jump to something inside one opens it there (landOn). */
function partOpen(d, target) {
	if (!d) return;
	const btns = $$(`[data-part="${d.id}"]`);
	lazyFill(d); // built the first time it opens (06-render-blocks.js)
	// a sheet that holds one folded card (a single ticket) opens it: the summary button was the tap that asked for it
	const folds = [...d.querySelectorAll('.bsheet-body details')].filter((x) => !x.parentElement.closest('details'));
	if (folds.length === 1) folds[0].open = true;
	openDialog(d);
	whenSettled(() => {
		if (!d.open) return;
		btns.forEach((b) => b.setAttribute('aria-expanded', 'true'));
		d.addEventListener('close', () => btns.forEach((b) => b.setAttribute('aria-expanded', 'false')), { once: true });
		if (target) {
			target.scrollIntoView({ block: 'start', behavior: 'instant' });
			flash(target);
		} else d.scrollTop = 0;
		fabSync();
	});
}
document.addEventListener('click', (e) => {
	const b = e.target.closest('[data-part]');
	if (b) {
		partOpen(document.getElementById(b.dataset.part));
		return;
	}
	// a stop's row opens its sheet too (map, directions, what's near), anywhere but its own buttons and links
	const row = e.target.closest('.stop.has-more .stop-b');
	if (row && !e.target.closest('a, button, input, label, summary, details, dialog, .split-card')) {
		const more = row.querySelector('[data-part]');
		if (more) partOpen(document.getElementById(more.dataset.part));
	}
});

/* ───────── a phone's sheet follows a finger down from its grip or title, and lets go with the finger's speed ─────────
   Past 45 % of its height (or flicked) it closes; otherwise a spring puts it back (apple-design: response 0.3, damping
   0.82 back, 1 closing; the release velocity carried over). Desktop's side panel has no drag. */
function springTo(from, to, v0, opts, onFrame, onDone) {
	const w = (2 * Math.PI) / opts.response;
	const k = w * w;
	const c = 2 * opts.damping * w;
	let x = from;
	let v = v0;
	let last = 0;
	const step = (now) => {
		const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
		last = now;
		v += (-k * (x - to) - c * v) * dt;
		x += v * dt;
		if (Math.abs(x - to) < 0.5 && Math.abs(v) < 10) {
			onFrame(to);
			if (onDone) onDone();
			return;
		}
		onFrame(x);
		requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}
(() => {
	let drag = null;
	const desk = matchMedia('(min-width: 1024px)');
	const rubber = (o, dim) => (o * dim * 0.55) / (dim + 0.55 * o);
	const set = (d, y) => (d.style.transform = y ? `translateY(${y}px)` : '');
	document.addEventListener('pointerdown', (e) => {
		const d = e.target.closest('dialog.bsheet[open]');
		if (!d || desk.matches || e.button > 0 || drag || !e.target.closest('.bsheet-head') || e.target.closest('button, a')) return;
		drag = { d, id: e.pointerId, y0: e.clientY, h: d.offsetHeight, pts: [{ y: e.clientY, t: performance.now() }], dy: 0 };
		d.style.transition = 'none';
	});
	document.addEventListener(
		'pointermove',
		(e) => {
			if (!drag || e.pointerId !== drag.id) return;
			const dy = e.clientY - drag.y0;
			drag.dy = dy;
			set(drag.d, dy >= 0 ? dy : -rubber(-dy, 120));
			const now = performance.now();
			drag.pts.push({ y: e.clientY, t: now });
			while (drag.pts.length > 2 && now - drag.pts[0].t > 100) drag.pts.shift();
		},
		{ passive: true },
	);
	const end = (e) => {
		if (!drag || e.pointerId !== drag.id) return;
		const g = drag;
		drag = null;
		const a = g.pts[0];
		const b = g.pts[g.pts.length - 1];
		const v = b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;
		const projected = g.dy + ((v / 1000) * 0.998) / (1 - 0.998);
		const done = () => {
			g.d.style.transition = '';
			set(g.d, 0);
		};
		if (g.dy > 8 && (projected > g.h * 0.45 || v > 900))
			springTo(
				Math.max(0, g.dy),
				g.h + 24,
				v,
				{ response: 0.3, damping: 1 },
				(y) => set(g.d, y),
				() => {
					closeDialog(g.d);
					done();
				},
			);
		else if (Math.abs(g.dy) > 1) springTo(g.dy >= 0 ? g.dy : -rubber(-g.dy, 120), 0, v, { response: 0.3, damping: 0.82 }, (y) => set(g.d, y), done);
		else done();
	};
	document.addEventListener('pointerup', end);
	document.addEventListener('pointercancel', end);
})();

/* ───────── between days: the previous / next buttons at each day's foot, and a sideways swipe as a bonus ───────── */
function pagerHTML(d) {
	const ids = NAV.filter((n) => n.day || n.id === 'top' || navDrawn(n.id)).map((n) => n.id);
	const i = ids.indexOf(d.id);
	const card = (id, dir) => {
		if (!id) return '<span></span>';
		const x = dayById[id];
		const n = NAV.find((m) => m.id === id);
		const h = x ? (dir === 'prev' ? Z('上一天', 'Previous day') : Z('下一天', 'Next day')) : L(n.label);
		const sub = x ? `${dateLabel(x.date, x.dow)} · ${L(x.title)}` : id === 'top' ? Z('整个行程', 'The whole trip') : '';
		return `<a class="pg ${dir}" href="#${id}" data-pager="${dir}"${x ? ` style="${colorVars(x.c)}"` : ''}><b>${dir === 'prev' ? icon('arrow-l') : ''}<span>${esc(h)}</span>${dir === 'next' ? icon('arrow') : ''}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</a>`;
	};
	return `<nav class="pager" aria-label="${Z('换一天', 'Other days')}">${card(ids[i - 1], 'prev')}${card(ids[i + 1], 'next')}</nav>`;
}
// a section the tabs list is drawn unless it has nothing to show (the map without positions)
const navDrawn = (id) => (id === 'map' ? !!GEO : true);
(() => {
	let t0 = null;
	const app = $('#app');
	app.addEventListener(
		'touchstart',
		(e) => {
			const skip = '.tabs, .photos, .tbl-wrap, .map-wrap, .scroll-x, .route-line, .parts, input, textarea, [data-noswipe]';
			// in the snow globe a sideways swipe on the sky is the globe's (24-sky.js)
			const globe = skyMode() === 'globe' && e.target.closest('[data-band]');
			if (!dayById[curView] || e.touches.length > 1 || globe || e.target.closest(skip)) {
				t0 = null;
				return;
			}
			t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
		},
		{ passive: true },
	);
	app.addEventListener(
		'touchend',
		(e) => {
			if (!t0) return;
			const dx = e.changedTouches[0].clientX - t0.x;
			const dy = e.changedTouches[0].clientY - t0.y;
			const quick = Date.now() - t0.t < 700;
			t0 = null;
			if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
			const i = DAYS.indexOf(dayById[curView]) + (dx < 0 ? 1 : -1);
			if (DAYS[i]) goView(DAYS[i].id);
		},
		{ passive: true },
	);
})();
