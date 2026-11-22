/* ───────── render: nav ───────── */
const NAV = [
	{ id: 'top', label: ['总览', 'Overview'] },
	...DAYS.map((d) => ({ id: d.id, day: d })),
	{ id: 'map', label: ['地图', 'Map'] },
	{ id: 'airport', label: ['机场', 'Airport'] },
	{ id: 'entry', label: ['入境', 'Entry'] },
	{ id: 'optional', label: ['备选', 'Optional'] },
	// a trip with no wishlist has no section (08-wishlist.js), so no tab or menu row pointing at nothing either
	...(WISH.length ? [{ id: 'wish', label: ['想去', 'Wishlist'] }] : []),
	{ id: 'eat', label: ['附近吃', 'Food'] },
	{ id: 'budget', label: ['预算', 'Budget'] },
	{ id: 'weather', label: ['天气', 'Weather'] },
	{ id: 'checklist', label: ['清单', 'Checklist'] },
	{ id: 'rules', label: ['原则', 'Priorities'] },
];
function renderTabs(today) {
	$('#tabs').innerHTML = NAV.filter((n) => n.day || navDrawn(n.id))
		.map((n) => {
			if (n.day) {
				const d = n.day;
				return `<a class="tab day" href="#${d.id}" data-tab="${d.id}" style="${colorVars(d.c)}" aria-label="${esc(`Day ${d.n} ${dateLabel(d.date, d.dow)}`)}"><span class="tab-num">${+d.date.slice(8)}</span><span class="tab-dow">${esc(L(d.dow))}</span>${today === d.date ? '<span class="today-dot" aria-hidden="true"></span>' : ''}</a>`;
			}
			return `<a class="tab" href="#${n.id}" data-tab="${n.id}">${esc(L(n.label))}</a>`;
		})
		.join('');
	tabsCue();
	renderRail(today);
}
/* the week rail (1024 px and up, beside the view; the tab strip's job there): the overview, every day with its mark,
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
	const row = (id, mark, h, subs, style = '') =>
		`<a class="rl" href="#${id}" data-rail="${id}"${style}>${mark}<span class="rl-t"><b>${h}</b>${subs
			.filter(Boolean)
			.map((x) => `<small>${x}</small>`)
			.join('')}</span>${icon('chev-r', 'rl-ch')}</a>`;
	const days = DAYS.map((d) => {
		const fc = fcOf(d);
		return row(
			d.id,
			dayMark(d),
			`${esc(dateLabel(d.date, d.dow))}${today === d.date ? ` <span class="flag">${Z('今天', 'Today')}</span>` : ''}`,
			[esc(L(d.title)), fc ? `${icon(fcIcon(fc.code))}${fc.tmin}–${fc.tmax}°` : ''],
			` style="${colorVars(d.c)}"`,
		);
	}).join('');
	const secs = NAV.filter((n) => !n.day && n.id !== 'top' && navDrawn(n.id))
		.map((n) => row(n.id, `<span class="rl-sq">${icon(TOC_ICON[n.id] || 'arrow')}</span>`, esc(L(n.label)), []))
		.join('');
	rail.setAttribute('aria-label', Z('行程', 'Trip'));
	rail.innerHTML = `<div class="rail-card">${row('top', `<span class="rl-sq">${icon('calendar')}</span>`, esc(Z('总览', 'Overview')), [esc(topSub)])}
      <p class="rail-h">${Z('每一天', 'Each day')}</p>${days}
      <p class="rail-h">${Z('其他', 'Everything else')}</p>${secs}</div>`;
	railMark();
}
function railMark() {
	$$('#rail [data-rail]').forEach((a) => {
		if (a.dataset.rail === curView) a.setAttribute('aria-current', 'page');
		else a.removeAttribute('aria-current');
	});
}
// a sideways row's scrollbar is hidden: fade each edge that has more behind it (style.css .more-l / .more-r), on the
// day tabs and on every other row that scrolls sideways (photos, the map's filters), so the row says it scrolls
const X_ROWS = '.photos, .map-ctrl';
function edgeCue(t) {
	if (!t) return;
	const max = t.scrollWidth - t.clientWidth;
	t.classList.toggle('more-l', t.scrollLeft > 2);
	t.classList.toggle('more-r', t.scrollLeft < max - 2);
}
const tabsCue = () => edgeCue($('#tabs'));
$('#tabs').addEventListener('scroll', tabsCue, { passive: true });
window.addEventListener('resize', () => {
	tabsCue();
	$$(X_ROWS).forEach(edgeCue);
});
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
