/* ───────── live location: a pulsing dot that follows the phone while the page is open (the position never leaves the phone) ───────── */
let meWatch = null;
let meAcc = 0;
let lateAt = null;
let meHd = null;
let meResume = false;
let meCardAt = null;
let mapSel = null;
const meOnce = [];
function meGot(pos) {
	meLL = { lat: pos.coords.latitude, lng: pos.coords.longitude };
	meAcc = pos.coords.accuracy || 0;
	meHd = pos.coords.speed > 0.6 && pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null;
	if (map && map.me) map.me(meLL, meAcc, meHd);
	mapListSync();
	if (mapSel && (!meCardAt || km(meCardAt, meLL) > 0.03)) {
		meCardAt = meLL;
		selRefresh();
	}
	if (!lateAt || km(lateAt, meLL) > 0.08) {
		lateAt = meLL;
		renderNow();
	} // moved: are we still on time?
	meOnce.splice(0).forEach((f) => {
		try {
			f();
		} catch {
			/* the map was rebuilt meanwhile */
		}
	});
}
function locateMe(cb, quiet) {
	if (cb) meOnce.push(cb);
	if (!navigator.geolocation) {
		meOnce.length = 0;
		if (!quiet) toast(Z('这个浏览器不能定位', 'This browser cannot share location'));
		return;
	}
	if (meWatch != null) {
		if (meLL) meOnce.splice(0).forEach((f) => f());
		return;
	}
	meWatch = navigator.geolocation.watchPosition(
		meGot,
		() => {
			if (meWatch != null) navigator.geolocation.clearWatch(meWatch);
			meWatch = null;
			meOnce.length = 0;
			if (!quiet) toast(Z('没法取得位置：请允许定位权限', 'Location unavailable; allow access'));
		},
		{ enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
	);
}
document.addEventListener('visibilitychange', () => {
	// no GPS while the phone is in a pocket
	if (document.hidden) {
		if (meWatch != null) {
			navigator.geolocation.clearWatch(meWatch);
			meWatch = null;
			meResume = true;
		}
	} else {
		renderNow();
		markToday();
		if (meResume) {
			meResume = false;
			locateMe(null, true);
		}
	}
});
function meAuto() {
	try {
		navigator.permissions
			.query({ name: 'geolocation' })
			.then((r) => {
				if (r.state === 'granted') locateMe(null, true);
			})
			.catch(() => {});
	} catch {
		/* no Permissions API: wait for a tap */
	}
}
const meDot = () => {
	const d = document.createElement('div');
	d.className = 'me-dot';
	d.innerHTML = '<span class="me-hd" hidden></span>';
	d.setAttribute('aria-label', Z('你在这里', 'You are here'));
	return d;
};
const meHead = (el, hd) => {
	const h = el && el.querySelector('.me-hd');
	if (!h) return;
	h.hidden = hd == null;
	if (hd != null) h.style.transform = `rotate(${Math.round(hd)}deg)`;
};
function selRefresh() {
	if (!mapSel || !map) return;
	if (map.line) map.line(mapSel);
	const c = $('#mapcard');
	if (c && c.dataset.pid === mapSel.pid) showCard(mapSel);
}

/* map search: type a name or pick a filter, get a list (nearest first once the phone shares its location); tap = fly to the pin */
const MAP_CATS = [
	['all', ['全部', 'All']],
	['place', ['景点', 'Sights']],
	['food', ['美食', 'Food']],
	['wish', ['想去', 'Wishlist']],
	['drink', ['饮料', 'Drinks']],
	['rest', ['歇脚', 'Rest']],
	['wc', ['厕所', 'Toilets']],
	['mrt', [METRO[0], Cap(METRO[1])]],
	['bike', [BIKES[0], Cap(BIKES[1])]],
	['bus', ['公车', 'Bus']],
];
const MAP_CAT_KEYS = MAP_CATS.map(([k]) => k).filter((k) => k !== 'all');
const PIN_KIND = {
	place: ['景点', 'Sight'],
	hotel: ['酒店', 'Hotel'],
	food: ['美食', 'Food'],
	shop: ['商店', 'Shop'], // a shop pin names its own list's kind (p.kind)
	wish: ['想去', 'Wishlist'],
	drink: ['饮料', 'Drinks'],
	rest: ['歇脚', 'Rest'],
	wc: ['厕所', 'Toilet'],
	mrt: [`${METRO[0]}站`, Cap(METRO[1])],
	bike: [BIKES[0], Cap(BIKES[1])],
	bus: ['公车站', 'Bus stop'],
	mine: ['我加的', 'Added by me'],
};
const PIN_RANK = { mine: 0, hotel: 0, place: 1, shop: 2, food: 3, wish: 4, rest: 5, drink: 6, wc: 7, mrt: 8, bike: 9, bus: 10 };
// category: 'all' leaves out drinks / rest / toilets (too many pins); a day keeps only that day's pins (+ hotel, + MRT by the hotel)
const catOK = (p, c) =>
	c === 'all'
		? !['drink', 'rest', 'wc', 'bike', 'bus'].includes(p.type) && !(p.type === 'mrt' && !(p.serves || []).length)
		: c === 'place'
			? ['place', 'shop', 'hotel', 'mine'].includes(p.type)
			: p.type === c;
// transport and toilets are about where you are, not which day: their own category ignores the day buttons
const dayOK = (p, d) =>
	d === 'all' || p.days.includes(d) || p.type === 'hotel' || !!p.always || (['mrt', 'bike', 'bus', 'wc'].includes(p.type) && mapCat === p.type);
const pinShown = (p) => catOK(p, mapCat) && dayOK(p, mapDay);
const inFilter = (p, f) =>
	p.drink || p.wc
		? f === p.type || (f !== 'all' && p.days.includes(f))
		: f === 'all' ||
			(f === 'food'
				? p.type === 'food'
				: f === 'wish'
					? p.type === 'wish'
					: ['drink', 'rest', 'wc'].includes(f)
						? false
						: p.days.includes(f) || p.type === 'hotel');
const hayOf = (p) =>
	p.hay ||
	(p.hay = [
		p.name,
		L(p.kind || PIN_KIND[p.type] || ['', '']),
		other(p.kind || PIN_KIND[p.type] || ['', '']),
		p.food && [p.food.name_trad, p.food.name_en, p.food.name_zh, p.food.dish_zh, p.food.dish_en],
		p.wish && [p.wish.name_trad, p.wish.name_en, p.wish.name_zh, p.wish.list_name],
		p.drink && [p.drink.name_trad, p.drink.name_en, p.drink.brand, p.drink.tip_zh, p.drink.kind && L(REST_KIND[p.drink.kind])],
		p.wc && [p.wc.n_trad, '公厕 toilet wc restroom 廁所'],
		PLACES[p.pid] && [PLACES[p.pid].name].flat(),
		p.type === 'mrt' && [
			'mrt 捷运 捷運 station',
			MRT && p.si != null && [MRT.st[p.si][1], MRT.st[p.si][2], p.lines.map((li) => [MRT.ln[li].zh, MRT.ln[li].en, MRT.ln[li].ref])],
		],
		p.bike && [p.bike.n_trad, p.bike.n_en, 'youbike ubike 单车 腳踏車 自行车'],
		p.bus && [p.bus.n_trad, 'bus 公车 公車 巴士'],
		p.days.map((d) => `day${dayById[d] ? dayById[d].n : ''}`),
	]
		.flat(3)
		.filter(Boolean)
		.join(' ')
		.toLowerCase());
const farAway = () =>
	!!meLL &&
	HOTELS.map(placeLL)
		.filter(Boolean)
		.every((h) => km(meLL, h) > 60); // still at home: distances in the thousands of km help no one
function mapMatches() {
	const q = ($('#mapq') || {}).value ? $('#mapq').value.trim().toLowerCase() : '';
	const words = q.split(/\s+/).filter(Boolean);
	// typing with category 全部 also finds drinks / rest / toilets (hidden on the map until picked)
	let list = mapPins.filter((p) => (q && mapCat === 'all' ? true : catOK(p, mapCat)) && dayOK(p, mapDay) && words.every((w) => hayOf(p).includes(w)));
	const byDist = mapNear && meLL && !farAway();
	list = list.map((p) => ({ p, k: meLL && !farAway() ? km(meLL, p) : null }));
	list.sort((a, b) => (byDist ? a.k - b.k : PIN_RANK[a.p.type] - PIN_RANK[b.p.type] || a.p.name.localeCompare(b.p.name, 'zh')));
	return { q, list };
}
function mapListSync() {
	const box = $('#mapres');
	const n = $('#mapn');
	if (!box) return;
	const { q, list } = mapMatches();
	if (n) n.textContent = String(list.length);
	if (box.hidden) return;
	const row = ({ p, k }) =>
		`<li><button type="button" class="mres" data-mres="${esc(p.pid)}"><span class="mres-ic" aria-hidden="true">${pinSVG(p)}</span><span class="mres-b"><span class="mres-n">${esc(p.name)}</span><span class="mres-m">${esc(L(p.kind || PIN_KIND[p.type] || ['', '']))}${p.days
			.slice(0, 2)
			.map((d) => ` · Day ${dayById[d] ? dayById[d].n : ''}`)
			.join('')}</span></span>${k != null ? `<span class="mres-d">${distLabel(k)}</span>` : ''}</button></li>`;
	const head = `<div class="mres-h"><span>${list.length ? Z(`${list.length} 个地点`, `${list.length} places`) : Z('没有找到：换个字或选「全部天」', 'Nothing found: try other words or "All days"')}</span><span class="mres-seg" role="group" aria-label="${Z('排序', 'Sort')}"><button type="button" class="seg-btn" data-mapsort="type" aria-pressed="${!mapNear}">${Z('按类别', 'By type')}</button><button type="button" class="seg-btn" data-mapsort="near" aria-pressed="${mapNear}">${icon('pin')}${Z('离我最近', 'Nearest')}</button></span></div>${mapNear && farAway() ? `<p class="mres-far">${icon('info')}${Z(`你现在不在${CITY[0]}，到了${CITY[0]}再按距离排。`, `You're not in ${CITY[1]} yet; distance sort works once you're there.`)}</p>` : ''}`;
	const gq =
		q.length >= 2 && window.google && google.maps && google.maps.importLibrary
			? `<button type="button" class="mres gq" data-gsearch>${icon('search')}<span class="mres-b"><span class="mres-n">${esc(Z(`在 Google 搜「${q}」`, `Search Google for "${q}"`))}</span><span class="mres-m">${Z('页面里没有的地方也能找，还能加入行程', 'Find places the page does not have, and add them to the plan')}</span></span></button>`
			: '';
	box.innerHTML =
		head +
		(list.length
			? `<ul class="mres-list">${list
					.slice(0, 80)
					.map((x, i) =>
						x.p.bike && i < 20
							? row(x).replace('</span></span>', `</span><span class="mres-yb" data-yb="${esc(x.p.bike.no)}"></span></span>`)
							: row(x),
					)
					.join(
						'',
					)}</ul>${list.length > 80 ? `<p class="xsmall muted">${Z('只列前80个，输入名字缩小范围', 'First 80 shown; type to narrow')}</p>` : ''}`
			: '') +
		gq; // the page's own places first, Google as the fallback
	ybFill(box);
}
async function gSearch(q) {
	const box = $('#mapres');
	if (!box) return;
	box.innerHTML = `<div class="mres-h"><span>${esc(Z(`Google：「${q}」`, `Google: "${q}"`))}</span><button type="button" class="mlink" data-gback>${icon('arrow', 'flip')}${Z('回到页面结果', 'Back to page results')}</button></div><p class="xsmall muted" style="padding:10px 12px">${Z('搜索中…', 'Searching…')}</p>`;
	try {
		const { Place } = await google.maps.importLibrary('places');
		const { places } = await Place.searchByText({
			textQuery: q,
			fields: ['id', 'displayName', 'formattedAddress', 'location'],
			locationBias: { center: meLL && !farAway() ? meLL : placeLL(hotelNow()), radius: 30000 },
			maxResultCount: 8,
			language: lang === 'en' ? 'en' : 'zh-TW',
			region: 'tw',
		});
		const rows = (places || [])
			.filter((p) => p.location)
			.map((p) => {
				const ll = { lat: p.location.lat(), lng: p.location.lng() };
				const k = meLL && !farAway() ? km(meLL, ll) : null;
				const n = p.displayName || '';
				const a = (p.formattedAddress || '').replace(/^\d{3,6}/, '');
				return `<li class="gres"><div class="gres-b"><span class="mres-n">${esc(n)}</span><span class="mres-m">${esc(a)}${k != null ? ` · ${distLabel(k)}` : ''}</span></div><div class="links-row">${extI(gmSearch(n, p.id), Z('地图', 'Map'), 'pin')}${extI(gmDir(n, 'transit', undefined, p.id), Z('路线', 'Directions'), 'route')}${addBtn(n, ll.lat, ll.lng, p.id, n, a)}</div></li>`;
			});
		box.querySelector('p').outerHTML = rows.length
			? `<ul class="mres-list">${rows.join('')}</ul>`
			: `<p class="xsmall muted" style="padding:10px 12px">${Z('Google 也没找到：换个名字试试', 'Nothing on Google either: try another name')}</p>`;
	} catch {
		const p = box.querySelector('p');
		if (p) p.textContent = Z('现在连不上 Google（网络？）', "Can't reach Google right now (network?)");
	}
}
function mapListOpenYb() {
	const box = $('#mapres');
	if (box && !box.hidden) ybFill(box);
}
function mapListOpen(on) {
	const box = $('#mapres');
	const b = $('[data-maplist]');
	if (!box) return;
	box.hidden = !on;
	if (b) b.setAttribute('aria-expanded', String(on));
	if (on) {
		mapListSync();
		mapListOpenYb();
	}
}

function mapReadyNow() {
	const td = DAYS.find((d) => d.date === tpNow().date);
	if (!mapWait.length && td && td.id !== ROLE.flight) map.filter(td.id);
	else map.filter(mapDay); // 'all' keeps the drink pins out of the overview
	const q = mapWait.splice(0);
	q.forEach((f) => {
		try {
			f();
		} catch {
			/* map rebuilt meanwhile */
		}
	});
	if (meLL) map.me(meLL, meAcc, meHd);
	meAuto();
}
function restyleLive() {
	if (gmap) {
		if (isDark() !== liveDark) mountGoogle();
		return;
	}
	if (!live || liveRaster || isDark() === liveDark) return;
	liveDark = isDark();
	try {
		live.setStyle(liveDark ? LIVE.dark : LIVE.light, { diff: false });
	} catch {
		/* keep the current style */
	}
}
function mountLive(url) {
	const wrap = $('.map-wrap');
	if (!wrap) return;
	let el = $('#livemap');
	if (!el) {
		el = document.createElement('div');
		el.id = 'livemap';
		el.className = 'livemap';
		wrap.prepend(el);
	}
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (live) {
		try {
			live.remove();
		} catch {
			/* container already replaced */
		}
		live = null;
	}
	let m;
	try {
		m = new maplibregl.Map({
			container: el,
			style: url,
			center: [placeLL(hotelNow()).lng, placeLL(hotelNow()).lat], // until the first map view fits
			zoom: 12.3,
			attributionControl: { compact: true },
			localIdeographFontFamily: '"PingFang TC","PingFang SC","Noto Sans TC","Noto Sans SC","Microsoft JhengHei",sans-serif',
			dragRotate: false,
			pitchWithRotate: false,
			touchPitch: false,
		});
	} catch {
		liveFailed = true;
		liveArmed = false;
		mapMsg('fail', 'webgl');
		return;
	}
	live = m;
	const slow = setTimeout(() => {
		if (live === m && !m.loaded()) mapMsg('slow');
	}, 10000);
	m.touchZoomRotate.disableRotation();
	m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
	m.addControl(
		{
			onAdd() {
				const d = document.createElement('div');
				d.className = 'maplibregl-ctrl maplibregl-ctrl-group';
				const b = document.createElement('button');
				b.type = 'button';
				b.className = 'ml-loc';
				b.setAttribute('aria-label', Z('显示我的位置', 'Show my location'));
				b.innerHTML = icon('pin');
				b.addEventListener('click', () => {
					if (meLL && meWatch != null) map.center();
					else locateMe(() => map.center());
				});
				d.append(b);
				return d;
			},
			onRemove() {},
		},
		'bottom-right',
	);
	let meMk = null;
	m.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-left');
	let swapped = false;
	let loadedOnce = false;
	liveDark = isDark();
	liveRaster = url === OSM_RASTER;
	m.on('error', () => {
		if (!loadedOnce && !m.isStyleLoaded() && !swapped && url !== OSM_RASTER) {
			swapped = true;
			liveRaster = true;
			m.setStyle(OSM_RASTER);
		}
	});
	m.once('load', () => {
		clearTimeout(slow);
		loadedOnce = true;
		wrap.classList.add('is-live');
		mapMsg('ok');
		const pins = buildPins();
		mapPins = pins;
		const markers = [];
		let popup = null;
		let sel = null;
		pins.forEach((p) => markers.push({ p, b: null, mk: null }));
		const mkOf = (x) => {
			// made the first time the pin is shown
			if (x.mk) return x.mk;
			const p = x.p;
			const b = document.createElement('button');
			b.type = 'button';
			b.className = 'lpin';
			b.dataset.type = p.type;
			b.dataset.pid = p.pid;
			b.dataset.days = p.days.join(' ');
			b.setAttribute('aria-label', p.name);
			b.innerHTML = pinSVG(p);
			x.b = b;
			x.mk = new maplibregl.Marker({ element: b, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(m);
			b.addEventListener('click', (ev) => {
				ev.stopPropagation();
				pick(p, false);
			});
			return x.mk;
		};
		function pick(p, fly) {
			if (sel) sel.classList.remove('sel');
			const mm = markers.find((x) => x.p.pid === p.pid);
			sel = mm && mm.b;
			if (sel) sel.classList.add('sel');
			if (popup) popup.remove();
			popup = new maplibregl.Popup({ offset: 16, maxWidth: '290px', closeButton: true, focusAfterOpen: false })
				.setLngLat([p.lng, p.lat])
				.setHTML(popupHTML(p))
				.addTo(m);
			popup.getElement().addEventListener('click', (e) => {
				if (e.target.closest('[data-more]')) openPinSheet(p);
			});
			if (fly) m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 17), duration: reduce ? 0 : 500 });
			mapSel = p;
			map.line(p);
			showCard(p);
		}
		const VIEWS = { all: GEO.bbox, ...Object.fromEntries((TRIP.mapViews || []).map((v) => [v.id, v.bbox])) };
		const fitTo = (list) => {
			if (!list.length) return;
			const lngs = list.map((x) => x.lng),
				lats = list.map((x) => x.lat);
			m.fitBounds(
				[
					[Math.min(...lngs), Math.min(...lats)],
					[Math.max(...lngs), Math.max(...lats)],
				],
				{ padding: 56, maxZoom: 15.5, duration: reduce ? 0 : 700 },
			);
		};
		map = {
			view(k) {
				if (popup) popup.remove();
				const b = VIEWS[k] || GEO.bbox;
				m.fitBounds(
					[
						[b[0], b[1]],
						[b[2], b[3]],
					],
					{ padding: 24, duration: reduce ? 0 : 700 },
				);
				$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === k)));
			},
			zoom(f) {
				m.easeTo({ zoom: m.getZoom() + (f < 1 ? 1 : -1), duration: reduce ? 0 : 250 });
			},
			filter(f) {
				if (popup) popup.remove();
				if (MAP_CAT_KEYS.includes(f)) mapCat = f;
				else mapDay = f;
				mapListSync();
				const show = (x) => pinShown(x.p);
				markers.forEach((x) => {
					if (show(x)) {
						mkOf(x);
						x.b.style.display = '';
					} else if (x.b) x.b.style.display = 'none';
				});
				$$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === mapDay)));
				$$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === mapCat)));
				if (mapDay !== 'all' || mapCat !== 'all') {
					fitTo(markers.filter((x) => show(x) && x.p.type !== 'hotel').map((x) => x.p));
					$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
				}
			},
			select(pid) {
				const x = markers.find((mm) => mm.p.pid === pid);
				if (x) {
					mkOf(x);
					x.b.style.display = '';
					pick(x.p, true);
				}
			},
			refit() {
				m.resize();
			},
			me(ll, acc, hd) {
				if (!meMk) meMk = new maplibregl.Marker({ element: meDot() }).setLngLat([ll.lng, ll.lat]).addTo(m);
				else meMk.setLngLat([ll.lng, ll.lat]);
				meHead(meMk.getElement(), hd);
				if (mapSel) map.line(mapSel);
			},
			line(p) {
				const data = {
					type: 'FeatureCollection',
					features:
						p && meLL && !farAway()
							? [
									{
										type: 'Feature',
										properties: {},
										geometry: {
											type: 'LineString',
											coordinates: [
												[meLL.lng, meLL.lat],
												[p.lng, p.lat],
											],
										},
									},
								]
							: [],
				};
				try {
					const src = m.getSource('me-line');
					if (src) src.setData(data);
					else if (data.features.length) {
						m.addSource('me-line', { type: 'geojson', data });
						m.addLayer({
							id: 'me-line',
							type: 'line',
							source: 'me-line',
							paint: { 'line-color': '#1a73e8', 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
						});
					}
				} catch {
					/* style still loading */
				}
			},
			center() {
				if (meLL) m.easeTo({ center: [meLL.lng, meLL.lat], zoom: Math.max(m.getZoom(), 15.5), duration: reduce ? 0 : 500 });
			},
		};
		$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === FIRST_VIEW)));
		new ResizeObserver(() => m.resize()).observe(wrap);
		mapReadyNow();
	});
}

// where the reader is: the element just under the sticky header, as a path from its nearest element with an id
// (the markup is the same in both languages, so the same path finds the same element after a re-render)
// keep the reader's place across a full redraw (language, push-back, added stops): an element near the top of the screen,
// which folded groups were open (by their nearest id, so build-on-open lists reopen too), and every section's height
function spotNow() {
	const y0 = Math.min(innerHeight - 2, $('.bar').getBoundingClientRect().bottom + 48);
	const hit = (y) =>
		document.elementsFromPoint(innerWidth / 2, Math.min(innerHeight - 2, y)).find((x) => x.closest('#app') && !x.closest('.day-bar'));
	let el = null;
	for (let dy = 0; dy <= 240 && !(el && !el.matches('#app > section')); dy += 24) el = hit(y0 + dy) || el; // a gap between blocks hits the section itself: look a little lower
	if (!el) return null;
	const mw = el.closest('.map-wrap');
	if (mw) el = mw; // the live map is rebuilt later: hold on to its frame
	const host = el.closest('#app [id]');
	if (!host) return null;
	const path = [];
	for (let n = el; n !== host; n = n.parentElement) path.unshift([...n.parentElement.children].indexOf(n)); // child indices from the host down
	const open = $$('#app details[open]')
		.map((d) => {
			const h = d.parentElement.closest('[id]');
			return h ? [h.id, $$('details', h).indexOf(d)] : null;
		})
		.filter(Boolean);
	const sizes = $$('#app > section').map((x) => [x.id, Math.round(x.getBoundingClientRect().height)]);
	return { id: host.id, path, top: el.getBoundingClientRect().top, open, sizes };
}
function spotRestore(sp) {
	if (!sp) return;
	// the new sections start at the old heights, so sections not drawn yet (content-visibility) don't shift the page while they draw
	sp.sizes.forEach(([id, h]) => {
		const x = document.getElementById(id);
		if (x && h) x.style.containIntrinsicSize = `auto ${h}px`;
	});
	sp.open.forEach(([hid, i]) => {
		const h = document.getElementById(hid) || lazyFor(hid);
		const d = h && $$('details', h)[i];
		if (d && !d.open) {
			d.open = true;
			lazyFill(d);
		}
	});
	const host = document.getElementById(sp.id) || lazyFor(sp.id);
	if (!host) return;
	let el = host;
	for (const i of sp.path) {
		const c = el.children[i];
		if (!c) break;
		el = c;
	}
	while (el !== host && !el.getClientRects().length) el = el.parentElement; // folded away now: its nearest visible parent
	window.scrollBy({ top: el.getBoundingClientRect().top - sp.top, behavior: 'instant' });
	// sections above can still finish drawing (content-visibility), the map or fonts can load, a browser extension can force
	// a layout: for 2 s keep the same element at the same height on screen, until the person touches or scrolls
	const token = ++pinN;
	const t0 = performance.now();
	let took = false;
	const IN = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
	const mine = () => {
		took = true;
	};
	IN.forEach((ev) => addEventListener(ev, mine, { passive: true }));
	let lastY = window.scrollY,
		lastTop = el.getBoundingClientRect().top;
	const pin = () => {
		if (took || token !== pinN || !el.isConnected || performance.now() - t0 > 2000) {
			IN.forEach((ev) => removeEventListener(ev, mine));
			return;
		}
		const y = window.scrollY,
			top = el.getBoundingClientRect().top;
		if (Math.abs(y - lastY) > 2 && Math.abs(top - lastTop + (y - lastY)) < 2) {
			took = true;
			requestAnimationFrame(pin);
			return;
		} // someone scrolled on purpose: let go
		const d = top - sp.top;
		if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: 'instant' }); // content above grew or shrank: hold the spot
		lastY = window.scrollY;
		lastTop = el.getBoundingClientRect().top;
		requestAnimationFrame(pin);
	};
	requestAnimationFrame(pin);
}
let pinN = 0;
