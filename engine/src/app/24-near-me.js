/* ───────── 附近吃什么: nearest options open today for a meal, measured from the phone (location never leaves it) ───────── */
const mealNow = () => {
	const m = tpNow().mins;
	return m < 300 ? 'supper' : m < 630 ? 'breakfast' : m < 900 ? 'lunch' : m < 1230 ? 'dinner' : 'supper';
};
let near = { meal: null, from: null, label: '', gps: false, note: '' };
function nearItems(from, meal, date) {
	if (meal === 'wc') {
		// public toilets + planned places with their own + shops that lend theirs
		const seen = new Set();
		const out = [];
		const add = (gpid, x) => {
			if (gpid && seen.has(gpid)) return;
			if (gpid) seen.add(gpid);
			out.push({ wish: false, meals: ['wc'], closed: false, rating: null, href: '', ...x });
		};
		TOILETS.wc.forEach((w) =>
			add(w.gpid, { name: wcName(w), meta: Z('公厕', 'Public toilet'), lat: w.lat, lng: w.lng, q: `${w.n_trad} ${w.lat},${w.lng}` }),
		);
		Object.entries(GEO.places || {}).forEach(([k, g]) => {
			if (PLACES[k] && g.lat && rrOf(g.gpid)[0] === 1)
				add(g.gpid, { name: L(PLACES[k].name), meta: Z('场内有厕所', 'Toilets inside'), lat: g.lat, lng: g.lng, q: PLACES[k].maps });
		});
		Object.values(TOILETS.borrow)
			.flat()
			.forEach((b) =>
				add(b.gpid, {
					name: lang === 'en' ? b.n_trad : b.n_zh,
					meta: Z('店家可借用（先买点东西）', 'Shop toilet: buy something first'),
					lat: b.lat,
					lng: b.lng,
					q: `${b.n_trad} ${b.lat},${b.lng}`,
				}),
			);
		return out.map((x) => ({ ...x, k: km(from, x) })).sort((a, b) => a.k - b.k);
	}
	if (meal === 'drink' || meal === 'rest') {
		const rest = meal === 'rest';
		const dr = DRINKS.filter((x) => isRest(x) === rest).map((x) => ({
			wish: false,
			name: `${drinkName(x)}`,
			meta: lang === 'en' ? x.tip_en : x.tip_zh,
			lat: x.lat,
			lng: x.lng,
			meals: [meal],
			closed: !!date && (x.closed_dates || []).includes(date),
			hours: lang === 'en' ? x.hours_en : x.hours_zh,
			rating: x.rating,
			q: `${x.name_trad} ${x.address_trad || ''}`,
			href: `#${x.id}`,
		}));
		const wd = WISH.filter((w) => w.status !== 'closed' && w.kind === (rest ? 'dessert' : 'drink'))
			.map((w) => {
				const br = wBest(w);
				return br && br.lat
					? {
							wish: true,
							name: wName(w),
							meta: lang === 'en' ? w.order_en : w.order_zh,
							lat: +br.lat,
							lng: +br.lng,
							meals: [meal],
							closed: !!date && (br.closed_dates || []).includes(date),
							hours: lang === 'en' ? br.hours_en : br.hours_zh,
							q: wQuery(br, w),
							href: `#wish-${w.id}`,
						}
					: null;
			})
			.filter(Boolean);
		return [...dr, ...wd].map((x) => ({ ...x, k: km(from, x) })).sort((a, b) => a.k - b.k);
	}
	const food = (EXTRA.food || [])
		.filter((f) => f.lat && f.lng)
		.map((f) => ({
			wish: false,
			name: lang === 'en' ? f.name_en || f.name_trad : f.name_zh || f.name_trad,
			meta: lang === 'en' ? f.dish_en : f.dish_zh,
			lat: +f.lat,
			lng: +f.lng,
			meals: mealsOf(f),
			closed: !!f.paused || (!!date && (f.closed_dates || []).includes(date)),
			hours: lang === 'en' ? f.hours_en : f.hours_zh,
			rating: f.rating,
			href: '#' + foodId(f),
			q: f.maps_query || f.address_trad,
		}));
	const wish = WISH.filter((w) => w.status !== 'closed' && WISH_FOOD.has(w.kind))
		.map((w) => {
			const br = wBest(w);
			return br && br.lat
				? {
						wish: true,
						name: wName(w),
						meta: lang === 'en' ? w.order_en : w.order_zh,
						lat: +br.lat,
						lng: +br.lng,
						meals: w.meals || ['snack'],
						closed: !!date && (br.closed_dates || []).includes(date),
						hours: lang === 'en' ? br.hours_en : br.hours_zh,
						rating: w.rating,
						href: '#wish-' + w.id,
						q: wQuery(br, w),
					}
				: null;
		})
		.filter(Boolean);
	return [...food, ...wish]
		.filter((x) => x.meals.includes(meal))
		.map((x) => ({ ...x, k: km(from, x) }))
		.sort((a, b) => a.k - b.k);
}
function renderNear() {
	const box = $('#near-in');
	if (!box) return;
	const now = tpNow();
	const date = TRIP_DATES.includes(now.date) ? now.date : null;
	const meal = near.meal || mealNow();
	const tabs = Object.keys(MEAL_NAMES)
		.map((m) => `<button type="button" class="seg-btn" data-near-meal="${m}" aria-pressed="${m === meal}">${esc(L(MEAL_NAMES[m]))}</button>`)
		.join('');
	let body = `<p class="small muted">${esc(near.note || Z('正在取得你的位置…', 'Finding where you are…'))}</p>`;
	if (near.from) {
		const all = nearItems(near.from, meal, date);
		const open = all.filter((x) => !x.closed);
		const hidden = all.length - open.length;
		const close = open.filter((x) => x.k <= 2.5).slice(0, 12);
		const list = close.length ? close : open.slice(0, 6);
		const origin = near.gps ? `${near.from.lat},${near.from.lng}` : undefined;
		body = `${close.length ? '' : `<p class="small muted">${Z('2.5 公里内没有这一类，下面是最近的几家。', 'None within 2.5 km; nearest shown.')}</p>`}
        <ul class="near-list">${list
					.map(
						(
							x,
						) => `<li class="near-row"><div class="near-top">${x.href ? `<a class="near-name" href="${x.href}">` : '<span class="near-name">'}${x.wish ? `<span class="near-tag">${Z('想去', 'Wish')}</span>` : ''}${esc(x.name)}${x.href ? '</a>' : '</span>'}<span class="near-dist">${distLabel(x.k)}${x.k < 3 ? ` · ${Z('走路约', 'walk ~')}${Math.max(1, Math.round((x.k * 1300) / 70))}${Z('分钟', ' min')}` : ''}</span></div>
          ${x.meta ? `<p class="xsmall">${esc(x.meta)}${x.rating ? ` · ★${esc(x.rating)}` : ''}</p>` : ''}${x.hours ? `<p class="xsmall">${icon('clock')} ${esc(x.hours)}</p>` : ''}
          <div class="links-row">${ext(gmDir(x.q, x.k < 1.5 ? 'walking' : 'transit', origin), Z('怎么去', 'Directions'), 'route')}${x.href ? `<a class="mlink" href="${x.href}">${icon('info')}${Z('详情', 'Details')}</a>` : ''}</div></li>`,
					)
					.join('')}</ul>
        ${hidden ? `<p class="xsmall">${Z(`今天有 ${hidden} 家休息，已经不列出来。`, `${hidden} closed today and left out.`)}</p>` : ''}`;
	}
	const starts = [...new Set([...HOTELS, ...DAYS.flatMap((d) => d.schedule.map((it) => it.place).filter(Boolean))])].filter(
		(pid) => placeLL(pid) && PLACES[pid],
	);
	box.innerHTML = `<div class="toc-head"><h2 id="near-h">${meal === 'wc' ? Z('附近厕所', 'Toilets near me') : meal === 'drink' ? Z('附近饮料', 'Drinks near me') : meal === 'rest' ? Z('附近坐下歇脚', 'Sit & rest near me') : Z('附近吃什么', 'Food near me')}</h2><button type="button" class="icon-btn" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button></div>
      ${near.from ? `<p class="small">${icon('pin')} ${Z('起点：', 'From: ')}${esc(near.label)}</p>` : ''}
      ${near.far ? `<p class="near-far">${icon('info')}<span>${esc(Z(`你现在不在${CITY[0]}，所以距离先从酒店算。到了${CITY[0]}会自动用你的位置。`, `You’re not in ${CITY[1]} yet, so distances start from the hotel. Once you’re there, it uses where you are.`))}</span></p>` : ''}
      <div class="map-ctrl near-meals" role="group" aria-label="${Z('哪一餐', 'Which meal')}">${tabs}</div>
      ${body}
      <details class="more"><summary>${icon('pin')}${Z('换一个起点', 'Start from somewhere else')}${icon('chev', 'chev')}</summary><div class="more-body"><div class="pills">${`<button type="button" class="tag pinbtn" data-near-gps>${Z('我的位置', 'My location')}</button>`}${starts.map((pid) => `<button type="button" class="tag pinbtn" data-near-from="${pid}">${esc(L(PLACES[pid].name))}</button>`).join('')}</div></div></details>
      <p class="xsmall">${Z('位置只在本机算距离，不上传。距离为直线，步行时间为估计。', 'Location used on this phone only for distance; never uploaded. Straight-line distances; walking times estimated.')}</p>`;
}
function nearFrom(pid, why) {
	near.from = placeLL(pid);
	near.gps = false;
	near.label = `${L(PLACES[pid].name)}${why ? `（${why}）` : ''}`;
	renderNear();
}
// no GPS: start from where the plan says we are right now (during the trip), else the hotel
function nearFallback(why) {
	const now = tpNow();
	const day = DAYS.find((d) => d.date === now.date);
	let k = hotelNow();
	if (day && GEO && GEO.places) {
		// the nearest stop (in plan order) that has a known place
		const { cur, next } = nowNext(day, now.mins);
		const i0 = (cur || next || { i: -1 }).i;
		const cand = day.schedule
			.map((it, i) => ({ it, i }))
			.filter((x) => x.it.place && GEO.places[x.it.place])
			.sort((a, b) => Math.abs(a.i - i0) - Math.abs(b.i - i0) || a.i - b.i);
		if (i0 >= 0 && cand.length) k = cand[0].it.place;
	}
	nearFrom(k, `${why}${isHotel(k) ? Z('，先用酒店', '; using the hotel') : Z('，按行程所在地', '; using where the plan has us')}`);
}
function nearLocate() {
	near.note = '';
	near.from = null;
	near.far = false;
	renderNear();
	if (!navigator.geolocation) {
		nearFallback(Z('这个浏览器不能定位', 'this browser cannot share location'));
		return;
	}
	const wait = setTimeout(() => {
		if (!near.from && $('#near').open) nearFallback(Z('定位太久（允许定位后会自动更新）', 'location slow (updates when it arrives)'));
	}, 12000);
	navigator.geolocation.getCurrentPosition(
		(pos) => {
			clearTimeout(wait);
			if (geoState !== 'granted') {
				geoState = 'granted';
				renderNow(); // the location card in the "now" box goes as soon as the answer is yes
			}
			const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
			if (
				HOTELS.map(placeLL)
					.filter(Boolean)
					.every((h) => km(here, h) > 60)
			) {
				near.far = true;
				nearFrom(hotelNow());
				return;
			}
			near.from = here;
			meLL = here;
			near.gps = true;
			near.label = Z('你现在的位置', 'where you are now');
			renderNear();
		},
		(err) => {
			clearTimeout(wait);
			nearFallback(Z('没有定位权限', 'location is off'));
			if (err && err.code === 1 && geoState !== 'denied') {
				geoState = 'denied';
				renderNow();
			}
		},
		{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
	);
}
function openNear(meal) {
	near = { meal: meal || null, from: null, label: '', gps: false, note: '' };
	openDialog($('#near'));
	nearLocate();
}
