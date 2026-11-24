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
		sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GM.key)}&v=weekly&loading=async&libraries=marker,places&language=${encodeURIComponent(gLang())}${gRegion() ? `&region=${gRegion().toUpperCase()}` : ''}&callback=__tpGmInit`;
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
		center: placeLL(hotelNow()), // until the first map view fits
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
	// the camera on a place, in the part of the map the list pane leaves open (paneAim, 16-map.js): Google has no offset,
	// so it centres the place, then pans by half the pane
	const aim = (p, low, zoom) => {
		if (m.getZoom() < low) m.setZoom(zoom);
		m.panTo({ lat: p.lat, lng: p.lng });
		const o = paneAim();
		if (o.x || o.y) g.event.addListenerOnce(m, 'idle', () => m.panBy(-o.x, -o.y));
	};
	// the finder's place in view with where the group is, as on the free map (21-live-location.js frame): both fitted
	// into the open part of the map, at street zoom at most. Google's fitBounds has no maxZoom: past it the camera steps
	// back to it and centres the two in the open part (as aim does); next door, or with nothing to frame it with, it
	// aims at the place
	const frame = (p, low, zoom) => {
		const from = frameFrom();
		if (!from || km(from, p) < 0.1) return aim(p, low, zoom);
		m.fitBounds(bounds([Math.min(from.lng, p.lng), Math.min(from.lat, p.lat), Math.max(from.lng, p.lng), Math.max(from.lat, p.lat)]), framePad());
		const cap = g.event.addListenerOnce(m, 'idle', () => {
			if (m.getZoom() <= 17) return;
			m.setZoom(17);
			m.panTo({ lat: (from.lat + p.lat) / 2, lng: (from.lng + p.lng) / 2 });
			const o = paneAim();
			if (o.x || o.y) g.event.addListenerOnce(m, 'idle', () => m.panBy(-o.x, -o.y));
		});
		setTimeout(() => g.event.removeListener(cap), 2500); // a frame that changed nothing sends no idle: never a late jump
	};
	// quiet: the place finder shows the place in the pane, so its pin is marked (destMark) without a popup over the map,
	// and the camera frames it. tapped: a pin tapped on the map is marked the same, with its popup, and framed with the
	// phone when its location is on near the trip, as on the free map (21-live-location.js pick); never a line
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
		if (tapped && meNear()) frame(p, 16.5, 17);
		if (quiet) iw.close();
		else {
			const box = document.createElement('div');
			box.innerHTML = popupHTML(p);
			box.addEventListener('click', (e) => {
				if (e.target.closest('[data-more]')) openPinSheet(p);
			});
			iw.setContent(box);
			iw.open({ map: m, anchor: mm ? mm.mk : undefined, shouldFocus: false });
			if (!mm) iw.setPosition({ lat: p.lat, lng: p.lng });
		}
		if (fly) (quiet ? frame : aim)(p, 16.5, 17);
		mapSel = p;
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
		x.mk.addListener('gmp-click', () => pick(p, false, false, true));
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
	let rideLine = null; // a split day's route (07-sections.js splitHTML), dashed in the day's colour
	let spotMk = null; // the finder's place without a pin
	m.controls[g.ControlPosition.RIGHT_BOTTOM].push(loc);
	const VIEWS = { all: GEO.bbox, ...Object.fromEntries((TRIP.mapViews || []).map((v) => [v.id, v.bbox])) };
	const bounds = (b) => ({ west: b[0], south: b[1], east: b[2], north: b[3] });
	const fitTo = (list) => {
		if (!list.length) return;
		const lngs = list.map((x) => x.lng),
			lats = list.map((x) => x.lat);
		m.fitBounds(bounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]), panePad(56));
		if (m.getZoom() > 15.5) m.setZoom(15.5);
	};
	map = {
		view(k) {
			iw.close();
			m.fitBounds(bounds(VIEWS[k] || GEO.bbox), panePad(24));
			$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === k)));
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
			mapFiltSync();
			if (mapDay !== 'all' || mapCat !== 'all') {
				fitTo(markers.filter((x) => show(x) && x.p.type !== 'hotel').map((x) => x.p));
				$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
			}
		},
		select(pid, quiet) {
			const x = markers.find((mm) => mm.p.pid === pid);
			if (x) {
				const mk = mkOf(x);
				if (!mk.map) mk.map = m;
				pick(x.p, true, quiet);
			}
		},
		refit() {
			/* Google resizes itself */
		},
		// a place with no pin of its own (a Google result in the finder): one marker of its own, marked as the finder's
		// place, and framed as a pin is
		spot(p) {
			if (spotMk) spotMk.map = null;
			spotMk = null;
			if (!p) return;
			iw.close();
			const el = document.createElement('div'); // a div, not a button: the marker is the control (Google's rule)
			el.className = 'lpin sel lpin-spot'; // not .spot: that's the toilet and drink list's row, a flex box with a border
			el.innerHTML = pinSVG({ type: 'mine', days: [] });
			spotMk = new g.marker.AdvancedMarkerElement({ map: m, position: { lat: p.lat, lng: p.lng }, content: el, title: p.n, zIndex: 998 });
			destMark(el, p.n, nameSide(frameFrom(), p));
			frame(p, 15.5, 16);
		},
		// the finder closed: nothing picked, no mark
		unpick() {
			if (sel) {
				sel.classList.remove('sel');
				destUnmark(sel);
			}
			sel = null;
			iw.close();
			mapSel = null;
			map.spot(null);
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
		},
		center() {
			if (!meLL) return;
			m.panTo(meLL);
			if (m.getZoom() < 15) m.setZoom(16);
		},
		ride(line, color) {
			if (rideLine) rideLine.setMap(null);
			rideLine = null;
			if (!line || line.length < 2) return;
			iw.close();
			const path = line.map(([lat, lng]) => ({ lat, lng }));
			rideLine = new g.Polyline({
				map: m,
				path,
				strokeOpacity: 0,
				clickable: false,
				zIndex: 4,
				icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.9, strokeColor: color, strokeWeight: 4, scale: 3 }, offset: '0', repeat: '12px' }],
			});
			fitTo(path);
			$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', 'false'));
		},
	};
	map.view(FIRST_VIEW);
	mapReadyNow();
}
