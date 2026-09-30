/* ───────── 目录: one tap to now/next, any day, any section ───────── */
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
function renderToc() {
	const box = $('#toc-in');
	if (!box) return;
	const now = tpNow();
	const today = DAYS.find((d) => d.date === now.date);
	const cur = (id) => (id === active ? ' aria-current="true"' : '');
	let lead;
	if (today) {
		const nn = nowNext(today, now.mins);
		const row = (k, x) =>
			x
				? `<a class="toc-now" href="#${today.id}-s${x.i}" style="${colorVars(today.c)}"><span class="toc-k">${k}</span><span>${esc(L(x.it.t || ''))} · ${esc(L(x.it.what).replace(/\*\*/g, ''))}</span></a>`
				: '';
		lead =
			row(Z('现在', 'Now'), nn.cur) + row(Z('下一站', 'Next'), nn.next) ||
			`<a class="toc-now" href="#${today.id}" style="${colorVars(today.c)}"><span class="toc-k">${Z('今天', 'Today')}</span><span>Day ${today.n} · ${esc(L(today.title))}</span></a>`;
	} else {
		const left = dnum(TRIP.start) - dnum(now.date);
		lead = `<a class="toc-now" href="#top"><span class="toc-k">${left > 0 ? Z(`${left} 天`, `${left} d`) : Z('结束', 'Done')}</span><span>${left > 0 ? Z('还没出发 · 看总览和出发前要做的事', 'Before the trip · overview and to-dos') : Z('旅程已结束 · 回到总览', 'Trip over · back to overview')}</span></a>`;
	}
	const days = DAYS.map(
		(d) =>
			`<a class="toc-day" href="#${d.id}" style="${colorVars(d.c)}"${cur(d.id)}><b>${+d.date.slice(8)} ${esc(Z('周' + d.dow[0], d.dow[1]))} · Day ${d.n}</b><span>${esc(L(d.title))}</span></a>`,
	).join('');
	const secs = NAV.filter((n) => !n.day && n.id !== 'top')
		.map((n) => `<a class="toc-sec" href="#${n.id}"${cur(n.id)}>${icon(TOC_ICON[n.id] || 'arrow')}${esc(L(n.label))}</a>`)
		.join('');
	box.innerHTML = `<div class="toc-head"><h2 id="toc-h">${Z('目录', 'Sections')}</h2><button type="button" class="icon-btn" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button></div>
      ${lead}
      <div class="toc-near-row"><button type="button" class="toc-sec toc-near" data-near aria-label="${Z('附近吃什么（用我的位置）', 'Food near me (uses my location)')}">${icon('food')}<span>${Z('附近吃什么', 'Food nearby')}</span>${icon('pin', 'loc')}</button><button type="button" class="toc-sec toc-near wc" data-near="wc" aria-label="${Z('附近厕所（用我的位置）', 'Toilets near me (uses my location)')}">${icon('wc')}<span>${Z('附近厕所', 'Toilets nearby')}</span>${icon('pin', 'loc')}</button></div>
      <p class="toc-lab">${Z('每天行程', 'Each day')}</p><div class="toc-grid">${days}</div>
      <p class="toc-lab">${Z('其他', 'Everything else')}</p><div class="toc-grid">${secs}</div>
      <a class="toc-sec toc-top" href="#top">${icon('arrow')}${Z('回到顶部 · 总览', 'Back to top · Overview')}</a>${resetBtn()}${homeBtn()}`;
}
const fabSync = () => {
	const fab = $('#tocBtn');
	if (!fab) return;
	const mw = $('.map-wrap');
	const r = mw && mw.getBoundingClientRect();
	const overMap = !!r && r.top < innerHeight - 16 && r.bottom > innerHeight - 76;
	const on = scrollY > innerHeight * 0.8 && !overMap && $('#search-row').hidden;
	fab.dataset.show = on ? '1' : '0';
	fab.tabIndex = on ? 0 : -1;
	fab.setAttribute('aria-hidden', on ? 'false' : 'true');
};
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
