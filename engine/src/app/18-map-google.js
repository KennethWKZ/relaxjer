/* ───────── Google map (only when .share/google.json gave a key); any failure falls back to the MapLibre map ───────── */
const GM = window.GMAPS && window.GMAPS.key ? window.GMAPS : null;
let gmLoad = null;
let gmFailed = false;
let gmap = null;
let gmDrop = null;
function loadGoogle() {
	if (gmLoad) return gmLoad;
	gmLoad = new Promise((res, rej) => {
		const t = setTimeout(() => rej(new Error('timeout')), 15000);
		window.__tpGmInit = () => {
			clearTimeout(t);
			res(window.google);
		};
		window.gm_authFailure = () => {
			gmFailed = true;
			clearTimeout(t);
			rej(new Error('auth'));
			if (gmap) {
				gmap = null;
				map = null;
				const g = $('#gmap');
				if (g) g.hidden = true;
				const w = $('.map-wrap');
				if (w) w.classList.remove('is-live', 'is-google');
				liveArmed = false;
				liveFailed = false;
				startLiveMap();
			}
		};
		const sc = document.createElement('script');
		sc.async = true;
		sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GM.key)}&v=weekly&loading=async&libraries=marker,places&language=${lang === 'en' ? 'en' : 'zh-TW'}&region=TW&callback=__tpGmInit`;
		sc.onerror = () => {
			clearTimeout(t);
			rej(new Error('load'));
		};
		document.head.appendChild(sc);
	});
	gmLoad.catch(() => {
		gmFailed = true;
	});
	return gmLoad;
}
function mountGoogle() {
	const wrap = $('.map-wrap');
	if (!wrap) return;
	if (live) {
		try {
			live.remove();
		} catch {
			/* container already replaced */
		}
		live = null;
	}
	// a theme switch rebuilds the map (Google sets light/dark only at creation): drop the old one, pins included, so maps don't pile up
	if (gmDrop) {
		try {
			gmDrop();
		} catch {
			/* already gone */
		}
		gmDrop = null;
	}
	const old = $('#gmap');
	if (old) old.remove();
	const el = document.createElement('div');
	el.id = 'gmap';
	el.className = 'livemap';
	wrap.prepend(el);
	const g = google.maps;
	const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const m = new g.Map(el, {
		mapId: GM.mapId,
		center: placeLL('hotel'), // until the first map view fits
		zoom: 12.3,
		colorScheme: isDark() ? g.ColorScheme.DARK : g.ColorScheme.LIGHT,
		gestureHandling: mapFullOn ? 'greedy' : 'cooperative',
		mapTypeControl: false,
		fullscreenControl: false,
		streetViewControl: true,
		rotateControl: false,
		tiltInteractionEnabled: false,
		headingInteractionEnabled: false,
		clickableIcons: true,
	});
	gmap = m;
	liveDark = isDark();
	wrap.classList.add('is-live', 'is-google');
	mapMsg('ok');
	const pins = buildPins();
	mapPins = pins;
	const markers = [];
	const iw = new g.InfoWindow({ maxWidth: 300 });
	let sel = null;
	function pick(p, fly) {
		if (sel) sel.classList.remove('sel');
		const mm = markers.find((x) => x.p.pid === p.pid);
		sel = mm && mm.b;
		if (sel) sel.classList.add('sel');
		const box = document.createElement('div');
		box.innerHTML = popupHTML(p);
		box.addEventListener('click', (e) => {
			if (e.target.closest('[data-more]')) openPinSheet(p);
		});
		iw.setContent(box);
		iw.open({ map: m, anchor: mm ? mm.mk : undefined, shouldFocus: false });
		if (!mm) iw.setPosition({ lat: p.lat, lng: p.lng });
		if (fly) {
			m.panTo({ lat: p.lat, lng: p.lng });
			if (m.getZoom() < 16.5) m.setZoom(17);
		}
		mapSel = p;
		map.line(p);
		showCard(p);
	}
	pins.forEach((p) => markers.push({ p, b: null, mk: null }));
	const mkOf = (x) => {
		// made the first time the pin is shown: hundreds of YouBike / bus pins cost nothing until asked for
		if (x.mk) return x.mk;
		const p = x.p;
		// plain element, not a <button>: the marker itself is the clickable control (Google's rule); a button inside it
		// makes overlapping pins bounce the click between them ("Maximum call stack size exceeded" in marker.js)
		const b = document.createElement('div');
		b.className = 'lpin';
		b.dataset.type = p.type;
		b.dataset.pid = p.pid;
		b.dataset.days = p.days.join(' ');
		b.innerHTML = pinSVG(p);
		x.b = b;
		x.mk = new g.marker.AdvancedMarkerElement({ map: null, position: { lat: p.lat, lng: p.lng }, content: b, title: p.name, gmpClickable: true });
		x.mk.addListener('gmp-click', () => pick(p, false));
		return x.mk;
	};
	gmDrop = () => {
		iw.close();
		markers.forEach((x) => {
			if (x.mk) x.mk.map = null;
		});
	};
	// "my location": Google's JS map has no built-in button, so add one (location stays on the phone)
	const loc = document.createElement('button');
	loc.type = 'button';
	loc.className = 'gm-loc';
	loc.setAttribute('aria-label', Z('显示我的位置', 'Show my location'));
	loc.innerHTML = icon('pin');
	loc.addEventListener('click', () => {
		if (meLL && meWatch != null) map.center();
		else locateMe(() => map.center());
	});
	let meMk = null;
	let meCirc = null;
	let meLine = null;
	m.controls[g.ControlPosition.RIGHT_BOTTOM].push(loc);
	const VIEWS = { all: GEO.bbox, ...Object.fromEntries((TRIP.mapViews || []).map((v) => [v.id, v.bbox])) };
	const bounds = (b) => ({ west: b[0], south: b[1], east: b[2], north: b[3] });
	const fitTo = (list) => {
		if (!list.length) return;
		const lngs = list.map((x) => x.lng),
			lats = list.map((x) => x.lat);
		m.fitBounds(bounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]), 56);
		if (m.getZoom() > 15.5) m.setZoom(15.5);
	};
	map = {
		view(k) {
			iw.close();
			m.fitBounds(bounds(VIEWS[k] || GEO.bbox), 24);
			$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === k)));
		},
		zoom(f) {
			m.setZoom(m.getZoom() + (f < 1 ? 1 : -1));
		},
		filter(f) {
			iw.close();
			if (MAP_CAT_KEYS.includes(f)) mapCat = f;
			else mapDay = f;
			mapListSync();
			const show = (x) => pinShown(x.p);
			markers.forEach((x) => {
				if (show(x)) {
					const mk = mkOf(x);
					if (!mk.map) mk.map = m;
				} else if (x.mk && x.mk.map) x.mk.map = null;
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
				const mk = mkOf(x);
				if (!mk.map) mk.map = m;
				pick(x.p, true);
			}
		},
		refit() {
			/* Google resizes itself */
		},
		me(ll, acc, hd) {
			if (!meMk) {
				meMk = new g.marker.AdvancedMarkerElement({ map: m, position: ll, content: meDot(), title: Z('你在这里', 'You are here'), zIndex: 999 });
				meCirc = new g.Circle({ map: m, center: ll, radius: acc, strokeOpacity: 0, fillColor: '#1a73e8', fillOpacity: 0.12, clickable: false });
			} else {
				meMk.position = ll;
				meCirc.setCenter(ll);
				meCirc.setRadius(acc);
			}
			meHead(meMk.content, hd);
			if (mapSel) map.line(mapSel);
		},
		line(p) {
			if (meLine) {
				meLine.setMap(null);
				meLine = null;
			}
			if (!p || !meLL || farAway()) return;
			meLine = new g.Polyline({
				map: m,
				path: [meLL, { lat: p.lat, lng: p.lng }],
				strokeOpacity: 0,
				clickable: false,
				zIndex: 5,
				icons: [
					{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.85, strokeColor: '#1a73e8', strokeWeight: 3, scale: 3 }, offset: '0', repeat: '14px' },
				],
			});
		},
		center() {
			if (!meLL) return;
			m.panTo(meLL);
			if (m.getZoom() < 15) m.setZoom(16);
		},
	};
	map.view(FIRST_VIEW);
	mapReadyNow();
}
