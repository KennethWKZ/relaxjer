// A stand-in for MapLibre GL, put in the page before its own script runs (page.addInitScript), so the live map's pins,
// the marked pin and where the camera aims can be tested offline: the network guard still refuses the map's library and
// its tiles. It draws nothing. Markers and popups are plain elements in the map's box; every camera move is kept in
// window.__ml (easeTo options in .ease, fitBounds bounds and options in .fit, both in order in .moves), and so are the
// lines it was asked to draw (each GeoJSON source's latest data in .src, each line layer's paint in .paint). WebGL is
// reported present, as on a phone, whatever the test browser has. The map's style is answered by mapStyleRoute below.
export function stubMapLibre() {
	window.__ml = { ease: [], fit: [], moves: [], src: {}, paint: {} };
	const getContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
		const c = getContext.call(this, type, ...rest);
		return c || (/webgl/.test(type) ? { getExtension: () => null } : c);
	};
	const keep = (o) => JSON.parse(JSON.stringify(o));
	class Map {
		constructor(o) {
			this.box = o.container;
			this.zoom = o.zoom;
			this.touchZoomRotate = { disableRotation() {} };
		}
		on() {
			return this;
		}
		once(type, fn) {
			if (type === 'load') setTimeout(fn, 0);
			return this;
		}
		addControl(c) {
			const el = c && c.onAdd && c.onAdd(this);
			if (el) this.box.append(el);
			return this;
		}
		loaded() {
			return true;
		}
		isStyleLoaded() {
			return true;
		}
		getZoom() {
			return this.zoom;
		}
		easeTo(o) {
			window.__ml.ease.push(keep(o));
			window.__ml.moves.push({ kind: 'ease', ...keep(o) });
			if (o.zoom != null) this.zoom = o.zoom;
		}
		fitBounds(bounds, o) {
			window.__ml.fit.push(keep({ bounds, ...o }));
			window.__ml.moves.push({ kind: 'fit', ...keep({ bounds, ...o }) });
		}
		getSource(id) {
			return this.srcs && this.srcs.has(id) ? { setData: (d) => (window.__ml.src[id] = keep(d)) } : null;
		}
		setStyle() {}
		resize() {}
		addSource(id, o) {
			(this.srcs = this.srcs || new Set()).add(id);
			window.__ml.src[id] = keep(o.data);
		}
		addLayer(l) {
			window.__ml.paint[l.id] = keep(l.paint || {});
		}
		setPaintProperty(id, k, v) {
			(window.__ml.paint[id] = window.__ml.paint[id] || {})[k] = v;
		}
		remove() {}
	}
	class Marker {
		constructor(o = {}) {
			this.el = o.element || document.createElement('div');
		}
		setLngLat(ll) {
			this.el.dataset.ll = ll.join(',');
			return this;
		}
		addTo(m) {
			m.box.append(this.el);
			return this;
		}
		getElement() {
			return this.el;
		}
		remove() {
			this.el.remove();
		}
	}
	class Popup {
		constructor() {
			this.el = document.createElement('div');
			this.el.className = 'maplibregl-popup';
		}
		setLngLat() {
			return this;
		}
		setHTML(h) {
			this.el.innerHTML = h;
			return this;
		}
		addTo(m) {
			m.box.append(this.el);
			return this;
		}
		getElement() {
			return this.el;
		}
		remove() {
			this.el.remove();
		}
	}
	class Control {
		onAdd() {
			return document.createElement('div');
		}
	}
	window.maplibregl = { Map, Marker, Popup, NavigationControl: Control, ScaleControl: Control };
}

/** the map's style, answered locally (any JSON does: the stand-in never reads it), so the page goes on to mount the map */
export const mapStyleRoute = (page) =>
	page.route(/tiles\.openfreemap\.org\/styles\//, (route) => route.fulfill({ contentType: 'application/json', body: '{}' }));

/** The phone's location, wherever the test puts it: once it sets window.__here ({ lat, lng }), the page's next request
 *  (the map's "Show my location", Food near me) gets a fix there, and window.__moveTo({ lat, lng }) sends the watch a
 *  new one, as a phone on the move does. Permission is left as the browser has it: the page asks only on a tap. */
export function stubPhoneAt() {
	const fix = () => ({
		coords: { latitude: window.__here.lat, longitude: window.__here.lng, accuracy: 15, heading: null, speed: null },
		timestamp: Date.now(),
	});
	navigator.geolocation.watchPosition = (ok) => {
		window.__moveTo = (ll) => {
			window.__here = ll;
			ok(fix());
		};
		if (window.__here) setTimeout(() => ok(fix()), 10);
		return 1;
	};
	navigator.geolocation.getCurrentPosition = (ok) => {
		if (window.__here) setTimeout(() => ok(fix()), 10);
	};
	navigator.geolocation.clearWatch = () => {};
}
