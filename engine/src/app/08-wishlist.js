/* ───────── wishlist ───────── */
const TRIP_DATES = DAYS.filter((d) => d.id !== ROLE.flight).map((d) => d.date);
const WISH_ICON = {
	food: 'food',
	snack: 'food',
	dessert: 'coffee',
	drink: 'coffee',
	shop: 'bag',
	market: 'bag',
	souvenir: 'bag',
	sight: 'pin',
	temple: 'flag',
	nature: 'sun',
	hotspring: 'sun',
};
const wName = (w) => (lang === 'en' ? w.name_en || w.name_trad : w.name_zh || w.name_trad);
const wBest = (w) => w.branches[Math.min(Math.max(+w.best || 0, 0), w.branches.length - 1)];
const wQuery = (br, w) => br.maps_query || br.address_trad || w.name_trad;
const fitLabel = (f) =>
	dayById[f.day] ? `Day ${dayById[f.day].n}` : f.day === 'any-evening' ? Z('任何晚上', 'Any evening') : Z('要专程', 'Special trip');
const closedNote = (br, onlyDate) => {
	if (br.paused)
		return `<p class="warn">${icon('alert')}${Z(`Google 显示暂停营业（${checkedOn('short')}查），出发前再确认`, `Google: temporarily closed (${checkedOn('short')}); recheck before trip`)}</p>`;
	const c = (br.closed_dates || []).filter((d) => TRIP_DATES.includes(d) && (!onlyDate || d === onlyDate));
	return c.length ? `<p class="warn">${icon('alert')}${Z('这天休息', 'Closed')}: ${c.map((d) => esc(dateLabel(d))).join(Z('、', ', '))}</p>` : '';
};
function wishCard(w) {
	const br = wBest(w);
	const q = wQuery(br, w);
	const others = w.branches.filter((b) => b !== br);
	const rating = w.rating
		? `<span class="rating${/google/i.test(w.rating_source || '') ? ' rating-q' : ''}">${icon('star', 'star')}<b>${esc(w.rating)}</b>${w.reviews ? ` · ${num(w.reviews)} ${Z('则评论', 'reviews')}` : ''}<span class="xsmall" title="${esc(w.rating_source || '')}"> · ${esc(srcShort(w.rating_source))}</span></span>`
		: '';
	const status =
		w.status === 'closed'
			? `<p class="warn">${icon('alert')}${Z('查到已停业或搬迁，去之前确认', 'Reported closed/moved; check first')}</p>`
			: w.status === 'unclear' || w.confidence === 'unverified'
				? `<p class="xsmall">${icon('info')} ${Z('资料未能完全确认', 'Not fully verified')}</p>`
				: '';
	return `<article class="hang wishcard" id="wish-${esc(w.id)}">
      <div class="hang-h"><span class="kind-ic">${icon(WISH_ICON[w.kind] || 'pin')}</span><div><p class="hang-name"${altX(wName(w), w.name_zh, w.name_en, w.name_trad, w.list_name)}>${mustB(w)}${esc(wName(w))}</p><p class="hang-meta">${escText(lang === 'en' ? w.order_en || '' : w.order_zh || '')}${(lang === 'en' ? w.price_en : w.price_zh) ? ` · ${escText(lang === 'en' ? w.price_en : w.price_zh)}` : ''}</p>${rating}</div></div>
      <div class="pills fits">${(w.fits || []).map((f) => `<span class="fit" ${dayById[f.day] ? `style="${colorVars(dayById[f.day].c)}"` : ''}><b>${esc(fitLabel(f))}</b> ${escText(lang === 'en' ? f.en : f.zh)}</span>`).join('')}</div>
      ${status}
      ${br.address_trad ? `<p class="addr">${icon('pin')}<span>${esc(br.label_zh && others.length ? `${lang === 'en' ? br.label_en || br.label_zh : br.label_zh}：` : '')}${escText(br.address_trad)}${lang === 'en' && br.address_en ? `<br><span class="xsmall">${escText(br.address_en)}</span>` : ''}</span></p>` : ''}
      ${(lang === 'en' ? br.mrt_en : br.mrt_zh) ? `<p class="xsmall">${icon('train')} ${escText(lang === 'en' ? br.mrt_en : br.mrt_zh)}</p>` : mrtLine(br.mrt)}
      ${(lang === 'en' ? br.hours_en : br.hours_zh) ? `<p class="xsmall">${icon('clock')} ${escText(lang === 'en' ? br.hours_en : br.hours_zh)}${br.hours_check ? ` <b class="hchk">${Z('与 Google 不同，以 Google 为准', 'Google differs; trust Google')}</b>` : ''}</p>` : ''}
      ${rrLine(br.gpid, br.lat, br.lng)}
      ${closedNote(br)}
      ${gBox(br.gpid)}
      <div class="links-row">${nativeChip(w.name_trad, w.name_roma)}${gBtn(br.gpid, `w:${w.id}:${w.branches.indexOf(br)}`)}${extI(gmSearch(q, br.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(q, 'transit', undefined, br.gpid), Z('路线', 'Directions'), 'route')}${w.site ? extI(w.site, Z('官网', 'Website'), 'ext') : ''}${addBtn(wName(w), br.lat, br.lng, br.gpid, q, br.address_trad)}</div>
      ${(lang === 'en' ? w.note_en : w.note_zh) ? `<details class="more wnote"><summary>${icon('info')}${Z('备注', 'Notes')}${icon('chev', 'chev')}</summary><div class="more-body"><p class="note">${escText(lang === 'en' ? w.note_en : w.note_zh)}</p></div></details>` : ''}
      ${others.length ? `<details class="more branches"><summary>${icon('list')}${Z('其他分店', 'Other branches')} (${others.length})${icon('chev', 'chev')}</summary><div class="more-body"><ul class="blist">${others.map((b) => `<li><p class="small"><strong>${esc(lang === 'en' ? b.label_en || b.label_zh || '' : b.label_zh || '')}</strong> ${escText(b.address_trad || '')}</p>${(lang === 'en' ? b.mrt_en : b.mrt_zh) ? `<p class="xsmall">${escText(lang === 'en' ? b.mrt_en : b.mrt_zh)}${(lang === 'en' ? b.hours_en : b.hours_zh) ? ` · ${escText(lang === 'en' ? b.hours_en : b.hours_zh)}` : ''}</p>` : ''}${closedNote(b)}<div class="links-row">${ext(gmSearch(wQuery(b, w)), Z('地图', 'Map'), 'pin')}${ext(gmDir(wQuery(b, w), 'transit'), Z('路线', 'Directions'), 'route')}</div></li>`).join('')}</ul></div></details>` : ''}
    </article>`;
}
function wishForDay(d) {
	const items = WISH.filter(
		(w) => w.status !== 'closed' && (w.fits || []).some((f) => f.day === d.id || (f.day === 'any-evening' && d.freeEvening)),
	).sort((a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0));
	if (!items.length) return '';
	return `<div class="block">${blockH('star', ['顺路还可以去（想去清单）', 'Also nearby (wishlist)'])}<ul class="wish-rows">${items
		.map((w) => {
			const br = wBest(w);
			const q = wQuery(br, w);
			const f = (w.fits || []).find((x) => x.day === d.id) || (w.fits || [])[0];
			return `<li class="wish-row"><div><a class="wr-name" href="#wish-${esc(w.id)}"${altX(wName(w), w.name_zh, w.name_en, w.name_trad, w.list_name)}>${mustB(w)}${esc(wName(w))}</a>${(lang === 'en' ? w.order_en : w.order_zh) ? `<span class="wr-order"> · ${escText(lang === 'en' ? w.order_en : w.order_zh)}</span>` : ''}${f ? `<p class="xsmall">${escText(lang === 'en' ? f.en : f.zh)}</p>` : ''}${closedNote(br, d.date)}</div><div class="links-row">${ext(gmSearch(q), Z('地图', 'Map'), 'pin')}${ext(gmDir(q, 'transit'), Z('路线', 'Directions'), 'route')}</div></li>`;
		})
		.join('')}</ul></div>`;
}
/* lazy lists: a closed <details data-lazy> (or a part's sheet, a <dialog data-lazy>: 06-render-blocks.js) is filled the
   first time it opens, or when search / a jump needs what's inside */
const LAZY = new Map();
const LAZY_ID = new Map();
const LAZY_IN = new Map(); // an id in a lazy list that sits in a sheet not filled yet → the sheet's key
let lazyN = 0;
const lazyKey = (fn, ids = []) => {
	const k = `lz${++lazyN}`;
	LAZY.set(k, fn);
	ids.forEach((id) => LAZY_ID.set(id, k));
	return k;
};
function lazyFill(d) {
	const k = d && d.dataset.lazy;
	if (!k) return;
	const fn = LAZY.get(k);
	delete d.dataset.lazy;
	if (!fn) return;
	const sheet = d.matches('dialog');
	const body = (!sheet && d.querySelector('[data-lazy-body]')) || d;
	body.insertAdjacentHTML('beforeend', fn());
	LAZY.delete(k);
	if (sheet) rateSet(rate); // what it holds was drawn at the last full draw: its figures follow the rate since, and the lucky draw adds up
}
// everything at once (search reads all of it); a filled sheet can hold lists of its own, so until none is left
function lazyAll() {
	for (let i = 0, els; i < 4 && (els = $$('[data-lazy]')).length; i++) els.forEach(lazyFill);
}
// what holds an id: its list, inside a sheet that may itself wait to be filled
const lazyFor = (id) => {
	for (let i = 0; i < 3 && !document.getElementById(id); i++) {
		const k = LAZY_ID.get(id);
		const el = (k && $(`[data-lazy="${k}"]`)) || (LAZY_IN.has(id) && $(`[data-lazy="${LAZY_IN.get(id)}"]`));
		if (!el) break;
		lazyFill(el);
	}
	return document.getElementById(id);
};
window.RJ_FILL = lazyAll; // for the tests' page-wide audits: the same as a search does
document.addEventListener(
	'toggle',
	(e) => {
		const d = e.target;
		if (d instanceof HTMLDetailsElement && d.open && d.dataset.lazy) lazyFill(d);
	},
	true,
);
const wGroup = (h, c, items) =>
	`<details class="more wgroup" data-lazy="${lazyKey(
		() => items.map(wishCard).join(''),
		items.map((w) => `wish-${w.id}`),
	)}"${c ? ` style="${colorVars(c)}"` : ''}><summary><h3 class="wish-h">${c ? '<span class="sw" aria-hidden="true"></span>' : icon('star')}<span>${esc(h)}</span></h3><span class="wg-n">${items.length}</span>${icon('chev', 'chev')}</summary><div class="hung" data-lazy-body></div></details>`;
// how to order at a Taiwan tea stand (the menu words that matter)
// how to order a drink there (Pack.drinkGuide: [[term, text], …] rows), if the country's pack has one
const drinkHowTo = () =>
	Pack.drinkGuide
		? `<details class="more" style="margin-top:12px"><summary>${icon('boba')}${Z('怎么点饮料', 'How to order a drink')}${icon('chev', 'chev')}</summary><div class="more-body"><dl class="kv">
      ${Pack.drinkGuide.map(([k, v]) => `<div><dt>${esc(L(k))}</dt><dd class="wrap">${escText(L(v))}</dd></div>`).join('\n      ')}
    </dl></div></details>`
		: '';
function secEat() {
	return `<section class="sec" id="eat" data-sec="eat">
      <h2 class="sec-title">${icon('food')}${Z('吃喝', 'Food & drinks')}</h2>
      <p class="sec-lede">${Z('按一下，按你的位置列出附近今天有开的早餐、午餐、晚餐、宵夜、小吃。', 'One tap: nearest places open today (breakfast, lunch, dinner, late-night, snacks) by your location.')}</p>
      <div class="links-row"><button type="button" class="go-btn" data-near>${icon('pin')}${Z('找我附近吃的', 'Find food near me')}</button><button type="button" class="go-btn ghost" data-near="drink">${icon('boba')}${Z('附近饮料', 'Drinks near me')}</button><button type="button" class="go-btn ghost" data-near="rest">${icon('coffee')}${Z('坐下歇脚', 'Sit & rest')}</button><button type="button" class="go-btn ghost" data-near="wc">${icon('wc')}${Z('附近厕所', 'Toilets near me')}</button>${REFILL.spots.length ? `<button type="button" class="go-btn ghost" data-near="refill">${icon('drop')}${Z('附近装水', 'Refill near me')}</button>` : ''}</div>
      ${drinkHowTo()}
      ${foodBlock(['bk-hotel'], ['酒店附近早餐（每天都可以）', 'Breakfast near the hotel (any day)'])}
      ${foodBlock(['sup-hotel'], ['酒店附近宵夜', 'Late-night food near the hotel'])}
    </section>`;
}
function secWish() {
	if (!WISH.length) return '';
	const buckets = [
		...DAYS.filter((d) => d.id !== ROLE.flight).map((d) => ({ k: d.id, h: `Day ${d.n} · ${dateLabel(d.date, d.dow)} · ${L(d.title)}`, c: d.c })),
		{ k: 'any-evening', h: Z('酒店附近 · 任何晚上', 'Near the hotel · any evening') },
		{ k: 'special', h: Z('要专程去', 'Needs its own trip') },
	];
	const placed = new Set();
	const groups = buckets
		.map((b) => {
			const items = WISH.filter(
				(w) =>
					!placed.has(w.id) &&
					(w.fits || [])[0] &&
					(w.fits[0].day === b.k || (b.k === 'special' && !dayById[w.fits[0].day] && w.fits[0].day !== 'any-evening')),
			);
			items.forEach((w) => placed.add(w.id));
			return items.length ? wGroup(b.h, b.c, items) : '';
		})
		.join('');
	const rest = WISH.filter((w) => !placed.has(w.id));
	return `<section class="sec" id="wish" data-sec="wish">
      <h2 class="sec-title">${icon('star')}${Z('想去清单', 'Wishlist')}</h2>
      <p class="sec-lede">${Z('想去、想吃的地方，按「哪天顺路」排列。全部可选：主行程优先，顺路有空才去。', 'Wanted stops/eats, sorted by day on the way. All optional; main plan first.')}</p>
      <div class="wgroups">${groups}${rest.length ? wGroup(Z('其他', 'Other'), 0, rest) : ''}</div>
      <p class="xsmall" style="margin-top:12px">${Z(`地址、营业时间查于${checkedOn('ymd')}，可能变；出发前看Google地图。`, `Addresses/hours checked ${checkedOn('long')}; confirm on Google Maps first.`)}</p>
    </section>`;
}

// the budget chart: each day's group spend, in the trip's currency or, when the phone reads the home currency, in that
// (its scale too). Redrawn on its own when the rate changes
function budgetBars() {
	const hv = (v) => (homeFirst ? v / rate : v);
	const hn = (v) => (homeFirst ? Money.roundHome(v / rate).toLocaleString('en-US') : num(v));
	const dayRows = DAYS.map((d) => {
		const b = d.blocks.find((x) => x.type === 'budget');
		return b ? { d, b } : null;
	}).filter(Boolean);
	const ax = Chart.axis(Math.max(0, ...dayRows.map((r) => hv(r.b.max))));
	const maxv = ax.top;
	return `<div class="bars">${dayRows
		.map(({ d, b }) => {
			const l = (hv(b.min) / maxv) * 100,
				w = ((hv(b.max) - hv(b.min)) / maxv) * 100;
			// the figure sits after the bar's end unless it would run past the track: the longer of its two lines (the
			// range, and each person's share; a CJK character counts twice) flips it sooner, ~2.8% of a phone's track a character
			const wide = (t) => [...t].reduce((n, ch) => n + (ch > '\u2e7f' ? 2 : 1), 0);
			const chars = Math.max(wide(`${hn(b.min)}–${hn(b.max)}`), wide(`${Z('每人', '')}${hn(each(b.min))}–${hn(each(b.max))}${Z('', ' each')}`));
			const lft = l + w > Math.min(70, 100 - chars * 2.8);
			return `<a class="bar-row2 barlink" href="#${d.id}-budget" style="${colorVars(d.c)}"><span class="bar-lab">${+d.date.slice(8)} ${esc(L(d.dow))}<small>Day ${d.n}${b.est ? Z(' · 估', ' · est.') : ''}</small></span><div class="bar-track"><div class="bar-grid"></div><div class="bar-range ${b.est ? 'est' : ''}" style="left:${l}%;width:${w}%"></div><span class="bar-val${lft ? ' lft' : ''}" style="${lft ? `right:calc(${100 - l}% + 6px)` : `left:calc(${l + w}% + 6px)`}">${hn(b.min)}–${hn(b.max)}<span class="bar-each">${Z('每人', '')}${hn(each(b.min))}–${hn(each(b.max))}${Z('', ' each')}</span></span></div></a>`;
		})
		.join('')}</div>
      ${axisHTML(ax)}`;
}

/* the budget as what's been paid and what's still to come (ADR-20261128-budget-paid-insurance): a row can be paid (its
   date, where, a booking number), in the home currency (flights booked at home) or the trip's, in parts (a deposit now,
   the balance on the day), or still without a price (tbd: listed, never counted). The glance is one big number, what
   the group has paid in the home currency (converted figures marked ≈), and one line for what's still to come. A trip
   without a home currency keeps its own; a budget with no payment yet keeps its estimate total */
const budHome = () => Money.canSwitch(CUR);
const budTally = () => Money.budgetTally(BUDGET.rows, { rate: budHome() ? rate : 1, home: budHome() ? CUR.home : null });
const budIsHome = (cur) => cur === 'home' || (budHome() && cur === CUR.home);
/** a sum in the home currency (or the trip's, without one): "≈ RM 1,230–1,560" */
function budAmt(min, max = min, approx = false) {
	const r = (v) => num(approx ? Money.roundHome(v) : v);
	const body = `${r(min)}${Math.round(max) > Math.round(min) ? `–${r(max)}` : ''}`;
	return budHome() ? `${approx ? '≈ ' : ''}${esc(CUR.home)} ${body}` : `${esc(CUR.sym)}${body}`;
}
/** each person's share of a sum in the home currency, always "about" */
const budEach = (min, max = min) =>
	budHome() ? budAmt(min / PAX, max / PAX, true) : `${esc(CUR.sym)}${num(each(min))}${max > min ? `–${num(each(max))}` : ''}`;
/** a row's own figure, in the currency it's paid in, with the other one beside it as everywhere else */
function budItemAmt(it, min, max) {
	// the figure in one span: the cell is a grid, and loose text beside a span would take a row of its own
	if (budIsHome(it.cur)) return `<span class="pay-f">${esc(CUR.home)} ${num(min)}${max > min ? `–${num(max)}` : ''}</span>`;
	const fig = !it.part && it.row.text ? fmt(it.row.text) : money(min, max);
	return `<span class="pay-f">${fig}</span>${budHome() ? ` <small class="rm" data-rm="${min},${max}">${rmText(min, max)}</small>` : ''}`;
}
const budVia = (v) => (v == null ? '' : Array.isArray(v) ? L(v) : String(v));
function budName(it) {
	const n = fmt(it.row.label);
	if (!it.part) return n;
	const pl = it.part.label ? L(it.part.label) : it.part.paid ? Z('订金', 'deposit') : Z('尾款', 'balance');
	return `${n}<span class="pay-part"> · ${esc(pl)}</span>`;
}
/** the glance: what the group has paid, big, and one line for what's still to come and each person's share of it */
function budgetGlance() {
	const T = budTally();
	if (!T.paidItems.length) {
		const B = BUDGET;
		if (B.totalMin != null)
			return `<div id="budget-glance">${totalBox(L(B.total).replace(/^约 |^About /, ''), [Z(`主行程 · ${GROUP[0]}`, `main costs · ${GROUP[1]}`), Z(`主行程 · ${GROUP[0]}`, `main costs · ${GROUP[1]}`)], B.totalMin, B.totalMax, eachLine(B.totalMin, B.totalMax))}</div>`;
		return `<div class="total bud-glance" id="budget-glance"><span class="per">${Z(`要花 · ${GROUP[0]}`, `To spend · ${GROUP[1]}`)}</span><span class="amt">${budAmt(T.todo[0], T.todo[1], T.todoApprox)}</span><p class="bg-todo">${Z('每人', 'Each')} <b>${budEach(T.todo[0], T.todo[1])}</b></p></div>`;
	}
	const todo =
		T.todo[1] > 0
			? `${Z('还要花', 'Still to come')} <b>${budAmt(T.todo[0], T.todo[1], T.todoApprox)}</b> · ${Z('每人', 'each')} <b>${budEach(T.todo[0], T.todo[1])}</b>`
			: Z('都付好了', 'All paid');
	return `<div class="total bud-glance" id="budget-glance"><span class="per">${Z(`已付 · ${GROUP[0]}`, `Paid so far · ${GROUP[1]}`)}</span><span class="amt">${budAmt(T.paid, T.paid, T.paidApprox)}</span><p class="bg-todo">${todo}</p></div>`;
}
/** what's been paid: each payment with where and when; a booking number waits in the opened row */
function budPaidHTML(T) {
	const rows = T.paidItems
		.map((it) => {
			const via = budVia(it.part ? it.part.via : it.row.via);
			const ref = it.part ? it.part.ref : it.row.ref;
			const line = [via && esc(via), it.paid && esc(dateLabel(it.paid))].filter(Boolean).join(' · ');
			const head = `<span class="pay-n"><b>${budName(it)}</b>${line ? `<small>${line}</small>` : ''}</span><span class="pay-a">${budItemAmt(it, it.amt, it.amt)}</span>`;
			return ref
				? `<details class="pay"><summary class="pay-h">${head}${icon('chev', 'chev')}</summary><p class="pay-ref">${Z('订单号', 'Booking no.')} <b>${esc(ref)}</b></p></details>`
				: `<div class="pay"><div class="pay-h">${head}</div></div>`;
		})
		.join('');
	return `<div class="pay-list">${rows}</div><p class="pay-sum">${Z('合计已付', 'Paid in all')} <b>${budAmt(T.paid, T.paid, T.paidApprox)}</b> · ${Z('每人', 'each')} ${budEach(T.paid)}</p>`;
}
/** what's still to come: each estimate with each person's share, a balance with where it's paid, a row with no price */
function budTodoHTML(T) {
	const B = BUDGET;
	const rows = T.todoItems
		.map((it) => {
			const via = budVia(it.part ? it.part.via : it.row.via);
			const air =
				it.row.anchor === 'airport' && B.airportNote ? `<span class="check-sub"><a href="#airport">${escText(L(B.airportNote))}</a></span>` : '';
			const eachOne = budIsHome(it.cur) ? budEach(it.min, it.max) : eachText(it.min, it.max);
			return `<div class="pay"><div class="pay-h"><span class="pay-n"><b>${budName(it)}</b>${via ? `<small>${esc(via)}</small>` : ''}${air}</span><span class="pay-a">${budItemAmt(it, it.min, it.max)}<small class="dd-each">${Z('每人', 'each')} ${eachOne}</small></span></div></div>`;
		})
		.join('');
	const tbd = T.tbdItems
		.map(
			(it) =>
				`<div class="pay is-tbd"><div class="pay-h"><span class="pay-n"><b>${fmt(it.row.label)}</b>${it.row.via ? `<small>${esc(budVia(it.row.via))}</small>` : ''}</span><span class="pay-a">${Z('价钱待定', 'Price TBD')}</span></div></div>`,
		)
		.join('');
	const left = T.tbdItems.length ? ` · ${Z(`不含 ${T.tbdItems.length} 项价钱待定`, `not counting ${T.tbdItems.length} with no price yet`)}` : '';
	return `<div class="pay-list">${rows}${tbd}</div>${
		T.todoItems.length
			? `<p class="pay-sum">${Z('合计', 'In all')} <b>${budAmt(T.todo[0], T.todo[1], T.todoApprox)}</b> · ${Z('每人', 'each')} ${budEach(T.todo[0], T.todo[1])}${left}</p>`
			: ''
	}`;
}
/* the budget by kind (ADR-20261128-budget-paid-insurance, amended): one row a kind, biggest first, each with what's been
   paid (exact) and what's still to come (a range), in the home currency, each person's share, and a share bar: paid
   solid, still to come dashed (an estimate), every bar against the biggest kind's. The kinds add up to the view's totals
   (Money.budgetByKind sums the same items), and the foot says so */
function budKindsHTML() {
	const K = Money.budgetByKind(BUDGET.rows, { rate: budHome() ? rate : 1, home: budHome() ? CUR.home : null });
	const T = budTally();
	const top = Math.max(1, ...K.map((k) => k.paid + k.todo[1]));
	const rows = K.map((k) => {
		const [ic, name] = BUD_KIND[k.cat] || BUD_KIND.other;
		const lines = [
			k.paid > 0 ? `${Z('已付', 'Paid')} <b>${budAmt(k.paid, k.paid, k.paidApprox)}</b>` : '',
			k.todo[1] > 0 ? `${Z('还要付', 'To pay')} <b>${budAmt(k.todo[0], k.todo[1], k.todoApprox)}</b>` : '',
			k.tbd ? Z(`${k.tbd} 项价钱待定`, `${k.tbd} with no price yet`) : '',
		].filter(Boolean);
		const all = [k.paid + k.todo[0], k.paid + k.todo[1]];
		const pct = Math.round(k.share * 100);
		const paidW = ((k.paid / top) * 100).toFixed(1);
		const todoW = ((k.todo[1] / top) * 100).toFixed(1);
		return `<li class="kind" data-kind="${k.cat}" data-share="${k.share.toFixed(4)}"><span class="kind-ic" aria-hidden="true">${icon(ic)}</span><div class="kind-b"><p class="kind-h"><b>${esc(L(name))}</b><span class="kind-pct">${all[1] > 0 ? `${pct}%` : Z('待定', 'TBD')}</span></p><span class="kind-bar" role="img" aria-label="${esc(Z(`占总数约 ${pct}%`, `about ${pct}% of the whole`))}"><span class="kb-paid" style="width:${paidW}%"></span><span class="kb-todo" style="width:${todoW}%"></span></span><p class="kind-m">${lines.join(' · ')}</p>${all[1] > 0 ? `<p class="kind-each">${Z('每人', 'Each')} ${budEach(all[0], all[1])}</p>` : ''}</div></li>`;
	}).join('');
	const key = `<p class="kind-key" aria-hidden="true"><span class="kk kk-paid"></span>${Z('已付', 'Paid')}<span class="kk kk-todo"></span>${Z('还要付（估）', 'Still to pay (est.)')}</p>`;
	const foot = `${Z('合计', 'In all')}: ${Z('已付', 'paid')} <b>${budAmt(T.paid, T.paid, T.paidApprox)}</b>${T.todo[1] > 0 ? ` · ${Z('还要付', 'still to pay')} <b>${budAmt(T.todo[0], T.todo[1], T.todoApprox)}</b>` : ''} · ${Z('每人', 'each')} ${budEach(T.paid + T.todo[0], T.paid + T.todo[1])}`;
	const other = K.some((k) => k.cat === 'other')
		? `<p class="note">${Z('没写类别的项目算在「其他」。', 'Rows with no kind written count as Other.')}</p>`
		: '';
	return `${key}<ul class="kinds">${rows}</ul><p class="pay-sum kinds-sum">${foot}</p>${other}`;
}

function secBudget() {
	const B = BUDGET;
	const T = budTally();
	const sg = numsIn(L(B.suggest));
	const paid = T.paidItems.length;
	const todoN = T.todoItems.length + T.tbdItems.length;
	return `<section class="sec" id="budget" data-sec="budget">
      <h2 class="sec-title">${icon('money')}${Z(`${GROUP[0]}预算`, `Budget ${GROUP[1]}`)}</h2>
      <div style="margin-top:14px">${budgetGlance()}</div>
      ${partsHTML(
				'budget',
				[
					paid && {
						key: 'paid',
						icon: 'check',
						t: ['已付', 'Paid'],
						h: ['已经付了', 'Paid so far'],
						n: paid,
						sum: `${sumB(budAmt(T.paid, T.paid, T.paidApprox))} · ${Z(`${paid} 笔`, `${paid} payments`)}`,
						body: budPaidHTML(T),
					},
					todoN && {
						key: 'rows',
						icon: 'list',
						t: paid ? ['还要付', 'To pay'] : ['支出', 'Costs'],
						h: paid ? ['还要付的', 'Still to pay'] : ['主要共同支出', 'Main shared costs'],
						n: todoN,
						sum: T.todoItems.length
							? `${sumB(budAmt(T.todo[0], T.todo[1], T.todoApprox))} · ${Z('每人', 'each')} ${budEach(T.todo[0], T.todo[1])}`
							: sumB(Z('价钱待定', 'Price TBD')),
						body: budTodoHTML(T),
					},
					{
						key: 'kinds',
						icon: 'bars',
						t: ['按类别', 'By kind'],
						h: [`按类别（${GROUP[0]}，${budHome() ? CUR.home : CUR.sym}）`, `By kind (${GROUP[1]}, ${budHome() ? CUR.home : CUR.sym})`],
						n: Money.budgetByKind(BUDGET.rows).length,
						sum: (() => {
							const K = Money.budgetByKind(BUDGET.rows, { rate: budHome() ? rate : 1, home: budHome() ? CUR.home : null });
							return K.length
								? `${sumB(L((BUD_KIND[K[0].cat] || BUD_KIND.other)[1]))} ${Z(`最多，约 ${Math.round(K[0].share * 100)}%`, `the most, about ${Math.round(K[0].share * 100)}%`)}`
								: '';
						})(),
						body: `<div id="budget-kinds">${budKindsHTML()}</div>`,
					},
					{
						key: 'days',
						icon: 'chart',
						t: ['每天', 'By day'],
						h: [
							`每天花费（条＝${GROUP[0]}，小字＝每人，${homeFirst ? CUR.home : CUR.sym}）`,
							`Per day (bar = all ${PAX}, small = each, ${homeFirst ? CUR.home : CUR.sym})`,
						],
						sum: sumB(nItems(DAYS.filter((d) => d.blocks.some((b) => b.type === 'budget')).length, '天', 'day', 'days')),
						body: `<div id="budget-bars">${budgetBars()}</div><p class="note">${esc(L(B.chartNote || ['虚线框 = 估算。', 'Dashed = estimate.']))}</p>`,
					},
					{
						key: 'cash',
						icon: 'card',
						t: ['现金和卡', 'Cash & cards'],
						h:
							Pack.transitCard && MONEY.transitCard
								? [`现金、信用卡和${Pack.transitCard[0]}`, `Cash, cards and ${Pack.transitCard[1]}`]
								: ['现金和信用卡', 'Cash and cards'],
						sum: `${Z('共同现金', 'Shared cash')} ${cvHtml(esc(MONEY.cash.amt), false)}`,
						body: `<div class="tiers">
        <div class="tier"><p class="tier-h">${icon('money')}${Z('共同现金', 'Shared cash')}</p><p class="wear-main" style="margin-top:6px">${cvHtml(esc(MONEY.cash.amt), false)}</p><p class="xsmall" data-rm="${(numsIn(MONEY.cash.amt) || [0, 0]).join(',')}">${rmText(...(numsIn(MONEY.cash.amt) || [0, 0]))}</p><p class="xsmall">${Z('每人约', 'Each ≈')} <b>${eachText(...(numsIn(MONEY.cash.amt) || [0, 0]))}</b></p>${list(MONEY.cash.uses)}</div>
        <div class="tier"><p class="tier-h">${icon('card')}${Z('信用卡', 'Credit card')}</p>${list(MONEY.card)}</div>
        ${Pack.transitCard && MONEY.transitCard ? `<div class="tier"><p class="tier-h">${icon('train')}${esc(L(Pack.transitCard))}</p><p style="margin-top:6px">${fmt(MONEY.transitCard)}</p><div class="links-row"><a class="mlink" href="#transit-card">${icon('arrow')}${Z('买卡与加值', 'Buying & topping up')}</a></div></div>` : ''}
      </div>`,
					},
				].filter(Boolean),
				['细节', 'Details'],
			)}
      <div class="fx"><label for="rate">${Z('汇率', 'Rate')}: 1 ${esc(CUR.home)} =</label><input id="rate" data-rate type="number" inputmode="decimal" step="any" min="0" value="${rate}"><span>${esc(CUR.sym)}</span><span class="xsmall">${esc(L(CUR.rateNote))}</span></div>
    ${foldHTML(
			'budget-notes',
			'info',
			['怎么分、不包括什么', 'Splitting it, and what it leaves out'],
			4,
			`<p class="note">${fmt(B.suggest)}${sg && !homeFirst ? ` <span data-rm="${sg.join(',')}">${rmText(...sg)}</span>` : ''}</p>
      <p class="callout">${icon('users')}<span>${fmt(B.split)}</span></p>
      <p class="callout">${icon('info')}<span>${fmt(B.poolText)}${homeFirst ? '' : ` <span data-rm="${B.pool},${B.pool}">${rmText(B.pool, B.pool)}</span>`}</span></p>
      <p class="note">${Z('不包括', 'Not included')}: ${B.excludes.map(L).map(esc).join(Z('、', ', '))}</p>`,
		)}
    </section>`;
}

// where each day's forecast chip comes from and what it says, in words a phone shows (the chip's tooltip never shows
// on a phone): the source, when it was checked, the days it covers, and how to read the icon next to the %
function fcLine() {
	const days = FC && FC.days ? Object.keys(FC.days).sort() : [];
	if (!FC || !FC.checked || !days.length) return '';
	const span = days.length > 1 ? `${dateLabel(days[0])}–${dateLabel(days[days.length - 1])}` : dateLabel(days[0]);
	return `<p class="small muted" data-fc-checked="${esc(FC.checked)}">${icon('info')} ${esc(Z(`每天卡片上的预报：Open-Meteo，${dateLabel(FC.checked)} 查，涵盖 ${span}。百分比是当天任何时候下雨的机会，图标是当天最差的天气（哪怕只有一阵）。`, `The forecast on each day: Open-Meteo, checked ${dateLabel(FC.checked)}, for ${span}. The % is the chance of rain at any time that day; the icon is the worst weather expected, even briefly.`))}</p>`;
}
function secWeather() {
	const W = WEATHER;
	return `<section class="sec" id="weather" data-sec="weather">
      <h2 class="sec-title">${icon('cloud')}${Z('天气和穿着', 'Weather & what to wear')}</h2>
      <p class="sec-lede">${fmt(W.lede)}</p>
      ${fcLine()}
      <h3 class="sub">${icon('calendar')}${Z('什么时候看天气', 'When to check')}</h3>
      <dl class="kv">${W.when.map((w) => `<div><dt>${fmt(w.t)}</dt><dd class="wrap">${fmt(w.v)}</dd></div>`).join('')}</dl>
      <div class="links-row">${(W.sites || []).map((k) => siteLink(k)).join('')}</div>
      <h3 class="sub">${icon('list')}${Z('每天检查', 'Check each day')}</h3>
      <div class="pills">${W.items.map((x) => `<span class="tag">${fmt(x)}</span>`).join('')}</div>
      <h3 class="sub">${icon('shirt')}${Z('怎么穿', 'Outfits')}</h3>
      <div class="stack">${W.outfits
				.filter((o) => dayById[o.day])
				.map(
					(o) =>
						`<a class="wear outfit" href="#${o.day}" style="${colorVars(dayById[o.day].c)}"><span class="sw" aria-hidden="true"></span><span><span class="xsmall">${fmt(o.h)}</span><span class="wear-main" style="display:block">${fmt(o.main)}</span><span class="note" style="display:block">${fmt(o.note)}</span></span></a>`,
				)
				.join('')}</div>
    </section>`;
}

function secChecklist() {
	const groups = [ENTRY_CHECKS, ...CHECKLIST];
	return `<section class="sec" id="checklist" data-sec="checklist">
      <h2 class="sec-title">${icon('check')}${Z('出发前清单', 'Before we go')}</h2>
      <p class="sec-lede">${
				SHARED_GROUPS.length
					? Z(
							'标着「全组」的清单，勾选会出现在每个人的页面上；其他的只保存在这台设备，各自勾。',
							'Ticks in lists marked Shared show on everyone’s page; the rest stay on this device, per person.',
						)
					: Z('勾选只保存在这台设备上；每个人各自勾。', 'Ticks stay on this device only; per person.')
			}</p>
      <div class="progress"><span id="prog-text"></span><div class="progress-track"><div class="progress-fill" id="prog-fill"></div></div></div>
      ${groups.map((g) => `<h3 class="sub">${fmt(g.h)}${SHARED_GROUPS.includes(g.id) ? `<span class="sync-tag">${icon('users')}${Z('全组', 'Shared')}</span>` : ''}</h3>${checkList(g.items.map((it) => ({ ...it, id: `${g.id}-${it.id}` })))}`).join('')}
      <div class="links-row" style="margin-top:14px"><button type="button" class="mlink" id="reset-ask">${icon('x')}${SHARED_GROUPS.length ? Z('清除我自己的勾选（全组的保留）', 'Clear my own ticks (shared lists stay)') : Z('清除全部勾选', 'Clear all ticks')}</button><span id="reset-confirm" hidden><button type="button" class="mlink danger" id="reset-yes">${Z('确定清除', 'Yes, clear')}</button><button type="button" class="mlink" id="reset-no">${Z('取消', 'Cancel')}</button></span></div>
    </section>`;
}

function secRules() {
	const P = PRIORITIES;
	return `<section class="sec" id="rules" data-sec="rules">
      <h2 class="sec-title">${icon('flag')}${Z('优先级', 'Priorities')}</h2>
      <div class="tiers" style="margin-top:14px">
        <div class="tier"><p class="tier-h">${Z('必做', 'Must do')}</p><ol>${P.must.map((x) => `<li>${fmt(x)}</li>`).join('')}</ol></div>
        <div class="tier"><p class="tier-h">${Z('应该去', 'Should do')}</p>${list(P.should, '')}</div>
        <div class="tier"><p class="tier-h">${Z('看心情', 'If we feel like it')}</p>${list(P.mood, '')}</div>
      </div>
      <div class="principle"><p class="wish" lang="zh-Hans">${esc(PRINCIPLE.wish)}</p>${PRINCIPLE.p.map((p) => `<p>${fmt(p)}</p>`).join('')}</div>
      ${CREDITS.length ? `<details class="more" style="margin-top:22px"><summary>${icon('image')}${Z('照片来源', 'Photo credits')} (${CREDITS.length})${icon('chev', 'chev')}</summary><div class="more-body"><ul class="credits">${CREDITS.map((c) => `<li>${esc(lang === 'en' ? c.subject_en : c.subject_zh)}: ${esc(c.author)}, <a href="${esc(c.source_url)}" target="_blank" rel="noopener">${esc(c.commons_title || 'Wikimedia Commons')}</a>, <a href="${esc(c.license_url || c.source_url)}" target="_blank" rel="noopener">${esc(c.license)}</a></li>`).join('')}</ul></div></details>` : ''}
    </section>`;
}
