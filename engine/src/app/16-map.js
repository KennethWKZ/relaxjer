/* ───────── map ───────── */
const FIRST_VIEW = (TRIP.mapViews && TRIP.mapViews[0] && TRIP.mapViews[0].id) || 'all'; // the map opens on the trip's first area
let map = null;
let mapPins = [];
let mapDay = 'all';
let mapCat = 'all';
let mapNear = false;
let meLL = null; // map: every pin, day scope, category, sort by distance, where the phone is
function mapListHTML() {
	if (!GEO) return '';
	const pins = buildPins();
	const byDay = DAYS.filter((d) => d.id !== ROLE.flight).map((d) => ({
		d,
		items: pins.filter((p) => p.days.includes(d.id) && p.type !== 'mrt' && !p.drink && !p.wc),
	}));
	const other = pins.filter((p) => !p.days.length && p.type !== 'mrt' && !p.drink && !p.wc);
	const btn = (p) => `<button type="button" class="tag pinbtn" data-pick="${p.pid}" data-q="${esc(p.q || p.name)}">${esc(p.name)}</button>`;
	return (
		byDay
			.map(({ d, items }) =>
				items.length
					? `<p class="tail-sub">Day ${d.n} · ${esc(dateLabel(d.date, d.dow))}</p><div class="pills">${items.map(btn).join('')}</div>`
					: '',
			)
			.join('') +
		(other.length ? `<p class="tail-sub">${Z('酒店与备选', 'Hotel & optional')}</p><div class="pills">${other.map(btn).join('')}</div>` : '')
	);
}

/* ── the map's list pane (ADR-20261124-map-first-search) ──
   The search results and the place finder lie over the map, never above it, so a search never pushes the map away. On
   a narrow stage the pane is a sheet at the map's foot with three heights (peek, half, full): its head follows a finger
   (springTo, 20-views.js), and its two chevron buttons do the same by tap or keyboard. On a wide stage (the container
   query in style.css) it's a panel down the map's left. The camera aims past it, so a picked place lands in the part of
   the map the pane leaves open. */
const PANE_STOPS = ['peek', 'half', 'full'];
let paneStop = 'half'; // the sheet's height while it's open; it opens again at the same one
let paneH = 0; // the height it's at, or heading for
let paneAnim = 0; // a new move cancels the one in flight
let paneDrag = null;
const paneSeen = new WeakSet();
const paneEls = () => ({ st: $('#mapstage'), box: $('#mapbox'), pane: $('#mappane') });
const paneOn = () => {
	const p = $('#mappane');
	return !!p && !p.hidden;
};
// a side panel when the stage is wide: style.css says so on the box (--pane-side), even while the pane is closed
const paneSide = (box = $('#mapbox')) => !!box && getComputedStyle(box).getPropertyValue('--pane-side').trim() === '1';
/** the sheet's heights in px, from the map's own height: a peek shows its head and the first line, half leaves more
 *  than half the map open (and, for the finder, reaches down to its links, Directions among them: the map draws no
 *  line, so that's the way there; for a short list, all of it, so "Nothing found" shows its Google search row whole;
 *  measured, so a photo or a bigger text size still fits, while 140 px of map stay open), full covers all but a strip */
function paneStops() {
	const { box, pane } = paneEls();
	const H = box ? box.clientHeight : 0;
	const head = pane ? pane.querySelector('.pane-head').offsetHeight : 52;
	const top = Math.max(head, H - 12);
	const peek = Math.min(top, head + 64);
	const find = pane && pane.querySelector('#mapfind:not([hidden])');
	const links = find && find.querySelector('.links-row');
	const res = !find && pane && pane.querySelector('#mapres:not([hidden])');
	const list = res ? Math.ceil(res.getBoundingClientRect().top - pane.getBoundingClientRect().top + res.scrollHeight + 10) : 0;
	const need = links
		? Math.ceil(links.getBoundingClientRect().bottom - pane.getBoundingClientRect().top + find.scrollTop + 10)
		: list <= H - 140
			? list // a long list keeps the usual half: it scrolls
			: 0;
	return { peek, half: Math.min(top, Math.max(peek + 52, Math.round(H * 0.42), Math.min(need, H - 140))), full: top };
}
/** how much of the map the pane covers: the sheet's height at its foot, or the panel's width down its left */
function paneCover() {
	const { box, pane } = paneEls();
	if (!box || !pane || pane.hidden) return { left: 0, bottom: 0 };
	if (paneSide(box)) return { left: Math.round(pane.getBoundingClientRect().right - box.getBoundingClientRect().left), bottom: 0 };
	return { left: 0, bottom: Math.round(paneH) };
}
/** the camera's aim past the pane, in px from the map's middle (MapLibre's easeTo offset; Google pans the other way) */
function paneAim() {
	const c = paneCover();
	return { x: Math.round(c.left / 2), y: -Math.round(c.bottom / 2) };
}
/** fitting pins or an area: room around them, and for the pane while the map keeps enough to show them */
function panePad(base) {
	const c = paneCover();
	const box = $('#mapbox');
	const W = box ? box.clientWidth : 0;
	const H = box ? box.clientHeight : 0;
	return {
		top: base,
		right: base,
		bottom: base + (H - c.bottom > 2 * base + 120 ? c.bottom : 0),
		left: base + (W - c.left > 2 * base + 160 ? c.left : 0),
	};
}
/** framing a picked place with where the group is (both ends): room around them for the place's name, more on the
 *  right, clear of the map's own buttons; less on a small map, but always the pane's cover, so both land in the part of
 *  the map the pane leaves open */
function framePad() {
	const c = paneCover();
	const box = $('#mapbox');
	const W = (box ? box.clientWidth : 0) - c.left;
	const H = (box ? box.clientHeight : 0) - c.bottom;
	const v = Math.max(16, Math.min(72, Math.round((H - 134) / 2)));
	const h = Math.max(16, Math.min(64, Math.round((W - 172) / 2)));
	return {
		top: v,
		right: h + Math.min(32, Math.max(0, W - 2 * h - 172)), // the map's own buttons run down its right side
		bottom: v + c.bottom,
		left: h + c.left,
	};
}
function paneHeight(h) {
	const { box, pane } = paneEls();
	if (!pane || !box) return;
	pane.style.height = `${Math.round(h)}px`;
	box.style.setProperty('--pane-cover', `${Math.round(h)}px`); // the map's own controls and its message move up with it
}
function paneBtns() {
	const { box, pane } = paneEls();
	if (!pane) return;
	const side = paneSide(box);
	pane.dataset.stop = side ? 'side' : paneStop;
	const i = PANE_STOPS.indexOf(paneStop);
	const up = pane.querySelector('[data-pane="up"]');
	const dn = pane.querySelector('[data-pane="down"]');
	if (up) up.disabled = side || i === PANE_STOPS.length - 1;
	if (dn) dn.disabled = side || i === 0;
}
/** move the sheet to one of its heights: a spring from where it is (the finger's speed carried over), or at once
 *  under reduced motion, while closed, or on a wide stage, where the panel has no heights */
function paneTo(stop, opts = {}) {
	const { box, pane } = paneEls();
	if (!pane || !box) return;
	paneStop = stop;
	paneBtns();
	const n = ++paneAnim;
	if (paneSide(box)) {
		paneH = 0;
		pane.style.height = '';
		box.style.setProperty('--pane-cover', '0px');
		return;
	}
	const s = paneStops();
	const to = s[stop];
	const from = pane.offsetHeight || to;
	paneH = to;
	if (opts.instant || pane.hidden || noMotion() || Math.abs(from - to) < 1) {
		paneHeight(to);
		return;
	}
	// a hard flick carries over, but only so far: the sheet settles with a small give, never past the map's top
	const v = Math.max(-2400, Math.min(2400, opts.v || 0));
	const keep = (h) => Math.max(s.peek - 16, Math.min(s.full + 8, h));
	springTo(from, to, v, { response: 0.32, damping: v ? 0.86 : 1 }, (h) => n === paneAnim && paneHeight(keep(h)));
}
/** the whole map in view under the header, for a pane that just opened (Back puts the page back where it was) */
function stageInView() {
	const { st, box } = paneEls();
	if (mapFullOn || !st || !box) return;
	const r = box.getBoundingClientRect();
	const foot = innerHeight - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-bottom')) || 0);
	if (r.top >= barH - 1 && r.bottom <= foot + 1) return;
	scrollToEl(st, 'start', false);
}
/** the map's search let go of its field: once the phone's keyboard has gone (it moves the page while it's up, and the
 *  page comes back lower, the sheet's foot behind the bottom bar), line the map up again and set the sheet to a height
 *  that shows what it holds. With no keyboard (a desktop) nothing moves, and this lands at once */
let stageKbT = 0;
function stageAfterKeyboard() {
	if (!paneOn()) return;
	clearTimeout(stageKbT);
	const settle = () => {
		if (VV) VV.removeEventListener('resize', wait);
		clearTimeout(stageKbT);
		requestAnimationFrame(() => {
			if (!paneOn() || finderAt) return; // a tapped result: the finder sets its own height and frames its place
			stageInView();
			paneTo(paneStop === 'peek' ? 'half' : paneStop);
		});
	};
	// the keyboard slides down over a few frames, each a viewport resize: wait until they stop
	const wait = () => {
		clearTimeout(stageKbT);
		stageKbT = setTimeout(settle, 120);
	};
	if (VV) VV.addEventListener('resize', wait);
	stageKbT = setTimeout(settle, 450);
}
/** open or close the pane; it opens at its last height (never as a sliver), and keeps up with the map's size */
function paneShow(on) {
	const { box, pane } = paneEls();
	if (!pane || !box) return;
	if (on && !paneSeen.has(box)) {
		paneSeen.add(box);
		if (window.ResizeObserver) new ResizeObserver(() => paneOn() && paneTo(paneStop, { instant: true })).observe(box);
		// while the sheet follows a finger the page under it holds still: a touch's moves all go to where it started, so
		// the head alone listens (Safari before touch-action pans from a touchmove unless it's stopped)
		pane.querySelector('.pane-head').addEventListener(
			'touchmove',
			(e) => {
				if (paneDrag && e.cancelable) e.preventDefault();
			},
			{ passive: false },
		);
	}
	const was = !pane.hidden;
	pane.hidden = !on;
	box.classList.toggle('pane-open', on);
	if (!on) {
		paneAnim++;
		paneH = 0;
		box.style.setProperty('--pane-cover', '0px');
		return;
	}
	if (!was) {
		paneTo(paneStop === 'peek' ? 'half' : paneStop, { instant: true });
		stageInView();
	}
}
/** the day the map shows, on its Filters button: the day's colour and name, or "All days" */
const mapFiltDay = () => mapDay !== 'all' && dayById[mapDay];
const mapFiltLabel = (d = mapFiltDay()) => (d ? `Day ${d.n} · ${+d.date.slice(8)} ${L(d.dow)}` : Z('全部天', 'All days'));
function mapFiltSync() {
	const b = $('[data-mapfilters]');
	const l = $('#mapfilt-l');
	const d = mapFiltDay();
	if (l) l.textContent = mapFiltLabel(d);
	if (!b) return;
	b.classList.toggle('dayf', !!d);
	b.dataset.on = d ? '1' : '0';
	b.style.cssText = d ? colorVars(d.c) : '';
}
// the sheet's head follows a finger up and down; let go and it settles on the nearest height, the flick carried over
document.addEventListener('pointerdown', (e) => {
	const head = e.target.closest && e.target.closest('#mappane .pane-head');
	if (!head || e.button > 0 || paneDrag || e.target.closest('button, a') || paneSide()) return;
	const pane = $('#mappane');
	e.preventDefault(); // no text selection or page drag starts from the sheet's head
	paneAnim++;
	paneDrag = { id: e.pointerId, y0: e.clientY, h0: pane.offsetHeight, h: pane.offsetHeight, pts: [{ y: e.clientY, t: performance.now() }] };
	pane.classList.add('is-drag');
	try {
		head.setPointerCapture(e.pointerId);
	} catch {
		/* the pointer is already gone */
	}
});
document.addEventListener(
	'pointermove',
	(e) => {
		if (!paneDrag || e.pointerId !== paneDrag.id) return;
		const s = paneStops();
		const raw = paneDrag.h0 - (e.clientY - paneDrag.y0);
		// past the ends it gives a little, like a rubber band
		const h = raw > s.full ? Math.min(s.full + 8, s.full + (raw - s.full) * 0.25) : raw < s.peek ? s.peek - (s.peek - raw) * 0.25 : raw;
		paneDrag.h = h;
		paneH = h;
		paneHeight(h);
		const now = performance.now();
		paneDrag.pts.push({ y: e.clientY, t: now });
		while (paneDrag.pts.length > 2 && now - paneDrag.pts[0].t > 100) paneDrag.pts.shift();
	},
	{ passive: true },
);
const paneLetGo = (e) => {
	if (!paneDrag || e.pointerId !== paneDrag.id) return;
	const g = paneDrag;
	paneDrag = null;
	const pane = $('#mappane');
	if (pane) pane.classList.remove('is-drag');
	const a = g.pts[0];
	const b = g.pts[g.pts.length - 1];
	const v = b.t > a.t ? -((b.y - a.y) / (b.t - a.t)) * 1000 : 0; // px/s, upward (taller) positive
	const aim = g.h + ((v / 1000) * 0.99) / (1 - 0.99); // where the flick would carry it
	const s = paneStops();
	const stop = PANE_STOPS.reduce((best, k) => (Math.abs(s[k] - aim) < Math.abs(s[best] - aim) ? k : best), 'half');
	paneTo(stop, { v });
};
document.addEventListener('pointerup', paneLetGo);
document.addEventListener('pointercancel', paneLetGo);
