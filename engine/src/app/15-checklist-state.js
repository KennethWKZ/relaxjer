/* ───────── checklist state ───────── */
function updateProgress() {
	const boxes = $$('#checklist [data-check]');
	const done = boxes.filter((b) => b.checked).length;
	const t = $('#prog-text');
	const f = $('#prog-fill');
	if (!t) return;
	t.textContent = `${done} / ${boxes.length}`;
	f.style.transform = `scaleX(${boxes.length ? done / boxes.length : 0})`;
}

const ybLive = new Map();
async function ybFetch(nos) {
	const need = [...new Set(nos)].filter((n) => !ybLive.has(n) || Date.now() - ybLive.get(n).t > 45000).slice(0, 20);
	if (need.length && Pack.bikeShare) {
		try {
			const q = Pack.bikeShare.request(need); // the city's bike share (Pack.bikeShare): its live-count API
			const r = await fetch(q.url, q.init);
			for (const x of Pack.bikeShare.parse(await r.json())) ybLive.set(x.no, { bikes: x.bikes, docks: x.docks, on: x.on, t: Date.now() });
		} catch {
			/* offline or blocked: the count just stays unknown */
		}
	}
	return nos.map((n) => ybLive.get(String(n)));
}
const ybText = (v) =>
	!v
		? Z('现在查不到车辆数（网络？）', 'Live count unavailable right now')
		: !v.on
			? Z('暂停服务', 'Not in service')
			: Z(`可借 ${v.bikes} 辆 · 可还 ${v.docks} 位`, `${v.bikes} bikes to rent · ${v.docks} free docks`);
const ybFill = (root) => {
	const els = [...root.querySelectorAll('[data-yb]')];
	if (!els.length) return;
	ybFetch(els.map((e) => e.dataset.yb)).then((vs) =>
		els.forEach((e, i) => {
			e.textContent = ybText(vs[i]);
			e.classList.toggle('yb-low', !!vs[i] && vs[i].bikes <= 2);
		}),
	);
};
function showCard(p, card = $('#mapcard')) {
	if (p.mine) {
		const x = p.mine;
		card.innerHTML = `<article class="hang"><p class="hang-name">${esc(x.name)}<span class="mine-tag">${Z('我加的', 'Added')}</span></p><p class="hang-meta"><a href="#${esc(x.id)}" class="daychip" style="${colorVars(dayById[x.day].c)}">Day ${dayById[x.day].n} · ${esc(x.t)}</a></p>${x.addr ? `<p class="addr">${icon('pin')}<span>${esc(x.addr)}</span></p>` : ''}<div class="links-row">${extI(gmSearch(x.q, x.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(x.q, 'transit', undefined, x.gpid), Z('路线', 'Directions'), 'route')}<button type="button" class="mlink" data-mine-edit="${esc(x.id)}">${icon('clock')}${Z('改时间', 'Change')}</button></div></article>`;
	} else if (p.bike) {
		card.innerHTML = `<article class="hang"><p class="hang-name">${icon('bike')} ${esc(p.name)}</p><p class="yb-live" data-yb="${esc(p.bike.no)}">${Z('正在查可借车辆…', 'Checking bikes…')}</p><p class="xsmall muted">YouBike 2.0 · ${esc(p.bike.cap)} ${Z('个车位 · 数字来自 YouBike 官方', 'docks · live from YouBike')}</p><div class="links-row">${extI(gmSearch(p.q), Z('地图', 'Map'), 'pin')}${extI(gmDir(p.q, 'walking'), Z('路线', 'Directions'), 'route')}</div></article>`;
		ybFill(card);
	} else if (p.bus) {
		card.innerHTML = `<article class="hang"><p class="hang-name">${icon('bus')} ${esc(p.name)}</p><p class="xsmall">${Z('公车站 · 哪几路车、几分钟到：点「地图」在 Google 地图看', 'Bus stop · routes and arrival times: tap Map for Google Maps')}</p><div class="links-row">${extI(gmSearch(p.q, p.bus.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(p.q, 'walking', undefined, p.bus.gpid), Z('路线', 'Directions'), 'route')}</div></article>`;
	} else if (p.type === 'mrt' && MRT && p.si != null) {
		card.innerHTML = `<article class="hang"><p class="hang-name">${icon('train')} ${esc(p.name)}</p><p class="mlines">${p.lines
			.filter((li, k, a) => a.findIndex((x) => MRT.ln[x].zh === MRT.ln[li].zh) === k)
			.map((li) => mline(MRT.ln[li]))
			.join(
				' ',
			)}</p>${p.near ? `<p class="xsmall">${esc(p.near)}</p>` : ''}<div class="links-row">${extI(gmSearch(p.q), Z('地图', 'Map'), 'pin')}${extI(gmDir(p.q, 'walking'), Z('路线', 'Directions'), 'route')}</div></article>`;
	} else if (p.wc) {
		card.innerHTML = `<article class="hang"><p class="hang-name">${icon('wc')} ${esc(p.name)}</p><p class="xsmall">${Z('公厕', 'Public toilet')} · Google</p><div class="links-row">${extI(gmSearch(p.q, p.wc.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(p.q, 'walking', undefined, p.wc.gpid), Z('路线', 'Directions'), 'route')}</div></article>`;
	} else if (p.drink) {
		card.innerHTML = drinkCard(p.drink);
	} else if (p.type === 'mrt') {
		card.innerHTML = `<article class="hang"><p class="hang-name">${icon('train')} ${esc(p.name)}</p><p class="xsmall">${esc(p.near)}</p><div class="links-row">${extI(gmSearch(p.q), Z('地图', 'Map'), 'pin')}${extI(gmDir(p.q, 'walking'), Z('路线', 'Directions'), 'route')}</div></article>`;
	} else if (p.food) {
		card.innerHTML = foodCard(p.food);
	} else if (p.wish) {
		card.innerHTML = wishCard(p.wish);
	} else {
		const a = addrFor(p.pid);
		const pl = PLACES[p.pid];
		const g = (GEO.places || {})[p.pid] || {};
		card.innerHTML = `<article class="hang"><p class="hang-name">${esc(p.name)}</p><p class="hang-meta">${p.days.map((d) => `<a href="#${d}" class="daychip" style="${colorVars(dayById[d].c)}">Day ${dayById[d].n}</a>`).join(' ') || esc(Z(p.type === 'hotel' ? '酒店' : '备选', p.type === 'hotel' ? 'Hotel' : 'Optional'))}</p>
        ${a.zh ? `<p class="addr">${icon('pin')}<span>${esc(a.zh)}${a.en && lang === 'en' ? `<br><span class="xsmall">${esc(a.en)}</span>` : ''}</span></p>` : ''}${(lang === 'en' ? g.hours_en : g.hours_zh) ? `<p class="xsmall">${icon('clock')} ${esc(lang === 'en' ? g.hours_en : g.hours_zh)}</p>` : ''}${mrtLine(g.mrt)}${rrLine(g.gpid, g.lat, g.lng)}${pl.note ? `<p class="note">${fmt(pl.note)}</p>` : ''}
        <div class="links-row">${placeLinks(p.pid)}${addBtn(p.name, p.lat, p.lng, g.gpid, pl ? pl.maps : p.q, a.zh)}</div></article>`;
	}
	card.dataset.pid = p.pid;
	const art = card.querySelector('article');
	if (art) art.insertAdjacentHTML('beforeend', `<div class="from-me">${planOrAsk(p)}</div>`);
}
function buildPins() {
	const pins = [];
	const seen = new Set();
	const dayOfPlace = {};
	DAYS.forEach((d) => {
		const add = (p) => {
			if (p && PLACES[p]) (dayOfPlace[p] = dayOfPlace[p] || []).includes(d.id) || dayOfPlace[p].push(d.id);
		};
		d.schedule.forEach((s) => add(s.place));
		d.blocks.forEach((b) => (b.places || []).forEach(add));
		(LEGS[d.id] || []).forEach(([a, b]) => {
			add(a);
			add(b);
		});
		d.blocks.forEach((b) => (b.opts || []).forEach((o) => add(o.place)));
	});
	SNOW.shops.forEach((s) => {
		if (s.day) (dayOfPlace[s.place] = dayOfPlace[s.place] || []).push(s.day);
	});
	Object.keys(PLACES).forEach((pid) => {
		const g = GEO.places && GEO.places[pid];
		if (!g || seen.has(pid)) return;
		seen.add(pid);
		const type = pid === 'hotel' ? 'hotel' : SNOW.shops.some((x) => x.place === pid) ? 'shop' : 'place';
		const days = (dayOfPlace[pid] || []).filter((d) => pid !== 'hotel');
		pins.push({ pid, type, lat: g.lat, lng: g.lng, days, name: L(PLACES[pid].name), q: PLACES[pid].maps });
	});
	(EXTRA.food || []).forEach((f, i) => {
		if (f.lat == null || f.lng == null) return;
		const d = (f.slot.match(/^d(\d)/) || [])[1];
		pins.push({
			pid: 'food' + i,
			type: 'food',
			lat: +f.lat,
			lng: +f.lng,
			days: d ? ['d' + d] : [],
			name: lang === 'en' ? f.name_en || f.name_trad : f.name_zh || f.name_trad,
			q: f.maps_query || f.address_trad,
			food: f,
		});
	});
	const routePts = pins.filter((p) => p.type === 'place' && p.days.length);
	WISH.filter((w) => w.status !== 'closed').forEach((w) => {
		const days = (w.fits || []).map((f) => f.day).filter((d) => dayById[d]);
		const best = wBest(w);
		w.branches.forEach((br, bi) => {
			if (br.lat == null || br.lng == null) return;
			if (w.branches.length > 4 && br !== best && !routePts.some((r) => km(r, { lat: +br.lat, lng: +br.lng }) <= 1.5)) return;
			if (pins.some((p) => (p.type === 'place' || p.type === 'hotel') && km(p, { lat: +br.lat, lng: +br.lng }) < 0.04)) return; // it's already a stop in the plan
			pins.push({
				pid: `wish-${w.id}-${bi}`,
				type: 'wish',
				lat: +br.lat,
				lng: +br.lng,
				days,
				name: wName(w) + (w.branches.length > 1 && br.label_zh ? ` · ${lang === 'en' ? br.label_en || br.label_zh : br.label_zh}` : ''),
				q: wQuery(br, w),
				wish: w,
			});
		});
	});
	const dayOf = {};
	pins
		.filter((p) => p.type === 'place' || p.type === 'hotel')
		.forEach((p) => {
			dayOf[p.pid] = p.days;
		});
	TOILETS.wc.forEach((w, i) =>
		pins.push({ pid: `wc-${i}`, type: 'wc', lat: w.lat, lng: w.lng, days: [], name: wcName(w), q: `${w.n_trad} ${w.lat},${w.lng}`, wc: w }),
	);
	DRINKS.forEach((x) => {
		const days = [...new Set(Object.keys(x.near || {}).flatMap((k) => dayOf[k] || []))];
		pins.push({
			pid: x.id,
			type: isRest(x) ? 'rest' : 'drink',
			lat: x.lat,
			lng: x.lng,
			days,
			name: drinkName(x),
			q: `${x.name_trad} ${x.address_trad || ''}`,
			drink: x,
		});
	});
	const st = new Map();
	pins
		.filter((p) => p.type === 'place' || p.type === 'hotel')
		.forEach((p) => {
			const m = ((GEO.places || {})[p.pid] || {}).mrt;
			if (!m || !m.walk || m.lat == null) return;
			const k = m.zh;
			const s = st.get(k) || {
				pid: `mrt-${k}`,
				type: 'mrt',
				lat: m.lat,
				lng: m.lng,
				days: [],
				name: lang === 'en' ? `${m.en || m.zh} ${Cap(METRO[1])}` : m.zh,
				q: `捷運${m.zh.replace(/站$/, '')}站`,
				serves: [],
				always: false,
			};
			p.days.forEach((d) => s.days.includes(d) || s.days.push(d));
			s.serves.push(`${p.name} ${Z(`步行约${m.min}分钟`, `~${m.min} min walk`)}`);
			if (p.type === 'hotel') s.always = true;
			st.set(k, s);
		});
	st.forEach((s) => {
		s.near = Z('到：', 'To: ') + s.serves.join(Z('；', '; '));
	});
	const linesAt = MRT ? MRT.st.map(() => new Set()) : [];
	if (MRT) MRT.ln.forEach((l, li) => l.s.forEach((si) => linesAt[si].add(li)));
	if (MRT)
		MRT.st.forEach(([zh, trad, en, lat, lng], i) => {
			const key = [...st.keys()].find((k) => {
				const b = k.replace(/站$/, '');
				return b === zh || b === trad;
			});
			const s = key ? st.get(key) : null;
			if (key) st.delete(key);
			pins.push({
				pid: `mrt-${i}`,
				type: 'mrt',
				lat,
				lng,
				days: s ? s.days : [],
				name: lang === 'en' ? `${en || zh} ${Z('', 'Station')}`.trim() : `${zh}站`,
				q: `${trad}站 ${lat},${lng}`,
				serves: s ? s.serves : [],
				near: s ? s.near : '',
				always: s ? s.always : false,
				si: i,
				lines: [...linesAt[i]],
			});
		});
	st.forEach((s) => pins.push(s)); // a station the network file does not have (should not happen)
	mineAll().forEach((x) => pins.push({ pid: x.id, type: 'mine', lat: x.lat, lng: x.lng, days: [x.day], name: x.name, q: x.q || x.name, mine: x }));
	YB.forEach((y) =>
		pins.push({
			pid: `yb-${y.no}`,
			type: 'bike',
			lat: y.lat,
			lng: y.lng,
			days: [],
			name: lang === 'en' ? y.n_en || y.n_trad : y.n_zh,
			q: `${y.lat},${y.lng}`,
			bike: y,
		}),
	);
	BUS.forEach((b, i) =>
		pins.push({
			pid: `bus-${i}`,
			type: 'bus',
			lat: b.lat,
			lng: b.lng,
			days: [],
			name: lang === 'en' ? b.n_trad : b.n_zh,
			q: `${b.n_trad} ${b.lat},${b.lng}`,
			bus: b,
		}),
	);
	return pins;
}
