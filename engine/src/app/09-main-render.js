/* ───────── main render ───────── */
/* flights: the booked times, or a delay the group typed in (saved on this phone). Every schedule time tagged `rel`
     (Day 1 after landing, Day 6/7 before take-off) is recomputed from them on each render. */
const fltArr = () => store.get('fltArr', '') || FLIGHTS.out.arr;
const fltDep = () => store.get('fltDep', '') || FLIGHTS.ret.dep;
const depMin = () => Plan.depMinutes(tMin(fltDep())); // minutes from the evening-before's midnight: 00:20 = 1460
const nextDay = () => [Time.shortDate(FLIGHTS.ret.date, 'zh'), Time.shortDate(FLIGHTS.ret.date, 'en')]; // e.g. "3/19", "19 Mar"
// when a trip's shop hours and prices were checked (TRIP.checked, YYYY-MM-DD): 'short' 9月30日 / 30 Sep, 'ymd' 2026/9/30, 'long' 30 Sep 2026, 'md' 9/30
const checkedOn = (form) => {
	const c = TRIP.checked;
	if (!c) return '';
	const [y, m, d] = [c.slice(0, 4), +c.slice(5, 7), +c.slice(8, 10)];
	return form === 'ymd'
		? `${y}/${m}/${d}`
		: form === 'md'
			? `${m}/${d}`
			: form === 'long'
				? `${Time.dateLabel(c, 'en')} ${y}`
				: Time.dateLabel(c, lang);
};
function applyFlights() {
	const arr = tMin(fltArr());
	const dep = depMin();
	DAYS.forEach((d) =>
		d.schedule.forEach((it) => {
			if (!it.rel) return;
			const { a, b } = Plan.relMinutes(it.rel, arr, dep, d.date === FLIGHTS.ret.date);
			const txt = `${a == null ? it.rel.from : hm(a)}${b != null ? `–${hm(b)}` : ''}`;
			const [nz, ne] = nextDay();
			it.t = it.rel.about
				? [`约${it.rel.next ? nz + ' ' : ''}${txt}`, `~${it.rel.next ? ne + ' ' : ''}${txt}`]
				: it.rel.next
					? [`${nz} ${txt}`, `${ne} ${txt}`]
					: txt;
		}),
	);
}
function fltEditHTML(kind) {
	const F = kind === 'arr' ? FLIGHTS.out : FLIGHTS.ret;
	const cur = kind === 'arr' ? fltArr() : fltDep();
	const booked = kind === 'arr' ? F.arr : F.dep;
	const moved = cur !== booked;
	const late = kind === 'arr' && tMin(cur) >= 21 * 60;
	return `<div class="flt-edit${moved ? ' moved' : ''}"><p class="flt-line">${icon('plane')}<span>${esc(F.no)} · ${kind === 'arr' ? Z('落地', 'lands') : Z('起飞', 'takes off')} <b>${esc(kind === 'dep' && tMin(cur) < 720 ? Z(`${nextDay()[0]} ${cur}`, `${nextDay()[1]} ${cur}`) : cur)}</b>${moved ? esc(Z(`（原定 ${booked}，下面时间已按新时间重算）`, ` (booked ${booked}; times below recalculated)`)) : ''}</span></p>
      ${late ? `<p class="warn">${icon('alert')}${Z('落地晚了：看「机场交通」的延误规则，可能要改搭 Uber×2 或接送。', 'Landing late: see the delay rule in "Airport"; you may need 2 Ubers or a van.')}</p>` : ''}
      <details class="flt-d"><summary>${icon('clock')}${Z('航班延误？改时间', 'Flight delayed? Change the time')}${icon('chev', 'chev')}</summary><div class="flt-f"><input type="time" data-flt="${kind}" value="${esc(cur)}" aria-label="${Z('新时间', 'New time')}"><button type="button" class="go-btn" data-flt-save="${kind}">${icon('check')}${Z('保存并重算', 'Save & recalculate')}</button>${moved ? `<button type="button" class="go-btn ghost" data-flt-reset="${kind}">${Z(`改回 ${booked}`, `Back to ${booked}`)}</button>` : ''}</div><p class="xsmall muted">${Z('存在这支手机；其他人要在自己手机改。', 'Saved on this phone; others change theirs.')}</p></details></div>`;
}

function render() {
	applyFlights();
	applyShifts();
	const now = tpNow();
	document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hans';
	// one button that names the other language: 中 while reading English, EN while reading Chinese
	const lb = $('#langBtn');
	const other = lang === 'en' ? 'zh' : 'en';
	lb.dataset.lang = other;
	lb.lang = other === 'en' ? 'en' : 'zh-Hans';
	lb.textContent = other === 'en' ? 'EN' : '中';
	lb.setAttribute('aria-label', other === 'en' ? 'English · 改用英文' : '中文 · Switch to Chinese');
	lb.title = lb.getAttribute('aria-label');
	$('#brand-dates').textContent = Time.rangeLabel(TRIP.start, TRIP.end, lang);
	$('#q').placeholder = L(TRIP.searchHint);
	$('#searchBtn').setAttribute('aria-label', Z('搜索', 'Search'));
	homeSync();
	updSync();
	$('#back-lab').textContent = Z('返回刚才', 'Back');
	$('#backPill').setAttribute('aria-label', Z('返回刚才的位置', 'Back to where you were'));
	$('#toc-lab').textContent = Z('目录', 'Sections');
	$('#tocBtn').setAttribute('aria-label', Z('目录：跳到任何一天或部分', 'Sections: jump to any day or part'));
	applyTheme();
	$('#searchClose').textContent = Z('完成', 'Done');
	$('#foot').innerHTML = esc(L(TRIP.footer));
	renderTabs(now.date);
	if (mapFullOn) {
		mapFullOn = false;
		document.documentElement.classList.remove('map-full-on');
		if (mapFullO) {
			dropOverlay(mapFullO);
			mapFullO = null;
		}
	}
	LAZY.clear();
	LAZY_ID.clear();
	$('#app').innerHTML =
		secOverview() +
		DAYS.map((d) => secDay(d, now.date)).join('') +
		secMap() +
		secAirport() +
		secEntry() +
		secOptional() +
		secWish() +
		secEat() +
		secBudget() +
		secWeather() +
		secChecklist() +
		secRules();
	renderNow();
	markToday();
	updateProgress();
	calcLucky();
	if (GEO) {
		liveArmed = false;
		armLiveMap();
	}
	netSync();
	measureBar();
	observeSections();
	observeLanterns();
	if (searchState.q && !$('#search-row').hidden) runSearch(searchState.q); // closed search re-runs on open; no need to build every lazy list now
}
