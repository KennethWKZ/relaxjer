/* ───────── live location: a pulsing dot that follows the phone while the page is open (the position never leaves the phone) ───────── */
let meWatch = null;
let meAcc = 0;
let lateAt = null;
let meHd = null;
let meResume = false;
let meCardAt = null;
let mapSel = null;
/* what the map's results box shows: the page's own places ('list') or a Google search ('google'). A location fix or a
   filter the page applies itself refreshes distances and counts in it, never swaps it: only a new query, Back, or a
   category or day the person picks does (the Google results once vanished under the next location fix) */
let mapView = 'list';
let gQuery = '';
let mapPinsOff = null; // the pins to search before the live map has made its own (offline, or not scrolled to yet)
let shopFinds = null; // the shop box's shops (shops.json), which have no pin: found by a search, for the finder
const meOnce = [];
function meGot(pos) {
	geoState = 'granted';
	meLL = { lat: pos.coords.latitude, lng: pos.coords.longitude };
	meAcc = pos.coords.accuracy || 0;
	geoFix(meAcc);
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
		(err) => {
			if (meWatch != null) navigator.geolocation.clearWatch(meWatch);
			meWatch = null;
			meOnce.length = 0;
			if (err && err.code === 1 && geoState !== 'denied') {
				geoState = 'denied';
				renderNow();
			}
			if (!quiet) {
				toast(Z('没法取得位置：请允许定位权限', 'Location unavailable; allow access'));
				renderNow(); // a busy "Finding you…" button comes back as a button
			}
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
/* asking for location: a card in the "now" box says why before the browser asks, and comes back when the phone
   forgets the answer (Safari on iPhone does, so a one-time "Allow" is not enough to keep the late check working) */
// pending (asking the browser) | unknown (it can't say) | prompt | granted | denied | none (no GPS in this browser)
let geoState = !navigator.geolocation ? 'none' : navigator.permissions ? 'pending' : 'unknown';
function geoWatch() {
	if (!navigator.geolocation) return;
	const tripDay = DAYS.some((d) => d.date === tpNow().date);
	try {
		navigator.permissions
			.query({ name: 'geolocation' })
			.then((r) => {
				const set = () => {
					const was = geoState;
					geoState = r.state;
					if (store.get('geoSeen', null) !== r.state) store.set('geoSeen', r.state);
					if (r.state === 'granted' && tripDay) locateMe(null, true); // follow the phone; never asks by itself
					if (geoState !== was) renderNow();
				};
				set();
				r.onchange = set;
			})
			.catch(() => {
				geoState = 'unknown';
				renderNow();
			});
	} catch {
		geoState = 'unknown'; // no Permissions API: the card stays until a tap gets a position
	}
}
/* approximate location (Android's "Approximate", iPhone's Precise Location off) is off by a kilometre or two: the map
   dot still shows, but the late check needs ~400 m and stays silent, so say so once the fixes stay that coarse */
let geoBest = Infinity;
let geoFixes = 0;
let geoFirstAt = 0;
let geoCoarse = false;
function geoFix(acc) {
	if (!store.get('geoOk', false)) store.set('geoOk', true); // this phone said yes once: a later ask means it forgot
	if (!(acc > 0)) return;
	geoBest = Math.min(geoBest, acc);
	if (++geoFixes === 1) {
		geoFirstAt = Date.now();
		setTimeout(geoCoarseSync, 30000); // an approximate position rarely updates: judge it after 30 s as well
	}
	geoCoarseSync();
}
// judged after 3 fixes or 30 s, so the first rough fix while the GPS warms up doesn't raise it
function geoCoarseSync() {
	if (geoFixes < 3 && Date.now() - geoFirstAt < 29500) return;
	const coarse = geoBest > 1000;
	if (coarse === geoCoarse) return;
	geoCoarse = coarse;
	renderNow();
}
// a location button while the phone looks for a fix: disabled, marked busy, and saying so
function geoBusy(b) {
	b.disabled = true;
	b.setAttribute('aria-busy', 'true');
	b.innerHTML = `${icon('pin')}${Z('正在定位…', 'Finding you…')}`;
}
function geoAsk() {
	if (window.DEMO_CLOCK) return ''; // a live-demo visitor isn't on the trip: where they are can't say if the group is late
	if (hintState('geo') === 'gone') return '';
	// a repeated hint (ADR-20261128-progressive-disclosure): in full the first time on this phone (what it does, where the
	// position stays, the button), then one row (a pin, a few words, the button, ✕); ✕ puts it away for good, and
	// Location in More's settings turns it on from there. A phone that keeps forgetting gets its reason the same way
	const card = (title, text, action, short, act) =>
		hint('geo') === 'full'
			? `<div class="geo-ask is-full"><p class="geo-l">${icon('pin')}<span>${title}</span></p>${text ? `<p class="geo-why">${text}</p>` : ''}${action}${geoX()}</div>`
			: `<div class="geo-ask is-line"><p class="geo-l">${icon('pin')}<span>${short}</span></p>${act}${geoX()}</div>`;
	const help = (kind, short) =>
		`<button type="button" class="go-btn" data-geo-help${kind ? `="${kind}"` : ''}${short ? ` aria-label="${Z('怎么打开', 'How to turn it on')}"` : ''}>${icon('info')}${short ? Z('怎么开', 'How') : Z('怎么打开', 'How to turn it on')}</button>`;
	const turnOn = `<button type="button" class="go-btn" data-geo-on>${icon('pin')}${Z('打开定位', 'Turn on location')}</button>`;
	const turnOnShort = `<button type="button" class="go-btn" data-geo-on aria-label="${Z('打开定位', 'Turn on location')}">${icon('pin')}${Z('打开', 'Turn on')}</button>`;
	// until the browser answers, go by this phone's last answer (geoWatch keeps it), so the card is there from the first
	// paint instead of pushing the page down a moment after it opens
	const st = geoState === 'pending' ? store.get('geoSeen', 'pending') : geoState;
	if (st === 'granted' && geoCoarse)
		return card(
			Z('位置只有大概：打开精确位置', 'Location is only approximate: turn on Precise'),
			'',
			help('precise'),
			Z('位置只有大概', 'Only approximate'),
			help('precise', true),
		);
	if (['none', 'pending', 'granted'].includes(st) || meLL) return '';
	if (st === 'denied')
		return card(
			Z('定位关着：打开后晚了会提醒你', 'Location is off: turn it on to hear when you’re late'),
			'',
			help(),
			Z('定位关着', 'Location is off'),
			help('', true),
		);
	// said yes before, asked again: the phone forgot (Safari on "Ask", or Chrome's "Only this time")
	if (store.get('geoOk', false))
		return card(
			Z('手机又在问定位了', 'Your phone is asking for location again'),
			isIOS()
				? Z(
						'iPhone 关掉页面后会忘记。想以后不再问：<b>设置 → App → Safari 浏览器 → 位置 → 允许</b>。',
						'iPhone forgets once the page is closed. To stop it asking: <b>Settings → Apps → Safari → Location → Allow</b>.',
					)
				: isAndroid()
					? Z(
							'可能上次选了「仅限这一次」。下次选<b>「访问该网站时允许」</b>，就不会再问。',
							'Maybe last time was “Only this time”. Pick <b>“While visiting the site”</b> next time and it won’t ask again.',
						)
					: Z('浏览器没有记住上次的选择。', 'The browser didn’t keep last time’s answer.'),
			turnOn,
			Z('手机又在问定位', 'Asked again'),
			turnOnShort,
		);
	return card(
		Z('打开定位，晚了会提醒你', 'Turn on location to hear when you’re running late'),
		Z('位置只留在这台手机，不会传出去；地图也会标出你在哪。', 'It stays on this phone and is never sent anywhere; the map shows where you are too.'),
		turnOn,
		Z('晚了会提醒你', 'Late alerts'),
		turnOnShort,
	);
}
// its ✕: away for good on this phone (Location in More's settings still turns it on)
const geoX = () =>
	`<button type="button" class="icon-btn geo-x" data-geo-no aria-label="${Z('不再提示（设置里还能打开）', 'Don’t show again (Settings still has it)')}">${icon('x')}</button>`;
// Location as a row of the settings (23-sections-menu.js): while it isn't on, on a phone that can, outside the demo
const geoRow = () =>
	navigator.geolocation && !window.DEMO_CLOCK && geoState !== 'granted' && !meLL
		? actRow(
				'toc-geo',
				'data-geo-row',
				'pin',
				Z('打开定位', 'Turn on location'),
				Z('晚了会提醒你，位置只留在这台手机', 'Late alerts; it stays on this phone'),
			)
		: '';
function geoHelp(kind) {
	const ios = isIOS();
	if (kind === 'precise') {
		const steps = ios
			? [
					Z(
						'打开<b>「设置」→「隐私与安全性」→「定位服务」→「Safari 浏览器网站」</b>',
						'Open <b>Settings → Privacy &amp; Security → Location Services → Safari Websites</b>',
					),
					Z('打开<b>「精确位置」</b>', 'Turn on <b>Precise Location</b>'),
				]
			: isAndroid()
				? [
						Z(
							'打开手机<b>「设置」→「应用」→「Chrome」→「权限」→「位置」</b>',
							'Open the phone’s <b>Settings → Apps → Chrome → Permissions → Location</b>',
						),
						Z('打开<b>「使用精确位置」</b>', 'Turn on <b>Use precise location</b>'),
					]
				: [Z('电脑只能给出大概位置；出门时用手机看这个页面', 'A computer can only give a rough position; use a phone when you’re out')];
		openSheet(`<div class="home-guide"><p class="pop-name">${icon('pin')}${Z('打开精确位置', 'Turn on precise location')}</p>
      <ol class="home-steps">${steps.map((x) => `<li>${x}</li>`).join('')}</ol>
      <p class="small">${Z('回到这个页面，过一会儿就会用准确的位置。', 'Come back to this page; it switches to the exact position in a moment.')}</p></div>`);
		return;
	}
	const steps = ios
		? [
				Z(
					'打开手机的<b>「设置」→「隐私与安全性」→「定位服务」</b>：要开着，里面的<b>「Safari 浏览器网站」</b>选「使用 App 期间」',
					'Open <b>Settings → Privacy &amp; Security → Location Services</b>: keep it on, and set <b>Safari Websites</b> to “While Using the App”',
				),
				Z(
					'回到<b>「设置」→「App」→「Safari 浏览器」→「位置」</b>，选<b>「允许」</b>或「询问」',
					'Then <b>Settings → Apps → Safari → Location</b>: pick <b>Allow</b> or Ask',
				),
				Z('有网络时，重新打开这个页面', 'With internet, open this page again'),
			]
		: isAndroid()
			? [
					Z(
						'在 Chrome 点网址左边的图标 →<b>「权限」→「位置」</b>，选<b>「允许」</b>',
						'In Chrome, tap the icon left of the address → <b>Permissions → Location</b> → <b>Allow</b>',
					),
					Z(
						'从主画面图标打开的？先用 Chrome 打开这个页面再做上一步',
						'Opened it from the home-screen icon? Open this page in Chrome and do the step above',
					),
					Z('手机本身的<b>「位置」</b>也要开着（从屏幕顶部往下滑）', 'The phone’s own <b>Location</b> must be on too (swipe down from the top)'),
				]
			: [
					Z('点网址左边的图标 →<b>「位置」</b>，选<b>「允许」</b>', 'Click the icon left of the address → <b>Location</b> → <b>Allow</b>'),
					Z('重新打开这个页面', 'Open this page again'),
				];
	openSheet(`<div class="home-guide"><p class="pop-name">${icon('pin')}${Z('打开定位', 'Turn on location')}</p>
      <ol class="home-steps">${steps.map((x) => `<li>${x}</li>`).join('')}</ol>
      <p class="small">${Z('位置只用来在地图上显示你、检查行程进度，不会传出这台设备。', 'Your position is only used to show you on the map and check the plan; it never leaves this device.')}</p></div>`);
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
	['refill', ['装水', 'Refill']],
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
	refill: ['装水点', 'Refill'],
	mrt: [`${METRO[0]}站`, Cap(METRO[1])],
	bike: [BIKES[0], Cap(BIKES[1])],
	bus: ['公车站', 'Bus stop'],
	mine: ['我加的', 'Added by me'],
	buy: ['购物', 'Shopping'],
};
const PIN_RANK = { mine: 0, hotel: 0, place: 1, shop: 2, buy: 2, food: 3, wish: 4, rest: 5, drink: 6, wc: 7, refill: 8, mrt: 9, bike: 10, bus: 11 };
// category: 'all' leaves out drinks / rest / toilets / refill (too many pins); a day keeps only that day's pins (+ hotel, + MRT by the hotel)
const catOK = (p, c) =>
	c === 'all'
		? !['drink', 'rest', 'wc', 'refill', 'bike', 'bus'].includes(p.type) && !(p.type === 'mrt' && !(p.serves || []).length)
		: c === 'place'
			? ['place', 'shop', 'hotel', 'mine'].includes(p.type)
			: p.type === c;
// transport, toilets and refill are about where you are, not which day: their own category ignores the day buttons
const dayOK = (p, d) =>
	d === 'all' ||
	p.days.includes(d) ||
	p.type === 'hotel' ||
	!!p.always ||
	(['mrt', 'bike', 'bus', 'wc', 'refill'].includes(p.type) && mapCat === p.type);
const pinShown = (p) => catOK(p, mapCat) && dayOK(p, mapDay);
// a pin of another day while one day is picked: still drawn, but quieter (ADR-20261128-progressive-disclosure), so the
// day's own pins stand out and the rest of the trip stays in sight; the list and the count keep to the day
const pinQuiet = (p) => mapDay !== 'all' && p.days.length > 0 && catOK(p, mapCat) && !dayOK(p, mapDay);
const inFilter = (p, f) =>
	p.drink || p.wc || p.refill
		? f === p.type || (f !== 'all' && p.days.includes(f))
		: f === 'all' ||
			(f === 'food'
				? p.type === 'food'
				: f === 'wish'
					? p.type === 'wish'
					: ['drink', 'rest', 'wc', 'refill'].includes(f)
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
		p.refill && [p.refill.name, p.refill.address, '装水 加水 饮水 饮水机 water refill fountain tap bottle 給水'],
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
// the phone's location is on and near the trip: a tapped pin is then framed with it (pick, 18-map-google.js too)
const meNear = () => !!meLL && !farAway();
// every place the map's search knows: the map's pins, built from the trip's data even while the live map can't load
const mapPool = () => (mapPins.length ? mapPins : (mapPinsOff = mapPinsOff || buildPins()));
// and, for a search, the shop box's shops (supermarkets, pharmacies), which the map draws no pin for
const shopPool = () =>
	shopFinds ||
	(shopFinds = SHOPS.filter((x) => x.lat != null && x.lng != null).map((x) => ({
		pid: `buy-${x.id}`,
		sid: x.id,
		type: 'buy',
		lat: +x.lat,
		lng: +x.lng,
		days: [],
		name: lang === 'en' ? x.name_en || x.name_trad : x.name_zh || x.name_trad,
		q: `${x.name_trad} ${x.addr || ''}`,
		hay: [x.name_trad, x.name_zh, x.name_en, '购物 shopping shop'].filter(Boolean).join(' ').toLowerCase(),
	})));
const findPool = () => mapPool().concat(shopPool());
function mapMatches() {
	const q = ($('#mapq') || {}).value ? $('#mapq').value.trim().toLowerCase() : '';
	const words = q.split(/\s+/).filter(Boolean);
	// typing with category 全部 also finds drinks / rest / toilets (hidden on the map until picked)
	let list = (q ? findPool() : mapPool()).filter(
		(p) => (q && mapCat === 'all' ? true : catOK(p, mapCat)) && dayOK(p, mapDay) && words.every((w) => hayOf(p).includes(w)),
	);
	const byDist = mapNear && meLL && !farAway();
	list = list.map((p) => ({ p, k: meLL && !farAway() ? km(meLL, p) : null }));
	list.sort((a, b) => (byDist ? a.k - b.k : PIN_RANK[a.p.type] - PIN_RANK[b.p.type] || a.p.name.localeCompare(b.p.name, 'zh')));
	return { q, list };
}
// the results list as last drawn: its markup, the same with its distances left out, and its first element (so a list
// another view drew over since, such as Google's results, is never taken for it)
let resLast = null;
function mapListSync() {
	const box = $('#mapres');
	const n = $('#mapn');
	if (!box) return;
	const { q, list } = mapMatches();
	if (n) n.textContent = String(list.length);
	if (box.hidden) return;
	// Google's results stay until the person moves on: only their distances follow the phone
	if (mapView === 'google') {
		paneTitle(Z('Google 的结果', 'Google results'));
		return gDistSync(box);
	}
	paneTitle(list.length ? Z(`${list.length} 个地点`, list.length === 1 ? '1 place' : `${list.length} places`) : Z('没有找到', 'Nothing found'));
	const y = box.scrollTop;
	const row = ({ p, k }) =>
		`<li><button type="button" class="mres" data-mres="${esc(p.pid)}"><span class="mres-ic" aria-hidden="true">${pinSVG(p)}</span><span class="mres-b"><span class="mres-n">${esc(p.name)}</span><span class="mres-m">${esc(L(p.kind || PIN_KIND[p.type] || ['', '']))}${p.days
			.slice(0, 2)
			.map((d) => ` · Day ${dayById[d] ? dayById[d].n : ''}`)
			.join('')}</span></span>${k != null ? `<span class="mres-d">${distLabel(k)}</span>` : ''}</button></li>`;
	// the count is the pane's title (paneTitle); this head keeps the sort, and says what to try when nothing matches
	const head = `<div class="mres-h">${list.length ? `<span class="mres-hn">${Z('排序', 'Sort')}</span><span class="mres-seg" role="group" aria-label="${Z('排序', 'Sort')}"><button type="button" class="seg-btn" data-mapsort="type" aria-pressed="${!mapNear}">${Z('按类别', 'By type')}</button><button type="button" class="seg-btn" data-mapsort="near" aria-pressed="${mapNear}">${icon('pin')}${Z('离我最近', 'Nearest')}</button></span>` : `<span class="mres-hn">${Z('换个字试试，或在日期按钮选「全部天」', 'Try other words, or “All days” on the day button')}</span>`}</div>${mapNear && farAway() ? `<p class="mres-far">${icon('info')}${Z(`你现在不在${CITY[0]}，到了${CITY[0]}再按距离排。`, `You're not in ${CITY[1]} yet; distance sort works once you're there.`)}</p>` : ''}`;
	const gq =
		q.length >= 2 && window.google && google.maps && google.maps.importLibrary
			? `<button type="button" class="mres gq" data-gsearch>${icon('search')}<span class="mres-b"><span class="mres-n">${esc(Z(`在 Google 搜「${q}」`, `Search Google for "${q}"`))}</span><span class="mres-m">${Z('页面里没有的地方也能找，还能加入行程', 'Find places the page does not have, and add them to the plan')}</span></span></button>`
			: '';
	const html =
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
	// a location fix mostly changes nothing on the list, or only its distances: keep the rows then, so a tap in flight
	// still lands on its button (a rebuild swapped every button out under it); rebuild when the rows themselves change
	const shape = html.replace(/(<span class="mres-d">)[^<]*(<\/span>)/g, '$1$2');
	if (resLast && box.firstElementChild && resLast.first === box.firstElementChild) {
		if (resLast.html === html) return;
		if (resLast.shape === shape) {
			const labels = list
				.slice(0, 80)
				.filter((x) => x.k != null)
				.map((x) => distLabel(x.k));
			box.querySelectorAll('.mres-list .mres-d').forEach((el, i) => {
				if (el.textContent !== labels[i]) el.textContent = labels[i];
			});
			resLast.html = html;
			return;
		}
	}
	box.innerHTML = html;
	box.scrollTop = y;
	ybFill(box);
	resLast = { html, shape, first: box.firstElementChild };
}
async function gSearch(q) {
	const box = $('#mapres');
	if (!box) return;
	mapView = 'google';
	gQuery = q;
	paneTitle(Z('Google 的结果', 'Google results'));
	box.innerHTML = `<div class="mres-h"><span>${esc(Z(`Google：「${q}」`, `Google: "${q}"`))}</span><button type="button" class="mlink" data-gback>${icon('arrow', 'flip')}${Z('回到页面结果', 'Back to page results')}</button></div><p class="xsmall muted mres-wait">${Z('搜索中…', 'Searching…')}</p>`;
	box.scrollTop = 0;
	let found;
	try {
		found = await gTextSearch(q);
	} catch {
		found = null;
	}
	if (mapView !== 'google' || gQuery !== q || !box.isConnected) return; // the person moved on meanwhile
	const p = box.querySelector('.mres-wait');
	if (!p) return;
	if (!found) {
		p.textContent = Z('现在连不上 Google（网络？）', "Can't reach Google right now (network?)");
		return;
	}
	p.outerHTML = found.length
		? `<ul class="mres-list">${found
				.map(
					(g) =>
						`<li><button type="button" class="mres" data-gfind="${esc(g.gpid)}" data-gll="${g.lat},${g.lng}"><span class="mres-ic" aria-hidden="true">${icon('search')}</span><span class="mres-b"><span class="mres-n">${esc(g.n)}</span><span class="mres-m">${esc(g.addr)}</span></span><span class="mres-d" data-gdist></span></button></li>`,
				)
				.join('')}</ul>`
		: `<p class="xsmall muted mres-wait">${Z('Google 也没找到：换个名字试试', 'Nothing on Google either: try another name')}</p>`;
	gDistSync(box);
}
// a Google result's distance from the phone, kept up to date in place
function gDistSync(box) {
	const here = meLL && !farAway() ? meLL : null;
	box.querySelectorAll('[data-gll]').forEach((b) => {
		const [lat, lng] = b.dataset.gll.split(',').map(Number);
		const d = b.querySelector('[data-gdist]');
		if (d) d.textContent = here ? distLabel(km(here, { lat, lng })) : '';
	});
}
function mapListOpenYb() {
	const box = $('#mapres');
	if (box && !box.hidden) ybFill(box);
}
function mapListOpen(on) {
	const box = $('#mapres');
	const b = $('[data-maplist]');
	if (!box) return;
	if (on && finderAt) finderReset(); // the list the person asked for takes the finder's place
	box.hidden = !on;
	if (b) b.setAttribute('aria-expanded', String(on));
	// the results lie in the pane over the map (16-map.js); closing them closes the pane, unless the finder holds it
	if (on || !finderAt) paneShow(on);
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
	let spotMk = null; // the finder's place without a pin
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
			b.className = p.skipped ? 'lpin lpin-skip' : 'lpin'; // skipped on every day it's on: quieter, still there
			b.dataset.type = p.type;
			b.dataset.pid = p.pid;
			b.dataset.days = p.days.join(' ');
			b.setAttribute('aria-label', p.skipped ? `${p.name} ${Z('（已跳过）', '(skipped)')}` : p.name);
			b.innerHTML = pinSVG(p);
			x.b = b;
			x.mk = new maplibregl.Marker({ element: b, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(m);
			b.addEventListener('click', (ev) => {
				ev.stopPropagation();
				pick(p, false, false, true);
			});
			return x.mk;
		};
		// the camera on a place, in the part of the map the list pane leaves open (paneAim, 16-map.js)
		const aim = (p, zoom) => {
			const o = paneAim();
			m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), zoom), offset: [o.x, o.y], duration: reduce ? 0 : 500 });
		};
		// the finder's place in view with where the group is (frameFrom): the camera fits both into the open part of the
		// map, at street zoom at most so two points close together don't zoom absurdly; next door, or with nothing to
		// frame it with, it aims at the place
		const frame = (p, zoom) => {
			const from = frameFrom();
			if (!from || km(from, p) < 0.1) return aim(p, zoom);
			m.fitBounds(
				[
					[Math.min(from.lng, p.lng), Math.min(from.lat, p.lat)],
					[Math.max(from.lng, p.lng), Math.max(from.lat, p.lat)],
				],
				{ padding: framePad(), maxZoom: 17, duration: reduce ? 0 : 700 },
			);
		};
		// quiet: the place finder shows the place in the pane, so its pin is marked (destMark) without a popup over the
		// map, and the camera frames it. tapped: a pin tapped on the map (a toilet, a station) is marked the same, with its
		// popup, and framed with the phone when its location is on near the trip; never a line (ADR-20261124-map-first-search)
		function pick(p, fly, quiet, tapped) {
			if (sel) {
				sel.classList.remove('sel');
				destUnmark(sel);
			}
			const mm = markers.find((x) => x.p.pid === p.pid);
			sel = mm && mm.b;
			if (sel) sel.classList.add('sel');
			if (sel && quiet) destMark(sel, p.name, nameSide(frameFrom(), p));
			else if (sel && tapped) destMark(sel); // its popup names it: the ring and the halo only
			if (tapped && meNear()) frame(p, 17);
			if (popup) popup.remove();
			popup = null;
			if (!quiet) {
				popup = new maplibregl.Popup({ offset: 16, maxWidth: '290px', closeButton: true, focusAfterOpen: false })
					.setLngLat([p.lng, p.lat])
					.setHTML(popupHTML(p))
					.addTo(m);
				popup.getElement().addEventListener('click', (e) => {
					if (e.target.closest('[data-more]')) openPinSheet(p);
				});
			}
			if (fly) (quiet ? frame : aim)(p, 17);
			mapSel = p;
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
				{ padding: panePad(56), maxZoom: 15.5, duration: reduce ? 0 : 700 },
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
					{ padding: panePad(24), duration: reduce ? 0 : 700 },
				);
				$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === k)));
			},
			filter(f) {
				if (popup) popup.remove();
				if (MAP_CAT_KEYS.includes(f)) mapCat = f;
				else mapDay = f;
				mapListSync();
				const show = (x) => pinShown(x.p);
				markers.forEach((x) => {
					const q = !show(x) && pinQuiet(x.p);
					if (show(x) || q) {
						mkOf(x);
						x.b.style.display = '';
						x.b.classList.toggle('lpin-quiet', q);
					} else if (x.b) x.b.style.display = 'none';
				});
				$$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === mapDay)));
				$$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === mapCat)));
				mapFiltSync();
				if (mapDay !== 'all' || mapCat !== 'all') {
					fitTo(markers.filter((x) => show(x) && x.p.type !== 'hotel').map((x) => x.p));
					$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
				}
			},
			select(pid, quiet) {
				const x = markers.find((mm) => mm.p.pid === pid);
				if (x) {
					mkOf(x);
					x.b.style.display = '';
					pick(x.p, true, quiet);
				}
			},
			refit() {
				m.resize();
			},
			// a place with no pin of its own (a Google result in the finder): one marker of its own, marked as the finder's
			// place, and framed as a pin is
			spot(p) {
				if (spotMk) spotMk.remove();
				spotMk = null;
				if (!p) return;
				if (popup) popup.remove();
				const el = document.createElement('div');
				el.className = 'lpin sel lpin-spot'; // not .spot: that's the toilet and drink list's row, a flex box with a border
				el.title = p.n;
				el.innerHTML = pinSVG({ type: 'mine', days: [] });
				spotMk = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).addTo(m);
				destMark(el, p.n, nameSide(frameFrom(), p));
				frame(p, 16);
			},
			// the finder closed: nothing picked, no mark
			unpick() {
				if (sel) {
					sel.classList.remove('sel');
					destUnmark(sel);
				}
				sel = null;
				if (popup) popup.remove();
				popup = null;
				mapSel = null;
				map.spot(null);
			},
			me(ll, acc, hd) {
				if (!meMk) meMk = new maplibregl.Marker({ element: meDot() }).setLngLat([ll.lng, ll.lat]).addTo(m);
				else meMk.setLngLat([ll.lng, ll.lat]);
				meHead(meMk.getElement(), hd);
			},
			center() {
				if (meLL) m.easeTo({ center: [meLL.lng, meLL.lat], zoom: Math.max(m.getZoom(), 15.5), duration: reduce ? 0 : 500 });
			},
			// a split day's route (07-sections.js splitHTML), dashed in the day's colour
			ride(line, color) {
				const data = {
					type: 'FeatureCollection',
					features:
						line && line.length > 1
							? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map(([lat, lng]) => [lng, lat]) } }]
							: [],
				};
				try {
					const src = m.getSource('ride-line');
					if (src) {
						src.setData(data);
						m.setPaintProperty('ride-line', 'line-color', color);
					} else if (data.features.length) {
						m.addSource('ride-line', { type: 'geojson', data });
						m.addLayer({
							id: 'ride-line',
							type: 'line',
							source: 'ride-line',
							layout: { 'line-cap': 'round', 'line-join': 'round' },
							paint: { 'line-color': color, 'line-width': 4, 'line-dasharray': [1.6, 1.4] },
						});
					}
				} catch {
					/* style still loading */
				}
				if (popup) popup.remove();
				if (data.features.length) fitTo(line.map(([lat, lng]) => ({ lat, lng })));
				$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
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
	// the view it sits in comes back first (20-views.js), as its own step's view
	const v = viewOf(host);
	if (v && v !== curView) {
		showView(v);
		history.replaceState(Object.assign({}, history.state, { view: v }), '');
		// the address names the view again once the page has loaded: WebKit scrolls to the address's #id at load, after
		// this restore, which put the reader back at the top of the view
		const nameIt = () => history.replaceState(history.state, '', `#${v}`);
		if (document.readyState === 'complete') setTimeout(nameIt, 0);
		else addEventListener('load', () => setTimeout(nameIt, 0), { once: true });
	}
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
		// the page moved and the content with it: someone scrolled. Any amount counts: a smooth scroll's first frame moves
		// under 2 px, and correcting it then cancelled the scroll (scroll anchoring moves the page but not the content)
		if (Math.abs(y - lastY) > 0.5 && Math.abs(top - lastTop + (y - lastY)) < 2) {
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
// a reload (the update bar's Update, a pull to refresh) lands where the reader was. The browser's own restore puts back a
// pixel offset before the sections above have drawn at their real height (Chromium skips drawing them), and a tab jump
// left its heading in the address: either landed a day or two away. So the place is saved whenever the page is hidden
// or reloads, and a reload within 30 minutes restores it (25-theme.js) instead.
function spotSave() {
	const sp = spotNow();
	if (sp) store.set('reloadSpot', { ...sp, at: Date.now() });
}
addEventListener('pagehide', spotSave);
document.addEventListener('visibilitychange', () => {
	if (document.hidden) spotSave(); // iPhone Safari doesn't always send pagehide
});
function reloadSpot() {
	const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
	const sp = store.get('reloadSpot', null);
	store.set('reloadSpot', null);
	return nav && nav.type === 'reload' && sp && Date.now() - sp.at < 30 * 60000 ? sp : null;
}
