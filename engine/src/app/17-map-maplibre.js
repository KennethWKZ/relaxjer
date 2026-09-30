/* ───────── live street map (MapLibre + OpenFreeMap); the SVG map stays as fallback ───────── */
const LIVE = {
	js: 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.0/maplibre-gl.js',
	css: 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.24.0/maplibre-gl.css',
	light: 'https://tiles.openfreemap.org/styles/liberty',
	dark: 'https://tiles.openfreemap.org/styles/dark',
};
let live = null;
let liveArmed = false;
let liveFailed = false;
let liveDark = null;
let liveRaster = false;
const isDark = () => {
	const t = document.documentElement.dataset.theme;
	return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
const loadTag = (tag, attrs) =>
	new Promise((res, rej) => {
		if (document.querySelector(`${tag}[${tag === 'script' ? 'src' : 'href'}="${attrs.src || attrs.href}"]`)) return res();
		const el = document.createElement(tag);
		Object.assign(el, attrs);
		el.onload = () => res();
		el.onerror = () => rej(new Error('load ' + (attrs.src || attrs.href)));
		document.head.appendChild(el);
	});
const pinColorOf = (p) => (p.type === 'hotel' ? 'var(--ink)' : p.days.length ? `var(--l${dayById[p.days[0]].c})` : 'var(--ink-2)');
function pinSVG(p) {
	const c = pinColorOf(p);
	const st = 'stroke="#fff" stroke-width="2.5" stroke-linejoin="round"';
	const body =
		p.type === 'hotel'
			? `<rect x="-10" y="-10" width="20" height="20" rx="6" fill="${c}" ${st}/><path d="M-5 1l5-5 5 5v5h-10z" fill="#fff"/>`
			: p.type === 'food'
				? `<rect x="-7" y="-7" width="14" height="14" rx="4" fill="${c}" ${st}/>`
				: p.type === 'shop'
					? `<path d="M0 -9L9 0L0 9L-9 0Z" fill="${c}" ${st}/>`
					: p.type === 'drink'
						? `<circle r="7" fill="#0f8a7e" stroke="#fff" stroke-width="2"/><path d="M-2.6-3.2h5.2l-.8 6.4h-3.6z" fill="#fff"/>`
						: p.type === 'mine'
							? `<circle r="9" fill="${c}" stroke="#fff" stroke-width="2.5"/><path d="M0-4.5V4.5M-4.5 0H4.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`
							: p.type === 'bike'
								? `<circle r="7.5" fill="#f2a900" stroke="#fff" stroke-width="2"/><circle cx="-2.6" cy="1.6" r="2" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="2.6" cy="1.6" r="2" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M-2.6 1.6L-0.6-2.4H1.6L2.6 1.6M-0.6-2.4L0.4 1.6" fill="none" stroke="#fff" stroke-width="1.1"/>`
								: p.type === 'bus'
									? `<rect x="-7" y="-7.5" width="14" height="15" rx="4" fill="#2f7d4f" stroke="#fff" stroke-width="2"/><rect x="-4" y="-4.5" width="8" height="5" rx="1" fill="#fff"/><circle cx="-2.4" cy="3" r="1.1" fill="#fff"/><circle cx="2.4" cy="3" r="1.1" fill="#fff"/>`
									: p.type === 'wc'
										? `<rect x="-7.5" y="-7.5" width="15" height="15" rx="4" fill="#4a6fa5" stroke="#fff" stroke-width="2"/><text x="0" y="3.2" text-anchor="middle" font-size="8" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">WC</text>`
										: p.type === 'rest'
											? `<circle r="7.5" fill="#a0527e" stroke="#fff" stroke-width="2"/><path d="M-3.8-2h5.6v2.2a2.8 2.8 0 0 1-5.6 0z" fill="#fff"/><path d="M1.8-1.2h.9a1.3 1.3 0 0 1 0 2.6h-.9" fill="none" stroke="#fff" stroke-width="1.1"/>`
											: p.type === 'mrt'
												? `<rect x="-8" y="-8" width="16" height="16" rx="4" fill="#0f5fa8" stroke="#fff" stroke-width="2"/><path d="M-4.5 4V-4L0 1.5 4.5-4V4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>`
												: p.type === 'wish'
													? `${p.wish && p.wish.must ? '<circle r="12.5" fill="#f2a900" stroke="#fff" stroke-width="1.5"/>' : ''}<path d="M0 -10L2.9 -3.4L9.9 -2.8L4.6 1.9L6.2 8.8L0 5.2L-6.2 8.8L-4.6 1.9L-9.9 -2.8L-2.9 -3.4Z" fill="${c}" ${st}/>`
													: `<circle r="8" fill="${c}" ${st}/>`;
	return `<svg viewBox="-13 -13 26 26" width="26" height="26" aria-hidden="true">${body}</svg>`;
}
const popMrt = (p) => {
	const m = p.food ? p.food.mrt : p.wish ? wBest(p.wish).mrt : ((GEO.places || {})[p.pid] || {}).mrt;
	return m ? `<p class="pop-addr">${icon('train')} ${esc(mrtText(m))}</p>` : '';
};
function popupHTML(p) {
	const f = p.food,
		w = p.wish;
	const br = w ? wBest(w) : null;
	const addr = f ? f.address_trad : w ? br.address_trad : p.drink ? p.drink.address_trad : p.type === 'mrt' || p.wc ? '' : addrFor(p.pid).zh;
	const meta = f
		? lang === 'en'
			? f.dish_en
			: f.dish_zh
		: w
			? lang === 'en'
				? w.order_en
				: w.order_zh
			: p.drink
				? `${lang === 'en' ? p.drink.tip_en : p.drink.tip_zh}${p.drink.rating ? ` · ★${p.drink.rating}` : ''}`
				: '';
	const q = p.q || addr || p.name;
	const days = p.days.map((d) => `<span class="daychip" style="${colorVars(dayById[d].c)}">Day ${dayById[d].n}</span>`).join(' ');
	return `<div class="pop"><p class="pop-name">${esc(p.name)}</p>${meta ? `<p class="pop-meta">${esc(meta)}</p>` : ''}${days ? `<p class="pop-days">${days}</p>` : ''}${addr ? `<p class="pop-addr">${esc(addr)}</p>` : ''}${p.type === 'mrt' ? `<p class="pop-addr">${esc(p.near || '')}</p>` : popMrt(p)}${meLL && !farAway() ? planHTML(p, true) : ''}
      <div class="links-row">${ext(gmSearch(q), Z('地图', 'Map'), 'pin')}${ext(gmDir(q, 'transit'), Z('路线', 'Directions'), 'route')}<button type="button" class="mlink" data-more="1">${icon('info')}${Z('详情', 'Details')}</button></div></div>`;
}
function armLiveMap() {
	if (liveArmed || liveFailed) return;
	const sec = $('#map');
	if (!sec) return;
	liveArmed = true;
	const io = new IntersectionObserver(
		(ents) => {
			if (ents.some((e) => e.isIntersecting)) {
				io.disconnect();
				liveIO = null;
				startLiveMap();
			}
		},
		{ rootMargin: '900px 0px' },
	);
	io.observe(sec);
	liveIO = io;
}
const OSM_RASTER = {
	version: 8,
	sources: {
		osm: {
			type: 'raster',
			tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
			tileSize: 256,
			maxzoom: 19,
			attribution: '© OpenStreetMap contributors',
		},
	},
	layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};
const JS_ALT = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js';
const CSS_ALT = 'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css';
function mapMsg(kind, why) {
	const el = $('#mapmsg');
	if (!el) return;
	el.classList.toggle('slow', kind === 'slow');
	if (kind === 'ok') {
		el.hidden = true;
		return;
	}
	el.hidden = false;
	const WHY = {
		net: Z('地图资料下载不了：可能没有网络，或被广告拦截、VPN挡住。', 'Map download failed: offline, or blocked by ad blocker/VPN.'),
		webgl: Z(
			'浏览器无法显示地图（图形加速未开）。请改用 Chrome 或 Safari。',
			"Browser can't draw map (graphics acceleration off). Try Chrome or Safari.",
		),
	};
	const list = Z('用下面「所有地点」列表，每个都能开 Google 地图。', 'Use "All places" below; each opens in Google Maps.');
	el.innerHTML =
		kind === 'loading'
			? `<p>${Z('地图载入中…', 'Loading the map…')}</p>`
			: kind === 'slow'
				? `<p class="small">${Z('地图载入比较慢，还在继续。', 'The map is slow and still loading.')}</p><button type="button" class="mlink primary" data-retry-map>${icon('route')}${Z('重新载入', 'Reload map')}</button>`
				: `<p class="pop-name">${Z('地图载入不了', "The map couldn't load")}</p><p class="small muted">${WHY[why] || WHY.net} ${list}</p><div class="links-row"><button type="button" class="mlink primary" data-retry-map>${icon('route')}${Z('再试一次', 'Try again')}</button>${ext(gmSearch(PLACES.hotel.maps), Z('Google 地图看酒店', 'Hotel in Google Maps'), 'pin')}</div>`;
}
const canWebGL = () => {
	try {
		const c = document.createElement('canvas');
		const gl = c.getContext('webgl2') || c.getContext('webgl');
		const lose = gl && gl.getExtension('WEBGL_lose_context');
		if (lose) lose.loseContext();
		return !!gl;
	} catch {
		return false;
	}
};
async function startLiveMap() {
	mapMsg('loading');
	if (GM && !gmFailed) {
		try {
			await loadGoogle();
			mountGoogle();
			return;
		} catch {
			/* fall through to the free map */
		}
	}
	if (!canWebGL()) {
		liveFailed = true;
		liveArmed = false;
		mapMsg('fail', 'webgl');
		return;
	}
	const loadLib = async () => {
		try {
			await loadTag('link', { rel: 'stylesheet', href: LIVE.css });
			await loadTag('script', { src: LIVE.js });
		} catch {
			/* try the second CDN */
		}
		if (!window.maplibregl) {
			await loadTag('link', { rel: 'stylesheet', href: CSS_ALT }).catch(() => {});
			await loadTag('script', { src: JS_ALT }).catch(() => {});
		}
		return !!window.maplibregl;
	};
	const pickStyle = async () => {
		const url = isDark() ? LIVE.dark : LIVE.light;
		try {
			const r = await fetch(url, { cache: 'force-cache' });
			if (r.ok) return url;
		} catch {
			/* fall through to OSM tiles */
		}
		try {
			const r = await fetch('https://tile.openstreetmap.org/12/3431/1754.png', { mode: 'no-cors' });
			if (r) return OSM_RASTER;
		} catch {
			/* offline */
		}
		return null;
	};
	const [ok, style] = await Promise.all([loadLib(), pickStyle()]);
	if (!ok || !style) {
		liveFailed = true;
		liveArmed = false;
		mapMsg('fail', 'net');
		return;
	}
	liveFailed = false;
	mountLive(style);
}
