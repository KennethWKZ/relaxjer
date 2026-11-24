/* ───────── 目录 and More: one tap to now/next, any day, any section, and the settings ─────────
   A desktop's Sections button opens the whole menu (mode 'all'). On a phone and a tablet the bottom bar's More opens the
   planning sections and the settings (mode 'more'), and Today and Days hold the rest (ADR-20261124-bottom-app-bar). */
const TOC_ICON = {
	eat: 'food',
	map: 'map',
	airport: 'plane',
	entry: 'passport',
	optional: 'flag',
	wish: 'star',
	budget: 'money',
	weather: 'umbrella',
	checklist: 'check',
	rules: 'list',
};
function renderToc(mode = 'all') {
	const box = $('#toc-in');
	if (!box) return;
	box.parentElement.dataset.mode = mode;
	const close = `<button type="button" class="icon-btn" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button>`;
	const near = `<div class="toc-near-row"><button type="button" class="toc-sec toc-near" data-near aria-label="${Z('找我附近吃的（用我的位置）', 'Find food near me (uses my location)')}">${icon('food')}<span>${Z('找我附近吃的', 'Find food near me')}</span>${icon('pin', 'loc')}</button><button type="button" class="toc-sec toc-near wc" data-near="wc" aria-label="${Z('附近厕所（用我的位置）', 'Toilets near me (uses my location)')}">${icon('wc')}<span>${Z('附近厕所', 'Toilets nearby')}</span>${icon('pin', 'loc')}</button></div>`;
	if (mode === 'more') {
		// the map has its own place in the bar; every other planning section, then the settings
		const plan = NAV.filter((n) => !n.day && n.id !== 'top' && n.id !== 'map' && navDrawn(n.id))
			.map(
				(n) =>
					`<a class="toc-sec" href="#${n.id}"${n.id === active ? ' aria-current="true"' : ''}>${icon(TOC_ICON[n.id] || 'arrow')}${esc(L(n.label))}</a>`,
			)
			.join('');
		box.innerHTML = `<div class="toc-head"><h2 id="toc-h">${Z('更多', 'More')}</h2>${close}</div>
      ${near}
      <p class="toc-lab">${Z('行程资料', 'Trip info')}</p><div class="toc-grid">${plan}</div>
      <p class="toc-lab" id="toc-set-h">${Z('设置', 'Settings')}</p><div class="toc-set" role="group" aria-labelledby="toc-set-h">${tocSettings()}</div>`;
		return;
	}
	const now = tpNow();
	const today = DAYS.find((d) => d.date === now.date);
	const cur = (id) => (id === active ? ' aria-current="true"' : '');
	let lead;
	if (today) {
		const nn = nowNext(today, now.mins);
		// Now and Next lead with the day's knots, as on its string: filled for the current stop, a ring for the next
		const row = (k, x, kind) =>
			x
				? `<a class="toc-now ${kind}" href="#${today.id}-s${x.i}" style="${colorVars(today.c)}"><span class="toc-k">${k}</span><span>${esc(L(x.it.t || ''))} · ${esc(L(x.it.what).replace(/\*\*/g, ''))}</span></a>`
				: '';
		lead =
			row(Z('现在', 'Now'), nn.cur, 'is-now') + row(Z('下一站', 'Next'), nn.next, 'is-next') ||
			`<a class="toc-now is-today" href="#${today.id}" style="${colorVars(today.c)}"><span class="toc-k">${Z('今天', 'Today')}</span><span>Day ${today.n} · ${esc(L(today.title))}</span></a>`;
	} else {
		const left = dnum(TRIP.start) - dnum(now.date);
		lead = `<a class="toc-now" href="#top"><span class="toc-k">${left > 0 ? Z(`${left} 天`, `${left} d`) : Z('结束', 'Done')}</span><span>${left > 0 ? Z('还没出发 · 出发前要做的事在「今天」', 'Before the trip · to-dos are in Today') : Z('旅程已结束 · 回到「今天」', 'Trip over · back to Today')}</span></a>`;
	}
	const days = DAYS.map(
		(d) =>
			`<a class="toc-day" href="#${d.id}" style="${colorVars(d.c)}"${cur(d.id)}><b>${+d.date.slice(8)} ${esc(Z('周' + d.dow[0], d.dow[1]))} · Day ${d.n}</b><span>${esc(L(d.title))}</span></a>`,
	).join('');
	const secs = NAV.filter((n) => !n.day && n.id !== 'top')
		.map((n) => `<a class="toc-sec" href="#${n.id}"${cur(n.id)}>${icon(TOC_ICON[n.id] || 'arrow')}${esc(L(n.label))}</a>`)
		.join('');
	box.innerHTML = `<div class="toc-head"><h2 id="toc-h">${Z('目录', 'Sections')}</h2>${close}</div>
      ${lead}
      ${near}
      <p class="toc-lab">${Z('每天行程', 'Each day')}</p><div class="toc-grid">${days}</div>
      <p class="toc-lab">${Z('其他', 'Everything else')}</p><div class="toc-grid">${secs}</div>
      <a class="toc-sec toc-top" href="#top">${icon('arrow')}${Z('回到「今天」', 'Back to Today')}</a>${tocSettings()}`;
}
// the settings, the same rows in the desktop's menu and the phone's More
const tocSettings = () => `${themeRow()}${skyRow()}${mapsRow()}${curRow()}${syncRow()}${resetBtn()}${homeBtn()}`;
/* Days (the bottom bar): every day as one row, its mark, short date and weekday, Day number, title and forecast, today
   flagged and the day on screen lit. A list that scrolls down, never sideways; one tap opens that day's view */
function renderDays() {
	const box = $('#days-in');
	if (!box) return;
	const today = tpNow().date;
	const rows = DAYS.map((d) => dayRow(d, today, 'data-day', `${dateTag(d.date, d.dow, false)} · Day ${d.n}`)).join('');
	box.innerHTML = `<div class="toc-head"><h2 id="days-h">${Z('日程', 'Days')}</h2><button type="button" class="icon-btn" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button></div>
      <div class="days-list">${rows}</div>`;
	const cur = $(`[data-day="${curView}"]`, box);
	if (cur) cur.setAttribute('aria-current', 'page');
}
// on phones the header has no room for a labelled theme switch, so it lives here with its name (style.css hides it where
// the header has one)
const themeRow = () =>
	`<button type="button" class="toc-sec toc-theme" data-theme-cycle>${icon(themePref === 'light' ? 'sun' : themePref === 'dark' ? 'moon' : 'auto')}<span>${Z('主题', 'Theme')}：${themeName(themePref)}</span></button>`;
// the sky's Pause (WCAG 2.2.2): below 1024 px it lives here, two taps from any view through the bar's More, which no
// view hides; a desktop keeps it in the header. Not drawn without a sky, and gone under reduced motion, where nothing
// moves (style.css). Pressed means paused, as the header's (24-sky.js skyBtnSync keeps both in step)
const skyRow = () =>
	skyOn()
		? `<button type="button" class="toc-sec toc-sky" data-sky-toggle aria-pressed="${skyPaused()}">${icon(skyPaused() ? 'play' : 'pause')}<span>${skyPaused() ? Z('继续下雪', 'Let it snow') : Z('暂停下雪', 'Pause the snow')}</span></button>`
		: '';
// which app the Map and Directions links open: Google Maps or Apple Maps, kept on this phone
const mapsRow = () =>
	`<button type="button" class="toc-sec toc-maps" data-maps-cycle>${icon('pin')}<span>${Z('打开地图用', 'Open maps in')}：${mapsName(mapsApp)}</span></button>`;
// which currency the figures lead with (the header's currency button makes the same choice) and the rate (the budget's
// field is the same value): both kept on this phone, never synced. Only for a trip with a home currency of its own
const curRow = () => {
	if (!CUR_SWITCH) return '';
	const opt = (k, label, sub) => {
		const on = (k === 'home') === homeFirst;
		return `<button type="button" data-amounts="${k}" aria-pressed="${on}">${on ? icon('check') : ''}<b>${esc(label)}</b><span>${sub}</span></button>`;
	};
	return `<div class="toc-cur">
        <p class="toc-lab" id="toc-cur-h">${Z('金额和汇率', 'Amounts and rate')}</p>
        <div class="toc-cur-in">
          <div class="seg toc-cur-seg" role="group" aria-label="${Z('金额显示用', 'Show amounts in')}">${opt('trip', CUR.sym, Z('当地货币', 'local'))}${opt('home', CUR.home, Z('本国货币', 'home'))}</div>
          <div class="fx toc-rate"><label for="toc-rate">${Z('汇率', 'Rate')}: 1 ${esc(CUR.home)} =</label><input id="toc-rate" data-rate type="number" inputmode="decimal" step="any" min="0" value="${rate}"><span>${esc(CUR.sym)}</span></div>
          <p class="xsmall muted">${Z(`行程的汇率：1 ${esc(CUR.home)} = ${esc(CUR.sym)}${CUR.rate}`, `The trip's rate: 1 ${esc(CUR.home)} = ${esc(CUR.sym)}${CUR.rate}`)}${CUR.rateNote ? ` · ${esc(L(CUR.rateNote))}` : ''}</p>
          <button type="button" class="mlink toc-rate-reset" data-rate-reset${store.get('rate') == null ? ' hidden' : ''}>${icon('sync')}${Z('改回行程的汇率', "Use the trip's rate")}</button>
        </div>
      </div>`;
};
/* the Sections button is a desktop's (ADR-20261124-bottom-app-bar; below 1024 px the bottom bar's Days and More take
   its place, style.css). It's always there, but steps aside over the map, while search is open, and wherever it would
   cover a day's Next button. The Back pill, there only for a moment after a jump, stays: each view's foot leaves room
   under the pager for both, so at the end of a day nothing covers it. A sheet (a modal dialog) covers both anyway */
const overlapsFab = (r, f) => !!r && r.top < f.bottom + 10 && r.bottom > f.top - 10 && r.right > f.left - 10 && r.left < f.right + 10;
const fabSync = () => {
	const fab = $('#tocBtn');
	if (!fab) return;
	const view = curView && document.getElementById(curView);
	const box = (sel) => {
		const e = view && view.querySelector(sel);
		return e && e.getClientRects().length ? e.getBoundingClientRect() : null;
	};
	// where the button sits at rest (it drops 14 px while hidden): bottom right, 52 px, above the home bar
	const f = fab.getBoundingClientRect();
	const rest = {
		top: f.top - (fab.dataset.show === '0' ? 14 : 0),
		bottom: f.bottom - (fab.dataset.show === '0' ? 14 : 0),
		left: f.left,
		right: f.right,
	};
	const mw = box('.map-wrap');
	const overMap = mapFullOn || (!!mw && mw.top < innerHeight - 16 && mw.bottom > innerHeight - 76);
	const pg = box('.pager .next');
	const on = !overMap && !overlapsFab(pg, rest) && $('#search-row').hidden;
	fab.dataset.show = on ? '1' : '0';
	fab.tabIndex = on ? 0 : -1;
	fab.setAttribute('aria-hidden', on ? 'false' : 'true');
};
addEventListener('resize', () => requestAnimationFrame(fabSync));
let fabRaf = 0;
addEventListener(
	'scroll',
	() => {
		cancelAnimationFrame(fabRaf);
		fabRaf = requestAnimationFrame(fabSync);
	},
	{ passive: true },
);
document.addEventListener('click', (e) => {
	if (e.target instanceof HTMLDialogElement && e.target.open) closeDialog(e.target);
});
