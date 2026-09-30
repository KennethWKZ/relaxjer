/* ───────── sections ───────── */
function secOverview() {
	const hotelAddr = addrFor('hotel');
	return `<section class="sec" id="top" data-sec="top">
      <h1 class="sr-only">${esc(L(TRIP.name))}</h1>
      <div class="now-card" id="now" aria-live="polite"></div>
      <p class="home-row" id="homeRow">${homeBtn()}</p>
      <h2 class="sub">${icon('calendar')}${Z('这一周', 'The week')}</h2>
      <ol class="week">${DAYS.map((d) => `<li><a class="wk" href="#${d.id}" style="${colorVars(d.c)}">${lanternMark(d.c)}<span class="wk-date">${+d.date.slice(8)}<small>${esc(Z('周' + d.dow[0], d.dow[1]))}</small></span><span class="wk-title">${esc(L(d.title))}<span class="wk-focus">${esc(L(d.focus))}</span></span>${icon('arrow', 'wk-arrow')}</a></li>`).join('')}</ol>
      <h2 class="sub">${icon('info')}${Z('旅行资料', 'Trip facts')}</h2>
      <dl class="facts">${FACTS.map((f) => `<div class="fact"><dt>${esc(L(f.k))}</dt><dd>${fmt(f.v)}${f.place ? `<p class="addr">${icon('pin')}<span>${esc(hotelAddr.zh)}${hotelAddr.en ? `<br><span class="xsmall">${esc(hotelAddr.en)}</span>` : ''}</span></p><p class="xsmall">${fmt(PLACES.hotel.note)} · ${Z('电话', 'Tel')} <span class="sel">${esc(PLACES.hotel.tel)}</span></p>${PLACES.hotel.gname ? `<p class="xsmall">${icon('info')} ${Z(`Google 地图仍用旧名「${esc(PLACES.hotel.gname)}」（同地址、电话）。搜「那那私旅」会出现别家酒店，请用这里的按钮或地址。`, `Google Maps still lists old name 「${esc(PLACES.hotel.gname)}」 (same address/phone). New-name search finds other hotels; use buttons/address here.`)}</p>` : ''}<div class="links-row">${placeLinks(f.place)}</div>` : ''}</dd></div>`).join('')}</dl>
      <h2 class="sub">${icon('list')}${Z('机动备选', 'Backups if we have time')}</h2>
      <div class="pills">${BACKUPS.map((b) => `<span class="tag">${fmt(b)}</span>`).join('')}</div>
      <div class="links-row"><a class="mlink" href="#optional">${icon('arrow')}${Z('看备选详情', 'See the optional list')}</a></div>
    </section>`;
}

// forecast from scripts/resync.py (Open-Meteo), for the part of Taiwan that day is in
const FC = window.FORECAST || null;
// which forecast spot a day reads: the day's `forecastSpot`, else the trip's
const FC_SPOT = Object.fromEntries(DAYS.filter((d) => d.forecastSpot).map((d) => [d.id, d.forecastSpot]));
const fcIcon = (c) => (c >= 61 || (c >= 51 && c < 60) || c >= 80 ? 'umbrella' : c >= 2 ? 'cloud' : 'sun');
function fcChip(d) {
	const f = FC && FC.days && FC.days[d.date] && FC.days[d.date][FC_SPOT[d.id] || TRIP.forecastSpot];
	if (!f) return '';
	return `<span class="chip" title="${esc(Z(`天气预报（${FC.checked} 查）`, `Forecast (checked ${FC.checked})`))}">${icon(fcIcon(f.code))}${f.tmin}–${f.tmax}° · ${Z('雨', 'rain')} ${f.rain}%</span>`;
}
const tMin = (t) => {
	const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
	return m ? +m[1] * 60 + +m[2] : null;
};
// a fixed-time item within 45 min before … the end of it (the show, the charter pickup, leaving for the airport)
function mineClash(dayId, t) {
	const d = dayById[dayId];
	const m = tMin(t);
	if (!d || m == null) return null;
	return (
		d.schedule.find((it) => {
			if (!it.fixed) return false;
			const pt = parseT(it.t || '');
			if (pt.s == null) return false;
			return m >= pt.s - 45 && m <= (pt.e != null ? pt.e : pt.s + 30);
		}) || null
	);
}
const llOfStop = (it) => (it.place ? placeLL(it.place) : it.lat != null ? { lat: it.lat, lng: it.lng } : null);

/* running late: push the rest of a day back. Fixed items (flights, the show, the charter pickup, checkout) never move
     and re-anchor the day, so a shift runs from its first stop up to the next fixed item. Stored per date as
     [{ from: planned start in minutes, min }]; the reset button clears it. The page only suggests; nothing moves by itself. */
const shiftsOf = (date) => {
	const all = store.get('shift', {});
	const l = all && all[date];
	return Array.isArray(l) ? l.filter((x) => x && x.from != null && x.min > 0) : [];
};
function shiftSet(date, list) {
	const all = store.get('shift', {}) || {};
	if (list.length) all[date] = list;
	else delete all[date];
	store.set('shift', all);
}
const shiftTxt = (t, m) => {
	const f = (x) => String(x).replace(/(\d{1,2}):(\d{2})/g, (_, h, mm) => hm(+h * 60 + +mm + m));
	return Array.isArray(t) ? t.map(f) : f(t);
};
// minutes a planned start s0 moves on day d: every shift that begins at or before it with no fixed item in between
function shiftAt(d, s0, segs = shiftsOf(d.date)) {
	if (s0 == null || !segs.length) return 0;
	const fx = d.schedule.filter((it) => it.fixed && it._s0 != null).map((it) => it._s0);
	return segs.reduce((m, g) => (g.from <= s0 && !fx.some((f) => f > g.from && f <= s0) ? m + g.min : m), 0);
}
function applyShifts() {
	DAYS.forEach((d) => {
		d.schedule.forEach((it) => {
			if (!it.rel && !('_t0' in it)) it._t0 = it.t;
			const base = it.rel ? it.t : it._t0;
			it._base = base;
			it._s0 = base ? parseT(base).s : null;
		});
		const segs = shiftsOf(d.date);
		d.schedule.forEach((it) => {
			it._sh = it.fixed ? 0 : shiftAt(d, it._s0, segs);
			it.t = it._sh ? shiftTxt(it._base, it._sh) : it._base;
			it._clash = null;
		});
		// a pushed item that now runs into the next fixed time
		d.schedule.forEach((it, i) => {
			if (!it._sh) return;
			const nf = d.schedule.slice(i + 1).find((x) => x.fixed && x._s0 != null);
			if (!nf) return;
			const pt = parseT(it.t);
			const nx = d.schedule.slice(i + 1).find((x) => x._s0 != null);
			const end = pt.e != null ? pt.e : nx && nx !== nf ? parseT(nx.t).s : pt.s + 15;
			if (end > nf._s0 || pt.s + 15 > nf._s0) it._clash = nf;
		});
	});
}
// door to door for seniors: walk if short, else the faster of MRT (offline plan) and a taxi incl. hailing
const etaMin = (a, b) => {
	const w = walkMin(a, b);
	if (w <= 15) return w;
	const pl = mrtPlan(a, b);
	const taxi = ((km(a, b) * 1.3) / 22) * 60 + 10;
	return Math.min(w, taxi, pl.none ? Infinity : pl.total);
};
// where we are vs today's plan: the next planned place we are not at, and how late we'd get there leaving now
function lateCheck() {
	const now = tpNow();
	const d = DAYS.find((x) => x.date === now.date);
	if (!d || !meLL || farAway() || meAcc > 400) return null;
	const rows = d.schedule.map((it, i) => ({ it, i, s: parseT(it.t || '').s, ll: llOfStop(it) })).filter((r) => r.s != null);
	const at = rows.filter((r) => r.ll && km(meLL, r.ll) <= 0.35 && r.s <= now.mins + 20).pop(); // the latest planned place we are standing at
	const after = (r) => (at ? r.i > at.i : r.s > now.mins - 15) && km(meLL, r.ll) > 0.35;
	const arr = (r) => {
		const eta = Math.round(etaMin(meLL, r.ll));
		return { eta, arrive: now.mins + eta, late: now.mins + eta - r.s };
	};
	// a fixed time we are about to miss comes first (the show, the airport run): hurry, nothing shifts
	const fx = rows.find((r) => r.ll && r.it.fixed && r.s >= now.mins - 5 && after(r));
	if (fx) {
		const a = arr(fx);
		if (a.late > -10) return { d, tgt: fx, ...a, fixed: true };
	}
	const tgt = rows.find((r) => r.ll && after(r));
	if (!tgt || tgt.it.fixed) return null;
	const a = arr(tgt);
	if (a.late < 15) return null;
	const min = Math.min(180, Math.ceil(a.late / 5) * 5);
	// move what is still ahead: the first stop after where we are that, pushed back, has not already passed
	const first = rows.find((r) => r.i > (at ? at.i : -1) && r.i <= tgt.i && !r.it.fixed && r.s + min >= now.mins - 10) || tgt;
	const nf = rows.find((r) => r.i > first.i && r.it.fixed);
	return { d, tgt, first, ...a, min, fixed: false, nf: nf || null };
}
const stopName = (it) => L(it.what).replace(/\*\*/g, '');
function lateHTML() {
	const now = tpNow();
	const d = DAYS.find((x) => x.date === now.date);
	if (!d || d.id === 'd7') return '';
	const segs = shiftsOf(d.date);
	const lt = lateCheck();
	const no = store.get('lateNo', null);
	const muted = lt && no && no.date === d.date && no.i === lt.tgt.i && lt.late < no.late + 20;
	let box = '';
	if (lt && lt.fixed) {
		const dk = km(meLL, lt.tgt.ll);
		const taxi = Math.round(((dk * 1.3) / 22) * 60 + 4);
		box = `<div class="late risk"><p class="late-h">${icon('alert')}${esc(Z(`赶${L(lt.tgt.it.t)}「${stopName(lt.tgt.it)}」要抓紧`, `Hurry for ${L(lt.tgt.it.t)} ${stopName(lt.tgt.it)}`))}</p>
        <p class="small">${esc(Z(`现在出发预计 ${hm(lt.arrive)} 到，晚约 ${lt.late} 分钟。这是固定时间，行程不会自动往后推：建议马上叫计程车（约${taxi}分钟）。`, `Leaving now you'd arrive ~${hm(lt.arrive)}, about ${lt.late} min late. It's a fixed time, so nothing shifts: take a taxi now (~${taxi} min).`))}</p>
        <div class="links-row">${lt.tgt.it.place ? ext(gmDir(PLACES[lt.tgt.it.place].maps, 'driving'), Z('导航过去', 'Directions'), 'route', 'go-btn') : ''}</div></div>`;
	} else if (lt && !muted) {
		box = `<div class="late"><p class="late-h">${icon('clock')}${esc(Z(`看起来比计划晚了约 ${lt.min} 分钟`, `Running about ${lt.min} min behind`))}</p>
        <p class="small">${esc(Z(`从你这里到「${stopName(lt.tgt.it)}」约${lt.eta}分钟，预计 ${hm(lt.arrive)} 到（计划 ${hm(lt.tgt.s)}）。`, `From you to ${stopName(lt.tgt.it)} is ~${lt.eta} min: ~${hm(lt.arrive)} instead of ${hm(lt.tgt.s)}.`))}${lt.nf ? ` ${esc(Z(`${L(lt.nf.it.t)}「${stopName(lt.nf.it)}」是固定时间，不会动。`, `${L(lt.nf.it.t)} ${stopName(lt.nf.it)} is fixed and stays.`))}` : ''}</p>
        <div class="links-row"><button type="button" class="go-btn" data-shift-add="${d.id}|${lt.first.it._s0}|${lt.min}">${icon('clock')}${Z(`后面顺延 ${lt.min} 分`, `Push the rest back ${lt.min} min`)}</button><button type="button" class="go-btn ghost" data-late-no="${d.date}|${lt.tgt.i}|${lt.late}">${Z('不用', 'No thanks')}</button></div></div>`;
	}
	const tot = segs.reduce((a, g) => a + g.min, 0);
	const on = segs.length
		? `<p class="shift-on">${icon('clock')}<span>${esc(Z(`今天后面已顺延 +${tot} 分`, `Today's rest pushed back +${tot} min`))}</span><button type="button" class="mlink" data-shift-edit="${d.id}">${Z('调整', 'Adjust')}</button><button type="button" class="mlink" data-shift-clear="${d.date}">${Z('恢复原时间', 'Undo')}</button></p>`
		: '';
	const ask = !box
		? `<div class="late-ask">${!segs.length ? `<button type="button" class="mlink" data-shift-edit="${d.id}">${icon('clock')}${Z('跑慢了？把后面往后推', 'Running late? Push the rest back')}</button>` : ''}${!meLL && navigator.geolocation ? `<button type="button" class="mlink" data-late-loc>${icon('pin')}${Z('用我的位置检查进度', 'Check progress from my location')}</button>` : ''}</div>`
		: '';
	return box + on + ask;
}
// the banner on a day whose times are pushed back
function shiftBanner(d) {
	const segs = shiftsOf(d.date);
	if (!segs.length) return '';
	const first = d.schedule.filter((it) => it._sh).sort((a, b) => a._s0 - b._s0)[0];
	const nf = first && d.schedule.find((it) => it.fixed && it._s0 > first._s0);
	const tot = segs.reduce((a, g) => a + g.min, 0);
	return `<div class="shift-bar"><p>${icon('clock')}<span>${first ? esc(Z(`已顺延：从「${stopName(first)}」起 +${tot} 分${nf ? `，到 ${L(nf.t)}「${stopName(nf)}」固定行程为止` : ''}。`, `Pushed back +${tot} min from ${stopName(first)}${nf ? ` until the fixed ${L(nf.t)} ${stopName(nf)}` : ''}.`)) : esc(Z(`已顺延 +${tot} 分`, `Pushed back +${tot} min`))}</span></p><div class="links-row"><button type="button" class="mlink" data-shift-edit="${d.id}">${Z('调整', 'Adjust')}</button><button type="button" class="mlink" data-shift-clear="${d.date}">${Z('恢复原时间', 'Back to planned times')}</button></div></div>`;
}
// pick the first stop to move and by how much
function shiftSheet(dayId) {
	const d = dayById[dayId];
	if (!d) return;
	const now = tpNow();
	const today = now.date === d.date;
	const run = d.schedule.findIndex((it) => it.fixed && it.rel && it.rel.dep); // once we leave for the airport, nothing after it moves
	const rows = d.schedule.map((it, i) => ({ it, i })).filter((r) => r.it._s0 != null && !r.it.fixed && !r.it.step && (run < 0 || r.i < run));
	const pick = today ? rows.filter((r) => parseT(r.it.t).s >= now.mins - 30) : rows;
	const def = (pick[0] || rows[0] || {}).i;
	const segs = shiftsOf(d.date);
	openSheet(`<div class="shift-sheet" data-shift-day="${d.id}"><p class="pop-name">${icon('clock')}${Z(`Day ${d.n} 往后推`, `Day ${d.n}: push back`)}</p>
      <p class="small muted">${Z('从哪一站开始？固定时间（航班、预约、退房）不会动，推到固定行程前为止。', 'From which stop? Fixed times (flights, bookings, checkout) never move; the push stops at the next fixed one.')}</p>
      <div class="shift-from" role="radiogroup">${(pick.length ? pick : rows).map((r) => `<button type="button" class="shift-opt" role="radio" aria-checked="${r.i === def}" data-shift-from="${r.it._s0}"><span class="t">${esc(L(r.it.t))}</span><span>${esc(stopName(r.it))}</span></button>`).join('')}</div>
      <p class="sub-h">${Z('推多久', 'How long')}</p>
      <div class="seg shift-min" role="radiogroup">${[15, 30, 45, 60, 90].map((m) => `<button type="button" class="seg-btn" role="radio" aria-checked="${m === 30}" data-shift-min="${m}">${m}${Z('分', ' min')}</button>`).join('')}</div>
      <div class="links-row"><button type="button" class="go-btn" data-shift-go="${d.id}">${icon('clock')}${Z('往后推', 'Push back')}</button>${segs.length ? `<button type="button" class="go-btn ghost" data-shift-clear="${d.date}">${Z('恢复原时间', 'Back to planned times')}</button>` : ''}</div></div>`);
}
function shiftAdd(dayId, from, min) {
	const d = dayById[dayId];
	if (!d || from == null || !(min > 0)) return;
	const segs = shiftsOf(d.date);
	const g = segs.find((x) => x.from === from);
	if (g) g.min += min;
	else segs.push({ from, min });
	shiftSet(d.date, segs);
	store.set('lateNo', null);
	const sh = $('#placeSheet');
	if (sh && sh.open) closeDialog(sh);
	whenSettled(() => mineRerender(Z(`后面行程已往后推 ${min} 分`, `Pushed back ${min} min`)));
}
function mineMerge(d, planned) {
	const segs = shiftsOf(d.date);
	const mine = mineAll()
		.filter((x) => x.day === d.id)
		.map((x) => {
			const m = shiftAt(d, tMin(x.t), segs);
			return m ? { ...x, t: hm(tMin(x.t) + m) } : x;
		})
		.sort((a, b) => tMin(a.t) - tMin(b.t));
	if (!mine.length) return planned.join('');
	const rows = d.schedule.map((it, i) => ({ s: parseT(it.t || '').s, html: planned[i], ll: llOfStop(it) }));
	mine.forEach((x) => {
		const m = tMin(x.t);
		let at = rows.findIndex((r) => r.s != null && r.s > m);
		if (at < 0) at = rows.length;
		const prev = rows
			.slice(0, at)
			.reverse()
			.find((r) => r.ll);
		rows.splice(at, 0, { s: m, ll: x, html: mineStopHTML(d, x, prev && prev.ll) });
	});
	return (
		rows.map((r) => r.html).join('') +
		`<li class="mine-bar"><button type="button" class="mlink" data-mine-share="${d.id}">${icon('link')}${Z('把我加的分享给大家', 'Share my added stops')}</button>${resetBtn()}</li>`
	);
}
/* Day 6: the free afternoon, worked back from the flight. Checked bags for 5: at the airport 3 h before take-off
     (most counters close 60 min before); hotel → airport ~60 min door to door (+15 by train via A1); 45 min to collect bags. */
const SHOPS = window.SHOPS || [];
const hm = (m) =>
	`${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;
function d6Times() {
	const dep = depMin(); // the plan: back at the hotel 5 h 50 before take-off, leave 5 h 05 before, at the airport ~3 h 50 before
	const plan = { back: dep - 350, leave: dep - 305, airport: dep - 230 };
	const airport = dep - 180;
	const leave = airport - 75; // the latest: 3 h before at the airport, ~60–75 min on the road
	return { dep, airport, leave, back: plan.back, plan };
}
const toHotelMin = (ll) => {
	const w = walkMin(ll, placeLL('hotel'));
	return w <= 15 ? Math.round(w) : Math.round(((km(ll, placeLL('hotel')) * 1.3) / 22) * 60 + 4 + 6);
}; // walk, or a taxi incl. hailing
function d6BudgetHTML() {
	const T = d6Times();
	const note =
		T.dep == null
			? Z(`按计划 ${hm(T.plan.leave)} 出发。`, `Plan: leave ${hm(T.plan.leave)}.`)
			: T.leave < T.plan.leave
				? Z(
						`⚠ 按这个航班要 ${hm(T.leave)} 就离开酒店，比计划 ${hm(T.plan.leave)} 早：晚餐和回酒店都要提早。`,
						`⚠ This flight means leaving the hotel by ${hm(T.leave)}, earlier than the planned ${hm(T.plan.leave)}: move dinner and the hotel stop earlier.`,
					)
				: T.leave - T.plan.leave < 15
					? Z(
							`刚好：按航班最晚 ${hm(T.leave)} 离开酒店，按计划 ${hm(T.plan.leave)} 出发，别再晚。`,
							`Just right: leave the hotel by ${hm(T.leave)}; keep to the planned ${hm(T.plan.leave)}, no later.`,
						)
					: Z(
							`按航班：最晚 ${hm(T.airport)} 到机场、${hm(T.leave)} 离开酒店；计划 ${hm(T.plan.leave)} 出发，多出约 ${T.leave - T.plan.leave} 分钟缓冲（塞车、下雨也够）。`,
							`By the flight: at the airport by ${hm(T.airport)}, leave the hotel by ${hm(T.leave)}; the planned ${hm(T.plan.leave)} leaves ~${T.leave - T.plan.leave} min of buffer (traffic, rain).`,
						);
	return `<div class="block d6-budget" id="d6-budget">${blockH('clock', ['今天的时间（从航班回推）', "Today's time, worked back from the flight"])}
      ${fltEditHTML('dep')}${store.get('fltDep', '') ? resetBtn() : ''}
      <p class="xsmall muted">${Z('桃园 T1 → 吉隆坡 KLIA T2。登机时间在值机后的登机证上（通常起飞前约45分钟）。', 'Taoyuan T1 → KLIA T2. Boarding time is on the boarding pass after check-in (usually ~45 min before).')}</p>
      <ol class="d6-line">
        <li><b>13:00–${hm(T.dep - 440)}</b> ${Z('自由时间：下面「自由时间去哪」点＋加入', 'Free time: add places from "Free-time ideas" below')}</li>
        <li><b>${hm(T.dep - 425)}</b> ${Z('集合吃晚餐', 'Meet up for dinner')}</li>
        <li><b>${Z('最晚', 'By')} ${hm(T.back)}</b> ${Z('回酒店拿行李（约45分钟整理）', 'Back at the hotel for the bags (~45 min)')}</li>
        <li><b>${hm(T.plan.leave)}–${hm(T.plan.leave + 15)}</b> ${Z(`出发去机场（最晚约${hm(T.leave)}）：Taxi/接送约60分钟，捷运+A1约70分钟`, `Leave for the airport (latest ~${hm(T.leave)}): taxi/van ~60 min, train via A1 ~70`)}</li>
        <li><b>${hm(T.plan.airport)}–${hm(T.plan.airport + 30)}</b> ${Z(`到 T1：柜台约起飞前3小时开（约${hm(T.dep - 180)}），早到排前面`, `At T1: counters open ~3 h before (~${hm(T.dep - 180)}); early means near the front of the queue`)}</li>
        <li><b>${Z('最晚', 'By')} ${hm(T.dep - 60)}</b> ${Z('托运完行李（柜台起飞前60分钟关）；安检＋出境约30–45分钟', 'Bags checked (counters close 60 min before); security + immigration ~30–45 min')}</li>
        ${T.dep != null ? `<li><b>${hm(T.dep)}</b> ${Z('起飞', 'Take-off')}${T.dep >= 1440 ? Z('（23日）', ' (23rd)') : ''}</li>` : ''}
      </ol>
      <p class="note">${esc(note)}</p></div>`;
}
// the free-day menu: everything worth adding, each with ＋
// a free-time idea: name, one line of why/where/when, and ＋ to put it in the day
// meta: plain text, or { html } already built (a cost with its per-person share)
const ideaRow = (n, meta, lat, lng, gpid, q, addr) =>
	`<li class="idea"><div class="idea-b"><span class="idea-n">${esc(n)}</span>${meta ? `<span class="idea-m">${meta.html != null ? meta.html : esc(meta)}</span>` : ''}</div>${addBtn(n, lat, lng, gpid, q, addr)}</li>`;
const awayHotel = (ll) => {
	const k = km(placeLL('hotel'), ll);
	return k < 0.1 ? Z('就在酒店旁', 'next to the hotel') : Z(`离酒店${distLabel(k)}`, `${distLabel(k)} from hotel`);
};
const trsTag = (x) =>
	x.trs === 'yes'
		? Z(' · 可退税（同日满NT$2,000）', ' · tax refund (NT$2,000+ same day)')
		: x.trs === 'some'
			? Z(' · 部分店家可退税（满NT$2,000）', ' · some shops: tax refund (NT$2,000+)')
			: '';
// Day 6 shops, opening hours on the day
const shopRows = () =>
	SHOPS.map((x) => {
		const h = x.week ? x.week[3] : '';
		return ideaRow(
			lang === 'en' ? x.name_en || x.name_trad : x.name_zh,
			`${lang === 'en' ? x.why_en : x.why_zh} · ${awayHotel(x)}${h ? ` · ${Z('周四', 'Thu')} ${h === '24h' ? Z('24小时', '24 h') : h === 'closed' ? Z('休息', 'closed') : h}` : ''}${trsTag(x)}`,
			x.lat,
			x.lng,
			x.gpid,
			`${x.name_trad} ${x.addr || ''}`,
			x.addr,
		);
	});
// the shop list right under the free-shopping stop: the nearest few, the rest one tap away, and the tax-refund rules
function shopBoxHTML() {
	const rows = shopRows();
	if (!rows.length) return '';
	const N = 4;
	return `<div class="stop-eat stop-shops" id="d6-shops"><p class="eat-h">${icon('bag')}${Z('买东西 · 点＋加入行程', 'Shopping · tap ＋ to add')}</p>
      <ul class="ideas">${rows.slice(0, N).join('')}</ul>
      ${rows.length > N ? `<details class="more idea-g" data-lazy="${lazyKey(() => rows.slice(N).join(''))}"><summary>${icon('bag')}<span>${Z(`再看 ${rows.length - N} 间`, `${rows.length - N} more`)}</span>${icon('chev', 'chev')}</summary><ul class="ideas" data-lazy-body></ul></details>` : ''}
      ${taxHTML()}</div>`;
}
function d6IdeasHTML() {
	const row = ideaRow;
	const away = awayHotel;
	const wish = WISH.filter((w) => w.status !== 'closed' && (w.fits || []).some((f) => f.day === 'd6'))
		.sort((a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0))
		.map((w) => {
			const br = wBest(w);
			return br && br.lat
				? row(
						`${w.must ? Z('必去 · ', 'Must · ') : ''}${wName(w)}`,
						`${lang === 'en' ? w.order_en || '' : w.order_zh || ''}${w.order_zh || w.order_en ? ' · ' : ''}${away({ lat: +br.lat, lng: +br.lng })}`,
						br.lat,
						br.lng,
						br.gpid,
						wQuery(br, w),
						br.address_trad,
					)
				: '';
		})
		.join('');
	const opt = OPTIONAL.map((o) => {
		const g = (GEO.places || {})[o.place];
		return g
			? row(
					L(o.name),
					{ html: `${fmt(o.cost.map((s) => s.replace(/\*\*/g, '')))} · ${esc(away(g))}` },
					g.lat,
					g.lng,
					g.gpid,
					PLACES[o.place] ? PLACES[o.place].maps : L(o.name),
					'',
				)
			: '';
	}).join('');
	const snow = SNOW.shops
		.map((x) => {
			const g = (GEO.places || {})[x.place];
			return g ? row(L(x.name), `${L(x.rank)} · ${away(g)}`, g.lat, g.lng, g.gpid, PLACES[x.place] ? PLACES[x.place].maps : L(x.name), '') : '';
		})
		.join('');
	const grp = (ic, h, n, body, open) =>
		body
			? `<details class="more idea-g"${open ? ' open' : ` data-lazy="${lazyKey(() => body)}"`}><summary>${icon(ic)}<span>${esc(h)}</span><span class="wg-n">${n}</span>${icon('chev', 'chev')}</summary><ul class="ideas"${open ? `>${body}` : ' data-lazy-body>'}</ul></details>`
			: '';
	const cnt = (h) => (h.match(/class="idea"/g) || []).length;
	return `<div class="block" id="d6-ideas">${blockH('star', ['自由时间去哪（点＋加入行程）', 'Free-time ideas (tap ＋ to add)'])}
      ${shopDaysHTML()}
      ${SHOPS.length ? `<a class="mlink" href="#d6-shops">${icon('bag')}${Z(`买东西（${SHOPS.length} 间店、退税）：在行程「分组自由购物」下面`, `Shopping (${SHOPS.length} shops, tax refund): under “Free shopping” in the schedule`)}</a>` : ''}
      ${grp('star', Z('想去清单', 'Wishlist'), cnt(wish), wish)}${grp('flag', Z('备选景点', 'Optional sights'), cnt(opt), opt)}${grp('snow', Z('雪具店', 'Snowboard gear'), cnt(snow), snow)}
      <p class="xsmall muted">${Z('也可以在「地图」搜任何地方（包括 Google），点＋加入。', 'Or search anything on the map (Google too) and tap ＋.')}</p></div>`;
}
// tourist tax refund: the rules in five lines + which of our shops have it
const taxHTML = () =>
	typeof TAX === 'undefined'
		? ''
		: `<details class="more idea-g tax"><summary>${icon('money')}<span>${esc(L(TAX.h))}</span><span class="wg-n">NT$2,000+</span>${icon('chev', 'chev')}</summary><div class="more-body">${list(TAX.list)}<p class="small">${fmt(TAX.shops)}</p><p class="xsmall muted">${fmt(TAX.note)}</p></div></details>`;
// which days suit coming back with bags of shopping
function shopDaysHTML() {
	const dl = (id) => {
		const d = dayById[id];
		return `${+d.date.slice(5, 7)}/${+d.date.slice(8)}`;
	};
	// the trip data's `shopDays` notes: {dN} becomes that day's date, {back} the time to collect the bags
	const fill = (s) =>
		String(s)
			.replace(/\{(d\d+)\}/g, (m, id) => (dayById[id] ? dl(id) : m))
			.replace(/\{back\}/g, () => hm(d6Times().back));
	const rows = (TRIP.shopDays || []).map(
		(x) => `<li class="${x.ok ? 'ok' : 'no'}">${icon(x.ok ? 'check' : 'x')}<span>${fill(Z(x.zh, x.en))}</span></li>`,
	);
	if (!rows.length) return '';
	return `<div class="shopdays"><p class="sub-h">${icon('bag')}${Z('哪天适合大包小包买东西', 'Which days suit carrying shopping bags')}</p><ul class="shopdays-l">
      ${rows.join('\n      ')}
    </ul></div>`;
}
// an added stop on the last day: the latest time to leave it and still collect the bags
function d6Deadline(x) {
	const back = d6Times().back;
	const t = toHotelMin(x);
	return { by: Math.floor((back - t) / 5) * 5, t, back };
} // rounded down to 5 min

function mineStopHTML(d, x, prevLL) {
	const cl = mineClash(d.id, x.t);
	const k = prevLL ? km(prevLL, x) : null;
	const wk = prevLL ? Math.max(1, Math.round(walkMin(prevLL, x))) : 0;
	return `<li class="stop mine" id="${esc(x.id)}" data-s="${tMin(x.t)}"><div class="stop-t">${esc(x.t)}</div><div class="stop-knot">${gapBtn(d, x.id)}</div><div class="stop-b">
      <p class="stop-name">${esc(x.name)}<span class="mine-tag">${Z('我加的', 'Added')}</span></p>
      ${x.addr ? `<p class="stop-note">${esc(x.addr)}</p>` : ''}
      ${cl ? `<p class="warn">${icon('alert')}${esc(Z(`接近固定行程：${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`, `Close to a fixed time: ${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`))}</p>` : ''}
      ${
				d.id === 'd6'
					? (() => {
							const D = d6Deadline(x);
							const late = tMin(x.t) + 30 > D.by;
							return `<p class="${late ? 'warn' : 'stop-note'}">${icon(late ? 'alert' : 'clock')} ${esc(Z(`最晚 ${hm(D.by)} 离开这里（回酒店约${D.t}分钟，${hm(D.back)}拿行李）`, `Leave here by ${hm(D.by)} (~${D.t} min back to the hotel, bags at ${hm(D.back)})`))}</p>`;
						})()
					: ''
			}
      ${prevLL ? `<p class="stop-note">${icon(wk > 20 ? 'car' : 'walk')} ${esc(wk > 20 ? Z(`从上一站 ${distLabel(k)}：计程车约${Math.round(((k * 1.3) / 22) * 60 + 4)}分钟，或搭捷运`, `${distLabel(k)} from the stop before: taxi ~${Math.round(((k * 1.3) / 22) * 60 + 4)} min, or the MRT`) : Z(`从上一站 ${distLabel(k)} · 走路约${wk}分钟`, `${distLabel(k)} from the stop before · ~${wk} min walk`))}</p>` : ''}
      <div class="stop-links">${extI(gmSearch(x.q, x.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(x.q, 'transit', undefined, x.gpid), Z('路线', 'Directions'), 'route')}<button type="button" class="mlink" data-mine-edit="${esc(x.id)}">${icon('clock')}<span class="dlbl">${Z('改时间', 'Change')}</span></button><button type="button" class="mlink" data-mine-del="${esc(x.id)}" aria-label="${Z('删除', 'Remove')}">${icon('x')}<span class="dlbl">${Z('删除', 'Remove')}</span></button></div>
      ${nearDrinks(d, { place: x.id })}
    </div></li>`;
}
// "add to my plan": pick a day and a time
let addItem = null;
const addBtn = (n, lat, lng, gpid, q, addr) =>
	lat == null
		? ''
		: `<button type="button" class="mlink add-btn" data-add="${esc(JSON.stringify({ n, lat: +lat, lng: +lng, gpid: gpid || null, q: q || n, addr: addr || '' }))}">${icon('plus')}${Z('加入行程', 'Add to plan')}</button>`;
function addSheet(item) {
	addItem = item;
	const td = DAYS.find((d) => d.date === tpNow().date && d.id !== 'd7');
	const day = item.day || (td ? td.id : 'd6');
	const t = item.t || (td ? `${String(Math.min(22, Math.floor(tpNow().mins / 60) + 1)).padStart(2, '0')}:00` : day === 'd6' ? '14:00' : '12:00');
	return `<h3 class="spots-h">${icon('plus')}${esc(item.id ? Z('改时间', 'Change the time') : Z('加入行程', 'Add to my plan'))}</h3><p class="add-name">${esc(item.n)}</p>${item.addr ? `<p class="xsmall muted">${esc(item.addr)}</p>` : ''}
      <p class="sub-h">${Z('哪一天', 'Which day')}</p><div class="add-days" role="group">${DAYS.filter((d) => d.id !== 'd7')
				.map(
					(d) =>
						`<button type="button" class="seg-btn dayf" style="${colorVars(d.c)}" data-add-day="${d.id}" aria-pressed="${d.id === day}">${+d.date.slice(8)} ${esc(L(d.dow))}</button>`,
				)
				.join('')}</div>
      <p class="sub-h">${Z('几点', 'What time')}</p><input type="time" data-add-t class="add-t" value="${esc(t)}" step="900">
      <p class="add-clash" data-add-clash></p>
      <p class="xsmall muted">${esc(L(TRIP.addStopNote || ['只存在这支手机；用「分享」把链接发给大家。', 'Saved on this phone; use Share to send it to the others.']))}</p>
      <div class="links-row"><button type="button" class="go-btn" data-add-save>${icon('check')}${item.id ? Z('保存', 'Save') : Z('加入', 'Add')}</button>${item.id ? `<button type="button" class="go-btn ghost" data-mine-del="${esc(item.id)}">${icon('x')}${Z('删除', 'Remove')}</button>` : ''}</div>`;
}
// "+" under a dot: add a stop right after this one
const gapBtn = (d, key) =>
	d.id === 'd7'
		? ''
		: `<button type="button" class="knot-add" data-add-gap="${d.id}|${esc(key)}" aria-label="${Z('在这之后加一站', 'Add a stop after this')}">${icon('plus')}</button>`;
function gapContext(dayId, key) {
	// suggested time + the stop before, for the add sheet
	const d = dayById[dayId];
	const r15 = (m) => Math.ceil(m / 15) * 15;
	if (MINE[key]) {
		const x = MINE[key];
		return { t: hm(Math.min(r15(tMin(x.t) + 60), 22 * 60)), prev: x.name, ll: { lat: x.lat, lng: x.lng } };
	}
	const i = +key;
	const it = d.schedule[i];
	if (!it) return {};
	const pt = parseT(it.t || '');
	const nx = d.schedule
		.slice(i + 1)
		.map((y) => parseT(y.t || '').s)
		.find((v) => v != null);
	let t = pt.e != null ? pt.e : pt.s != null ? pt.s + 60 : null;
	if (t != null) {
		t = r15(t);
		if (nx != null && t >= nx) t = Math.max((pt.s || 0) + 30, nx - 30);
	}
	const ll = llOfStop(it) || d.schedule.slice(0, i).reverse().map(llOfStop).find(Boolean) || placeLL('hotel');
	return { t: t != null ? hm(t) : null, prev: L(it.what).replace(/\*\*/g, ''), ll };
}
let addDay = null;
let addPins = null;
let addCtx = {};
let addCat = 'all';
let addSort = 'near';
const ADD_CATS = [
	['all', ['全部', 'All']],
	['food', ['美食', 'Food']],
	['drink', ['饮料', 'Drinks']],
	['rest', ['歇脚', 'Rest']],
	['wish', ['想去', 'Wishlist']],
	['place', ['景点', 'Sights']],
	['buy', ['购物', 'Shopping']],
];
function addFindSheet(dayId, ctx = {}) {
	addDay = dayId;
	addCtx = ctx;
	addCat = 'all';
	addSort = ctx.ll ? 'near' : 'rate';
	const d = dayById[dayId];
	const where = ctx.prev ? Z(`在「${ctx.prev}」之后${ctx.t ? `，约 ${ctx.t}` : ''}`, `after "${ctx.prev}"${ctx.t ? `, about ${ctx.t}` : ''}`) : '';
	return `<h3 class="spots-h">${icon('plus')}${esc(Z(`加一站到 Day ${d.n}（${dateLabel(d.date, d.dow)}）`, `Add a stop to Day ${d.n} (${dateLabel(d.date, d.dow)})`))}</h3>${where ? `<p class="xsmall muted">${esc(where)}</p>` : ''}
      <label class="map-q add-q">${icon('search')}<input type="search" data-addq enterkeyhint="search" autocomplete="off" placeholder="${Z('店名、景点、地址…', 'Shop, sight, address…')}" aria-label="${Z('搜地点', 'Search places')}"></label>
      <div class="add-cats" role="group" aria-label="${Z('分类', 'Category')}">${ADD_CATS.map(([k, l]) => `<button type="button" class="seg-btn" data-addcat="${k}" aria-pressed="${k === 'all'}">${esc(L(l))}</button>`).join('')}</div>
      <div class="add-sort" role="group" aria-label="${Z('排序', 'Sort')}">${ctx.ll ? `<button type="button" class="seg-btn" data-addsort="near" aria-pressed="${addSort === 'near'}">${icon('pin')}${Z('离上一站近', 'Nearest to the stop before')}</button>` : ''}<button type="button" class="seg-btn" data-addsort="rate" aria-pressed="${addSort === 'rate'}">${icon('star')}${Z('评分高', 'Top rated')}</button></div>
      <div class="add-res" data-add-res></div>${dayId === 'd6' ? `<p class="xsmall"><a class="mlink" href="#d6-ideas" data-close>${icon('star')}${Z('看「自由时间去哪」清单', 'See the free-time ideas')}</a></p>` : ''}`;
}
// everything addable, with a category, a rating and "closed that day" when we know it
function addPool() {
	if (addPins) return addPins;
	const ok = (p) => !['wc', 'bike', 'bus', 'mrt', 'hotel', 'mine'].includes(p.type);
	const cat = (p) => (p.type === 'shop' || p.type === 'place' ? 'place' : p.type);
	const pins = buildPins()
		.filter(ok)
		.map((p) => ({
			p,
			cat: cat(p),
			rating: (p.food && p.food.rating) || (p.wish && p.wish.rating) || (p.drink && p.drink.rating) || null,
			closed: (p.food && p.food.closed_dates) || (p.wish && wBest(p.wish).closed_dates) || (p.drink && p.drink.closed_dates) || [],
			gpid: (p.food && p.food.gpid) || (p.wish && wBest(p.wish).gpid) || (p.drink && p.drink.gpid) || ((GEO.places || {})[p.pid] || {}).gpid,
		}));
	const shops = SHOPS.map((x) => ({
		p: {
			pid: x.id,
			type: 'buy',
			lat: x.lat,
			lng: x.lng,
			days: [],
			name: lang === 'en' ? x.name_en || x.name_trad : x.name_zh,
			q: `${x.name_trad} ${x.addr || ''}`,
		},
		cat: 'buy',
		rating: x.rating,
		closed: [],
		week: x.week,
		gpid: x.gpid,
		trs: x.trs,
	}));
	return (addPins = pins.concat(shops));
}
const ADD_KIND = {
	food: ['美食', 'Food'],
	drink: ['饮料', 'Drinks'],
	rest: ['歇脚', 'Rest'],
	wish: ['想去', 'Wishlist'],
	place: ['景点', 'Sight'],
	buy: ['购物', 'Shopping'],
};
function addFindRender(q) {
	const box = $('[data-add-res]');
	if (!box) return;
	q = (q || '').trim().toLowerCase();
	const words = q.split(/\s+/).filter(Boolean);
	const date = (dayById[addDay] || {}).date;
	const from = addCtx.ll;
	let hits = addPool().filter((x) => (addCat === 'all' || x.cat === addCat) && words.every((w) => hayOf(x.p).includes(w)));
	hits = hits.map((x) => ({
		...x,
		k: from ? km(from, x.p) : null,
		off: !!date && (x.closed.includes(date) || (x.week && x.week[(new Date(date + 'T12:00:00+08:00').getUTCDay() + 6) % 7] === 'closed')),
	}));
	hits.sort((a, b) => a.off - b.off || (addSort === 'near' && from ? a.k - b.k : (b.rating || 0) - (a.rating || 0)));
	const row = (x) =>
		`<li class="idea"><div class="idea-b"><span class="idea-n">${esc(x.p.name)}</span><span class="idea-m">${esc(L(ADD_KIND[x.cat] || ['', '']))}${x.rating ? ` · ★${x.rating}` : ''}${x.k != null ? ` · ${Z('离上一站', 'from the stop before')} ${distLabel(x.k)}` : ''}${x.trs === 'yes' ? Z(' · 可退税（满NT$2,000）', ' · tax refund (NT$2,000+)') : ''}${x.off ? `<b class="idea-off"> · ${Z('当天休息', 'closed that day')}</b>` : ''}</span></div>${addBtn(x.p.name, x.p.lat, x.p.lng, x.gpid, x.p.q || x.p.name, '')}</li>`;
	box.innerHTML =
		(hits.length
			? `<p class="xsmall muted">${Z(`${hits.length} 个`, `${hits.length} places`)}${hits.length > 25 ? Z('，只列前25个', ', first 25 shown') : ''}</p><ul class="ideas">${hits.slice(0, 25).map(row).join('')}</ul>`
			: `<p class="xsmall muted">${Z('页面里没有这个地方。', "The page doesn't have this place.")}</p>`) +
		(q
			? `<button type="button" class="go-btn ghost" data-add-g>${icon('search')}${esc(Z(`在 Google 搜「${q}」`, `Search Google for "${q}"`))}</button>`
			: '');
}
async function addFindGoogle(q) {
	const box = $('[data-add-res]');
	if (!box) return;
	box.innerHTML = `<p class="xsmall muted">${Z('Google 搜索中…', 'Searching Google…')}</p>`;
	try {
		if (!(window.google && google.maps && google.maps.importLibrary)) {
			if (typeof loadGoogle === 'function') await loadGoogle();
		}
		const { Place } = await google.maps.importLibrary('places');
		const { places } = await Place.searchByText({
			textQuery: q,
			fields: ['id', 'displayName', 'formattedAddress', 'location'],
			locationBias: { center: meLL && !farAway() ? meLL : { lat: 25.05, lng: 121.53 }, radius: 30000 },
			maxResultCount: 8,
			language: lang === 'en' ? 'en' : 'zh-TW',
			region: 'tw',
		});
		const rows = (places || [])
			.filter((p) => p.location)
			.map((p) => {
				const n = p.displayName || '';
				const a = (p.formattedAddress || '').replace(/^\d{3,6}/, '');
				return `<li class="idea"><div class="idea-b"><span class="idea-n">${esc(n)}</span><span class="idea-m">${esc(a)}</span></div>${addBtn(n, p.location.lat(), p.location.lng(), p.id, n, a)}</li>`;
			});
		box.innerHTML = rows.length
			? `<ul class="ideas">${rows.join('')}</ul>`
			: `<p class="xsmall muted">${Z('Google 也没找到：换个名字试试', 'Nothing on Google either: try another name')}</p>`;
	} catch {
		box.innerHTML = `<p class="xsmall muted">${Z('现在连不上 Google（网络？）。可以先到「地图」加载地图再试。', "Can't reach Google right now (network?). Open the Map section once, then try again.")}</p>`;
	}
}
function addClashNote() {
	const el = $('[data-add-clash]');
	if (!el) return;
	const day = ($('[data-add-day][aria-pressed="true"]') || {}).dataset?.addDay;
	const tv = ($('[data-add-t]') || {}).value;
	const cl = day && mineClash(day, tv);
	if (!cl && day === 'd6' && addItem && tMin(tv) != null) {
		const D = d6Deadline(addItem);
		if (tMin(tv) + 30 > D.by) {
			el.innerHTML = `${icon('alert')} ${esc(Z(`太晚了：这里最晚 ${hm(D.by)} 要离开（回酒店约${D.t}分钟，${hm(D.back)}拿行李）`, `Too late: leave here by ${hm(D.by)} (~${D.t} min to the hotel, bags at ${hm(D.back)})`))}`;
			return;
		}
		el.innerHTML = `<span class="ok-note">${icon('clock')} ${esc(Z(`最晚 ${hm(D.by)} 离开这里就赶得上`, `Leave by ${hm(D.by)} and you're fine`))}</span>`;
		return;
	}
	el.innerHTML = cl
		? `${icon('alert')} ${esc(Z(`接近固定行程：${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`, `Close to a fixed time: ${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`))}`
		: '';
}
function resetAll() {
	const n = mineAll().length;
	const f = !!(store.get('fltArr', '') || store.get('fltDep', ''));
	const sh = Object.keys(store.get('shift', {}) || {}).length;
	if (!n && !f && !sh) {
		toast(Z('现在就是原计划，没有要恢复的', 'Already the original plan'));
		return;
	}
	const what = [
		n ? Z(`删除我加的 ${n} 个行程`, `remove ${n} added stop${n > 1 ? 's' : ''}`) : '',
		f ? Z('航班改回原定时间', 'put the flights back to the booked times') : '',
		sh ? Z('取消往后推的时间', 'undo the pushed-back times') : '',
	]
		.filter(Boolean)
		.join(Z('、', ', '));
	if (!confirm(Z(`恢复原计划：${what}？（清单打勾会保留）`, `Back to the original plan: ${what}? (Checklist ticks stay.)`))) return;
	mineSet([]);
	store.set('fltArr', '');
	store.set('fltDep', '');
	store.set('shift', {});
	store.set('lateNo', null);
	const ps = $('#placeSheet');
	if (ps && ps.open) closeDialog(ps);
	const tc = $('#toc');
	if (tc && tc.open) closeDialog(tc);
	whenSettled(() => mineRerender(Z('已恢复原计划', 'Back to the original plan')));
}
const resetBtn = () =>
	mineAll().length || store.get('fltArr', '') || store.get('fltDep', '') || Object.keys(store.get('shift', {}) || {}).length
		? `<button type="button" class="mlink reset-btn" data-reset-all>${icon('x')}${Z('恢复原计划（清除我加的和改过的）', 'Back to the original plan (clear what I added or changed)')}</button>`
		: '';
function mineRerender(msg) {
	const sp = spotNow();
	render();
	spotRestore(sp);
	if (msg) toast(msg);
}
// share: my stops in a link (#add=…); opening it offers to add them
const b64u = (str) =>
	btoa(unescape(encodeURIComponent(str)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const unb64u = (str) => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
function mineShareURL() {
	const pack = mineAll().map((x) => [x.day, x.t, x.name, +x.lat.toFixed(6), +x.lng.toFixed(6), x.gpid || '', x.addr || '']);
	return `${(window.SHARE_URL || location.href).split('#')[0]}#add=${b64u(JSON.stringify(pack))}`;
}
function mineImportOffer() {
	const m = /[#&]add=([\w-]+)/.exec(location.hash);
	if (!m) return;
	let pack;
	try {
		pack = JSON.parse(unb64u(m[1]));
	} catch {
		return;
	}
	if (!Array.isArray(pack) || !pack.length) return;
	history.replaceState(history.state, '', location.pathname + location.search);
	const items = pack
		.filter((r) => Array.isArray(r) && dayById[r[0]] && tMin(r[1]) != null)
		.map((r) => ({
			day: r[0],
			t: r[1],
			name: String(r[2]).slice(0, 80),
			lat: +r[3],
			lng: +r[4],
			gpid: r[5] || null,
			addr: String(r[6] || '').slice(0, 120),
		}));
	if (!items.length) return;
	mineIncoming = items;
	openSheet(
		`<h3 class="spots-h">${icon('plus')}${Z(`收到 ${items.length} 个别人加的行程`, `${items.length} shared stops`)}</h3><ul class="spots">${items.map((x) => `<li class="spot"><div class="spot-main"><span class="spot-n">${esc(x.name)}</span><span class="spot-m">Day ${dayById[x.day].n} · ${esc(x.t)}</span></div></li>`).join('')}</ul><div class="links-row"><button type="button" class="go-btn" data-mine-import>${icon('check')}${Z('加入我的行程', 'Add to my plan')}</button></div>`,
	);
}
let mineIncoming = null;
let flightT = 0;

function secDay(d, today) {
	const isToday = today === d.date;
	const wish =
		lang === 'zh'
			? `<h2 class="wish">${esc(d.wish)}</h2><p class="l-title"${alt(other(d.title))}>${esc(L(d.title))}</p>`
			: `<p class="wish" lang="zh-Hans" aria-hidden="true">${esc(d.wish)}</p><p class="wish-gloss">${esc(d.gloss[1])}</p><h2 class="l-title"${alt(other(d.title))}>${esc(L(d.title))}</h2>`;
	const wx = fcChip(d);
	const chips = [
		wx,
		d.focus && `<span class="chip">${icon('flag')}${esc(L(d.focus))}</span>`,
		d.budgetChip && budgetChip(d),
		d.wear && `<span class="chip">${icon('shirt')}${esc(L(d.wear))}</span>`,
	]
		.filter(Boolean)
		.join('');
	const photos = d.photos.filter((p) => credit[p]);
	const stopsTitle = d.stepsTitle ? L(d.stepsTitle) : Z('行程', 'Schedule');
	const planned = d.schedule.map((it, i) => {
		const t = it.step ? String(it.step) : L(it.t || '');
		const pt = parseT(it.t || '');
		const cls = ['stop', it.fixed && 'fixed', it.key && 'key'].filter(Boolean).join(' ');
		return `<li class="${cls}${it._sh ? ' shifted' : ''}" id="${d.id}-s${i}" ${pt.s != null ? `data-s="${pt.s}"` : ''}><div class="stop-t">${esc(t)}${it._sh ? `<span class="t-was">${esc(Z(`原 ${L(it._base)}`, `was ${L(it._base)}`))}</span>` : ''}</div><div class="stop-knot">${gapBtn(d, `${i}`)}</div><div class="stop-b">
        <p class="stop-name"${alt(other(it.what))}>${fmt(it.what)}${it.fixed ? seal() : ''}<span class="flag-slot"></span></p>
        ${it.note ? `<p class="stop-note">${fmt(it.note)}</p>` : ''}
        ${it.shops ? shopBoxHTML() : ''}
        ${it._clash ? `<p class="warn">${icon('alert')}${esc(Z(`推迟后会撞到 ${L(it._clash.t)}「${stopName(it._clash)}」：这一项缩短或跳过`, `Now runs into the fixed ${L(it._clash.t)} ${stopName(it._clash)}: shorten or skip this`))}</p>` : ''}
        ${it.place || it.link ? `<div class="stop-links">${it.place ? placeLinks(it.place, { noDriver: true, noSite: false }) : ''}${it.link ? `<a class="mlink" href="${it.link}">${icon('arrow')}${Z('看详情', 'Details')}</a>` : ''}</div>` : ''}
        ${mealEats(d, it)}
        ${nearWish(d, it)}
        ${nearDrinks(d, it)}
        ${it.photo ? thumb(it.photo) : ''}</div></li>`;
	});
	const sched = mineMerge(d, planned);
	const foodSlots =
		{
			d1: ['d1-ningxia', 'd1-hotel'],
			d2: ['d2-lunch', 'd2-dessert', 'd2-dinner'],
			d3: ['d3-lunch', 'd3-dinner'],
			d4: ['d4-jiufen', 'd4-shifen'],
			d5: ['d5-lunch', 'd5-dinner'],
			d6: ['d6-meals'],
		}[d.id] || [];
	const tickets = d.tickets || []; // the day's ticket/booking cards (ids in extra.json tickets)
	const tix = tickets
		.map((t) => ticketBlock(t))
		.filter(Boolean)
		.join('');
	return `<section class="day" id="${d.id}" data-sec="${d.id}" style="${colorVars(d.c)}">
      <div class="day-bar"><span class="sw" aria-hidden="true"></span><span class="dt">Day ${d.n} · ${esc(dateLabel(d.date, d.dow))}</span><span class="rt">${esc(L(d.title))}</span></div>
      <div class="lantern">
        <div class="l-meta"><span>Day ${d.n}</span><span>${esc(dateLabel(d.date, d.dow))}</span>${isToday ? `<span class="flag inv">${Z('今天', 'Today')}</span>` : ''}</div>
        ${wish}
        <div class="l-chips">${chips}</div>
        ${routeCard(d)}
        <div class="l-actions">
          <button type="button" class="l-btn" data-copy-day="${d.id}">${icon('copy')}<span class="dlbl">${Z('复制给大家', 'Copy for chat')}</span></button>
          <button type="button" class="l-btn" data-copy-link="${d.id}">${icon('link')}<span class="dlbl">${Z('复制链接', 'Copy link')}</span></button>
          ${GEO ? `<button type="button" class="l-btn" data-map-day="${d.id}">${icon('map')}${Z('地图', 'Map')}</button>` : ''}
        </div>
      </div>
      ${d.lede ? `<p class="day-lede">${fmt(d.lede)}</p>` : ''}
      ${d.id === 'd6' ? d6BudgetHTML() : ''}${d.id === 'd1' ? `<div class="block d1-flight">${fltEditHTML('arr')}</div>` : ''}
      <div class="block">${blockH(d.stepsTitle ? 'list' : 'clock', [stopsTitle, stopsTitle])}${shiftBanner(d)}<ol class="sched">${sched}</ol>${d.id !== 'd7' ? `<button type="button" class="go-btn ghost add-stop" data-add-open="${d.id}">${icon('plus')}${Z(`加一站到 Day ${d.n}`, `Add a stop to Day ${d.n}`)}</button>` : ''}</div>
      ${d.id === 'd6' ? d6IdeasHTML() : ''}
      ${photos.length ? `<div class="photos" role="list">${photos.map((p) => figure(p)).join('')}</div>` : ''}
      ${tix ? `<div class="block">${blockH('ticket', ['门票与怎么订', 'Tickets & how to book'])}<div class="stack">${tix}</div></div>` : ''}
      ${d.blocks.map((b) => renderBlock(b, d)).join('')}
      ${foodBlock(foodSlots)}
      ${wishForDay(d)}
    </section>`;
}

function secMap() {
	if (!GEO) return '';
	const views = [['all', ['全部', 'All']], ...(TRIP.mapViews || []).map((v) => [v.id, v.name])]; // the trip's map areas
	return `<section class="sec" id="map" data-sec="map">
      <h2 class="sec-title">${icon('map')}${Z('地图', 'Map')}</h2>
      <p class="sec-lede">${Z('点地图上的点看地址和路线。右上「全屏」可单指拖动；右下按钮定位。颜色=日期，形状=类型。', 'Tap pin for address/directions. “Full screen” (top right): drag with one finger. Locate button bottom right. Colour = day, shape = type.')}</p>
      <div class="map-stage" id="mapstage">
      <div class="map-top"><p class="map-top-t">${icon('map')}${Z('地图', 'Map')}</p><button type="button" class="mlink map-exit" data-mapfull="0" aria-label="${Z('退出全屏', 'Exit full screen')}">${icon('x')}<span class="dlbl">${Z('退出全屏', 'Exit full screen')}</span></button></div>
      <div class="map-ctrl" role="group" aria-label="${Z('地图范围', 'Map area')}">${views.map(([k, l]) => `<button type="button" class="seg-btn" data-view="${k}">${esc(L(l))}</button>`).join('')}</div>
      <div class="map-ctrl days" role="group" aria-label="${Z('按日期筛选', 'Filter by day')}"><button type="button" class="seg-btn" data-filter="all" aria-pressed="true">${Z('全部天', 'All days')}</button>${DAYS.filter(
				(d) => d.id !== 'd7',
			)
				.map(
					(d) =>
						`<button type="button" class="seg-btn dayf" data-filter="${d.id}" style="${colorVars(d.c)}">${+d.date.slice(8)} ${esc(L(d.dow))}</button>`,
				)
				.join('')}</div>
      <div class="map-ctrl cats" role="group" aria-label="${Z('分类', 'Category')}">${MAP_CATS.filter(([k]) => k !== 'wish' || WISH.length)
				.map(
					([k, l]) =>
						`<button type="button" class="seg-btn cat" data-cat="${k}" aria-pressed="${k === 'all'}">${k === 'all' ? '' : `<span class="cat-ic" aria-hidden="true">${pinSVG({ type: k === 'place' ? 'place' : k, days: [], wish: null })}</span>`}${esc(L(l))}</button>`,
				)
				.join('')}</div>
      <div class="map-find" role="search"><label class="map-q">${icon('search')}<input id="mapq" type="search" enterkeyhint="search" autocomplete="off" placeholder="${Z('搜地图：店名、景点、厕所、饮料…', 'Search the map: name, sight, toilet, drinks…')}" aria-label="${Z('搜地图', 'Search the map')}"></label><button type="button" class="mlink map-listbtn" data-maplist aria-expanded="false" aria-controls="mapres">${icon('list')}<span class="dlbl">${Z('列表', 'List')}</span><b id="mapn"></b></button></div>
      <div class="map-results" id="mapres" hidden></div>
      <div class="map-wrap" role="region" aria-label="${Z('行程地图', 'Trip map')}"><div class="map-msg" id="mapmsg"><p>${Z('地图载入中…', 'Loading the map…')}</p></div><button type="button" class="map-full" data-mapfull="1" aria-label="${Z('全屏看地图', 'Full-screen map')}">${icon('expand')}<span class="dlbl">${Z('全屏', 'Full screen')}</span></button></div>
      </div>
      <div class="map-legend">
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="var(--ink-2)"/></svg>${Z('景点', 'Sight')}</span>
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="3" fill="var(--ink-2)"/></svg>${Z('美食', 'Food')}</span>
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5L14.5 8L8 14.5L1.5 8Z" fill="var(--ink-2)"/></svg>${Z('雪具店', 'Ski shop')}</span>
        ${WISH.length ? `<span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -9.5L2.8 -3.2L9.4 -2.6L4.4 1.8L5.9 8.4L0 5L-5.9 8.4L-4.4 1.8L-9.4 -2.6L-2.8 -3.2Z" fill="var(--ink-2)"/></svg>${Z('想去', 'Wishlist')}</span>` : ''}
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#0f8a7e"/><path d="M5.4 4.8h5.2l-.8 6.4H6.2z" fill="#fff"/></svg>${Z('饮料', 'Drinks')}</span>
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#a0527e"/><path d="M4.4 6h5.4v2.2a2.7 2.7 0 0 1-5.4 0z" fill="#fff"/><path d="M9.8 6.8h.8a1.2 1.2 0 0 1 0 2.4h-.8" fill="none" stroke="#fff" stroke-width="1"/></svg>${Z('歇脚·甜品', 'Rest & dessert')}</span>
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="#4a6fa5"/><text x="8" y="10.6" text-anchor="middle" font-size="6.5" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">WC</text></svg>${Z('公厕', 'Public toilet')}</span>
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="#0f5fa8"/><path d="M4.5 11.5V4.5L8 9l3.5-4.5v7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>${Z('捷运站', 'MRT')}</span>
        <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="4" fill="var(--ink)"/><path d="M4.5 9l3.5-3.5 3.5 3.5v3h-7z" fill="var(--paper)"/></svg>${Z('酒店', 'Hotel')}</span>
      </div>
      <div class="map-card" id="mapcard"><p class="muted small">${Z('点一个点看详情。', 'Tap a pin to see details.')}</p></div>
      <details class="more" style="margin-top:12px" data-lazy="${lazyKey(mapListHTML)}"><summary>${icon('list')}${Z('所有地点列表', 'All places as a list')}${icon('chev', 'chev')}</summary><div class="more-body" id="maplist" data-lazy-body></div></details>
      ${
				window.KML_B64
					? `<details class="more" style="margin-top:10px" id="mymaps"><summary>${icon('map')}${Z('导入到 Google 地图 App（My Maps）', 'All pins in Google Maps app (My Maps)')}${icon('chev', 'chev')}</summary><div class="more-body stack">
        <p class="small">${Z('App 不能直接导入文件，先在 Google My Maps 建一张图（一次，约1分钟），之后大家在 App 里看到全部点。', "App can't import files. Build one map in Google My Maps (once, ~1 min); then all see every pin in the app.")}</p>
        <ol class="list steps">
          <li>${Z('点下面「下载 KML」（iPhone会存进「文件」App）', 'Tap "Download KML" below (iPhone: Files app)')}</li>
          <li>${Z('浏览器开 mymaps.google.com，登录 →「建立新地图」', 'Open mymaps.google.com, sign in → "Create a new map"')}</li>
          <li>${Z('点「汇入」→ 选 taipei-trip-mymaps.kml', 'Tap "Import" → pick taipei-trip-mymaps.kml')}</li>
          <li>${Z('若全在同一层：图层「个别样式」→ 按「Layer」分组，即按天分色', 'If all pins in one layer: layer style → group by "Layer" (colours by day)')}</li>
          <li>${Z(`地图改名「${BRAND}」→「分享」→ 知道链接者可查看，链接发群组`, `Rename "${BRAND}" → Share → anyone with link can view; post link in group chat`)}</li>
          <li>${Z('Google Maps App：「已储存 Saved」→「地图 Maps」，打开看全部点', 'Google Maps app: "Saved" → "Maps" → open to see all pins')}</li>
        </ol>
        <div class="links-row"><a class="go-btn" href="data:application/vnd.google-earth.kml+xml;base64,${window.KML_B64}" download="taipei-trip-mymaps.kml">${icon('map')}${Z('下载 KML', 'Download KML')}</a>${ext('https://www.google.com/maps/d/', 'Google My Maps', 'ext')}</div>
      </div></details>`
					: ''
			}
      <p class="xsmall" style="margin-top:8px">${Z('地图资料', 'Map data')}: OpenFreeMap · © OpenStreetMap contributors · ${Z('导航以Google地图为准', 'Use Google Maps for turn-by-turn directions')}</p>
    </section>`;
}

function secAirport() {
	const A = AIRPORT;
	const maxv = 4000;
	const bars = A.methods
		.map((m) => {
			const l = (m.min / maxv) * 100,
				w = Math.max(((m.max - m.min) / maxv) * 100, 1.2);
			return `<div class="bar-row2"><span class="bar-lab">${esc(L(m.short))}</span><div class="bar-track"><div class="bar-grid"></div><div class="bar-range" style="left:${l}%;width:${w}%;--c:${m.pick ? 'var(--ink)' : 'var(--ink-3)'}"></div><span class="bar-val" style="${l + w > 70 ? `right:calc(${100 - l}% + 6px)` : `left:calc(${l + w}% + 6px)`}">${esc(m.cost)}</span></div></div>`;
		})
		.join('');
	return `<section class="sec" id="airport" data-sec="airport">
      <h2 class="sec-title">${icon('train')}${Z('机场交通', 'Airport transfer')}</h2>
      <p class="sec-lede">${fmt(A.lede)}</p>
      <dl class="facts">${A.facts.map((f) => `<div class="fact"><dt>${esc(L(f.k))}</dt><dd>${fmt(f.v)}</dd></div>`).join('')}</dl>
      <h3 class="sub">${icon('money')}${Z(`Day 1 到酒店：${GROUP[0]}总价`, `Day 1 to the hotel: total ${GROUP[1]}`)}</h3>
      <div class="bars" role="img" aria-label="${esc(A.methods.map((m) => `${L(m.name)} ${m.cost}`).join('; '))}">${bars}</div>
      <div class="bar-axis"><span></span><div class="bar-axis-t"><span>0</span><span>1,000</span><span>2,000</span><span>3,000</span><span>4,000</span></div></div>
      <div class="methods" style="margin-top:16px">${A.methods
				.map(
					(m) => `<article class="method ${m.pick ? 'pick' : ''}" id="m-${m.id}">
        <div class="method-h"><span class="ic">${icon(m.icon)}</span><div><p class="method-name">${fmt(m.name)}</p><p class="method-sub">${fmt(m.sub)}</p></div><p class="method-cost">${esc(m.cost)}<small>${fmt(m.per)}</small><small data-rm="${m.min},${m.max}">${rmText(m.min, m.max)}</small></p></div>
        <dl class="method-grid"><div class="mg"><dt>${Z('门到门', 'Door to door')}</dt><dd>${fmt(m.time)}</dd></div><div class="mg"><dt>${Z('换乘', 'Changes')}</dt><dd>${fmt(m.xfer)}</dd></div><div class="mg"><dt>${Z('拖行李', 'With bags')}</dt><dd>${fmt(m.bags)}</dd></div></dl>
        ${list(m.list)}
        <p class="note"><strong>${Z('适合', 'Best when')}:</strong> ${fmt(m.when)}</p>
        ${m.pick ? `<p class="pick-badge">${icon('check')}${Z('建议：大家要搭捷运的话，这样最省力', 'Recommended if we take the train')}</p>` : ''}
        ${m.id === 'van' ? ticketBlock('airport-transfer-booking') : ''}
      </article>`,
				)
				.join('')}</div>
      <h3 class="sub">${icon('route')}${Z('搭机场捷运怎么走', 'Taking the Airport MRT')}</h3>
      ${airportStrip()}
      <ol class="list steps">${A.steps.map((s) => `<li>${fmt(s)}</li>`).join('')}</ol>
      <div class="links-row">${placeLinks('tpe1', { noDriver: true })}${ext(SITES.tymetro.url, L(SITES.tymetro.name), 'ext')}${ext(gmDir(PLACES.hotel.maps, 'transit', PLACES.tpe1.maps), Z('T1 → 酒店（搭车）', 'T1 → hotel (transit)'), 'route')}${ext(gmDir(PLACES.hotel.maps, 'transit', PLACES.tpe2.maps), Z('T2 → 酒店（搭车）', 'T2 → hotel (transit)'), 'route')}</div>
      <h3 class="sub">${icon('clock')}${Z('当天怎么决定', 'Deciding on the day')}</h3>
      <div class="decide">${A.rule.map(optRow).join('')}</div>
      <h3 class="sub" id="easycard">${icon('card')}${Z('悠游卡', 'EasyCard')}</h3>
      ${list(A.easycard)}
      <div class="links-row">${ext(SITES.easycard.url, L(SITES.easycard.name), 'ext')}</div>
      ${ticketBlock('easycard-buy')}
      <h3 class="sub" id="depart">${icon('plane')}${Z(`回程：${Time.dateLabel(departEve(), 'zh')}晚到机场`, `Going home: to the airport on ${Time.dateLabel(departEve(), 'en')}`)}</h3>
      <p>${fmt(A.depart.lede)}</p>
      ${list(A.depart.list)}
      <div class="links-row">${ext(gmDir(PLACES.tpe1.maps, 'driving', PLACES.hotel.maps), Z('酒店 → T1（开车）', 'Hotel → T1 (drive)'), 'car')}${ext(gmDir(PLACES.tpe2.maps, 'driving', PLACES.hotel.maps), Z('酒店 → T2（开车）', 'Hotel → T2 (drive)'), 'car')}${ext(gmDir(PLACES.tpe1.maps, 'transit', PLACES.hotel.maps), Z('酒店 → T1（搭车）', 'Hotel → T1 (transit)'), 'train')}${ext(SITES.uber.url, 'Uber', 'ext')}</div>
      <p class="xsmall" style="margin-top:10px">${fmt(A.sourceNote)}</p>
    </section>`;
}

function secEntry() {
	const E = ENTRY;
	const lk = E.lucky;
	return `<section class="sec" id="entry" data-sec="entry">
      <h2 class="sec-title">${icon('passport')}${Z('入境与抽奖', 'Entry & lucky draw')}</h2>
      <div class="stack" style="margin-top:14px">${E.rules.map((r) => `<div class="tier"><p class="tier-h">${fmt(r.h)}</p><p style="margin-top:6px">${fmt(r.p)}</p>${r.warn ? `<p class="warn">${icon('alert')}${fmt(r.warn)}</p>` : ''}${r.site ? `<div class="links-row">${ext(SITES[r.site].url, L(SITES[r.site].name), 'ext')}</div>` : ''}</div>`).join('')}</div>
      <h3 class="sub" id="lucky">${icon('star')}${fmt(lk.name)}</h3>
      <p>${fmt(lk.period)}</p>
      <p class="callout">${icon('alert')}<span>${fmt(lk.deadline)}</span></p>
      <div class="block">${blockH('list', ['谁可以参加', 'Who can join'])}${list(lk.who)}</div>
      <div class="block">${blockH('users', [`我们${PAX}人可以拿多少？`, `How much could the ${PAX} of us get?`])}
        <div class="calc"><label for="repeat">${Z('2023年1月1日后入境过台湾的人数', 'People who entered Taiwan since 1 Jan 2023')}</label>
          <div class="stepper"><button type="button" class="icon-btn" data-step="-1" aria-label="${Z('减少', 'Fewer')}">${icon('minus')}</button><output id="repeat" aria-live="polite">${store.get('repeat', 3)}</output><button type="button" class="icon-btn" data-step="1" aria-label="${Z('增加', 'More')}">${icon('plus')}</button></div>
          <div id="calcout"></div></div></div>
      <div class="block">${blockH('check', ['中奖后怎么领', 'If we win'])}${list(lk.how)}</div>
      <p class="note">${fmt(lk.unsure)}</p>
      <div class="links-row">${ext(SITES.lucky.url, L(SITES.lucky.name), 'ext')}${ext(SITES.luckyRules.url, L(SITES.luckyRules.name), 'ext')}${ext(SITES.twac.url, L(SITES.twac.name), 'ext')}</div>
      <p class="xsmall" style="margin-top:10px">${Z(`资料来源：入出国及移民署、外交部领事局、海关、观光署官网（${checkedOn('ymd')}查）。`, `Sources: immigration, consular, customs, tourism sites (checked ${checkedOn('long')}).`)}</p>
    </section>`;
}
function calcLucky() {
	const r = Math.max(0, Math.min(5, +store.get('repeat', 3)));
	const c = PAX - r,
		comp = Math.min(c, r),
		left = c - comp,
		total = r * 5000 + comp * 3000;
	const o = $('#repeat');
	if (o) o.textContent = r;
	const out = $('#calcout');
	if (!out) return;
	out.innerHTML =
		r === 0
			? `<p class="warn">${icon('alert')}${Z(`没有人符合「重游旅客」，这次${PAX}人都不能参加。`, 'No Repeat Visitor; none of us eligible.')}</p>`
			: `<dl class="kv"><div><dt>${Z('重游旅客（各NT$5,000）', 'Repeat Visitors (NT$5,000 each)')}</dt><dd>${r}</dd></div><div><dt>${Z('同行亲友（各NT$3,000）', 'Companions (NT$3,000 each)')}</dt><dd>${comp}</dd></div>${left ? `<div><dt>${Z('不能参加', "Can't join")}</dt><dd>${left}</dd></div>` : ''}<div class="sum"><dt>${Z('全部中奖最多', 'If every pair wins')}</dt><dd>NT$${num(total)}</dd></div></dl><p class="note"><span data-rm="${total},${total}">${rmText(total, total)}</span> · ${Z('要中奖才有，不保证。', 'Only if drawn; not guaranteed.')}</p>`;
}

function secOptional() {
	const S = SNOW;
	const shop = (s) => {
		const p = PLACES[s.place];
		const a = addrFor(s.place);
		return `<article class="hang" id="shop-${s.place}"><div class="hang-h"><div><p class="hang-name"${alt(other(s.name))}>${esc(L(s.name))}</p><p class="hang-meta">${esc(L(s.area))} · ${esc(L(s.rank))}</p></div></div>
        <p class="note"><strong>${Z('什么时候', 'When')}:</strong> ${fmt(s.when)}</p>${list(s.list)}
        ${a.zh ? `<p class="addr">${icon('pin')}<span>${esc(a.zh)}${lang === 'en' && a.en ? `<br><span class="xsmall">${esc(a.en)}</span>` : ''}</span></p>` : ''}
        ${p.mrt ? `<p class="xsmall">${icon('train')} ${fmt(p.mrt)}</p>` : ''}${p.hours ? `<p class="xsmall">${icon('clock')} ${fmt(p.hours)}${p.tel ? ` · ${Z('电话', 'Tel')} <span class="sel">${esc(p.tel)}</span>` : ''}</p>` : ''}
        <div class="links-row">${placeLinks(s.place, { noDriver: true })}${s.day ? `<a class="mlink" href="#${s.day}">${icon('calendar')}Day ${dayById[s.day].n}</a>` : ''}</div></article>`;
	};
	const opt = (o) => {
		const a = addrFor(o.place);
		return `<article class="hang" id="${o.id}"><div class="hang-h">${credit[o.photo] ? `<img src="${imgSrc(o.photo, true)}" data-img="${imgKey(o.photo, true)}" alt="" width="64" height="64" loading="lazy">` : ''}<div><p class="hang-name"${alt(other(o.name))}>${esc(L(o.name))}</p><p class="hang-meta">${esc(L(o.meta))}</p></div></div>
        <p class="note"><strong>${esc(L(o.when))}:</strong></p>${list(o.list)}
        <div class="total" style="margin-top:10px"><span>${fmt(o.cost)}</span></div><p class="note">${fmt(o.note)}</p>
        ${a.zh ? `<p class="addr">${icon('pin')}<span>${esc(a.zh)}${lang === 'en' && a.en ? `<br><span class="xsmall">${esc(a.en)}</span>` : ''}</span></p>` : ''}
        <div class="links-row">${placeLinks(o.place)}</div>${o.ticket ? ticketBlock(o.ticket) : ''}</article>`;
	};
	return `<section class="sec" id="optional" data-sec="optional">
      <h2 class="sec-title">${icon('list')}${Z('备选：看当天情况', 'Optional: decide on the day')}</h2>
      <p class="sec-lede">${Z('都不锁日期，挂在主行程下，体力、天气、心情合适才加。', 'No dates. Add below main plan only if energy, weather, mood allow.')}</p>
      <div class="hung">${OPTIONAL.map(opt).join('')}</div>
      ${OPTIONAL.filter((o) => o.food)
				.map((o) => foodBlock(o.food.slots, o.food.h))
				.join('')}
      <h3 class="sub" id="snow">${icon('snow')}${Z('Snowboard / 雪具店', 'Snowboard / ski shops')}</h3>
      <p>${fmt(S.lede)}</p><p class="note">${fmt(S.lede2)}</p>
      ${credit['snow-gear'] ? `<div class="photos">${figure('snow-gear')}</div>` : ''}
      <div class="hung">${S.shops.map(shop).join('')}</div>
      <div class="block">${blockH('check', ['去之前对一下', 'Before going in, check'])}<p class="callout">${icon('info')}<span>${fmt(S.rule)}</span></p>${checkList(S.checks.map((t, i) => ({ id: `snow-${i}`, t })))}<p class="note">${fmt(S.close)}</p></div>
    </section>`;
}
