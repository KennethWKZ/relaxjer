/* ───────── render: nav ───────── */
const NAV = [
	// the trip's first view: Now and Next (before the trip, the countdown and its to-dos), then the week. One name
	// everywhere it's offered: the bottom bar, the rail, the Sections menu, the first day's Previous
	{ id: 'top', label: ['今天', 'Today'] },
	...DAYS.map((d) => ({ id: d.id, day: d })),
	{ id: 'map', label: ['地图', 'Map'] },
	{ id: 'airport', label: ['机场', 'Airport'] },
	{ id: 'entry', label: ['入境', 'Entry'] },
	{ id: 'optional', label: ['备选', 'Optional'] },
	// a trip with no wishlist has no section (08-wishlist.js), so no row in the rail or a menu pointing at nothing either
	...(WISH.length ? [{ id: 'wish', label: ['想去', 'Wishlist'] }] : []),
	{ id: 'eat', label: ['吃喝', 'Food & drinks'] },
	{ id: 'budget', label: ['预算', 'Budget'] },
	{ id: 'weather', label: ['天气', 'Weather'] },
	{ id: 'checklist', label: ['清单', 'Checklist'] },
	{ id: 'rules', label: ['原则', 'Priorities'] },
];
/* the bottom bar (below 1024 px; ADR-20261124-bottom-app-bar): Today and Map are views, Days and More open their
   sheets. One layout on a phone and a tablet, whether the page is installed or opened in a browser; a desktop keeps
   the rail. The item for the part of the trip on screen is lit (barMark) */
function renderNav(today) {
	renderBar();
	renderRail(today);
}
const tbIcon = (n, extra = '') => `<span class="tb-ic">${icon(n)}${extra}</span>`;
function renderBar() {
	const bar = $('#tabbar');
	if (!bar) return;
	bar.setAttribute('aria-label', Z('行程', 'Trip'));
	// Today's mark is a calendar page with today's date on it, as a phone's own calendar shows it (barToday)
	bar.innerHTML =
		`<a class="tb" href="#top" data-tb="top">${tbIcon('today', '<span class="tb-num" aria-hidden="true"></span>')}<span class="tb-l">${Z('今天', 'Today')}</span></a>` +
		`<button type="button" class="tb" id="daysBtn" data-tb="days" aria-haspopup="dialog" aria-controls="days">${tbIcon('days')}<span class="tb-l">${Z('日程', 'Days')}</span></button>` +
		(navDrawn('map') ? `<a class="tb" href="#map" data-tb="map">${tbIcon('map')}<span class="tb-l">${Z('地图', 'Map')}</span></a>` : '') +
		`<button type="button" class="tb" id="moreBtn" data-tb="more" aria-haspopup="dialog" aria-controls="toc">${tbIcon('more')}<span class="tb-l">${Z('更多', 'More')}</span></button>`;
	barToday();
	barMark();
}
// the destination's date on Today's calendar, turned over each minute's refresh too (25-theme.js)
function barToday() {
	const n = $('#tabbar .tb-num');
	if (n) n.textContent = String(+tpNow().date.slice(8));
}
/** the bar's item for a view: the overview is Today, a day is Days, the map is Map, every other section is in More */
const barGroup = (id) => (id === 'top' ? 'top' : dayById[id] ? 'days' : id === 'map' ? 'map' : 'more');
function barMark() {
	const bar = $('#tabbar');
	if (!bar) return;
	const g = barGroup(curView || 'top');
	$$('.tb', bar).forEach((b) => {
		if (b.dataset.tb === g) b.setAttribute('aria-current', b.tagName === 'A' ? 'page' : 'true');
		else b.removeAttribute('aria-current');
	});
	// a day lights Days in its own lantern colour (a lantern colour means "this day"); everything else in ink
	const d = dayById[curView];
	bar.setAttribute('style', d ? colorVars(d.c) : '');
}
/* the week rail (1024 px and up, beside the view; the bottom bar's job there): Today, every day with its mark,
   date, title and forecast, then the other sections. Each row is a link to its view; the one on screen is lit */
function renderRail(today) {
	const rail = $('#rail');
	if (!rail) return;
	const left = dnum(TRIP.start) - dnum(tpNow().date);
	const td = DAYS.find((d) => d.date === today);
	const topSub = td
		? Z(`今天是第 ${td.n} 天`, `Today is day ${td.n}`)
		: left > 0
			? Z(`还有 ${left} 天出发`, `${left} days to go`)
			: Z('旅程已结束', 'Trip over');
	const row = (id, mark, h, subs, style = '') => railRow(id, mark, h, subs, `${style} data-rail="${id}"`);
	const days = DAYS.map((d) => dayRow(d, today, 'data-rail', esc(dateLabel(d.date, d.dow)))).join('');
	const secs = NAV.filter((n) => !n.day && n.id !== 'top' && navDrawn(n.id))
		.map((n) => row(n.id, `<span class="rl-sq">${icon(TOC_ICON[n.id] || 'arrow')}</span>`, esc(L(n.label)), []))
		.join('');
	rail.setAttribute('aria-label', Z('行程', 'Trip'));
	rail.innerHTML = `<div class="rail-card">${row('top', `<span class="rl-sq">${icon('today')}</span>`, esc(Z('今天', 'Today')), [esc(topSub)])}
      <p class="rail-h">${Z('每一天', 'Each day')}</p>${days}
      <p class="rail-h">${Z('其他', 'Everything else')}</p>${secs}</div>`;
	railMark();
}
/** one row of the week: the rail's on a desktop, the Days sheet's on a phone and a tablet (23-sections-menu.js) */
const railRow = (id, mark, h, subs, attrs = '') =>
	`<a class="rl" href="#${id}"${attrs}>${mark}<span class="rl-t"><b>${h}</b>${subs
		.filter(Boolean)
		.map((x) => `<small>${x}</small>`)
		.join('')}</span>${icon('chev-r', 'rl-ch')}</a>`;
/** a day's row: its mark, its date (html, escaped by the caller), a Today flag, its title and forecast */
function dayRow(d, today, key, date) {
	const fc = fcOf(d);
	return railRow(
		d.id,
		dayMark(d),
		`${date}${today === d.date ? ` <span class="flag">${Z('今天', 'Today')}</span>` : ''}`,
		[esc(L(d.title)), fc ? `${icon(fcIcon(fc.code))}${fc.tmin}–${fc.tmax}°` : ''],
		` style="${colorVars(d.c)}" ${key}="${d.id}"`,
	);
}
function railMark() {
	$$('#rail [data-rail]').forEach((a) => {
		if (a.dataset.rail === curView) a.setAttribute('aria-current', 'page');
		else a.removeAttribute('aria-current');
	});
}
// a sideways row's scrollbar is hidden: fade each edge that has more behind it (style.css .more-l / .more-r), on every
// row that scrolls sideways (photos, the map's filters), so the row says it scrolls
const X_ROWS = '.photos, .map-ctrl';
function edgeCue(t) {
	if (!t) return;
	const max = t.scrollWidth - t.clientWidth;
	t.classList.toggle('more-l', t.scrollLeft > 2);
	t.classList.toggle('more-r', t.scrollLeft < max - 2);
}
window.addEventListener('resize', () => $$(X_ROWS).forEach(edgeCue));
// rows drawn later (a section Chromium skipped, the map's filters when it opens) get their cue once they have a size
const xSized = new ResizeObserver((es) => es.forEach((e) => edgeCue(e.target)));
let xWatch = 0;
new MutationObserver(() => {
	if (xWatch) return;
	xWatch = requestAnimationFrame(() => {
		xWatch = 0;
		$$(X_ROWS).forEach((t) => {
			if (!t._cue) {
				t._cue = 1;
				xSized.observe(t);
			}
		});
	});
}).observe(document.body, { childList: true, subtree: true });
document.addEventListener(
	'scroll',
	(e) => {
		if (e.target.matches && e.target.matches(X_ROWS)) edgeCue(e.target);
	},
	{ capture: true, passive: true },
);
