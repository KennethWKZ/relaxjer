/* ───────── sections ───────── */
/* Today (ADR-20261128-progressive-disclosure): the glance layer stays open (Now and Next, tonight's hotel, the week, one
   line a day); bookings are tiles; the trip's facts and the backup ideas are folds, shut until asked for */
function secOverview() {
	const now = tpNow();
	const td = DAYS.find((d) => d.date === now.date);
	// with a live sky the trip's name, its dates and today's weather sit in the sky's band at the top
	const head = skyOn()
		? bandHTML(
				`<p class="band-meta"><span>${icon('calendar')}${esc(Time.rangeLabel(TRIP.start, TRIP.end, lang))}</span>${td ? `<span class="flag">Day ${td.n}</span>` : ''}</p><h1 class="band-h">${esc(L(TRIP.name))}</h1>${td ? wxLine(td) : ''}`,
			)
		: `<h1 class="sr-only">${esc(L(TRIP.name))}</h1>`;
	return `<section class="sec" id="top" data-sec="top">
      ${head}
      ${worldArt('hero', 'world-hero')}
      <div class="now-card" id="now" aria-live="polite"></div>
      ${syncAwayHTML()}
      ${hotelCard(hotelNow())}
      <h2 class="sub">${icon('calendar')}${Z('这一周', 'The week')}</h2>
      <ol class="week">${DAYS.map((d) => `<li><a class="wk" href="#${d.id}" style="${colorVars(d.c)}">${dayMark(d)}<span class="wk-date">${+d.date.slice(8)}${daySeal(d)}<small>${esc(Z('周' + d.dow[0], d.dow[1]))}</small></span><span class="wk-title">${esc(dayShort(d))}</span>${dayWx(d)}${icon('arrow', 'wk-arrow')}</a></li>`).join('')}</ol>
      ${partsHTML('top', topParts(), ['预订和资料', 'Bookings and info'])}
      ${foldHTML(
				'facts',
				'info',
				['旅行资料', 'Trip facts'],
				FACTS.filter((f) => !f.place).length,
				`<dl class="facts">${FACTS.filter((f) => !f.place)
					.map((f) => `<div class="fact"><dt>${esc(L(f.k))}</dt><dd>${fmt(f.v)}</dd></div>`)
					.join('')}</dl>`,
			)}
      ${foldHTML(
				'backups',
				'list',
				['机动备选', 'Backups if we have time'],
				BACKUPS.length,
				`<div class="pills">${BACKUPS.map((b) => `<span class="tag">${fmt(b)}</span>`).join('')}</div><div class="links-row"><a class="mlink" href="#optional">${icon('arrow')}${Z('看备选详情', 'See the optional list')}</a></div>`,
			)}
    </section>`;
}
/** a collapsed section: a big heading with its count and a chevron that turns, shut until tapped; a native details, so
 *  search finds what's inside and opens it, and a reload reopens it (spotSave) */
function foldHTML(id, ic, h, n, body) {
	if (!n) return '';
	return `<details class="fold" id="fold-${id}"><summary class="fold-h"><h2>${icon(ic)}<span>${esc(L(h))}</span></h2><span class="fold-n">${n}</span>${icon('chev', 'chev')}</summary><div class="fold-body">${body}</div></details>`;
}
/** tonight's hotel as a card (the first night's before the trip): its name, the nights, and its actions as labelled
 *  icons; the address, its note and the phone fold under it (the driver card shows the address too) */
function hotelCard(pid) {
	const p = PLACES[pid];
	if (!p) return '';
	const nights = DAYS.slice(0, -1).filter((d) => hotelOf(d.id) === pid);
	const a = addrFor(pid);
	const span = nights.length
		? `${esc(Time.rangeLabel(nights[0].date, DAYS[DAYS.indexOf(nights[nights.length - 1]) + 1].date, lang))} · ${Z(`${nights.length} 晚`, `${nights.length} night${nights.length > 1 ? 's' : ''}`)}`
		: '';
	const more = [
		a.zh ? `<p class="addr">${icon('pin')}<span>${escText(a.zh)}${a.en ? `<br><span class="xsmall">${escText(a.en)}</span>` : ''}</span></p>` : '',
		p.note ? `<p class="xsmall">${fmt(p.note)}</p>` : '',
		p.tel ? `<p class="xsmall">${Z('电话', 'Tel')} <span class="sel">${esc(p.tel)}</span></p>` : '',
		p.gname
			? `<p class="xsmall">${icon('info')} ${Z(`Google 地图仍用旧名「${esc(p.gname)}」（同地址、电话）。搜新名字会出现别家酒店，请用这里的按钮或地址。`, `Google Maps still lists old name 「${esc(p.gname)}」 (same address/phone). New-name search finds other hotels; use buttons/address here.`)}</p>`
			: '',
	].join('');
	return `<article class="hotel-card" id="hotel-card"><div class="hc-head"><span class="hc-ic" aria-hidden="true">${icon('bed')}</span><div class="hc-t"><h2 class="hc-name">${esc(L(p.name))}</h2>${span ? `<p class="hc-sub">${span}</p>` : ''}</div></div>
      ${placeActs(pid, { copyName: true, noSite: true })}
      ${more ? `<details class="hc-more"><summary>${icon('info')}<span>${Z('地址和说明', 'Address and notes')}</span>${icon('chev', 'chev')}</summary><div class="hc-more-b">${more}</div></details>` : ''}</article>`;
}
/** Today's tiles: the bookings and the parts of the trip the group looks up now and then */
function topParts() {
	const F = FLIGHTS;
	const fl = (f) =>
		f && f.no
			? `<div class="flt-card">${icon('plane')}<div><p class="flt-no"><b>${esc(f.no)}</b> · ${esc(dateLabel(f.date))}</p><p>${esc(L(f.from || ['', '']))} → ${esc(L(f.to || ['', '']))}</p><p class="flt-t"><b>${esc(f.dep || '')}</b>${f.arr ? ` → <b>${esc(f.arr)}</b>` : ''}${f.dur ? ` · ${esc(f.dur)}` : ''}</p></div></div>`
			: '';
	const flights = [fl(F.out), fl(F.ret)].filter(Boolean);
	// a tile that goes to a view: Back returns here
	const go = (key, ic, t, href) => ({ key, icon: ic, t, h: t, href, body: ' ' });
	return [
		flights.length && {
			key: 'flights',
			icon: 'plane',
			h: ['航班', 'Flights'],
			t: ['航班', 'Flights'],
			n: flights.length > 1 ? flights.length : 0,
			body: `<div class="stack">${flights.join('')}</div>`,
		},
		go('airport', 'train', ['机场', 'Airport'], '#airport'),
		go('entry', 'passport', ['入境', 'Entry'], '#entry'),
		go('checklist', 'check', ['清单', 'Checklist'], '#checklist'),
		go('budget', 'money', ['预算', 'Budget'], '#budget'),
		hasTax() && {
			key: 'tax',
			icon: 'receipt',
			h: TAX.h || ['退税', 'Tax refund'],
			t: ['退税', 'Tax refund'],
			n: taxCoupons().good.length,
			sum: taxSum(),
			body: taxSheetHTML(),
			fill: () => taxSheetHTML(), // drawn when it opens: the coupons' images arrive after the first draw (imgLoad)
		},
		insPolicies().length && {
			key: 'ins',
			icon: 'shield',
			h: ['旅游保险', 'Travel insurance'],
			t: ['保险', 'Insurance'],
			n: insPolicies().length > 1 ? insPolicies().length : 0,
			sum: sumB([...new Set(insPolicies().map((p) => p.insurer))].map(esc).join(Z('、', ', '))),
			body: insuranceHTML(),
		},
	].filter(Boolean);
}
/* the group's travel insurance (INSURANCE, ADR-20261128-budget-paid-insurance): a card per policy (who it covers, the
   dates, what it covers, its app, the numbers to call, each a 44 px tel: link, WhatsApp as a wa.me link), then what to
   keep for a claim, by event. The page is shared with the group: no ID numbers, addresses or birth dates, ever (the
   contract refuses them) */
const insPolicies = () => (typeof INSURANCE !== 'undefined' && INSURANCE && Array.isArray(INSURANCE.policies) ? INSURANCE.policies : []);
const telHref = (t) => String(t).replace(/[^\d+]/g, '');
function insuranceHTML() {
	const contact = (c) =>
		`<div class="ins-c"><span class="ins-c-t"><b>${esc(L(c.label))}</b>${c.when ? `<small>${esc(L(c.when))}</small>` : ''}</span><span class="ins-c-a"><a class="go-btn ins-tel" href="tel:${telHref(c.tel)}">${icon('phone')}<span>${esc(c.tel)}</span></a>${
			c.wa
				? `<a class="ins-wa" href="https://wa.me/${telHref(c.wa).replace('+', '')}" target="_blank" rel="noopener">${icon('chat')}<span>WhatsApp</span></a>`
				: ''
		}</span></div>`;
	const site = (s) => (SITES[s] ? SITES[s].url : s);
	const policy = (p) => `<article class="ins-card">
      <p class="ins-name">${icon('shield')}<b>${fmt(p.name)}</b></p>
      <p class="ins-by">${esc(p.insurer)}${p.plan ? ` · ${esc(L(p.plan))}` : ''}</p>
      ${p.who ? `<p class="ins-line">${icon('users')}<span>${esc(L(p.who))}</span></p>` : ''}
      ${p.from ? `<p class="ins-line">${icon('calendar')}<span>${esc(p.to && p.to !== p.from ? Time.rangeLabel(p.from, p.to, lang) : dateLabel(p.from))}</span></p>` : ''}
      ${p.covers && p.covers.length ? `<ul class="ins-covers">${p.covers.map((c) => `<li>${icon('check')}<span>${esc(L(c))}</span></li>`).join('')}</ul>` : ''}
      ${p.note ? `<p class="note">${fmt(p.note)}</p>` : ''}
      ${p.contacts && p.contacts.length ? `<div class="ins-contacts">${p.contacts.map(contact).join('')}</div>` : ''}
      ${p.app ? `<p class="ins-line">${icon('install')}<span><b>${esc(p.app.name)}</b>${p.app.note ? ` · ${esc(L(p.app.note))}` : ''}</span></p>` : ''}
      ${p.site ? `<div class="links-row">${ext(site(p.site), Z('保险公司网站', "The insurer's site"))}</div>` : ''}
    </article>`;
	const claims = (typeof INSURANCE !== 'undefined' && INSURANCE.claims) || [];
	return `<div class="stack">${insPolicies().map(policy).join('')}</div>${
		claims.length
			? `<h4 class="ins-h">${icon('list')}${Z('理赔要留的文件', 'Keep these for a claim')}</h4>${claims.map((g) => `<div class="ins-claim"><p class="ins-claim-h">${esc(L(g.h))}</p>${list(g.items)}</div>`).join('')}`
			: ''
	}`;
}

// forecast from scripts/resync.py (Open-Meteo), for the part of Taiwan that day is in
const FC = window.FORECAST || null;
// which forecast spot a day reads: the day's `forecastSpot`, else the trip's
const FC_SPOT = Object.fromEntries(DAYS.filter((d) => d.forecastSpot).map((d) => [d.id, d.forecastSpot]));
const fcIcon = (c) => (c >= 61 || (c >= 51 && c < 60) || c >= 80 ? 'umbrella' : c >= 2 ? 'cloud' : 'sun');
/** a day's forecast ({ code, tmin, tmax, rain }), or null without one */
function fcOf(d) {
	return (d && FC && FC.days && FC.days[d.date] && FC.days[d.date][FC_SPOT[d.id] || TRIP.forecastSpot]) || null;
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
			if (!it.fixed || it._skip) return false; // a skipped booking holds nothing
			const pt = parseT(it.t || '');
			if (pt.s == null) return false;
			return m >= pt.s - 45 && m <= (pt.e != null ? pt.e : pt.s + 30);
		}) || null
	);
}
const llOfStop = (it) => (it.place ? placeLL(it.place) : it.lat != null ? { lat: it.lat, lng: it.lng } : null);

/* running late: push the rest of a day back. Fixed items (flights, the show, the charter pickup, checkout) never move
     and re-anchor the day, so a shift runs from its first stop up to the next fixed item. Stored per date as
     [{ from: planned start in minutes, min }]; the reset button clears it. The page only suggests; nothing moves by itself.
     A skipped stop's suggestion moves the next ones earlier the same way, as a negative min (07-skip.js), and a skipped
     fixed time no longer holds a move */
const shiftsOf = (date) => {
	const all = store.get('shift', {});
	return Plan.validPushes(all && all[date]);
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
	const fx = d.schedule.filter((it) => it.fixed && !it._skip && it._s0 != null).map((it) => it._s0);
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
		if (d.split) d.split._sh = shiftAt(d, tMin(d.split.at), segs); // the fork moves like any flexible stop
		d.schedule.forEach((it) => {
			it._sh = it.fixed ? 0 : shiftAt(d, it._s0, segs);
			it.t = it._sh ? shiftTxt(it._base, it._sh) : it._base;
			it._clash = null;
		});
		// a pushed item that now runs into the next fixed time (skipped ones aren't on the way)
		d.schedule.forEach((it, i) => {
			if (!it._sh || it._skip) return;
			const nf = d.schedule.slice(i + 1).find((x) => x.fixed && !x._skip && x._s0 != null);
			if (!nf) return;
			const pt = parseT(it.t);
			const nx = d.schedule.slice(i + 1).find((x) => x._s0 != null && !x._skip);
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
	const taxi = taxiMin(km(a, b));
	return Math.min(w, taxi, pl.none ? Infinity : pl.total);
};
// where we are vs today's plan: the next planned place we are not at, and how late we'd get there leaving now
function lateCheck() {
	const now = tpNow();
	const d = DAYS.find((x) => x.date === now.date);
	if (!d || !meLL || farAway() || meAcc > 400) return null;
	// a skipped stop isn't where the group is heading, so it's neither the target nor a deadline
	const rows = d.schedule.map((it, i) => ({ it, i, s: parseT(it.t || '').s, ll: llOfStop(it) })).filter((r) => r.s != null && !r.it._skip);
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
	if (!d || d.id === ROLE.flight) return '';
	const segs = shiftsOf(d.date);
	const lt = lateCheck();
	const no = store.get('lateNo', null);
	const muted = lt && no && no.date === d.date && no.i === lt.tgt.i && lt.late < no.late + 20;
	let box = '';
	if (lt && lt.fixed) {
		const dk = km(meLL, lt.tgt.ll);
		const taxi = Math.round(taxiMin(dk));
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
		? `<p class="shift-on">${icon('clock')}<span>${esc(tot < 0 ? Z(`今天后面已提早 ${-tot} 分`, `Today's rest moved ${-tot} min earlier`) : tot ? Z(`今天后面已顺延 +${tot} 分`, `Today's rest pushed back +${tot} min`) : Z('今天后面的时间改过', "Today's times changed"))}</span><button type="button" class="mlink" data-shift-edit="${d.id}">${Z('调整', 'Adjust')}</button><button type="button" class="mlink" data-shift-clear="${d.date}">${Z('恢复原时间', 'Undo')}</button></p>`
		: '';
	const ask = !box
		? `<div class="late-ask">${!segs.length ? `<button type="button" class="mlink" data-shift-edit="${d.id}">${icon('clock')}${Z('跑慢了？把后面往后推', 'Running late? Push the rest back')}</button>` : ''}${!meLL && navigator.geolocation && !window.DEMO_CLOCK && !geoAsk() ? `<button type="button" class="mlink" data-late-loc>${icon('pin')}${Z('用我的位置检查进度', 'Check progress from my location')}</button>` : ''}</div>`
		: '';
	return box + on + ask;
}
// the banner on a day whose times are pushed back
function shiftBanner(d) {
	const segs = shiftsOf(d.date);
	if (!segs.length) return '';
	const first = d.schedule.filter((it) => it._sh && !it._skip).sort((a, b) => a._s0 - b._s0)[0];
	const nf = first && d.schedule.find((it) => it.fixed && !it._skip && it._s0 > first._s0);
	const tot = segs.reduce((a, g) => a + g.min, 0);
	// pushed back, or moved earlier after a skipped stop (a negative total), or both and evened out
	const until = nf
		? Z(`，到 ${L(nf.t)}「${stopName(nf)}」固定行程为止`, ` until the fixed ${L(nf.t)} ${stopName(nf)}`)
		: Z('，一直到当天结束', ' to the end of the day');
	const said =
		tot < 0
			? first
				? Z(`已提早：从「${stopName(first)}」起 ${-tot} 分${until}。`, `Moved ${-tot} min earlier from ${stopName(first)}${until}.`)
				: Z(`已提早 ${-tot} 分`, `Moved ${-tot} min earlier`)
			: !tot
				? Z('时间改过，前后抵消了', 'Times changed, evening out')
				: first
					? Z(`已顺延：从「${stopName(first)}」起 +${tot} 分${until}。`, `Pushed back +${tot} min from ${stopName(first)}${until}.`)
					: Z(`已顺延 +${tot} 分`, `Pushed back +${tot} min`);
	return `<div class="shift-bar"><p>${icon('clock')}<span>${esc(said)}</span></p><div class="links-row"><button type="button" class="mlink" data-shift-edit="${d.id}">${Z('调整', 'Adjust')}</button><button type="button" class="mlink" data-shift-clear="${d.date}">${Z('恢复原时间', 'Back to planned times')}</button></div></div>`;
}
// pick the first stop to move and by how much
function shiftSheet(dayId) {
	const d = dayById[dayId];
	if (!d) return;
	const now = tpNow();
	const today = now.date === d.date;
	const run = d.schedule.findIndex((it) => it.fixed && it.rel && it.rel.dep); // once we leave for the airport, nothing after it moves
	const rows = d.schedule
		.map((it, i) => ({ it, i }))
		.filter((r) => r.it._s0 != null && !r.it.fixed && !r.it.step && !r.it._skip && (run < 0 || r.i < run));
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
/** moves a day's stops from a planned start by min (a push back > 0, a pull earlier < 0), adding to a move already
 *  there; a move that comes back to 0 goes */
function shiftNudge(date, from, min) {
	const segs = shiftsOf(date);
	const g = segs.find((x) => x.from === from);
	if (g) g.min += min;
	else segs.push({ from, min });
	shiftSet(
		date,
		segs.filter((x) => x.min !== 0),
	);
}
function shiftAdd(dayId, from, min) {
	const d = dayById[dayId];
	if (!d || from == null || !(min > 0)) return;
	shiftNudge(d.date, from, min);
	store.set('lateNo', null);
	const sh = $('#placeSheet');
	if (sh && sh.open) closeDialog(sh);
	whenSettled(() => mineRerender(Z(`后面行程已往后推 ${min} 分`, `Pushed back ${min} min`)));
}
// the day's string: its planned stops, its added ones slotted in by time, then the fold of skipped stops (tail). Sharing
// or clearing what this phone changed is rare, so it lives in the day's ⋯ sheet (changeRows), not under the string
function mineMerge(d, planned, tail = '') {
	const segs = shiftsOf(d.date);
	const rawDay = d.schedule.map((it) => parseT(it.t || ''));
	const mine = mineAll()
		.filter((x) => x.day === d.id)
		.map((x) => {
			const m = shiftAt(d, tMin(x.t), segs);
			return m ? { ...x, t: hm(tMin(x.t) + m) } : x;
		})
		.sort((a, b) => Plan.minuteOn(rawDay, tMin(a.t)) - Plan.minuteOn(rawDay, tMin(b.t)));
	const skipped = d.schedule.some((it) => it._skip);
	if (!mine.length && !skipped) return planned.join('');
	// a skipped stop isn't the stop before an added one: the group doesn't go there
	const rows = d.schedule.map((it, i) => ({ ...parseT(it.t || ''), html: planned[i], ll: it._skip ? null : llOfStop(it) }));
	mine.forEach((x) => {
		const m = tMin(x.t);
		const at = Plan.slotFor(rows, m); // an untimed "Evening: back to the hotel" stays after it
		const prev = rows
			.slice(0, at)
			.reverse()
			.find((r) => r.ll);
		rows.splice(at, 0, { s: m, ll: x, html: mineStopHTML(d, x, prev && prev.ll) });
	});
	return rows.map((r) => r.html).join('') + tail;
}
/* Day 6: the free afternoon, worked back from the flight. Checked bags for 5: at the airport 3 h before take-off
     (most counters close 60 min before); hotel → airport ~60 min door to door (+15 by train via A1); 45 min to collect bags. */
const SHOPS = window.SHOPS || [];
const hm = (m) =>
	`${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;
// the airport evening, worked back from take-off. FLIGHTS.ret.plan gives it in minutes before take-off: back at the
// hotel for the bags, leave, at the airport; the latest arrival at the airport and the longest road there
const LEAVE_PLAN = { back: 350, leave: 305, airport: 230, latest: 180, road: 75, ...(FLIGHTS.ret.plan || {}) };
function leaveTimes() {
	const P = LEAVE_PLAN;
	const dep = depMin();
	const plan = { back: dep - P.back, leave: dep - P.leave, airport: dep - P.airport };
	const airport = dep - P.latest;
	const leave = airport - P.road;
	return { dep, airport, leave, back: plan.back, plan };
}
// one line of the airport evening: `at` holds one or two times, each "HH:MM" as written or minutes before take-off;
// in the text, {latest} is the latest time to leave and {-N} the time N minutes before take-off
function leaveStep(T, x) {
	const at = x.at.map((a) => (typeof a === 'number' ? hm(T.dep - a) : a)).join('–');
	const text = L(x.what)
		.replace(/\{latest\}/g, () => hm(T.leave))
		.replace(/\{-(\d+)\}/g, (m, n) => hm(T.dep - +n));
	return `<li><b>${x.by ? `${Z('最晚', 'By')} ` : ''}${at}</b> ${esc(text)}</li>`;
}
const toHotelMin = (ll) => {
	const H = placeLL(hotelOf(ROLE.leave)); // back to where the bags are, on the airport evening
	const w = walkMin(ll, H);
	return w <= 15 ? Math.round(w) : Math.round(taxiMin(km(ll, H)));
}; // walk, or a taxi incl. hailing
function leaveBudgetHTML() {
	const T = leaveTimes();
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
	return `<div class="block leave-budget" id="leave-budget">${blockH('clock', ['今天的时间（从航班回推）', "Today's time, worked back from the flight"])}
      ${fltEditHTML('dep')}${!SYNC && store.get('fltDep', '') ? resetBtn() : ''}
      ${LEAVE_PLAN.route ? `<p class="xsmall muted">${esc(L(LEAVE_PLAN.route))}</p>` : ''}
      <ol class="leave-line">
        ${(LEAVE_PLAN.steps || []).map((x) => leaveStep(T, x)).join('\n        ')}
        ${T.dep != null ? `<li><b>${hm(T.dep)}</b> ${Z('起飞', 'Take-off')}${T.dep >= 1440 ? Z(`（${+FLIGHTS.ret.date.slice(8)}日）`, ` (${Time.ordinal(+FLIGHTS.ret.date.slice(8))})`) : ''}</li>` : ''}
      </ol>
      <p class="note">${esc(note)}</p></div>`;
}
// the free-day menu: everything worth adding, each with ＋
// a free-time idea: name, one line of why/where/when, and ＋ to put it in the day
// meta: plain text, or { html } already built (a cost with its per-person share)
const ideaRow = (n, meta, lat, lng, gpid, q, addr) =>
	`<li class="idea"><div class="idea-b"><span class="idea-n">${esc(n)}</span>${meta ? `<span class="idea-m">${meta.html != null ? meta.html : keepRanges(esc(meta))}</span>` : ''}</div>${addBtn(n, lat, lng, gpid, q, addr)}</li>`;
const awayHotel = (ll) => {
	const k = km(placeLL(hotelOf(ROLE.free)), ll); // the free-time day's hotel
	return k < 0.1 ? Z('就在酒店旁', 'next to the hotel') : Z(`离酒店${distLabel(k)}`, `${distLabel(k)} from hotel`);
};
// the country's tourist tax refund (Pack.taxRefund): which of our shops have it, and the minimum spend
// (plain text, in the home currency when the phone reads that and the pack counts in the trip's currency)
const trsMin = () => (Pack.taxRefund ? (Pack.sym === CUR.sym ? cvPlain : String)(`${Pack.sym}${num(Pack.taxRefund.min)}`) : '');
const trsTag = (x) =>
	!Pack.taxRefund
		? ''
		: x.trs === 'yes'
			? Z(` · 可退税（同日满${trsMin()}）`, ` · tax refund (${trsMin()}+ same day)`)
			: x.trs === 'some'
				? Z(` · 部分店家可退税（满${trsMin()}）`, ` · some shops: tax refund (${trsMin()}+)`)
				: '';
// the shops for the free-time day, with that day's opening hours
const shopRows = () => {
	const fd = dayById[ROLE.free];
	return SHOPS.map((x) => {
		const h = x.week ? x.week[Time.weekdayIndex(fd.date)] : '';
		return ideaRow(
			lang === 'en' ? x.name_en || x.name_trad : x.name_zh,
			`${lang === 'en' ? x.why_en : x.why_zh} · ${awayHotel(x)}${h ? ` · ${Z(`周${fd.dow[0]}`, fd.dow[1])} ${h === '24h' ? Z('24小时', '24 h') : h === 'closed' ? Z('休息', 'closed') : h}` : ''}${trsTag(x)}`,
			x.lat,
			x.lng,
			x.gpid,
			`${x.name_trad} ${x.addr || ''}`,
			x.addr,
		);
	});
};
// the shop list right under the free-shopping stop: the nearest few, the rest one tap away, and the tax-refund rules
function shopBoxHTML() {
	const rows = shopRows();
	if (!rows.length) return '';
	const N = 4;
	return `<div class="stop-eat stop-shops" id="free-shops"><p class="eat-h">${icon('bag')}${Z('买东西 · 点＋加入行程', 'Shopping · tap ＋ to add')}</p>
      <ul class="ideas">${rows.slice(0, N).join('')}</ul>
      ${rows.length > N ? `<details class="more idea-g" data-lazy="${lazyKey(() => rows.slice(N).join(''))}"><summary>${icon('bag')}<span>${Z(`再看 ${rows.length - N} 间`, `${rows.length - N} more`)}</span>${icon('chev', 'chev')}</summary><ul class="ideas" data-lazy-body></ul></details>` : ''}
      ${taxHTML()}</div>`;
}
function freeIdeasHTML() {
	const row = ideaRow;
	const away = awayHotel;
	const wish = WISH.filter((w) => w.status !== 'closed' && (w.fits || []).some((f) => f.day === ROLE.free))
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
	// each shop list's shops, as its own group
	const shopGroups = SHOPLISTS_.map((l) => ({
		l,
		rows: l.shops
			.map((x) => {
				const g = (GEO.places || {})[x.place];
				return g ? row(L(x.name), `${L(x.rank)} · ${away(g)}`, g.lat, g.lng, g.gpid, PLACES[x.place] ? PLACES[x.place].maps : L(x.name), '') : '';
			})
			.join(''),
	}));
	const grp = (ic, h, n, body, open) =>
		body
			? `<details class="more idea-g"${open ? ' open' : ` data-lazy="${lazyKey(() => body)}"`}><summary>${icon(ic)}<span>${esc(h)}</span><span class="wg-n">${n}</span>${icon('chev', 'chev')}</summary><ul class="ideas"${open ? `>${body}` : ' data-lazy-body>'}</ul></details>`
			: '';
	const cnt = (h) => (h.match(/class="idea"/g) || []).length;
	return `<div class="block" id="free-ideas">${blockH('star', ['自由时间去哪（点＋加入行程）', 'Free-time ideas (tap ＋ to add)'])}
      ${shopDaysHTML()}
      ${SHOPS.length ? `<a class="mlink" href="#free-shops">${icon('bag')}${Z(`买东西（${SHOPS.length} 间店、退税）：在行程「分组自由购物」下面`, `Shopping (${SHOPS.length} shops, tax refund): under “Free shopping” in the schedule`)}</a>` : ''}
      ${grp('star', Z('想去清单', 'Wishlist'), cnt(wish), wish)}${grp('flag', Z('备选景点', 'Optional sights'), cnt(opt), opt)}${shopGroups.map(({ l, rows }) => grp(l.icon, L(l.group), cnt(rows), rows)).join('')}
      <p class="xsmall muted">${Z('也可以在「地图」搜任何地方（包括 Google），点＋加入。', 'Or search anything on the map (Google too) and tap ＋.')}</p></div>`;
}
// tourist tax refund, under the shopping ideas: one row into its sheet in Today's bookings, where all of it lives
const taxHTML = () =>
	hasTax()
		? `<a class="mlink tax-go" href="#top-p-tax">${icon('receipt')}<span>${esc(L(TAX.h || ['退税', 'Tax refund']))}</span>${trsMin() ? `<span class="wg-n">${trsMin()}+</span>` : ''}${icon('chev-r')}</a>`
		: '';
/* the tourist tax refund (TAX; ADR-20261128-tax-refund): a tile in Today's bookings opens it. The rules in short with the
   pack's minimum spend and the deadline; the shop coupons, each with its barcode full width (a tap opens it full screen
   on white for the cashier's scanner; one past its last day greys and folds to Expired); how it works, step by step;
   to a card or in cash; and where things are at the airport, with the customs Wi-Fi. A trip with only h, list, shops and
   note keeps those */
function hasTax() {
	return typeof TAX !== 'undefined' && !!TAX && typeof TAX === 'object';
}
const taxCoupons = () => Tax.couponsOn(hasTax() ? TAX.coupons : [], tpNow().date);
const COUPON_FILES = window.COUPON_FILES || {};
const couponSrc = (key) => (IMG ? IMG[key] || BLANK : IMG_LATE ? BLANK : COUPON_FILES[key] || '');
const lbl = (v) => (Array.isArray(v) ? L(v) : String(v || '')); // a [zh, en] label, or a name that's the same in both
function taxSum() {
	const n = taxCoupons().good.length;
	return [
		trsMin() && Z(`同店同日满 ${sumB(trsMin())}`, `${sumB(trsMin())}+ in one shop, one day`),
		n && Z(`${n} 张优惠券`, `${n} coupon${n > 1 ? 's' : ''}`),
	]
		.filter(Boolean)
		.join(' · ');
}
function couponHTML(c, gone) {
	const shop = esc(lbl(c.shop));
	const until = c.until ? `<span class="coupon-until">${esc(Z(`${dateLabel(c.until)} 前有效`, `until ${dateLabel(c.until)}`))}</span>` : '';
	const rules = !c.rules ? '' : Array.isArray(c.rules[0]) ? list(c.rules) : `<p class="note">${fmt(c.rules)}</p>`;
	const img =
		c.img && COUPON_FILES[c.img]
			? `<button type="button" class="coupon-img" data-coupon="${esc(c.img)}" aria-label="${esc(Z(`${lbl(c.shop)}的优惠券：全屏给店员扫`, `${lbl(c.shop)} coupon: full screen for the cashier`))}"><img src="${couponSrc(c.img)}" data-img="${esc(c.img)}" alt="${esc(Z(`${lbl(c.shop)}优惠券和条码`, `${lbl(c.shop)} coupon and its barcode`))}" decoding="async"></button><p class="xsmall muted coupon-tip">${icon('expand')}<span>${Z('点图片全屏，给店员扫条码', 'Tap it for full screen, for the cashier to scan')}</span></p>`
			: '';
	const where = c.place && PLACES[c.place] ? `<div class="links-row">${placeLinks(c.place, { noDriver: true })}</div>` : '';
	const body = `<p class="coupon-h">${fmt(c.h)}</p>${c.items && c.items.length ? `<ul class="coupon-tiers">${c.items.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>` : ''}${img}${rules}${where}`;
	return gone
		? `<details class="coupon is-gone" data-coupon-id="${esc(c.id)}" data-keep-shut><summary><span class="coupon-shop">${icon('ticket')}<b>${shop}</b></span><span class="coupon-badge">${Z('已过期', 'Expired')}</span>${icon('chev', 'chev')}</summary><div class="coupon-b">${body}</div></details>`
		: `<article class="coupon" data-coupon-id="${esc(c.id)}"><p class="coupon-shop">${icon('ticket')}<b>${shop}</b>${until}</p>${body}</article>`;
}
function taxSheetHTML() {
	const T = TAX;
	const { good, gone } = taxCoupons();
	const sec = (ic, h, body) => (body ? `<h4 class="tax-h">${icon(ic)}<span>${esc(h)}</span></h4>${body}` : '');
	const ar = T.airport && typeof T.airport === 'object' ? T.airport : null;
	const wifi = ar && ar.wifi && ar.wifi.ssid ? ar.wifi : null;
	const copyBtn = (text, what) =>
		`<button type="button" class="mlink tax-copy" data-copy-text="${esc(text)}" aria-label="${esc(Z(`复制${what}`, `Copy the ${what}`))}">${icon('copy')}<span>${Z('复制', 'Copy')}</span></button>`;
	const places =
		ar && Array.isArray(ar.rows) && ar.rows.length
			? `<div class="tax-places">${ar.rows
					.map(
						(r) =>
							`<div class="tax-place"><p class="tax-what"><b>${fmt(r.what)}</b></p>${r.where ? `<p class="tax-line">${icon('pin')}<span>${fmt(r.where)}</span></p>` : ''}${r.when ? `<p class="tax-line">${icon('clock')}<span>${fmt(r.when)}</span></p>` : ''}${r.note ? `<p class="note">${fmt(r.note)}</p>` : ''}</div>`,
					)
					.join('')}</div>`
			: '';
	const wf = wifi
		? `<div class="tax-wifi"><p class="tax-what">${icon('wifi')}<b>${Z('海关 Wi-Fi', 'Customs Wi-Fi')}</b></p><p class="tax-wf"><span>${Z('名称', 'Network')}</span><code>${esc(wifi.ssid)}</code>${copyBtn(wifi.ssid, Z('名称', 'network name'))}</p>${wifi.pass ? `<p class="tax-wf"><span>${Z('密码', 'Password')}</span><code>${esc(wifi.pass)}</code>${copyBtn(wifi.pass, Z('密码', 'password'))}</p>` : ''}${wifi.note ? `<p class="note">${fmt(wifi.note)}</p>` : ''}</div>`
		: '';
	return [
		trsMin() || T.deadline
			? `<div class="tax-lead">${trsMin() ? `<p class="tax-key">${icon('money')}<span>${Z(`同一天、同一家店满 <b>${trsMin()}</b>`, `<b>${trsMin()}</b> or more in one shop, on one day`)}</span></p>` : ''}${T.deadline ? `<p class="tax-key">${icon('calendar')}<span>${fmt(T.deadline)}</span></p>` : ''}</div>`
			: '',
		Array.isArray(T.list) && T.list.length ? list(T.list) : '',
		sec(
			'ticket',
			Z('优惠券', 'Coupons'),
			good.length || gone.length
				? `<div class="coupons">${good.map((c) => couponHTML(c, false)).join('')}${gone.map((c) => couponHTML(c, true)).join('')}</div>`
				: '',
		),
		sec(
			'list',
			Z('怎么退', 'How it works'),
			Array.isArray(T.steps) && T.steps.length ? `<ol class="tax-steps">${T.steps.map((x) => `<li>${fmt(x)}</li>`).join('')}</ol>` : '',
		),
		sec(
			'card',
			Z('退到卡，还是领现金', 'To a card, or in cash'),
			Array.isArray(T.methods) && T.methods.length
				? `<div class="tiers">${T.methods.map((m) => `<div class="tier"><p class="tier-h">${fmt(m.h)}</p>${list(m.items || [])}${m.note ? `<p class="note">${fmt(m.note)}</p>` : ''}</div>`).join('')}</div>`
				: '',
		),
		sec('plane', ar && ar.h ? lbl(ar.h) : Z('在机场', 'At the airport'), places + wf),
		T.shops ? `<p class="small">${fmt(T.shops)}</p>` : '',
		T.note ? `<p class="xsmall muted">${fmt(T.note)}</p>` : '',
		T.src ? `<p class="xsmall muted">${icon('info')} ${fmt(T.src)}</p>` : '',
	].join('');
}
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
			.replace(/\{back\}/g, () => hm(leaveTimes().back));
	const rows = (TRIP.shopDays || []).map(
		(x) => `<li class="${x.ok ? 'ok' : 'no'}">${icon(x.ok ? 'check' : 'x')}<span>${fill(Z(x.zh, x.en))}</span></li>`,
	);
	if (!rows.length) return '';
	return `<div class="shopdays"><p class="sub-h">${icon('bag')}${Z('哪天适合大包小包买东西', 'Which days suit carrying shopping bags')}</p><ul class="shopdays-l">
      ${rows.join('\n      ')}
    </ul></div>`;
}
// an added stop on the last day: the latest time to leave it and still collect the bags
function leaveDeadline(x) {
	const back = leaveTimes().back;
	const t = toHotelMin(x);
	return { by: Math.floor((back - t) / 5) * 5, t, back };
} // rounded down to 5 min

function mineStopHTML(d, x, prevLL) {
	const cl = mineClash(d.id, x.t);
	const k = prevLL ? km(prevLL, x) : null;
	const wk = prevLL ? Math.max(1, Math.round(walkMin(prevLL, x))) : 0;
	return `<li class="stop mine" id="${esc(x.id)}" data-s="${tMin(x.t)}"><div class="stop-t">${esc(x.t)}</div><div class="stop-knot"></div><div class="stop-b">
      <p class="stop-name">${esc(x.name)}<span class="mine-tag">${SYNC && x.by ? esc(Z(`${x.by}${/[!-~]$/.test(x.by) ? ' ' : ''}加的`, `Added by ${x.by}`)) : Z('我加的', 'Added')}</span></p>
      ${x.addr ? `<p class="stop-note">${esc(x.addr)}</p>` : ''}
      ${cl ? `<p class="warn">${icon('alert')}${esc(Z(`接近固定行程：${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`, `Close to a fixed time: ${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`))}</p>` : ''}
      ${
				d.id === ROLE.leave
					? (() => {
							const D = leaveDeadline(x);
							const late = tMin(x.t) + 30 > D.by;
							return `<p class="${late ? 'warn' : 'stop-note'}">${icon(late ? 'alert' : 'clock')} ${esc(Z(`最晚 ${hm(D.by)} 离开这里（回酒店约${D.t}分钟，${hm(D.back)}拿行李）`, `Leave here by ${hm(D.by)} (~${D.t} min back to the hotel, bags at ${hm(D.back)})`))}</p>`;
						})()
					: ''
			}
      ${prevLL ? `<p class="stop-note">${icon(wk > 20 ? 'car' : 'walk')} ${esc(wk > 20 ? Z(`从上一站 ${distLabel(k)}：计程车约${Math.round(taxiMin(k))}分钟，或搭${METRO[0]}`, `${distLabel(k)} from the stop before: taxi ~${Math.round(taxiMin(k))} min, or the ${METRO[1]}`) : Z(`从上一站 ${distLabel(k)} · 走路约${wk}分钟`, `${distLabel(k)} from the stop before · ~${wk} min walk`))}</p>` : ''}
      <div class="stop-links">${extI(gmSearch(x.q, x.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(x.q, 'transit', undefined, x.gpid), Z('路线', 'Directions'), 'route')}${addAfter(d, x.id, true)}${canEditStop(x) ? `<button type="button" class="mlink" data-mine-edit="${esc(x.id)}">${icon('clock')}<span>${Z('改时间', 'Change')}</span></button><button type="button" class="mlink" data-mine-del="${esc(x.id)}" aria-label="${Z('删除', 'Remove')}">${icon('x')}<span class="dlbl">${Z('删除', 'Remove')}</span></button>` : ''}</div>
      ${nearDrinks(d, { place: x.id, t: x.t })}
    </div></li>`;
}
/* a day that splits (DAYS[].split, trip-format.md): part of the group takes its own plan for a few hours. It hangs,
   folded, on the string where it forks: its go / wait / skip rule, a switch between its plans (times, bike docks with
   live counts, a route for the map), and a note on the stop where they come back. A push-back moves the fork and the
   rejoin with the day's stops; the times inside each plan (pick-up, return by) are its own and stay as planned
   (ADR-20261007-split-follows-pushback). The switch is remembered per phone. */
function splitPick(d) {
	const id = (store.get('splitPick', {}) || {})[d.id];
	const opts = d.split.options;
	return opts.find((o) => o.id === id) || opts.find((o) => o.default) || opts[0];
}
const splitSum = (o) => [o.km && `≈${o.km} km`, o.back && Z(`约 ${o.back} 回来`, `back ≈${o.back}`)].filter(Boolean).join(' · ');
// the folded card's line: the plan's name, then its distance and return when it has them (no stray "·" without them)
const splitLine = (o) => [L(o.name), splitSum(o)].filter(Boolean).join(' · ');
const ybSpot = (p) => (p.yb ? `<span class="yb-live" data-yb="${esc(p.yb)}">${Z('打开后查可借车辆…', 'Checking live bikes…')}</span>` : '');
function splitDir(o) {
	const at = (p) => `${p.lat},${p.lng}`;
	const via = (o.via || []).map((p) => p.join(',')).join('|');
	return `https://www.google.com/maps/dir/?api=1&origin=${at(o.start)}&destination=${at(o.end)}${via ? `&waypoints=${encodeURIComponent(via)}` : ''}&travelmode=bicycling`;
}
function splitPanel(d, o, on) {
	const back = d.schedule.find((it) => it._s0 != null && it._s0 === tMin(o.join)); // by its planned time: a push-back moves it
	const joinT = back && back._sh ? hm(parseT(back.t).s) : o.join;
	const rows = [
		o.km && [
			Z('距离', 'Distance'),
			`≈${o.km} km${o.ride ? Z(` · 骑约 ${o.ride} 分钟${o.stops ? `，休息 ${o.stops} 分钟` : ''}`, ` · ≈${o.ride} min riding${o.stops ? `, ${o.stops} min stops` : ''}`) : ''}`,
		],
		o.start && [Z('借车', 'Pick up'), `${o.leave ? `${esc(o.leave)} · ` : ''}${esc(L(o.start.name))}${ybSpot(o.start)}`],
		o.end && [
			Z('还车', 'Return'),
			`${o.back ? `≈${esc(o.back)} · ` : ''}${esc(L(o.end.name))}${ybSpot(o.end)}${o.alt ? `<span class="split-alt">${Z('满了就还到', 'Full? Return at')} ${esc(L(o.alt.name))}</span>${ybSpot(o.alt)}` : ''}`,
		],
		...(o.rows || []).map(([k, v]) => [esc(L(k)), fmt(v)]),
		[Z('会合', 'Rejoin'), `${esc(joinT)}${back ? ` · ${fmt(back.what)}` : ''}`],
		o.fee && [Z('费用', 'Cost'), fmt(o.fee)],
	].filter(Boolean);
	const links = [
		o.line &&
			`<button type="button" class="mlink" data-split-map="${d.id}|${esc(o.id)}">${icon('map')}${Z('在地图上看路线', 'Route on the map')}</button>`,
		o.start && o.end && ext(splitDir(o), Z('Google 导航', 'Directions'), 'route'),
		o.place && placeLinks(o.place, { noDriver: true }),
	].filter(Boolean);
	return `<div class="split-opt" data-split-opt="${esc(o.id)}"${on ? '' : ' hidden'}>
      <dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd class="wrap">${v}</dd></div>`).join('')}</dl>
      ${o.rule ? `<p class="warn">${icon('clock')}${fmt(o.rule)}</p>` : ''}
      ${links.length ? `<div class="links-row">${links.join('')}</div>` : ''}
    </div>`;
}
function splitHTML(d) {
	const sp = d.split;
	const cur = splitPick(d);
	const opts = sp.options;
	const sh = sp._sh || 0;
	return `<li class="stop split${sh ? ' shifted' : ''}" id="${d.id}-split" data-s="${tMin(sp.at) + sh}"><div class="stop-t">${esc(sh ? hm(tMin(sp.at) + sh) : sp.at)}${sh ? `<span class="t-was">${esc(Z(`原 ${sp.at}`, `was ${sp.at}`))}</span>` : ''}</div><div class="stop-knot"></div><div class="stop-b">
      <p class="stop-name">${esc(L(sp.h))}<span class="split-who">${esc(L(sp.who))}</span></p>
      ${sp.sub ? `<p class="stop-note">${fmt(sp.sub)}</p>` : ''}
      <details class="more split-card"><summary>${icon(sp.icon || 'bike')}<span class="split-h"><span class="split-name">${Z('路线与规则', 'Plans and rules')}</span><span class="split-sum" data-split-sum>${esc(splitLine(cur))}</span></span>${icon('chev', 'chev')}</summary>
        <div class="more-body stack">
          ${sp.go ? `<div class="decide">${sp.go.map(optRow).join('')}</div>` : ''}
          ${opts.length > 1 ? `<div class="seg split-seg" role="group" aria-label="${Z('选一个', 'Pick one')}">${opts.map((o) => `<button type="button" aria-pressed="${o === cur}" data-split-pick="${d.id}|${esc(o.id)}">${esc(L(o.name))}</button>`).join('')}</div>` : ''}
          ${opts.map((o) => splitPanel(d, o, o === cur)).join('')}
          ${(sp.lists || []).map((g) => `<p class="tail-sub">${fmt(g.h)}</p>${list(g.list)}`).join('')}
          ${sp.note ? `<p class="note">${fmt(sp.note)}</p>` : ''}
          ${sh ? `<p class="note">${icon('clock')} ${esc(Z(`已顺延 +${sh} 分：${hm(tMin(sp.at) + sh)} 分开；各方案里的时间（借车、还车）仍按原计划。`, `Pushed back +${sh} min: it splits at ${hm(tMin(sp.at) + sh)}. The times inside each plan (pick-up, return by) stay as planned.`))}</p>` : ''}
        </div>
      </details></div></li>`;
}
// on the stop where they come back: who rejoins here, and on which plans
function splitBack(d, it) {
	if (!d.split) return '';
	const s = it._s0; // its planned time: a push-back moves the stop, and the rejoin with it
	const here = d.split.options.filter((o) => tMin(o.join) === s).map((o) => L(o.name));
	if (s == null || !here.length) return '';
	const who = L(d.split.who);
	return `<p class="split-back">${icon(d.split.icon || 'bike')}${esc(Z(`${who}在这里会合（${here.join('、')}）`, `Rejoining here: ${who} (${here.join(', ')})`))}</p>`;
}
// "add to my plan": pick a day and a time
let addItem = null;
// ref: the place's ref (21-place-finder.js placeInfo), so the add sheet can show what the page knows about it
const addBtn = (n, lat, lng, gpid, q, addr, ref) =>
	lat == null
		? ''
		: `<button type="button" class="mlink add-btn" data-add="${esc(JSON.stringify({ n, lat: +lat, lng: +lng, gpid: gpid || null, q: q || n, addr: addr || '', ...(ref ? { ref } : {}) }))}">${icon('plus')}${Z('加入行程', 'Add to plan')}</button>`;
// the suggested time in a new stop's sheet may still move to when the group can get there; one typed in may not
let addAutoT = false;
function addSheet(item) {
	addItem = item;
	addAutoT = !item.id;
	const td = DAYS.find((d) => d.date === tpNow().date && d.id !== ROLE.flight);
	const day = item.day || (td ? td.id : ROLE.free);
	const t =
		item.t ||
		(td
			? `${String(Math.min(22, Math.floor(tpNow().mins / 60) + 1)).padStart(2, '0')}:00`
			: day === ROLE.free && dayById[day].freeFrom
				? hm(tMin(dayById[day].freeFrom) + 60)
				: '12:00');
	// a new stop shows what the page knows of the place (our photo, the rating, the day's hours, the address) and, with
	// the key, Google's rating and photos: at once when it was tapped in the list for a closer look, else on a tap
	const info = !item.id && item.ref ? placeInfo(item.ref) : null;
	const place = info
		? `<article class="hang add-place">${placeHead(info)}${addrLine(info)}<div data-add-hours></div>${gCan(info) ? (item.peek ? '<div class="gplace" data-gauto></div>' : `<div class="links-row">${gBtn(info.gpid, info.ref)}</div>`) : ''}</article>`
		: `<p class="add-name" tabindex="-1">${esc(item.n)}</p>${item.addr ? `<p class="xsmall muted">${esc(item.addr)}</p>` : ''}`;
	return `${item.peek ? `<button type="button" class="mlink spots-back" data-add-back>${icon('arrow', 'flip')}${Z('回到列表', 'Back to the list')}</button>` : ''}<h3 class="spots-h">${icon('plus')}${esc(item.id ? Z('改时间', 'Change the time') : Z('加入行程', 'Add to my plan'))}</h3>${place}
      <p class="sub-h">${Z('哪一天', 'Which day')}</p><div class="add-days" role="group">${DAYS.filter((d) => d.id !== ROLE.flight)
				.map(
					(d) =>
						`<button type="button" class="seg-btn dayf" style="${colorVars(d.c)}" data-add-day="${d.id}" aria-pressed="${d.id === day}">${+d.date.slice(8)} ${esc(L(d.dow))}</button>`,
				)
				.join('')}</div>
      <p class="sub-h">${Z('几点', 'What time')}</p><input type="time" data-add-t class="add-t" value="${esc(t)}" step="900">
      <p class="add-clash" data-add-clash></p>
      <div class="add-leg" data-add-leg aria-live="polite"></div>
      ${SYNC ? syncAddNote() : `<p class="xsmall muted">${esc(L(TRIP.addStopNote || ['只存在这台设备；用「分享」把链接发给大家。', 'Saved on this device; use Share to send it to the others.']))}</p>`}
      <div class="links-row add-act"><button type="button" class="go-btn" data-add-save>${icon('check')}${item.id ? Z('保存', 'Save') : Z('加入', 'Add')}</button>${item.id ? `<button type="button" class="go-btn ghost" data-mine-del="${esc(item.id)}">${icon('x')}${Z('删除', 'Remove')}</button>` : ''}</div>`;
}
// with group sync the stop goes on everyone's page, under this phone's name; no name yet: ask for it right here
function syncAddNote() {
	const name = (syncMeta() || {}).name || '';
	return name
		? `<p class="xsmall muted">${esc(Z(`大家的页面都会看到，标着「${name}加的」。`, `Goes on everyone’s page, marked “Added by ${name}”.`))}</p>`
		: `<p class="xsmall muted">${Z('大家的页面都会看到。', 'Goes on everyone’s page.')}</p><label class="sync-name">${Z('你的名字（大家会看到是谁加的）', 'Your name (so the group sees who added it)')}<input type="text" data-sync-name maxlength="24" autocomplete="nickname" enterkeyhint="done"></label>`;
}
// add a stop right after this one: a labelled button in the opened stop (an added stop: in its row of links), never a
// "+" on the string between every stop (ADR-20261128-progressive-disclosure); the day's own Add a stop sits at its end
const addAfter = (d, key, mine) =>
	d.id === ROLE.flight
		? ''
		: mine
			? `<button type="button" class="mlink" data-add-gap="${d.id}|${esc(key)}">${icon('plus')}<span>${Z('之后加一站', 'Add after')}</span></button>`
			: `<button type="button" class="ibtn" data-add-gap="${d.id}|${esc(key)}">${ibtn('plus', Z('之后加一站', 'Add after'))}</button>`;
function gapContext(dayId, key) {
	// suggested time + the stop before, for the add sheet: a time that lands the new stop right after this knot
	const d = dayById[dayId];
	const raw = d.schedule.map((it) => parseT(it.t || ''));
	const rows = Plan.effectiveRows(raw);
	const on = (m) => Plan.minuteOn(raw, m); // the last day runs past midnight
	const later = (m) =>
		[
			...rows.filter((r, k) => r.s != null && !r.closes && !d.schedule[k]._skip).map((r) => r.s),
			...mineAll()
				.filter((y) => y.day === d.id)
				.map((y) => on(tMin(y.t))),
		]
			.filter((s) => s > m)
			.sort((a, b) => a - b)[0] ?? null;
	if (MINE[key]) {
		const x = MINE[key];
		const s = on(tMin(x.t));
		const t = Plan.gapTime(s, null, later(s));
		return { t: t != null ? hm(t) : null, prev: x.name, ll: { lat: x.lat, lng: x.lng } };
	}
	const i = +key;
	const it = d.schedule[i];
	if (!it) return {};
	const r = rows[i];
	const nx = rows.slice(i + 1).find((y) => y.s != null && !y.closes && y.s >= (r.s ?? -1));
	const t = Plan.gapTime(r.s, r.e, nx ? nx.s : null);
	const ll = llOfStop(it) || d.schedule.slice(0, i).reverse().map(llOfStop).find(Boolean) || placeLL(hotelOf(d.id));
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
	// the list and a place's preview share the sheet: the preview hides the list, so Back finds it as it was
	return `<div data-addfind><h3 class="spots-h">${icon('plus')}${esc(Z(`加一站到 Day ${d.n}（${dateLabel(d.date, d.dow)}）`, `Add a stop to Day ${d.n} (${dateLabel(d.date, d.dow)})`))}</h3>${where ? `<p class="xsmall muted">${esc(where)}</p>` : ''}
      <label class="map-q add-q">${icon('search')}<input type="search" data-addq enterkeyhint="search" autocomplete="off" placeholder="${Z('店名、景点、地址…', 'Shop, sight, address…')}" aria-label="${Z('搜地点', 'Search places')}"></label>
      <div class="add-cats" role="group" aria-label="${Z('分类', 'Category')}">${ADD_CATS.map(([k, l]) => `<button type="button" class="seg-btn" data-addcat="${k}" aria-pressed="${k === 'all'}">${esc(L(l))}</button>`).join('')}</div>
      <div class="add-sort" role="group" aria-label="${Z('排序', 'Sort')}">${ctx.ll ? `<button type="button" class="seg-btn" data-addsort="near" aria-pressed="${addSort === 'near'}">${icon('pin')}${Z('离上一站近', 'Nearest to the stop before')}</button>` : ''}<button type="button" class="seg-btn" data-addsort="rate" aria-pressed="${addSort === 'rate'}">${icon('star')}${Z('评分高', 'Top rated')}</button></div>
      <div class="add-res" data-add-res></div>${dayId === ROLE.free ? `<p class="xsmall"><a class="mlink" href="#free-ideas" data-close>${icon('star')}${Z('看「自由时间去哪」清单', 'See the free-time ideas')}</a></p>` : ''}</div><div data-addprev hidden></div>`;
}
// everything addable, with a category, a rating and "closed that day" when we know it
function addPool() {
	if (addPins) return addPins;
	const ok = (p) => !['wc', 'refill', 'bike', 'bus', 'mrt', 'hotel', 'mine'].includes(p.type);
	const cat = (p) => (p.type === 'shop' || p.type === 'place' ? 'place' : p.type);
	const pins = buildPins()
		.filter(ok)
		.map((p) => ({
			p,
			cat: cat(p),
			rating: (p.food && p.food.rating) || (p.wish && p.wish.rating) || (p.drink && p.drink.rating) || null,
			rsrc: (p.food && p.food.rating_source) || (p.wish && p.wish.rating_source) || (p.drink && p.drink.rating_source) || '',
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
		rsrc: 'Google Maps', // shops come from Google's place search
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
		off: !!date && (x.closed.includes(date) || (x.week && x.week[Time.weekdayIndex(date)] === 'closed')),
	}));
	hits.sort((a, b) => a.off - b.off || (addSort === 'near' && from ? a.k - b.k : Rating.byScore((x) => [x.rating, x.rsrc])(a, b)));
	// the whole row opens the place's preview (the same as its "Add to plan"), so a name is never a dead tap
	const row = (x) =>
		`<li class="idea"><button type="button" class="idea-b idea-go" data-add-peek><span class="idea-n">${esc(x.p.name)}</span><span class="idea-m">${esc(L(ADD_KIND[x.cat] || ['', '']))}${x.rating ? ` · ★${x.rating}` : ''}${x.k != null ? ` · ${Z('离上一站', 'from the stop before')} ${distLabel(x.k)}` : ''}${x.trs === 'yes' && trsMin() ? Z(` · 可退税（满${trsMin()}）`, ` · tax refund (${trsMin()}+)`) : ''}${x.off ? `<b class="idea-off"> · ${Z('当天休息', 'closed that day')}</b>` : ''}</span></button>${addBtn(x.p.name, x.p.lat, x.p.lng, x.gpid, x.p.q || x.p.name, '', pinRef(x.p))}</li>`;
	box.innerHTML =
		(hits.length
			? `<p class="xsmall muted">${Z(`${hits.length} 个`, `${hits.length} places`)}${hits.length > 25 ? Z('，只列前25个', ', first 25 shown') : ''}</p><ul class="ideas">${hits.slice(0, 25).map(row).join('')}</ul>`
			: `<p class="xsmall muted">${Z('页面里没有这个地方。', "The page doesn't have this place.")}</p>`) +
		// Google's search needs the page's Google key: without one the button could only fail
		(q && window.GMAPS
			? `<button type="button" class="go-btn ghost" data-add-g>${icon('search')}${esc(Z(`在 Google 搜「${q}」`, `Search Google for "${q}"`))}</button>`
			: '');
}
async function addFindGoogle(q) {
	const box = $('[data-add-res]');
	if (!box) return;
	box.innerHTML = `<p class="xsmall muted">${Z('Google 搜索中…', 'Searching Google…')}</p>`;
	try {
		const rows = (await gTextSearch(q)).map(
			(g) =>
				`<li class="idea"><button type="button" class="idea-b idea-go" data-add-peek><span class="idea-n">${esc(g.n)}</span><span class="idea-m">${esc(g.addr)}</span></button>${addBtn(g.n, g.lat, g.lng, g.gpid, g.q, g.addr, g.ref)}</li>`,
		);
		box.innerHTML = rows.length
			? `<ul class="ideas">${rows.join('')}</ul>`
			: `<p class="xsmall muted">${Z('Google 也没找到：换个名字试试', 'Nothing on Google either: try another name')}</p>`;
	} catch {
		box.innerHTML = `<p class="xsmall muted">${Z('现在连不上 Google（网络？）。可以先到「地图」加载地图再试。', "Can't reach Google right now (network?). Open the Map section once, then try again.")}</p>`;
	}
}
// a day with this many added stops already gets a word before one more goes in (and onto everyone's page)
const CROWDED = 4;
function addClashNote() {
	const el = $('[data-add-clash]');
	if (!el) return;
	addHoursNote();
	addClashMain(el);
	const day = ($('[data-add-day][aria-pressed="true"]') || {}).dataset?.addDay;
	const n = day ? mineAll().filter((x) => x.day === day && (!addItem || x.id !== addItem.id)).length : 0;
	if (n >= CROWDED)
		el.insertAdjacentHTML(
			'beforeend',
			`<span class="crowd-note">${icon('alert')} ${esc(Z(`Day ${dayById[day].n} 已经加了 ${n} 个行程：确定还要再加？`, `Day ${dayById[day].n} already has ${n} added stops: sure about one more?`))}</span>`,
		);
	addLegNote();
}
const legModes = (a, b) => {
	const k = km(a, b);
	const walk = walkMin(a, b); // at the group's pace
	const pl = walk > 12 ? mrtPlan(a, b) : { none: true };
	return { walk, taxi: k > 0.4 ? taxiMin(k) : null, mrt: pl.none ? null : pl.total };
};
const modeName = (m) => ({ walk: Z('走路', 'walking'), taxi: Z('计程车', 'by taxi'), mrt: Z(`搭${METRO[0]}`, `by ${METRO[1]}`) })[m] || m;
const legLine = (modes) =>
	Object.entries(modes)
		.filter(([, v]) => v != null)
		.map(([m, v]) => `${modeName(m)} ~${Math.max(1, Math.round(v))} ${Z('分', 'min')}`)
		.join(' · ');
/* the add sheet's "Getting there": from the stop before (or from where the phone is, for the next few hours today) to
   this one, walking at the group's pace, by taxi or the metro; whether the time set leaves enough of it, with the
   earliest time that does; and the time to leave for the next timed stop (Plan.legCheck). Estimates, no traffic */
function addLegNote() {
	const el = $('[data-add-leg]');
	if (!el) return;
	const day = ($('[data-add-day][aria-pressed="true"]') || {}).dataset?.addDay;
	const m0 = tMin(($('[data-add-t]') || {}).value);
	const d = day && dayById[day];
	if (!d || m0 == null || !addItem || addItem.lat == null) {
		el.innerHTML = '';
		return;
	}
	const raw = d.schedule.map((it) => parseT(it.t || ''));
	let rows = d.schedule.map((it, i) => ({ ...raw[i], ll: it._skip ? null : llOfStop(it), name: stopName(it) })); // skipped: not on the way
	mineAll()
		.filter((x) => x.day === day && x.id !== addItem.id)
		.sort((a, b) => Plan.minuteOn(raw, tMin(a.t)) - Plan.minuteOn(raw, tMin(b.t)))
		.forEach((x) => rows.splice(Plan.slotFor(rows, tMin(x.t)), 0, { s: tMin(x.t), e: null, ll: x, name: x.name }));
	const at = Plan.slotFor(rows, m0);
	rows = Plan.onOneClock(rows);
	const m = Plan.minuteOn(raw, m0);
	const here = { lat: addItem.lat, lng: addItem.lng };
	const now = tpNow();
	let prev = rows
		.slice(0, at)
		.reverse()
		.find((r) => r.ll && r.s != null);
	let fromName = prev ? prev.name : '';
	if (d.date === now.date && meLL && !farAway() && m >= now.mins && m <= now.mins + 180 && (!prev || prev.s <= now.mins)) {
		prev = { s: now.mins, e: null, ll: meLL };
		fromName = Z('你现在的位置', 'where you are now');
	}
	const next = rows.slice(at).find((r) => r.ll && r.s != null && r.s > m);
	const go = prev ? legModes(prev.ll, here) : null;
	const on = next ? legModes(here, next.ll) : null;
	const c = Plan.legCheck({ at: m, from: prev ? { start: prev.s, end: prev.e } : null, go, next: next ? next.s : null, onward: on });
	// on the leaving day a time is only worth offering while the group can still be back for its bags (leaveDeadline)
	const D = day === ROLE.leave ? leaveDeadline(addItem) : null;
	const soonest = c.earliest != null ? Math.ceil(c.earliest / 5) * 5 : null;
	const usable = soonest != null && (!next || soonest < next.s) && (!D || soonest + 30 <= D.by);
	// a suggested time ("+" under a stop) that leaves no time to get here moves to when the group can, on a 5-minute
	// mark, while that's still before the next timed stop
	if (addAutoT && c.short) {
		addAutoT = false;
		if (usable) {
			$('[data-add-t]').value = hm(soonest);
			return addClashNote();
		}
	}
	addAutoT = false;
	const out = [];
	if (d.date === now.date && m < now.mins - 5)
		out.push(
			`<p class="warn">${icon('clock')}<span>${esc(Z(`这个时间已经过了（现在 ${hm(now.mins)}）`, `That time has passed (it's ${hm(now.mins)} now)`))}</span></p>`,
		);
	if (prev && c.best) {
		out.push(
			`<p class="leg-line">${icon('route')}<span><b>${esc(Z(`从${fromName}`, `From ${fromName}`))}</b> · ${esc(distLabel(km(prev.ll, here)))} · ${esc(legLine(go))}</span></p>`,
		);
		out.push(
			c.short
				? `<p class="warn">${icon('alert')}<span>${esc(Z(`时间太早：最快约 ${hm(c.earliest)} 到（${modeName(c.best.mode)}）`, `Too early: the soonest is about ${hm(c.earliest)} (${modeName(c.best.mode)})`))}</span>${usable ? `<button type="button" class="mlink" data-add-use-time="${hm(soonest)}">${esc(Z(`改成 ${hm(soonest)}`, `Use ${hm(soonest)}`))}</button>` : ''}</p>`
				: `<p class="ok-note">${icon('check')} ${esc(Z(`来得及：${modeName(c.best.mode)}约 ${c.best.min} 分`, `Works: about ${c.best.min} min ${modeName(c.best.mode)}`))}</p>`,
		);
	}
	if (next && c.onBest)
		out.push(
			`<p class="${c.tight ? 'warn' : 'leg-line'}">${icon(c.tight ? 'alert' : 'clock')}<span>${esc(
				c.tight
					? Z(
							`赶不上 ${hm(next.s)}「${next.name}」：从这里过去${modeName(c.onBest.mode)}约 ${c.onBest.min} 分`,
							`Too late for ${next.name} at ${hm(next.s)}: it's ~${c.onBest.min} min ${modeName(c.onBest.mode)} from here`,
						)
					: Z(
							`接着 ${hm(next.s)}「${next.name}」：最晚 ${hm(c.leaveBy)} 离开这里（${modeName(c.onBest.mode)}约 ${c.onBest.min} 分）`,
							`Then ${next.name} at ${hm(next.s)}: leave here by ${hm(c.leaveBy)} (~${c.onBest.min} min ${modeName(c.onBest.mode)})`,
						),
			)}</span></p>`,
		);
	el.innerHTML = out.length ? `${out.join('')}<p class="xsmall muted">${Z('估算，不含塞车。', 'Estimates, without traffic.')}</p>` : '';
}
function addClashMain(el) {
	const day = ($('[data-add-day][aria-pressed="true"]') || {}).dataset?.addDay;
	const tv = ($('[data-add-t]') || {}).value;
	const cl = day && mineClash(day, tv);
	if (day === ROLE.leave && addItem && tMin(tv) != null) {
		const D = leaveDeadline(addItem);
		if (tMin(tv) + 30 > D.by) {
			el.innerHTML = `${icon('alert')} ${esc(Z(`太晚了：这里最晚 ${hm(D.by)} 要离开（回酒店约${D.t}分钟，${hm(D.back)}拿行李）`, `Too late: leave here by ${hm(D.by)} (~${D.t} min to the hotel, bags at ${hm(D.back)})`))}`;
			return;
		}
		const by = esc(Z(`最晚 ${hm(D.by)} 离开这里就赶得上`, `Leave by ${hm(D.by)} and you're fine`));
		el.innerHTML = cl
			? `${icon('alert')} ${esc(Z(`接近固定行程：${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`, `Close to a fixed time: ${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`))} · ${by}`
			: `<span class="ok-note">${icon('clock')} ${by}</span>`;
		return;
	}
	el.innerHTML = cl
		? `${icon('alert')} ${esc(Z(`接近固定行程：${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`, `Close to a fixed time: ${L(cl.t)} ${L(cl.what).replace(/\*\*/g, '')}`))}`
		: '';
}
// stops that left the plan by mistake: put back (newer than the removal, so they come back on every phone)
function putBack(stops, extra) {
	const ids = new Set(stops.map((x) => x.id));
	mineSet([...mineAll().filter((y) => !ids.has(y.id)), ...stops]);
	if (extra) {
		if (extra.fltArr && !store.get('fltArr', '')) store.set('fltArr', extra.fltArr);
		if (extra.fltDep && !store.get('fltDep', '')) store.set('fltDep', extra.fltDep);
		if (extra.shift && Object.keys(extra.shift).length) store.set('shift', { ...extra.shift, ...(store.get('shift', {}) || {}) });
		if (extra.lateNo != null && store.get('lateNo', null) == null) store.set('lateNo', extra.lateNo);
		if (extra.skips && Object.keys(extra.skips).length) store.set('skips', { ...extra.skips, ...skipsAll() });
	}
	const n = stops.length;
	whenSettled(() =>
		mineRerender(
			!n
				? Z('已撤销', 'Undone')
				: n === 1
					? Z(`已放回「${stops[0].name}」`, `Put back ${stops[0].name}`)
					: Z(`已放回 ${n} 个行程`, `Put back ${n} stops`),
		),
	);
	if (SYNC) syncSheetRefresh();
}
// an "Undo" on the toast after a removal: only what that removal took, so anything the group added since stays
const undoPutBack = (stops, extra) => ({ label: Z('撤销', 'Undo'), run: () => putBack(stops, extra) });
function removeStops(list, ask) {
	if (!list.length || !confirm(ask(list.length))) return;
	$$('#app dialog.bsheet[open]').forEach(closeDialog); // a day's ⋯ sheet, where it was asked for
	const ids = new Set(list.map((x) => x.id));
	mineSet(mineAll().filter((x) => !ids.has(x.id)));
	const n = list.length;
	whenSettled(() => mineRerender(Z(`已删除 ${n} 个行程`, `Removed ${n} stop${n > 1 ? 's' : ''}`), undoPutBack(list)));
	if (SYNC) syncSheetRefresh();
}
const noEditMsg = () => Z('只有加的人或规划人能改这个行程', 'Only the person who added it, or a planner, can change this stop');
function resetAll() {
	if (SYNC && !syncIsPlanner()) return toast(Z('只有规划人能恢复全组的原计划', 'Only a planner can put the whole group’s plan back'));
	const n = mineAll().length;
	const f = !!(store.get('fltArr', '') || store.get('fltDep', ''));
	const sh = Object.keys(store.get('shift', {}) || {}).length;
	const sk = Object.keys(skipsAll()).length;
	if (!n && !f && !sh && !sk) {
		toast(Z('现在就是原计划，没有要恢复的', 'Already the original plan'));
		return;
	}
	const what = [
		n
			? SYNC
				? Z(`删除全组加的 ${n} 个行程`, `remove all ${n} added stop${n > 1 ? 's' : ''}, everyone’s`)
				: Z(`删除我加的 ${n} 个行程`, `remove ${n} added stop${n > 1 ? 's' : ''}`)
			: '',
		sk ? Z(`放回跳过的 ${sk} 站`, `put back ${sk} skipped stop${sk > 1 ? 's' : ''}`) : '',
		f ? Z('航班改回原定时间', 'put the flights back to the booked times') : '',
		sh ? Z('取消往后推的时间', 'undo the pushed-back times') : '',
	]
		.filter(Boolean)
		.join(Z('、', ', '));
	const all = SYNC ? Z('全组每个人的页面都会改。', ' This changes everyone’s page.') : '';
	if (!confirm(Z(`恢复原计划：${what}？（清单打勾会保留）${all}`, `Back to the original plan: ${what}? (Checklist ticks stay.)${all}`))) return;
	// what it takes, for the Undo; the names people gave in Group sync aren't part of the plan and stay
	const was = {
		stops: mineAll(),
		fltArr: store.get('fltArr', ''),
		fltDep: store.get('fltDep', ''),
		shift: store.get('shift', {}) || {},
		lateNo: store.get('lateNo', null),
		skips: skipsAll(),
	};
	mineSet([]);
	store.set('skips', {});
	skipAsk = null;
	store.set('fltArr', '');
	store.set('fltDep', '');
	store.set('shift', {});
	store.set('lateNo', null);
	const ps = $('#placeSheet');
	if (ps && ps.open) closeDialog(ps);
	const tc = $('#toc');
	if (tc && tc.open) closeDialog(tc);
	$$('#app dialog.bsheet[open]').forEach(closeDialog); // a day's ⋯ sheet, where it was asked for
	whenSettled(() => mineRerender(Z('已恢复原计划', 'Back to the original plan'), undoPutBack(was.stops, was)));
	if (SYNC) syncSheetRefresh();
}
// with group sync, the everyday button clears only this phone's own stops; putting everyone's plan back is a
// planner's, in the Group sync sheet
const resetBtn = () => (SYNC ? ownClearBtn() : resetAllBtn());
function ownClearBtn() {
	const n = mineAll().filter(ownsStop).length;
	return n
		? `<button type="button" class="mlink reset-btn" data-mine-clear-own>${icon('x')}${Z(`删除我加的 ${n} 个行程`, `Remove the ${n} stop${n > 1 ? 's' : ''} I added`)}</button>`
		: '';
}
// anything on this phone that the original plan doesn't have: added stops, skipped stops, flight changes, moved times
const resetAllNeeded = () =>
	mineAll().length ||
	Object.keys(skipsAll()).length ||
	store.get('fltArr', '') ||
	store.get('fltDep', '') ||
	Object.keys(store.get('shift', {}) || {}).length;
const resetAllBtn = () =>
	resetAllNeeded()
		? `<button type="button" class="mlink reset-btn" data-reset-all>${icon('x')}${Z('恢复原计划', 'Back to the original plan')}</button>`
		: '';
/* what this phone changed, as rows of a day's ⋯ sheet (ADR-20261128-progressive-disclosure, amended): share it by link
   (only without group sync, which already shares it) and back to the original plan, in red. Both act on the whole trip,
   as they did at the foot of each day, and show only when there's something to act on. With group sync the reset row
   clears this phone's own stops; putting everyone's plan back stays a planner's, in the Group sync sheet */
function changeRows() {
	const skips = Object.keys(skipsAll()).length > 0;
	const share =
		!SYNC && (mineAll().length || skips)
			? actRow(
					'',
					'data-mine-share',
					'link',
					skips ? Z('把我的改动分享给大家', 'Share my changes') : Z('把我加的分享给大家', 'Share my added stops'),
					Z('一个链接，大家打开就加进自己的页面', 'One link; opening it adds them to their page'),
				)
			: '';
	return share + resetRow();
}
// the same two actions as the last row of the settings (23-sections-menu.js), in red: they take away (with Undo)
function resetRow() {
	if (SYNC) {
		const n = mineAll().filter(ownsStop).length;
		return n ? actRow('is-bad', 'data-mine-clear-own', 'x', Z(`删除我加的 ${n} 个行程`, `Remove the ${n} stop${n > 1 ? 's' : ''} I added`)) : '';
	}
	return resetAllNeeded()
		? actRow('is-bad', 'data-reset-all', 'x', Z('恢复原计划', 'Back to the original plan'), Z('清除我加的和改过的', 'Clears what I added or changed'))
		: '';
}
function mineRerender(msg, act) {
	const sp = spotNow();
	render();
	spotRestore(sp);
	if (msg) toast(msg, act);
}
// share: my stops in a link (#add=…), and the stops I skip after it (&skip=key_key, ADR-20261128-skip-planned-stops);
// opening it offers to add them. A link from before skips has no &skip and imports as it always did
const b64u = (str) =>
	btoa(unescape(encodeURIComponent(str)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const unb64u = (str) => decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/'))));
function mineShareURL() {
	const pack = mineAll().map((x) => [x.day, x.t, x.name, +x.lat.toFixed(6), +x.lng.toFixed(6), x.gpid || '', x.addr || '']);
	const skips = Object.keys(skipsAll()).filter((k) => Plan.SKIP_KEY.test(k));
	return `${(window.SHARE_URL || location.href).split('#')[0]}#add=${b64u(JSON.stringify(pack))}${skips.length ? `&skip=${skips.join('_')}` : ''}`;
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
	if (!Array.isArray(pack)) return;
	// the stops the sender skipped that this phone still has on: only ones this page knows and lets the group skip
	const sk = /[#&]skip=([\w-]+)/.exec(location.hash);
	const skips = (sk ? sk[1].split('_') : []).filter((k) => {
		const at = SKIP_AT[k];
		return at && canSkip(at.d, at.d.schedule[at.i]) && !skipsAll()[k];
	});
	if (!pack.length && !skips.length) return;
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
	if (!items.length && !skips.length) return;
	mineIncoming = items;
	mineIncomingSkips = skips;
	const skipRows = skips.map((k) => {
		const { d, i } = SKIP_AT[k];
		return `<li class="spot"><div class="spot-main"><span class="spot-n">${escText(stopName(d.schedule[i]))}</span><span class="spot-m">Day ${d.n} · ${esc(skipTime(d.schedule[i]))} · ${Z('跳过', 'skip')}</span></div></li>`;
	});
	openSheet(
		`<h3 class="spots-h">${icon('plus')}${items.length ? Z(`收到 ${items.length} 个别人加的行程`, `${items.length} shared stops`) : Z(`收到跳过的 ${skips.length} 站`, `${skips.length} shared skip${skips.length > 1 ? 's' : ''}`)}</h3>${items.length ? `<ul class="spots">${items.map((x) => `<li class="spot"><div class="spot-main"><span class="spot-n">${esc(x.name)}</span><span class="spot-m">Day ${dayById[x.day].n} · ${esc(x.t)}</span></div></li>`).join('')}</ul>` : ''}${skips.length ? `${items.length ? `<p class="sub-h">${Z(`也跳过 ${skips.length} 站`, `And skip ${skips.length}`)}</p>` : ''}<ul class="spots">${skipRows.join('')}</ul>` : ''}<div class="links-row"><button type="button" class="go-btn" data-mine-import>${icon('check')}${Z('加入我的行程', 'Add to my plan')}</button></div>`,
	);
}
let mineIncoming = null;
let mineIncomingSkips = [];
let flightT = 0;

/* the band of sky at the top of a view (a world with a live sky, ADR-20261122-day-views): the sky behind, snow falling
   behind the words, and the view's weather line. Its globe's Shake shows only in the globe sky (24-sky.js) */
const bandHTML = (inner) =>
	`<div class="band" data-band><div class="band-col">${inner}<button type="button" class="shake-btn" data-shake>${icon('globe')}<span>${Z('摇一摇', 'Shake the snow')}</span></button></div></div>`;
// what the forecast says, in words (the sky itself draws it, 24-sky.js), and what to wear beside it
function wxLine(d, wear) {
	const f = fcOf(d);
	const now = tpNow();
	const parts = [];
	if (f) {
		const w = Sky.wordFor(f.code, d.date === now.date && Sky.isNight(now.mins));
		parts.push(
			`<span class="wx-now">${icon(w.icon)}<b>${esc(L(w.name))}</b></span><span>${f.tmin}–${f.tmax}°</span><span class="wx-note">${Z('降水', 'precip.')} ${f.rain}%</span>`,
		);
	}
	if (wear) parts.push(`<span class="wx-wear">${icon('shirt')}<span>${Z('穿', 'Wear')}: ${esc(L(wear))}</span></span>`);
	return parts.length ? `<p class="wx-line">${parts.join('')}</p>` : '';
}
/* ── the glance layer of a day (ADR-20261128-progressive-disclosure): its card says three things in one line of icon
   facts, its stops are one line each, and everything else waits behind a tile or an opened stop ── */
// a stop's kind, drawn as the mark on its string: the data's own `icon`, else read from the stop (a meal, the hotel, a
// ride to its place, a walk, shopping), else a sight. Words of the page's own two languages only, never a place's name
const STOP_ICONS = new Set(Plan.stopKinds);
const MEAL_RE = /餐|饭|吃|夜市|breakfast|lunch|dinner|supper|meal|\beat\b|food|market/i;
const GO_RE = /去|到|回|往|搭|坐|乘|\bto\b|\bride\b|\btake\b/i;
function stopIcon(d, it) {
	if (STOP_ICONS.has(it.icon)) return it.icon;
	const zh = Array.isArray(it.what) ? it.what[0] : String(it.what || '');
	const en = Array.isArray(it.what) ? it.what[1] : '';
	const terminal = (AIRPORT.terminals || []).some((t) => t.place === it.place);
	if (terminal && (it.fixed || it.rel)) return 'plane';
	if (MEAL_RE.test(zh) || MEAL_RE.test(en)) return 'food';
	if (it.place && isHotel(it.place)) return 'bed';
	if ((MEAL_AT[d.id] || []).some(([re]) => re.test(zh))) return 'food';
	if (GO_RE.test(zh) || GO_RE.test(en)) {
		// a ride: the mode of the day's leg that reaches or leaves its place, else simply "on the way"
		const leg = (LEGS[d.id] || []).find((l) => (l[1] === it.place || l[0] === it.place) && l[2] !== 'walking');
		return leg ? MODES[leg[2]][2] : 'route';
	}
	if (/散步|走走|步行|walk|stroll/i.test(zh + en)) return 'walk';
	if (/购物|买|逛街|shop/i.test(zh + en)) return 'bag';
	return 'sight';
}
// a time range's start ("10:30–12:00" → "10:30"); the whole range shows when the stop opens
const tStart = (t) => String(t).replace(/^(\D*\d{1,2}:\d{2})\s*[–-]\s*\d{1,2}:\d{2}$/, '$1');
// minutes, said short: "45 分钟" / "45 min", "1 小时 20 分" / "1 h 20 min"
const durText = (m) =>
	m < 60
		? Z(`${m} 分钟`, `${m} min`)
		: m % 60
			? Z(`${Math.floor(m / 60)} 小时 ${m % 60} 分`, `${Math.floor(m / 60)} h ${m % 60} min`)
			: Z(`${m / 60} 小时`, `${m / 60} h`);
/** each person's share of a group figure as one number on the glance layer: the middle of the range, in the currency
 *  this phone reads, marked "about" (and the plan's estimate mark when it is one) */
function eachOne(min, max, est) {
	const v = Money.glanceShare(min, max, PAX);
	const n = homeFirst ? `${esc(CUR.home)} ${Money.roundHome(v / rate).toLocaleString('en-US')}` : `${esc(CUR.sym)}${num(v)}`;
	return Z(`每人约 ${n}${est ? '（估）' : ''}`, `≈ ${n} each${est ? ' (est.)' : ''}`);
}
// the day's one line of facts: time on the way, what it costs each, the forecast (where no sky shows it), a rain plan
function dayFacts(d, sky) {
	const out = [];
	const legs = LEGS[d.id] && dayLegs(d); // without the places the group skips
	if (legs) {
		const LT = (GEO && GEO.legs) || {};
		let tot = 0;
		let top = null;
		legs.forEach((leg, li) => {
			const t = Plan.storedLeg(LT, d.id, li, leg);
			if (!t) return;
			const m = leg[2] === 'walking' ? Math.round(t.min * GROUP_WALK) : t.min;
			tot += m;
			if (!top || m > top.m) top = { m, mode: leg[2] };
		});
		if (tot)
			out.push(
				`<span class="lf">${icon(MODES[top.mode][2])}<span>${esc(Z(`路上约 ${durText(tot)}`, `~${durText(tot)} getting around`))}</span></span>`,
			);
	}
	const b = d.blocks.find((x) => x.type === 'budget');
	const span = b ? [b.min, b.max] : d.budgetChip ? numsIn(L(d.budgetChip)) : null;
	if (span) out.push(`<span class="lf">${icon('money')}<span>${eachOne(span[0], span[1], b && b.est)}</span></span>`);
	const f = !sky && fcOf(d);
	if (f) out.push(`<span class="lf">${icon(fcIcon(f.code))}<span>${f.tmin}–${f.tmax}°</span></span>`);
	const rain = d.blocks.find((x) => x.type === 'rain');
	if (rain) out.push(`<span class="lf">${icon('umbrella')}<span>${esc(L(rain.tile || ['有雨天方案', 'Rain plan']))}</span></span>`);
	return out.length ? `<p class="l-facts">${out.join('')}</p>` : '';
}
function secDay(d, today) {
	const isToday = today === d.date;
	const sky = skyOn();
	const wishOnly =
		lang === 'zh'
			? `<h2 class="wish">${esc(d.wish)}</h2>`
			: `<p class="wish" lang="zh-Hans" aria-hidden="true">${esc(d.wish)}</p><p class="wish-gloss">${esc(d.gloss[1])}</p>`;
	const titleOnly =
		lang === 'zh'
			? `<p class="l-title"${alt(other(d.title))}>${esc(L(d.title))}</p>`
			: `<h2 class="l-title"${alt(other(d.title))}>${esc(L(d.title))}</h2>`;
	// the date leads, big; the day's number and its mark beside it, small
	const meta = `<div class="l-meta">${dateTag(d.date, d.dow)}<span class="l-n">Day ${d.n}</span>${motifTag(d)}${isToday ? `<span class="flag inv">${Z('今天', 'Today')}</span>` : ''}</div>`;
	// with a live sky the day's date, wish, weather and what to wear sit in the sky's band; the card keeps the rest
	const band = sky ? bandHTML(`${meta}${wishOnly}${wxLine(d, d.wear)}`) : '';
	const photos = (d.photos || []).filter((p) => credit[p]); // optional: a day may have none
	const stopsTitle = d.stepsTitle ? L(d.stepsTitle) : Z('行程', 'Schedule');
	// no Add after where nothing can come right after: the row that closes the day (back to the hotel), a moment the next
	// row starts at too (Plan.roomAfter), and the flight home
	const room = Plan.roomAfter(d.schedule.map((it) => parseT(it.t || '')));
	const closes = room.map((ok, i) => !ok || !!(d.schedule[i].rel && Array.isArray(d.schedule[i].rel.dep) && d.schedule[i].rel.dep[0] === 0));
	const planned = d.schedule.map((it, i) => {
		// skipped: folded into the day's "N skipped" line (skipFoldHTML), or, right after the skip, greyed where it was with
		// the suggestion to move the next stops earlier (07-skip.js)
		if (it._skip) return skipAskHTML(d, i);
		const t = it.step ? String(it.step) : L(it.t || '');
		const pt = parseT(it.t || '');
		const cls = ['stop', it.fixed && 'fixed', it.key && 'key', it.todo && 'todo'].filter(Boolean).join(' ');
		const sid = `${d.id}-s${i}`;
		// the stop's sheet: what's near it (food, the wishlist, drinks and rest spots), its shop box, its local words, a
		// photo, and its map and directions again; the opened row has the few actions used on the way
		const more = [
			stopNative(it),
			it.place || it.link
				? `<div class="stop-links">${it.place ? placeLinks(it.place, { noSite: false, noNative: true }) : ''}${it.link ? `<a class="mlink" href="${SITES[it.link] ? SITES[it.link].url : it.link}">${icon('arrow')}${Z('看详情', 'Details')}</a>` : ''}</div>`
				: '',
			it.shops ? shopBoxHTML() : '',
			mealEats(d, it),
			nearWish(d, it),
			nearDrinks(d, it),
			it.photo ? thumb(it.photo) : '',
		]
			.join('')
			.trim();
		// built the first time it opens, like a part's sheet (partSheet, 06-render-blocks.js): a long trip has a sheet per
		// stop, and drawing them all at first paint cost a twelve-day trip ~2,900 nodes (tests/e2e/boot.spec.mjs)
		const moreSheet = more
			? `<dialog class="sheet bsheet ssheet" id="${sid}-more" aria-labelledby="${sid}-more-h" data-lazy="${lazyKey(
					() =>
						`<div class="bsheet-head"><span class="bsheet-grip" aria-hidden="true"></span><span class="part-ic" aria-hidden="true">${icon(it.fixed ? 'clock' : 'pin')}</span><h3 class="bsheet-h" id="${sid}-more-h">${escText(stopName(it))}<small>Day ${d.n} · ${esc(dateLabel(d.date, d.dow))}${it.t ? ` · ${esc(L(it.t))}` : ''}</small></h3><button type="button" class="icon-btn bsheet-x" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button></div><div class="bsheet-body">${more}</div>`,
				)}"></dialog>`
			: '';
		// the opened stop: its whole time, its note and longer note, where the group rejoins, the few actions on the way
		// (labelled icons), what the trip suggests near it, and its sheet
		const range = !it.step && t !== tStart(t) ? `<p class="stop-when">${icon('clock')}<span>${esc(t)}</span></p>` : '';
		const acts = [
			it.place ? placeActs(it.place, { noSite: true }) : '',
			closes[i] ? '' : addAfter(d, `${i}`),
			more
				? `<button type="button" class="ibtn stop-more" data-part="${sid}-more" aria-haspopup="dialog" aria-expanded="false">${ibtn('more', Z('附近和更多', 'Nearby & more'))}</button>`
				: '',
			canSkip(d, it) ? skipAct(d, i) : '', // not on a flight or the lodging (ADR-20261128-skip-planned-stops)
		].join('');
		const inner = [
			range && !it.fixed ? range : '',
			it.note && !it.todo ? `<p class="stop-note">${fmt(it.note)}</p>` : '',
			it.detail ? `<p class="stop-note stop-detail">${fmt(it.detail)}</p>` : '',
			splitBack(d, it),
			acts ? `<div class="stop-acts">${acts}</div>` : '',
			nearOpts(d, it, sid),
		]
			.join('')
			.trim();
		// one line, two at most: its name, and for a fixed time the seal with its range, or a note the group must act on
		const line2 = it.fixed
			? `<span class="stop-2">${seal()}${range ? `<span class="stop-range">${esc(t)}</span>` : ''}</span>`
			: it.todo && it.note
				? `<span class="stop-2 stop-do">${icon('flag')}<span>${fmt(it.note)}</span></span>`
				: '';
		const name = `<span class="stop-name"${alt(other(it.what))}>${fmt(it.what)}<span class="flag-slot"></span></span>${line2}`;
		const head = inner
			? `<details class="stop-x" data-stop="${sid}"${stopIsOpen(sid) ? ' open' : ''}><summary class="stop-sum">${name}${icon('chev', 'chev')}</summary><div class="stop-open">${inner}</div></details>`
			: `<div class="stop-sum">${name}</div>`;
		const knot = it.fixed ? '' : `<span class="knot-ic" aria-hidden="true">${icon(stopIcon(d, it))}</span>`;
		return `<li class="${cls}${it._sh ? ' shifted' : ''}${more ? ' has-more' : ''}" id="${sid}" ${pt.s != null ? `data-s="${pt.s}"` : ''}><div class="stop-t">${tStart(t) === t ? esc(t) : `<span aria-hidden="true">${esc(tStart(t))}</span><span class="sr-only">${esc(t)}</span>`}${it._sh ? `<span class="t-was">${esc(Z(`原 ${tStart(L(it._base))}`, `was ${tStart(L(it._base))}`))}</span>` : ''}</div><div class="stop-knot">${knot}</div><div class="stop-b">
        ${head}
        ${it._clash ? `<p class="warn stop-clash">${icon('alert')}<span>${esc(Z(`推迟后会撞到 ${L(it._clash.t)}「${stopName(it._clash)}」：这一项缩短或跳过`, `Now runs into the fixed ${L(it._clash.t)} ${stopName(it._clash)}: shorten or skip this`))}</span>${canSkip(d, it) ? `<button type="button" class="mlink" data-skip="${d.id}|${i}">${icon('skip')}<span>${Z('跳过', 'Skip')}</span></button>` : ''}</p>` : ''}
        ${skipShutHTML(d, it, i, isToday)}
        ${it.place ? `<div class="stop-drv"><button type="button" class="mlink" data-driver="${it.place}">${icon('car')}${Z('给司机看', 'Show driver')}</button></div>` : ''}
        ${moreSheet}</div></li>`;
	});
	if (d.split) {
		// it forks after the last stop that starts by then; added stops still sort around it by time
		const fork = tMin(d.split.at) + (d.split._sh || 0);
		const at = d.schedule.reduce((k, it, j) => (parseT(it.t || '').s != null && parseT(it.t || '').s <= fork ? j : k), -1);
		if (at >= 0) planned[at] += splitHTML(d);
	}
	const sched = mineMerge(d, planned, skipFoldHTML(d));
	const foodSlots = d.foodSlots || []; // the day's researched food slots (extra.json food[].slot)
	const tickets = d.tickets || []; // the day's ticket/booking cards (ids in extra.json tickets)
	const tixOk = tickets.map((t) => (EXTRA.tickets || []).find((x) => x.id === t)).filter(Boolean);
	const tix = tixOk.map((t) => ticketBlock(t.id)).join('');
	const food = foodBlock(foodSlots);
	const foodN = (EXTRA.food || []).filter((f) => foodSlots.includes(f.slot)).length;
	const wishD = wishForDay(d);
	const wishN = (wishD.match(/class="wish-row"/g) || []).length;
	const ideas = d.id === ROLE.free ? freeIdeasHTML() : '';
	const BLOCK_ICON = { wear: 'shirt', budget: 'money', rain: 'umbrella' };
	// the day's route (places and how you get between them, the whole route in the maps app) and its focus: one tile
	const route = routeCard(d);
	const focus = d.focus ? `<p class="route-focus">${icon('flag')}<span>${esc(L(d.focus))}</span></p>` : '';
	// the day's planning blocks: a tile each under the card, the block itself in its sheet
	const parts = [
		(route || focus) && {
			key: 'route',
			icon: 'route',
			h: ['今天的路线', "The day's route"],
			t: ['路线', 'Route'],
			sum: esc(L(d.title)),
			noSum: true,
			body: `${focus}${route}${GEO ? `<div class="gl route-acts">${actRow('', `data-map-day="${d.id}"`, 'map', Z('在地图上看这天', 'This day on the map'))}</div>` : ''}`,
		},
		ideas && {
			key: 'ideas',
			icon: 'star',
			h: ['自由时间去哪', 'Free-time ideas'],
			t: ['去哪玩', 'Ideas'],
			sum: `${sumB(Z('点＋加入行程', 'Tap ＋ to add a stop'))} · ${nItems((ideas.match(/class="more idea-g/g) || []).length, '组', 'group', 'groups')}`,
			n: (ideas.match(/class="more idea-g/g) || []).length,
			body: ideas,
		},
		tix && {
			key: 'tickets',
			icon: 'ticket',
			h: ['门票与怎么订', 'Tickets & how to book'],
			t: ['门票', 'Tickets'],
			sum: `${sumB(nItems(tixOk.length, '张', 'ticket', 'tickets'))} · ${escText(lang === 'en' ? tixOk[0].title_en : tixOk[0].title_zh)}`,
			n: tixOk.length > 1 ? tixOk.length : 0,
			body: `<div class="block">${blockH('ticket', ['门票与怎么订', 'Tickets & how to book'])}<div class="stack">${tix}</div></div>`,
		},
		...d.blocks.map((b, i) => ({
			key: `b${i}`,
			icon: BLOCK_ICON[b.type] || b.icon,
			h: b.h,
			t: tileWord(b),
			n: tileCount(b),
			pick: b.type === 'decide' && !!b.pick,
			sum: blockSum(b),
			body: renderBlock(b, d),
			fill: () => renderBlock(b, d),
		})),
		food && {
			key: 'food',
			icon: 'food',
			h: ['去哪吃（参考）', 'Where to eat'],
			t: ['去哪吃', 'Where to eat'],
			n: foodN,
			sum: sumB(nItems(foodN, '个吃饭的地方', 'place to eat', 'places to eat')),
			body: food,
		},
		wishD && {
			key: 'wish',
			icon: 'star',
			h: ['顺路还可以去', 'Also nearby'],
			t: ['想去', 'Wishlist'],
			n: wishN,
			sum: sumB(nItems(wishN, '个想去的地方', 'wishlist place', 'wishlist places')),
			body: wishD,
		},
	].filter(Boolean);
	// the card's ⋯: what the group does with the whole day now and then (copy it to the chat, copy its link, the map)
	const menu = partSheet(d.id, {
		key: 'menu',
		icon: 'more',
		h: [`Day ${d.n} · ${dateLabel(d.date, d.dow)}`, `Day ${d.n} · ${dateLabel(d.date, d.dow)}`],
		body: `<div class="gl day-menu">${actRow('', `data-copy-day="${d.id}"`, 'copy', Z('复制给大家', 'Copy for chat'), Z('整天的行程，贴到群组', "The whole day, to paste in the group's chat"))}${actRow('', `data-copy-link="${d.id}"`, 'link', Z('复制链接', 'Copy link'), Z('直接打开这一天', 'Opens this day'))}${GEO ? actRow('', `data-map-day="${d.id}"`, 'map', Z('在地图上看', 'See it on the map')) : ''}</div>${(() => {
			const ch = changeRows();
			return ch
				? `<p class="gl-h" id="${d.id}-mine-h">${Z('我的改动', 'My changes')}</p><div class="gl day-menu day-mine" role="group" aria-labelledby="${d.id}-mine-h">${ch}</div>`
				: '';
		})()}`,
	});
	return `<section class="day" id="${d.id}" data-sec="${d.id}" style="${colorVars(d.c)}">
      ${band}
      <div class="day-bar"><span class="sw" aria-hidden="true"></span><span class="dt">Day ${d.n} · ${dateTag(d.date, d.dow, false)}</span><span class="rt">${esc(L(d.title))}</span></div>
      <div class="lantern">
        ${worldArt(d.motif, 'day-art')}
        ${sky ? '' : `${meta}${wishOnly}`}
        <div class="l-head">${titleOnly}<button type="button" class="l-more" data-part="${d.id}-p-menu" aria-haspopup="dialog" aria-expanded="false" aria-controls="${d.id}-p-menu" aria-label="${Z(`Day ${d.n} 更多：复制给大家、复制链接`, `More for Day ${d.n}: copy for chat, copy link`)}">${icon('more')}</button></div>
        ${dayFacts(d, sky)}
      </div>
      ${menu}
      ${partsHTML(d.id, parts)}
      ${d.lede ? `<p class="day-lede">${fmt(d.lede)}</p>` : ''}
      ${d.id === ROLE.leave ? leaveBudgetHTML() : ''}${d.id === ROLE.arrive ? `<div class="block arrive-flight">${fltEditHTML('arr')}</div>` : ''}
      <div class="block">${blockH(d.stepsTitle ? 'list' : 'clock', [stopsTitle, stopsTitle])}${shiftBanner(d)}<ol class="sched">${sched}</ol>${d.id !== ROLE.flight ? `<button type="button" class="go-btn ghost add-stop" data-add-open="${d.id}">${icon('plus')}${Z(`加一站到 Day ${d.n}`, `Add a stop to Day ${d.n}`)}</button>` : ''}</div>
      ${photos.length ? `<div class="photos" role="list">${photos.map((p) => figure(p)).join('')}</div>` : ''}
      ${pagerHTML(d)}
    </section>`;
}

function secMap() {
	if (!GEO) return '';
	const views = [['all', ['全部', 'All']], ...(TRIP.mapViews || []).map((v) => [v.id, v.name])]; // the trip's map areas
	const fd = mapFiltDay(); // the day the map shows, kept across a redraw
	// map-first (ADR-20261124-map-first-search): the search over the map, and one Filters button for the day, the kind
	// and the area, with what the pins mean, in its sheet (ADR-20261128-progressive-disclosure); the results and the place
	// finder in a pane over the map (a sheet at its foot on a phone, a panel down its left on a wide stage), so a search
	// never pushes the map away
	return `<section class="sec" id="map" data-sec="map">
      <h2 class="sec-title">${icon('map')}${Z('地图', 'Map')}</h2>
      <div class="map-stage" id="mapstage">
      <div class="map-top"><p class="map-top-t">${icon('map')}${Z('地图', 'Map')}</p><button type="button" class="mlink map-exit" data-mapfull="0" aria-label="${Z('退出全屏', 'Exit full screen')}">${icon('x')}<span class="dlbl">${Z('退出全屏', 'Exit full screen')}</span></button></div>
      <div class="map-find" role="search"><label class="map-q">${icon('search')}<input id="mapq" type="search" enterkeyhint="search" autocomplete="off" placeholder="${Z('搜地图：店名、景点、厕所、饮料…', 'Search the map: name, sight, toilet, drinks…')}" aria-label="${Z('搜地图', 'Search the map')}"></label><button type="button" class="mlink map-listbtn" data-maplist aria-expanded="false" aria-controls="mappane">${icon('list')}<span class="dlbl">${Z('列表', 'List')}</span><b id="mapn"></b></button></div>
      <div class="map-chips"><button type="button" class="seg-btn map-filt${fd ? ' dayf' : ''}" data-mapfilters data-on="${fd || mapCat !== 'all' ? 1 : 0}" aria-haspopup="dialog" aria-controls="mapfilt"${fd ? ` style="${colorVars(fd.c)}"` : ''}>${icon('filter')}<span id="mapfilt-l">${esc(mapFiltLabel(fd))}</span>${icon('chev-r', 'part-ch')}</button></div>
      <div class="map-box" id="mapbox">
      <div class="map-pane" id="mappane" role="region" aria-label="${Z('地图列表', 'Map list')}" hidden>
        <div class="pane-head"><span class="pane-grip" aria-hidden="true"></span><div class="pane-t" id="panet" aria-live="polite"></div><button type="button" class="icon-btn pane-btn" data-pane="up" aria-label="${Z('列表拉高', 'Make the list taller')}" aria-controls="mappane">${icon('chev', 'up')}</button><button type="button" class="icon-btn pane-btn" data-pane="down" aria-label="${Z('列表放低，多看地图', 'Make the list shorter, more map')}" aria-controls="mappane">${icon('chev')}</button><button type="button" class="icon-btn pane-x" data-pane="close" aria-label="${Z('关闭列表', 'Close the list')}">${icon('x')}</button></div>
        <div class="map-results" id="mapres" hidden></div>
        <div class="map-results pfind" id="mapfind" role="region" aria-label="${Z('这个地方和行程', 'This place and the plan')}" hidden></div>
      </div>
      <div class="map-wrap" role="region" aria-label="${Z('行程地图', 'Trip map')}"><div class="map-msg" id="mapmsg"><p>${Z('地图载入中…', 'Loading the map…')}</p></div><button type="button" class="map-full" data-mapfull="1" aria-label="${Z('全屏看地图', 'Full-screen map')}">${icon('expand')}<span class="dlbl">${Z('全屏', 'Full screen')}</span></button></div>
      </div>
      <dialog class="sheet bsheet map-filts" id="mapfilt" aria-labelledby="mapfilt-h"><div class="bsheet-head"><span class="bsheet-grip" aria-hidden="true"></span><span class="part-ic" aria-hidden="true">${icon('calendar')}</span><h3 class="bsheet-h" id="mapfilt-h">${Z('筛选', 'Filters')}<small>${Z('选一个，地图就跟着变', 'Pick one; the map follows')}</small></h3><button type="button" class="icon-btn bsheet-x" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button></div>
        <div class="bsheet-body">
          <p class="sub-h" id="mapfilt-d">${Z('看哪一天的点', 'Show the pins of')}</p>
          <div class="map-pick" role="group" aria-labelledby="mapfilt-d"><button type="button" class="seg-btn" data-filter="all" aria-pressed="${!fd}">${Z('全部天', 'All days')}</button>${DAYS.filter(
						(d) => d.id !== ROLE.flight,
					)
						.map(
							(d) =>
								`<button type="button" class="seg-btn dayf" data-filter="${d.id}" style="${colorVars(d.c)}" aria-pressed="${d === fd}">Day ${d.n} · ${+d.date.slice(8)} ${esc(L(d.dow))}</button>`,
						)
						.join('')}</div>
          <p class="sub-h" id="mapfilt-c">${Z('看哪一类', 'Show')}</p>
          <div class="map-pick cats" role="group" aria-labelledby="mapfilt-c">${MAP_CATS.filter(
						([k]) => (k !== 'wish' || WISH.length) && (k !== 'refill' || REFILL.spots.length),
					)
						.map(
							([k, l]) =>
								`<button type="button" class="seg-btn cat" data-cat="${k}" aria-pressed="${k === mapCat}">${k === 'all' ? '' : `<span class="cat-ic" aria-hidden="true">${pinSVG({ type: k === 'place' ? 'place' : k, days: [], wish: null })}</span>`}${esc(L(l))}</button>`,
						)
						.join('')}</div>
          <p class="sub-h" id="mapfilt-v">${Z('移到哪一区', 'Move the map to')}</p>
          <div class="map-pick" role="group" aria-labelledby="mapfilt-v">${views.map(([k, l]) => `<button type="button" class="seg-btn" data-view="${k}" aria-pressed="false">${esc(L(l))}</button>`).join('')}</div>
          <p class="sub-h" id="mapfilt-k">${Z('图例：颜色是日期，形状是类型', 'What the pins mean: colour is the day, shape the type')}</p>
          <div class="map-legend">
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="var(--ink-2)"/></svg>${Z('景点', 'Sight')}</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="3" fill="var(--ink-2)"/></svg>${Z('美食', 'Food')}</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5L14.5 8L8 14.5L1.5 8Z" fill="var(--ink-2)"/></svg>${esc(SHOPLISTS_.map((l) => L(l.kind)).join(' / ') || Z('商店', 'Shop'))}</span>
          ${WISH.length ? `<span><svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -9.5L2.8 -3.2L9.4 -2.6L4.4 1.8L5.9 8.4L0 5L-5.9 8.4L-4.4 1.8L-9.4 -2.6L-2.8 -3.2Z" fill="var(--ink-2)"/></svg>${Z('想去', 'Wishlist')}</span>` : ''}
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#0f8a7e"/><path d="M5.4 4.8h5.2l-.8 6.4H6.2z" fill="#fff"/></svg>${Z('饮料', 'Drinks')}</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="#a0527e"/><path d="M4.4 6h5.4v2.2a2.7 2.7 0 0 1-5.4 0z" fill="#fff"/><path d="M9.8 6.8h.8a1.2 1.2 0 0 1 0 2.4h-.8" fill="none" stroke="#fff" stroke-width="1"/></svg>${Z('歇脚·甜品', 'Rest & dessert')}</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="#4a6fa5"/><text x="8" y="10.6" text-anchor="middle" font-size="6.5" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">WC</text></svg>${Z('公厕', 'Public toilet')}</span>
          ${REFILL.spots.length ? `<span><svg viewBox="-9.5 -10 19 19" aria-hidden="true">${REFILL_PIN}</svg>${Z('装水', 'Refill')}</span>` : ''}
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="#0f5fa8"/><path d="M4.5 11.5V4.5L8 9l3.5-4.5v7" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>${Z('捷运站', 'MRT')}</span>
          <span><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="4" fill="var(--ink)"/><path d="M4.5 9l3.5-3.5 3.5 3.5v3h-7z" fill="var(--paper)"/></svg>${Z('酒店', 'Hotel')}</span>
      </div>
        </div></dialog>
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
          <li>${Z(`点「汇入」→ 选 ${FILE_BASE}-mymaps.kml`, `Tap "Import" → pick ${FILE_BASE}-mymaps.kml`)}</li>
          <li>${Z('若全在同一层：图层「个别样式」→ 按「Layer」分组，即按天分色', 'If all pins in one layer: layer style → group by "Layer" (colours by day)')}</li>
          <li>${Z(`地图改名「${BRAND}」→「分享」→ 知道链接者可查看，链接发群组`, `Rename "${BRAND}" → Share → anyone with link can view; post link in group chat`)}</li>
          <li>${Z('Google Maps App：「已储存 Saved」→「地图 Maps」，打开看全部点', 'Google Maps app: "Saved" → "Maps" → open to see all pins')}</li>
        </ol>
        <div class="links-row"><a class="go-btn" href="data:application/vnd.google-earth.kml+xml;base64,${window.KML_B64}" download="${FILE_BASE}-mymaps.kml">${icon('map')}${Z('下载 KML', 'Download KML')}</a>${ext('https://www.google.com/maps/d/', 'Google My Maps', 'ext')}</div>
      </div></details>`
					: ''
			}
      <p class="xsmall" style="margin-top:8px">${Z('地图资料', 'Map data')}: OpenFreeMap · © OpenStreetMap contributors · ${Z(`导航以${mapsName(mapsApp)}为准`, `Use ${mapsName(mapsApp)} for turn-by-turn directions`)}</p>
    </section>`;
}

// the airport options' chart: each one's total for the group, in the trip's currency or the home currency (its scale
// too) as the phone reads amounts. Redrawn on its own when the rate changes
function airportBars() {
	const A = AIRPORT;
	const hv = (v) => (homeFirst ? v / rate : v);
	const ax = Chart.axis(Math.max(0, ...A.methods.map((m) => hv(m.max))));
	const maxv = ax.top;
	return `<div class="bars" role="img" aria-label="${esc(A.methods.map((m) => `${L(m.name)} ${cvPlain(m.cost)}`).join('; '))}">${A.methods
		.map((m) => {
			const l = (hv(m.min) / maxv) * 100,
				w = Math.max(((hv(m.max) - hv(m.min)) / maxv) * 100, 1.2);
			return `<div class="bar-row2"><span class="bar-lab">${esc(L(m.short))}</span><div class="bar-track"><div class="bar-grid"></div><div class="bar-range" style="left:${l}%;width:${w}%;--c:${m.pick ? 'var(--ink)' : 'var(--ink-3)'}"></div><span class="bar-val" style="${l + w > 70 ? `right:calc(${100 - l}% + 6px)` : `left:calc(${l + w}% + 6px)`}">${cvHtml(esc(m.cost), false)}</span></div></div>`;
		})
		.join('')}</div>
      ${axisHTML(ax)}`;
}

function secAirport() {
	const A = AIRPORT;
	// the airport's terminals (place ids + codes, the first is where we land and leave) and the hotel
	const TERM = A.terminals || [];
	return `<section class="sec" id="airport" data-sec="airport">
      <h2 class="sec-title">${icon('train')}${Z('机场交通', 'Airport transfer')}</h2>
      <p class="sec-lede">${fmt(A.lede)}</p>
      <dl class="facts">${A.facts.map((f) => `<div class="fact"><dt>${esc(L(f.k))}</dt><dd>${fmt(f.v)}</dd></div>`).join('')}</dl>
      <h3 class="sub">${icon('money')}${Z(`Day 1 到酒店：${GROUP[0]}总价`, `Day 1 to the hotel: total ${GROUP[1]}`)}</h3>
      <div id="airport-bars">${airportBars()}</div>
      ${airportParts(A, TERM)}
    </section>`;
}
// the airport view's long parts, each a summary button and a sheet (ADR-20261122-day-views): the ways to the hotel,
// the train route, deciding on the day, the transit card and going home
function airportParts(A, TERM) {
	const pick = A.methods.find((m) => m.pick);
	const methods = `<div class="methods">${A.methods
		.map(
			(m) => `<article class="method ${m.pick ? 'pick' : ''}" id="m-${m.id}">
        <div class="method-h"><span class="ic">${icon(m.icon)}</span><div><p class="method-name">${fmt(m.name)}</p><p class="method-sub">${fmt(m.sub)}</p></div><p class="method-cost">${cvHtml(esc(m.cost), false)}<small>${fmt(m.per, false)}</small><small data-rm="${m.min},${m.max}">${rmText(m.min, m.max)}</small></p></div>
        <dl class="method-grid"><div class="mg"><dt>${Z('门到门', 'Door to door')}</dt><dd>${fmt(m.time)}</dd></div><div class="mg"><dt>${Z('换乘', 'Changes')}</dt><dd>${fmt(m.xfer)}</dd></div><div class="mg"><dt>${Z('拖行李', 'With bags')}</dt><dd>${fmt(m.bags)}</dd></div></dl>
        ${list(m.list)}
        <p class="note"><strong>${Z('适合', 'Best when')}:</strong> ${fmt(m.when)}</p>
        ${m.pick ? `<p class="pick-badge">${icon('check')}${Z(`建议：大家要搭${METRO[0]}的话，这样最省力`, 'Recommended if we take the train')}</p>` : ''}
        ${m.ticket ? ticketBlock(m.ticket) : ''}
      </article>`,
		)
		.join('')}</div>`;
	const routeTitle = A.routeTitle || ['怎么搭车到酒店', 'To the hotel by train'];
	const route = `${A.route ? airportStrip() : ''}
      <ol class="list steps">${A.steps.map((s) => `<li>${fmt(s)}</li>`).join('')}</ol>
      <div class="links-row">${TERM[0] ? placeLinks(TERM[0].place, { noDriver: true }) : ''}${(A.sites || []).map((k) => siteLink(k)).join('')}${TERM.map((t) => ext(gmDir(PLACES[hotelOf(ROLE.arrive)].maps, 'transit', PLACES[t.place].maps), Z(`${t.code} → 酒店（搭车）`, `${t.code} → hotel (transit)`), 'route')).join('')}</div>`;
	const card =
		Pack.transitCard && A.transitCard
			? `<div id="transit-card">${list(A.transitCard)}
      <div class="links-row">${siteLink(A.transitCardSite)}</div>
      ${A.transitCardTicket ? ticketBlock(A.transitCardTicket) : ''}</div>`
			: '';
	const depart = `<div id="depart"><p>${fmt(A.depart.lede)}</p>
      ${list(A.depart.list)}
      <div class="links-row">${TERM.map((t) => ext(gmDir(PLACES[t.place].maps, 'driving', PLACES[hotelOf(ROLE.leave)].maps), Z(`酒店 → ${t.code}（开车）`, `Hotel → ${t.code} (drive)`), 'car')).join('')}${TERM[0] ? ext(gmDir(PLACES[TERM[0].place].maps, 'transit', PLACES[hotelOf(ROLE.leave)].maps), Z(`酒店 → ${TERM[0].code}（搭车）`, `Hotel → ${TERM[0].code} (transit)`), 'train') : ''}${(A.departSites || []).map((x) => (typeof x === 'string' ? siteLink(x) : siteLink(x.site, 'ext', x.label))).join('')}</div></div>`;
	const parts = [
		{
			key: 'ways',
			icon: 'route',
			t: ['怎么去', 'Ways'],
			h: ['到酒店的方法', 'Ways to the hotel'],
			sum: `${sumB(nItems(A.methods.length, '个方法', 'way', 'ways'))}${pick ? ` · ${Z('建议', 'Pick')}: ${escText(plainText(pick.short))}` : ''}`,
			body: methods,
		},
		{ key: 'route', icon: 'train', t: ['搭车', 'By train'], h: routeTitle, sum: sumB(nItems(A.steps.length, '步', 'step', 'steps')), body: route },
		{
			key: 'rule',
			icon: 'clock',
			t: ['当天决定', 'Deciding'],
			h: ['当天怎么决定', 'Deciding on the day'],
			sum: esc(A.rule.map((o) => plainText(o.name)).join(' · ')),
			body: `<div class="decide">${A.rule.map(optRow).join('')}</div>`,
		},
		card && { key: 'card', icon: 'card', t: Pack.transitCard, h: Pack.transitCard, sum: escText(plainText(A.transitCard[0])), body: card },
		{
			key: 'depart',
			icon: 'plane',
			t: ['回程', 'Going home'],
			h: [`回程：${Time.dateLabel(departEve(), 'zh')}晚到机场`, `Going home: to the airport on ${Time.dateLabel(departEve(), 'en')}`],
			sum: escText(plainText(A.depart.list[0] || A.depart.lede)),
			body: depart,
		},
	];
	return `${partsHTML('airport', parts, ['去市区和回机场', 'To town and back'])}
      <p class="xsmall" style="margin-top:10px">${fmt(A.sourceNote)}</p>`;
}

function secEntry() {
	const E = ENTRY;
	const lk = Pack.luckyDraw && E.lucky; // the lucky draw only where the country's pack runs one
	return `<section class="sec" id="entry" data-sec="entry">
      <h2 class="sec-title">${icon('passport')}${lk ? Z('入境与抽奖', 'Entry & lucky draw') : Z('入境', 'Entry')}</h2>
      ${entryParts(E, lk)}
      <div class="links-row">${lk ? (lk.sites || []).map((k) => siteLink(k)).join('') : ''}${(E.sites || [])
				.filter((k) => lk || !E.rules.some((r) => r.site === k))
				.map((k) => siteLink(k))
				.join('')}</div>
      <p class="xsmall" style="margin-top:10px">${Z(`资料来源：${L0(E.sources, '官方网站')}（${checkedOn('ymd')}查）。`, `Sources: ${L1(E.sources, 'official sites')} (checked ${checkedOn('long')}).`)}</p>
    </section>`;
}
// the entry view (ADR-20261122-day-views): the entry ticks' progress first (they live in the checklist), then each
// rule and the lucky draw as a summary button and a sheet
function entryParts(E, lk) {
	const ids = ENTRY_CHECKS.items.map((it) => `${ENTRY_CHECKS.id}-${it.id}`);
	const ticks = `<a class="part go-part" href="#checklist"><span class="part-ic" aria-hidden="true">${icon('check')}</span><span class="part-h">${fmt(ENTRY_CHECKS.h)}</span>${icon('arrow', 'part-ch')}<span class="part-s">${checkSum(ids)}</span></a>`;
	const rules = E.rules.map((r, i) => ({
		key: `r${i}`,
		icon: r.warn ? 'alert' : 'passport',
		h: r.h,
		t: [bare(r.h[0]), bare(r.h[1])],
		sum: escText(plainText(r.p)),
		body: `<div class="tier"><p>${fmt(r.p)}</p>${r.warn ? `<p class="warn">${icon('alert')}${fmt(r.warn)}</p>` : ''}${SITES[r.site] ? `<div class="links-row">${siteLink(r.site)}</div>` : ''}</div>`,
	}));
	const lucky = lk && {
		key: 'lucky',
		icon: 'star',
		h: lk.name,
		t: [bare(lk.name[0]), bare(lk.name[1])],
		sum: escText(plainText(lk.period)),
		body: `<div id="lucky">${luckyHTML(lk)}</div>`,
	};
	return `<div class="parts lead-part">${ticks}</div>${partsHTML('entry', [...rules, lucky], ['入境要知道的', 'What to know at entry'])}`;
}
function luckyHTML(lk) {
	return `<p>${fmt(lk.period)}</p>
      <p class="callout">${icon('alert')}<span>${fmt(lk.deadline)}</span></p>
      <div class="block">${blockH('list', ['谁可以参加', 'Who can join'])}${list(lk.who)}</div>
      <div class="block">${blockH('users', [`我们${PAX}人可以拿多少？`, `How much could the ${PAX} of us get?`])}
        <div class="calc"><label for="repeat">${luckySinceLabel()}</label>
          <div class="stepper"><button type="button" class="icon-btn" data-step="-1" aria-label="${Z('减少', 'Fewer')}">${icon('minus')}</button><output id="repeat" aria-live="polite">${store.get('repeat', 3)}</output><button type="button" class="icon-btn" data-step="1" aria-label="${Z('增加', 'More')}">${icon('plus')}</button></div>
          <div id="calcout"></div></div></div>
      <div class="block">${blockH('check', ['中奖后怎么领', 'If we win'])}${list(lk.how)}</div>
      <p class="note">${fmt(lk.unsure)}</p>`;
}
// the country's lucky draw (Pack.luckyDraw): how many of us could win, and how much
const luckySinceLabel = () => {
	const d = Pack.luckyDraw.since;
	return Z(
		`${d.slice(0, 4)}年${Time.dateLabel(d, 'zh')}后入境过${Pack.country[0]}的人数`,
		`People who entered ${Pack.country[1]} since ${Time.dateLabel(d, 'en')} ${d.slice(0, 4)}`,
	);
};
// a figure from the pack, in its currency, which is the trip's: shown as the phone reads amounts
const packMoney = (n) => (Pack.sym === CUR.sym ? money(n) : `${Pack.sym}${num(n)}`);
function calcLucky() {
	if (!Pack.luckyDraw) return;
	const LK = Pack.luckyDraw.words; // the programme's own words for who wins what
	const S = Pack.luckyShares(PAX, +store.get('repeat', 3));
	const r = S.repeat,
		comp = S.companions,
		left = S.left,
		total = S.total;
	const o = $('#repeat');
	if (o) o.textContent = r;
	const out = $('#calcout');
	if (!out) return;
	out.innerHTML =
		r === 0
			? `<p class="warn">${icon('alert')}${esc(L(LK.none).replace('{pax}', PAX))}</p>`
			: `<dl class="kv"><div><dt>${Z(`${LK.repeat[0]}（各${packMoney(Pack.luckyDraw.repeat)}）`, `${LK.repeat[1]} (${packMoney(Pack.luckyDraw.repeat)} each)`)}</dt><dd>${r}</dd></div><div><dt>${Z(`${LK.companion[0]}（各${packMoney(Pack.luckyDraw.companion)}）`, `${LK.companion[1]} (${packMoney(Pack.luckyDraw.companion)} each)`)}</dt><dd>${comp}</dd></div>${left ? `<div><dt>${Z('不能参加', "Can't join")}</dt><dd>${left}</dd></div>` : ''}<div class="sum"><dt>${esc(L(LK.all))}</dt><dd>${packMoney(total)}</dd></div></dl><p class="note"><span data-rm="${total},${total}">${rmText(total, total)}</span> · ${Z('要中奖才有，不保证。', 'Only if drawn; not guaranteed.')}</p>`;
}

// one optional plan's card: in the Optional section, and in a sheet over the day from a stop's "Nearby options"
function optCard(o) {
	const a = addrFor(o.place);
	const g = (GEO && GEO.places && GEO.places[o.place]) || {};
	const hours = lang === 'en' ? g.hours_en : g.hours_zh;
	return `<article class="hang" id="${o.id}"><div class="hang-h">${credit[o.photo] ? `<img src="${imgSrc(o.photo, true)}" data-img="${imgKey(o.photo, true)}" alt="" width="64" height="64" loading="lazy">` : ''}<div><p class="hang-name"${alt(other(o.name))}>${esc(L(o.name))}</p><p class="hang-meta">${escText(L(o.meta))}</p></div></div>
        <p class="note"><strong>${esc(L(o.when))}:</strong></p>${list(o.list)}
        <div class="total" style="margin-top:10px"><span>${fmt(o.cost)}</span></div><p class="note">${fmt(o.note)}</p>
        ${a.zh ? `<p class="addr">${icon('pin')}<span>${escText(a.zh)}${lang === 'en' && a.en ? `<br><span class="xsmall">${escText(a.en)}</span>` : ''}</span></p>` : ''}${hours ? `<p class="xsmall">${icon('clock')} ${esc(hours)}</p>` : ''}${mrtLine(g.mrt)}
        <div class="links-row">${placeLinks(o.place)}</div>${o.ticket ? ticketBlock(o.ticket) : ''}</article>`;
}

function secOptional() {
	const shop = (s) => {
		const p = PLACES[s.place];
		const a = addrFor(s.place);
		return `<article class="hang" id="shop-${s.place}"><div class="hang-h"><div><p class="hang-name"${alt(other(s.name))}>${esc(L(s.name))}</p><p class="hang-meta">${escText(L(s.area))} · ${escText(L(s.rank))}</p></div></div>
        <p class="note"><strong>${Z('什么时候', 'When')}:</strong> ${fmt(s.when)}</p>${list(s.list)}
        ${a.zh ? `<p class="addr">${icon('pin')}<span>${escText(a.zh)}${lang === 'en' && a.en ? `<br><span class="xsmall">${escText(a.en)}</span>` : ''}</span></p>` : ''}
        ${p.mrt ? `<p class="xsmall">${icon('train')} ${fmt(p.mrt)}</p>` : ''}${p.hours ? `<p class="xsmall">${icon('clock')} ${fmt(p.hours)}${p.tel ? ` · ${Z('电话', 'Tel')} <span class="sel">${escText(p.tel)}</span>` : ''}</p>` : ''}
        <div class="links-row">${placeLinks(s.place, { noDriver: true })}${dayById[s.day] ? `<a class="mlink" href="#${s.day}">${icon('calendar')}Day ${dayById[s.day].n}</a>` : ''}</div></article>`;
	};
	return `<section class="sec" id="optional" data-sec="optional">
      <h2 class="sec-title">${icon('list')}${Z('备选：看当天情况', 'Optional: decide on the day')}</h2>
      <p class="sec-lede">${Z('都不锁日期，挂在主行程下，体力、天气、心情合适才加。', 'No dates. Add below main plan only if energy, weather, mood allow.')}</p>
      <div class="hung">${OPTIONAL.map(optCard).join('')}</div>
      ${OPTIONAL.filter((o) => o.food)
				.map((o) => foodBlock(o.food.slots, o.food.h))
				.join('')}
      ${SHOPLISTS_.map(
				(S) => `<h3 class="sub" id="${esc(S.id)}">${icon(S.icon)}${esc(L(S.h))}</h3>
      ${S.lede ? `<p>${fmt(S.lede)}</p>` : ''}${S.lede2 ? `<p class="note">${fmt(S.lede2)}</p>` : ''}
      ${credit[S.photo] ? `<div class="photos">${figure(S.photo)}</div>` : ''}
      <div class="hung">${S.shops.map(shop).join('')}</div>
      ${S.rule || S.checks.length ? `<div class="block">${blockH('check', ['去之前对一下', 'Before going in, check'])}${S.rule ? `<p class="callout">${icon('info')}<span>${fmt(S.rule)}</span></p>` : ''}${checkList(S.checks.map((t, i) => ({ id: `${S.id}-${i}`, t })))}${S.close ? `<p class="note">${fmt(S.close)}</p>` : ''}</div>` : ''}`,
			).join('\n      ')}
    </section>`;
}
