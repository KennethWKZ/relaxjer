/* ───────── render: nav ───────── */
const NAV = [
	{ id: 'top', label: ['总览', 'Overview'] },
	...DAYS.map((d) => ({ id: d.id, day: d })),
	{ id: 'map', label: ['地图', 'Map'] },
	{ id: 'airport', label: ['机场', 'Airport'] },
	{ id: 'entry', label: ['入境', 'Entry'] },
	{ id: 'optional', label: ['备选', 'Optional'] },
	{ id: 'wish', label: ['想去', 'Wishlist'] },
	{ id: 'eat', label: ['附近吃', 'Food'] },
	{ id: 'budget', label: ['预算', 'Budget'] },
	{ id: 'weather', label: ['天气', 'Weather'] },
	{ id: 'checklist', label: ['清单', 'Checklist'] },
	{ id: 'rules', label: ['原则', 'Priorities'] },
];
function renderTabs(today) {
	$('#tabs').innerHTML = NAV.map((n) => {
		if (n.day) {
			const d = n.day;
			return `<a class="tab day" href="#${d.id}" data-tab="${d.id}" style="${colorVars(d.c)}" aria-label="${esc(`Day ${d.n} ${dateLabel(d.date, d.dow)}`)}"><span class="tab-num">${+d.date.slice(8)}</span><span class="tab-dow">${esc(L(d.dow))}</span>${today === d.date ? '<span class="today-dot" aria-hidden="true"></span>' : ''}</a>`;
		}
		return `<a class="tab" href="#${n.id}" data-tab="${n.id}">${esc(L(n.label))}</a>`;
	}).join('');
	tabsCue();
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
