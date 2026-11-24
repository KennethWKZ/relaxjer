/* ───────── place details and the map's place finder ─────────
     One view of a place, whatever list it came from (a stop, an Optional card, the add sheet, the map's search, a Google
     result): its name, our photo, the day's hours, the address, the rating we have, and Google's live rating and photos
     on a tap when the page has the planner's key. The finder adds how the place sits against the plan: the nearest stop
     of each day, and the day it fits best (Fit, engine/src/core/fit.mjs), with one tap into the add sheet. */

// Google places met in this page view (search results): their id → { n, lat, lng, gpid, addr, q }. Memory only
const gSeen = new Map();
// a place's Google id found by name near its pin (Text Search asking for ids only), by ref
const gidMemo = new Map();

/** the ref a pin's place goes by in the details view and the add sheet; null for transport and toilets */
function pinRef(p) {
	if (!p) return null;
	if (p.mine) return `m:${p.mine.id}`;
	if (p.food) return `f:${(EXTRA.food || []).indexOf(p.food)}`;
	if (p.wish) return `w:${p.wish.id}:${(/-(\d+)$/.exec(p.pid) || [0, wBestIdx(p.wish)])[1]}`;
	if (p.drink) return `d:${p.drink.id}`;
	if (p.type === 'buy') return `s:${p.sid || p.pid}`;
	return PLACES[p.pid] ? `p:${p.pid}` : null;
}
const wBestIdx = (w) => w.branches.indexOf(wBest(w));
const PLAN_KIND = { food: ['美食', 'Food'], wish: ['想去', 'Wishlist'], buy: ['购物', 'Shopping'], google: ['Google 地点', 'Google place'] };

/**
 * Everything the page knows about a place, from its ref (p: a trip place, f: food, w: wishlist branch, d: drink or rest
 * spot, s: shop, m: an added stop, g: a Google result): { ref, n, kind, lat, lng, gpid, q, addr, addrEn, hours, week,
 * closed, rating, reviews, photo, sub, pid, mine, paused }. null when it isn't there (any more).
 */
function placeInfo(ref) {
	const m = /^([pfwdsmg]):(.+)$/.exec(String(ref || ''));
	if (!m) return null;
	const [, k, id] = m;
	const H = (x) => (lang === 'en' ? x.hours_en : x.hours_zh) || '';
	const base = {
		ref,
		kind: null,
		week: null,
		closed: [],
		rating: null,
		reviews: null,
		rsrc: '',
		photo: null,
		sub: '',
		pid: null,
		mine: null,
		paused: false,
	};
	if (k === 'p') {
		const pl = PLACES[id];
		const g = (GEO && GEO.places && GEO.places[id]) || {};
		if (!pl || g.lat == null) return null;
		const a = addrFor(id);
		const opt = OPTIONAL.find((o) => o.place === id && credit[o.photo]);
		const stop = DAYS.flatMap((d) => d.schedule).find((it) => it.place === id && credit[it.photo]);
		return {
			...base,
			n: L(pl.name),
			kind: isHotel(id) ? PIN_KIND.hotel : shopListOf(id) ? shopListOf(id).kind : PIN_KIND.place,
			lat: +g.lat,
			lng: +g.lng,
			gpid: g.gpid || pl.gpid || null,
			q: pl.maps,
			addr: a.zh,
			addrEn: a.en,
			hours: H(g),
			closed: g.closed_dates || [],
			photo: (opt && opt.photo) || (stop && stop.photo) || null,
			pid: id,
		};
	}
	if (k === 'f') {
		const f = (EXTRA.food || [])[+id];
		if (!f || f.lat == null) return null;
		return {
			...base,
			n: lang === 'en' ? f.name_en || f.name_trad : f.name_zh || f.name_trad,
			kind: PLAN_KIND.food,
			lat: +f.lat,
			lng: +f.lng,
			gpid: f.gpid || null,
			q: f.maps_query || f.address_trad || f.name_trad,
			addr: f.address_trad || '',
			addrEn: f.address_en || '',
			hours: H(f),
			closed: f.closed_dates || [],
			rating: f.rating || null,
			reviews: f.reviews || null,
			rsrc: f.rating_source || '',
			sub: (lang === 'en' ? f.dish_en : f.dish_zh) || '',
			paused: !!f.paused,
		};
	}
	if (k === 'w') {
		const [wid, bi] = id.split(':');
		const w = WISH.find((x) => String(x.id) === wid);
		const br = w && (w.branches[+bi] || wBest(w));
		if (!br || br.lat == null) return null;
		return {
			...base,
			n: wName(w),
			kind: PLAN_KIND.wish,
			lat: +br.lat,
			lng: +br.lng,
			gpid: br.gpid || null,
			q: wQuery(br, w),
			addr: br.address_trad || '',
			addrEn: br.address_en || '',
			hours: H(br),
			closed: br.closed_dates || [],
			rating: w.rating || null,
			reviews: w.reviews || null,
			rsrc: w.rating_source || '',
			sub: (lang === 'en' ? w.order_en : w.order_zh) || '',
			paused: !!br.paused,
		};
	}
	if (k === 'd') {
		const x = DRINKS.find((y) => y.id === id);
		if (!x) return null;
		return {
			...base,
			n: drinkName(x),
			kind: x.kind ? REST_KIND[x.kind] : PIN_KIND[isRest(x) ? 'rest' : 'drink'],
			lat: +x.lat,
			lng: +x.lng,
			gpid: x.gpid || null,
			q: `${x.name_trad} ${x.address_trad || ''}`,
			addr: x.address_trad || '',
			hours: H(x),
			week: x.week || null,
			closed: x.closed_dates || [],
			rating: x.rating || null,
			reviews: x.reviews || null,
			rsrc: 'Google Maps',
			sub: (lang === 'en' ? x.tip_en : x.tip_zh) || '',
		};
	}
	if (k === 's') {
		const x = SHOPS.find((y) => y.id === id);
		if (!x) return null;
		return {
			...base,
			n: lang === 'en' ? x.name_en || x.name_trad : x.name_zh,
			kind: PLAN_KIND.buy,
			lat: +x.lat,
			lng: +x.lng,
			gpid: x.gpid || null,
			q: `${x.name_trad} ${x.addr || ''}`,
			addr: x.addr || '',
			week: x.week || null,
			rating: x.rating || null,
		};
	}
	if (k === 'm') {
		const x = MINE[id];
		if (!x) return null;
		return {
			...base,
			n: x.name,
			kind: PIN_KIND.mine,
			lat: +x.lat,
			lng: +x.lng,
			gpid: x.gpid || null,
			q: x.q || x.name,
			addr: x.addr || '',
			mine: x.id,
		};
	}
	const g = gSeen.get(id);
	return g ? { ...base, ...g, kind: PLAN_KIND.google } : null;
}

// Google's opening hours for a place already fetched (placeMemo): the weekdays it never opens, Monday first, or null
function gClosedDays(gpid) {
	const pl = gpid && placeMemo.get(gpid);
	const per = pl && pl.regularOpeningHours && pl.regularOpeningHours.periods;
	if (!per || !per.length) return null;
	if (per.length === 1 && !per[0].close) return []; // Google's way of saying always open
	const open = new Set(per.map((x) => x.open && (x.open.day + 6) % 7));
	return [0, 1, 2, 3, 4, 5, 6].filter((i) => !open.has(i));
}
/** a place's hours on a trip date: { closed, text }; with no date (or none known for it), the whole week's text */
function infoHours(info, date) {
	if (!date) return { closed: false, text: info.hours || '' };
	const wd = Time.weekdayIndex(date);
	const g = gClosedDays(info.gpid);
	if ((info.closed || []).includes(date) || (g && g.includes(wd)) || (info.week && info.week[wd] === 'closed'))
		return { closed: true, text: Z('当天休息', 'closed that day') };
	if (info.week && info.week[wd]) return { closed: false, text: info.week[wd] === '24h' ? Z('24小时', '24 h') : info.week[wd].replace(/,/g, ', ') };
	const pl = info.gpid && placeMemo.get(info.gpid);
	const desc = pl && pl.regularOpeningHours && pl.regularOpeningHours.weekdayDescriptions;
	if (desc && desc[wd]) return { closed: false, text: desc[wd].replace(/^[^:：]+[:：]\s*/, '') };
	return { closed: false, text: info.hours || '' };
}
// the trip date to show hours for: today while the trip runs, else none (the whole week)
const infoDate = () => (TRIP_DATES.includes(tpNow().date) ? tpNow().date : null);
function hoursLine(info, date) {
	const h = infoHours(info, date);
	if (h.closed) return `<p class="warn">${icon('alert')}<span>${esc(date ? `${dateLabel(date)} ${Z('休息', 'closed')}` : h.text)}</span></p>`;
	if (!h.text) return '';
	const when = date ? (date === tpNow().date ? Z('今天', 'Today') : dateLabel(date)) : '';
	return `<p class="xsmall">${icon('clock')} ${when ? `<b>${esc(when)}</b> ` : ''}${keepRanges(esc(h.text))}</p>`;
}
const infoRating = (info) =>
	info.rating
		? `<span class="rating">${icon('star', 'star')}<b>${esc(info.rating)}</b>${info.reviews ? ` · ${num(info.reviews)} ${Z('则评论', 'reviews')}` : ''}${info.rsrc ? `<span class="xsmall"> · ${esc(srcShort(info.rsrc))}</span>` : ''}</span>`
		: '';
/** the top of a place's details: our photo, its name, kind and line, the rating we hold */
function placeHead(info, h = 'p') {
	const ph = info.photo && credit[info.photo];
	const meta = [info.kind ? L(info.kind) : '', info.sub].filter(Boolean).join(' · ');
	return `<div class="hang-h">${ph ? `<img src="${imgSrc(info.photo, true)}" data-img="${imgKey(info.photo, true)}" alt="" width="64" height="64" loading="lazy" decoding="async">` : ''}<div><${h} class="hang-name" tabindex="-1">${esc(info.n)}</${h}>${meta ? `<p class="hang-meta">${escText(meta)}</p>` : ''}${infoRating(info)}</div></div>`;
}
const addrLine = (info) =>
	info.addr
		? `<p class="addr">${icon('pin')}<span>${escText(info.addr)}${info.addrEn && lang === 'en' ? `<br><span class="xsmall">${escText(info.addrEn)}</span>` : ''}</span></p>`
		: '';
// Google's live part of a place can come only with the key, for a place with a Google id or a position to look one up
const gCan = (info) => !!(GM && info && (info.gpid || info.lat != null));

/** one place, in full: the shared details view (a sheet over the page) */
function placeDetailsHTML(info) {
	const date = infoDate();
	// a stop of the plan (or one added) isn't offered again
	const planned = !!info.mine || (!!info.pid && DAYS.some((d) => d.schedule.some((it) => it.place === info.pid)));
	return `<article class="hang pdet" data-pdet="${esc(info.ref)}">${placeHead(info, 'h3')}${addrLine(info)}${hoursLine(info, date)}${info.paused ? `<p class="warn">${icon('alert')}${Z('暂停营业', 'Paused')}</p>` : ''}${gCan(info) ? '<div class="gplace"></div>' : ''}
      <div class="links-row">${extI(gmSearch(info.q || info.n, info.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(info.q || info.n, 'transit', undefined, info.gpid), Z('路线', 'Directions'), 'route')}${planned ? '' : addBtn(info.n, info.lat, info.lng, info.gpid, info.q, info.addr, info.ref)}</div></article>`;
}
function openPlaceDetails(ref) {
	const info = placeInfo(ref);
	if (!info) return;
	openSheet(placeDetailsHTML(info));
	const box = $('#placeSheet .pdet .gplace');
	if (box) gLoad(info, box);
}
/** Google's rating, hours and photos into box, for a place: by its Google id, else found by name near its pin */
async function gLoad(info, box) {
	box.hidden = false;
	box.innerHTML = `<p class="xsmall">${Z('载入中…', 'Loading…')}</p>`;
	const id = info.gpid || (await gLookup(info));
	if (!id) {
		// not found, or Google refused (no network, the key's limits): say which
		box.innerHTML =
			id === null
				? `<p class="xsmall">${Z('Google 上找不到这个地方。点「地图」看。', 'Google doesn’t list this place. Tap “Map”.')}</p>`
				: `<p class="xsmall">${Z('暂时查不到 Google 资料（可能额度用完）。点「地图」看。', 'Google details unavailable (quota may be used up). Tap “Map”.')}</p>`;
		return null;
	}
	info.gpid = id;
	return loadPlace(id, box);
}
// Text Search asking only for ids (Google's free tier for ids), once per place per page view: the id, null when Google
// has no such place, undefined when the search failed (tried again on the next tap)
async function gLookup(info) {
	if (gidMemo.has(info.ref)) return gidMemo.get(info.ref);
	try {
		const { Place } = await gPlaces();
		const { places } = await Place.searchByText({
			textQuery: info.q || info.n,
			fields: ['id'],
			locationBias: { center: { lat: info.lat, lng: info.lng }, radius: 500 },
			maxResultCount: 1,
			language: gLang(),
			...(gRegion() ? { region: gRegion() } : {}),
		});
		const id = (places && places[0] && places[0].id) || null;
		gidMemo.set(info.ref, id);
		return id;
	} catch {
		return undefined;
	}
}
async function gPlaces() {
	if (!(window.google && google.maps && google.maps.importLibrary)) await loadGoogle();
	return google.maps.importLibrary('places');
}
/** Google's text search near where the group is (or the hotel): up to 8 places, each remembered in gSeen */
async function gTextSearch(q) {
	const { Place } = await gPlaces();
	const { places } = await Place.searchByText({
		textQuery: q,
		fields: ['id', 'displayName', 'formattedAddress', 'location'],
		locationBias: { center: meLL && !farAway() ? meLL : placeLL(hotelNow()), radius: 30000 },
		maxResultCount: 8,
		language: gLang(),
		...(gRegion() ? { region: gRegion() } : {}),
	});
	return (places || [])
		.filter((p) => p.location && p.id)
		.map((p) => {
			const n = p.displayName || '';
			const g = {
				n,
				lat: p.location.lat(),
				lng: p.location.lng(),
				gpid: p.id,
				q: n,
				addr: (p.formattedAddress || '').replace(/^\d{3,6}/, ''),
				ref: `g:${p.id}`,
			};
			gSeen.set(p.id, g);
			return g;
		});
}

/* ── the finder: a place against the plan ── */
let finderO = null; // its history step: Back returns to the results
let finderAt = null; // the place it shows
let finderY = 0; // where the results were scrolled to
const FINDER_TYPES = ['place', 'shop', 'buy', 'food', 'wish', 'drink', 'rest'];
const finderFor = (p) => FINDER_TYPES.includes(p.type) && !isHotel(p.pid);
// a leg in words, the way the add sheet counts it: a short walk at the group's pace, else a taxi first (seniors), and
// the metro when it runs there
function legWords(a, b) {
	const m = legModes(a, b);
	if (m.walk <= 20) return Z(`走路约${Math.max(1, Math.round(m.walk))}分`, `~${Math.max(1, Math.round(m.walk))} min walk`);
	const t = m.taxi != null ? Z(`计程车约${Math.round(m.taxi)}分`, `taxi ~${Math.round(m.taxi)} min`) : '';
	const r = m.mrt != null ? Z(`${METRO[0]}约${Math.round(m.mrt)}分`, `${METRO[1]} ~${Math.round(m.mrt)} min`) : '';
	return [t, r].filter(Boolean).join(' · ');
}
/** how the place sits against each trip day (Fit.fitDays), from the plan as it is on this phone now */
function fitFor(info) {
	const now = tpNow();
	const near = (ll) => ll && km(ll, info) < 0.04; // the same spot: the place itself
	const days = DAYS.filter((d) => d.id !== ROLE.flight).map((d) => {
		const raw = d.schedule.map((it) => parseT(it.t || ''));
		const eff = Plan.effectiveRows(raw);
		const can = Plan.roomAfter(raw);
		const mine = mineAll().filter((x) => x.day === d.id);
		const at = (x) => Plan.minuteOn(raw, tMin(x.t));
		const starts = [...eff.filter((r) => r.s != null && !r.closes).map((r) => r.s), ...mine.map(at)];
		const freeFrom = d.freeFrom ? Plan.minuteOn(raw, tMin(d.freeFrom)) : null;
		const today = d.date === now.date;
		let planned = false;
		const stops = [];
		d.schedule.forEach((it, i) => {
			const ll = llOfStop(it);
			if ((info.pid && it.place === info.pid) || near(ll)) planned = true;
			else if (ll && can[i]) {
				const r = eff[i];
				stops.push({
					...ll,
					key: String(i),
					name: stopName(it),
					hotel: !!(it.place && isHotel(it.place)),
					past: today && r.s != null && (r.e ?? r.s) < now.mins,
					room: Fit.freeAfter(r.s, r.e, starts),
					free: freeFrom != null && r.s != null && r.s >= freeFrom,
				});
			}
		});
		mine.forEach((x) => {
			if (x.id === info.mine || (info.gpid && x.gpid === info.gpid) || near(x)) planned = true;
			else {
				const s = at(x);
				stops.push({
					lat: +x.lat,
					lng: +x.lng,
					key: x.id,
					name: x.name,
					past: today && s < now.mins,
					room: Fit.freeAfter(s, null, starts),
					free: freeFrom != null && s >= freeFrom,
				});
			}
		});
		return { id: d.id, closed: infoHours(info, d.date).closed, planned, over: d.date < now.date, crowded: mine.length >= CROWDED, stops };
	});
	return Fit.fitDays(info, days);
}
const dayTag = (d) => `<span class="daychip" style="${colorVars(d.c)}">Day ${d.n} · ${esc(L(d.dow))}</span>`;
// a distance that never breaks between the number and its unit
const dist1 = (k) => distLabel(k).replace(/ (k?m)$/, ' $1');
// how far a day's nearest stop is, in words ("next door" reads as a place, not a distance)
const fromStop = (r) =>
	r.km < 0.1
		? Z(`就在「${r.stop.name}」旁边`, `Next door to ${r.stop.name}`)
		: Z(`离「${r.stop.name}」${dist1(r.km)}`, `${dist1(r.km)} from ${r.stop.name}`);
function finderHTML(info) {
	const f = fitFor(info);
	const date = infoDate();
	const inPlan = DAYS.filter(
		(d) =>
			d.schedule.some((it) => (info.pid && it.place === info.pid) || (llOfStop(it) && km(llOfStop(it), info) < 0.04)) ||
			mineAll().some((x) => x.day === d.id && (x.id === info.mine || km(x, info) < 0.04)),
	);
	const b = f.best;
	const bd = b && dayById[b.id];
	const at = b ? gapContext(b.id, b.stop.key).t : null; // the time the add sheet will start from
	const best = b
		? `<div class="pf-best"><p class="pf-best-h">${icon('check')}<span>${Z('最合适', 'Best fit')}</span>${dayTag(bd)}<span class="pf-date">${esc(Time.shortDate(bd.date, lang))}</span></p>
        <p class="pf-why">${esc(fromStop(b))} · ${esc(legWords(b.stop, info))}${b.roomy ? ` · ${Z('之后有空档', 'free time after it')}` : ''}</p>
        ${f.far ? `<p class="warn">${icon('alert')}<span>${esc(Z(`每天的行程都离这里很远（最近 ${distLabel(b.km)}）：可能要另外排半天。`, `Far from every day's stops (the nearest is ${distLabel(b.km)}): it may need half a day of its own.`))}</span></p>` : ''}
        <button type="button" class="go-btn pf-add" data-fit-add="${b.id}|${esc(b.stop.key)}">${icon('plus')}<span class="pf-add-t"><b>${esc(Z(`加到 Day ${bd.n}`, `Add to Day ${bd.n}`))}</b><small>${esc(Z(`接在它之后${at ? `，约 ${at}` : ''}`, `right after it${at ? `, about ${at}` : ''}`))}</small></span></button></div>`
		: `<p class="pf-none">${icon('info')}<span>${esc(
				f.rows.length
					? Z(
							'剩下的日子都排不进：当天休息、已经在行程里，或那天已经过了。',
							'No day ahead can take it: closed, already in the plan, or the day is over.',
						)
					: Z('行程里没有可以比较的站。', 'The plan has no stops to measure from.'),
			)}</span></p>`;
	const others = f.rows.filter((r) => r !== b).slice(0, 3);
	const row = (r) => {
		const d = dayById[r.id];
		const why = r.closed
			? Z('当天休息', 'closed that day')
			: r.planned
				? Z('已在当天行程', 'already that day')
				: r.over
					? Z('已经过了', 'already over')
					: '';
		const body = `${dayTag(d)}<span class="pf-day-b"><span class="pf-day-n">${esc(r.stop.name)}</span><span class="pf-day-m">${esc(dist1(r.km))} · ${esc(legWords(r.stop, info))}</span>${why ? `<b class="pf-off">${esc(why)}</b>` : ''}</span>`;
		return r.ok
			? `<li><button type="button" class="pf-day" data-fit-add="${r.id}|${esc(r.stop.key)}" aria-label="${esc(Z(`加到 Day ${d.n}，「${r.stop.name}」之后`, `Add to Day ${d.n}, after ${r.stop.name}`))}">${body}${icon('plus', 'pf-plus')}</button></li>`
			: `<li><div class="pf-day is-off">${body}</div></li>`;
	};
	return `<div class="mres-h"><button type="button" class="mlink" data-find-back>${icon('arrow', 'flip')}${Z('回到结果', 'Back to results')}</button></div>
    <div class="pf-body">${placeHead(info, 'h3')}${hoursLine(info, date)}
      ${inPlan.length ? `<p class="pf-in">${icon('calendar')}<span>${esc(Z('已在行程：', 'In the plan: '))}${inPlan.map((d) => `<a class="mlink" href="#${d.id}">Day ${d.n}</a>`).join(' ')}</span></p>` : ''}
      ${best}
      ${others.length ? `<p class="sub-h">${Z('其他天最近的站', 'Other days, nearest stop first')}</p><ul class="pf-days">${others.map(row).join('')}</ul>` : ''}
      <p class="xsmall muted">${Z('直线距离；时间为估算（走路按长辈速度），不含塞车。', 'Straight-line distance; times are estimates (walking at the group’s pace), without traffic.')}</p>
      <div class="links-row"><button type="button" class="mlink" data-find-detail>${icon('info')}${Z('详情', 'Details')}${gCan(info) ? `<span class="dlbl">${Z(' · 营业时间、照片、评价', ' · hours, photos, reviews')}</span>` : ''}</button>${extI(gmSearch(info.q || info.n, info.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(info.q || info.n, 'transit', undefined, info.gpid), Z('路线', 'Directions'), 'route')}</div>
    </div>`;
}
/** show a place in the finder, in place of the results, and on the map: its pin, or a marker of its own for a place
 *  the map has no pin for (a Google result, a shop box shop); from: the result row tapped, focused again on Back */
function finderOpen(info, pin, from) {
	const box = $('#mapfind');
	const res = $('#mapres');
	if (!box || !info) return;
	if (!finderAt) finderY = res ? res.scrollTop : 0;
	finderAt = { info, pin: pin || null, from };
	box.innerHTML = finderHTML(info);
	box.hidden = false;
	box.scrollTop = 0;
	if (res) res.hidden = true;
	const lb = $('[data-maplist]');
	if (lb) lb.setAttribute('aria-expanded', 'false');
	if (!finderO) finderO = openOverlay(() => finderShut(true));
	// the panel's top just under the bar, so the map shows below it (held while sections above draw: holdLanding)
	if (!mapFullOn) scrollToEl(box, 'start', false);
	const h = box.querySelector('.hang-name');
	if (h) h.focus({ preventScroll: true });
	if (liveFailed) return; // the list and the plan still work without the live map
	withMap(() => (pin ? map.select(pin) : map.spot && map.spot(info)));
}
function finderRefresh() {
	const box = $('#mapfind');
	if (box && !box.hidden && finderAt) box.innerHTML = finderHTML(finderAt.info);
}
// the finder closes: back to the results where they were (back), or out of the way for a new search or a redraw
function finderShut(back) {
	const box = $('#mapfind');
	const res = $('#mapres');
	const from = finderAt && finderAt.from;
	finderAt = null;
	finderO = null;
	if (map && map.spot) map.spot(null);
	if (!box) return;
	box.hidden = true;
	box.innerHTML = '';
	if (!back || !res) return;
	mapListOpen(true);
	res.scrollTop = finderY;
	const el = from && res.querySelector(from);
	if (el) el.focus({ preventScroll: true });
}
function finderBack() {
	if (finderO) dropOverlay(finderO);
	finderShut(true);
}
/** before a new search, a list the person asked for, or a full redraw: the finder steps aside (and off history) */
function finderReset() {
	if (finderO) dropOverlay(finderO);
	finderShut(false);
}
/** a full redraw rebuilds the map section: the finder and the results start over */
function mapSearchReset() {
	finderReset();
	mapView = 'list';
	mapPinsOff = null;
	shopFinds = null;
}

/* ── the add sheet's preview: a place tapped in its list opens over the list (its own history step), with Add, and
   Back (the button or the phone's) brings the list back as it was: the search, the filters, where it was scrolled ── */
let addPeekO = null;
let addPeekY = 0;
let addPeekAt = -1;
function addPeek(item, from) {
	const sh = $('#placeSheet');
	const list = sh && sh.querySelector('[data-addfind]');
	const pv = sh && sh.querySelector('[data-addprev]');
	if (!list || !pv) {
		sheetShow(addSheet(item));
		return;
	}
	addPeekY = sh.scrollTop;
	addPeekAt = [...list.querySelectorAll('[data-add]')].indexOf(from);
	pv.innerHTML = addSheet({ ...item, peek: true });
	list.hidden = true;
	pv.hidden = false;
	sh.scrollTop = 0;
	if (!addPeekO || !overlays.includes(addPeekO)) {
		addPeekO = openOverlay(() => addPeekShut());
		(sh._subs = sh._subs || []).push(addPeekO);
	}
	const h = pv.querySelector('.hang-name, .add-name');
	if (h) h.focus({ preventScroll: true });
	// the place was tapped for a closer look: Google's part comes with it (once per place per page view)
	const box = pv.querySelector('.gplace[data-gauto]');
	const info = item.ref && placeInfo(item.ref);
	if (box && info) gLoad(info, box).then(addHoursNote);
}
function addPeekShut() {
	addPeekO = null;
	const sh = $('#placeSheet');
	const list = sh && sh.querySelector('[data-addfind]');
	const pv = sh && sh.querySelector('[data-addprev]');
	if (!list || !pv) return;
	pv.hidden = true;
	pv.innerHTML = ''; // the sheet's fields are looked up by name: only the list's may be left
	addItem = null;
	list.hidden = false;
	sh.scrollTop = addPeekY;
	const back = list.querySelectorAll('[data-add]')[addPeekAt];
	if (back) back.focus({ preventScroll: true });
}
function addPeekBack() {
	if (addPeekO) dropOverlay(addPeekO);
	addPeekShut();
}
/** the add sheet's line for the place's hours on the day picked (closed that day: a warning) */
function addHoursNote() {
	const el = $('[data-add-hours]');
	if (!el || !addItem || !addItem.ref) return;
	const info = placeInfo(addItem.ref);
	const day = ($('[data-add-day][aria-pressed="true"]') || {}).dataset?.addDay;
	el.innerHTML = info && day && dayById[day] ? hoursLine(info, dayById[day].date) : '';
}
