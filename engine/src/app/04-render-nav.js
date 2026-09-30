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
}
