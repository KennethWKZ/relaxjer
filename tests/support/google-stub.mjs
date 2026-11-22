// A stand-in for Google's Maps JavaScript library, put in the page before its own script runs (page.addInitScript), so
// the Google parts can be tested offline: the network guard still refuses every Google host. Only the Places calls the
// page makes: Place.searchByText (each request is kept in window.__gCalls.search) and place.fetchFields (ids in
// window.__gCalls.fetch). Every answer is made up. The page's photo is a data: image, which its policy allows.
export function stubGoogle() {
	const PHOTO =
		'data:image/svg+xml;utf8,' +
		encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="#9ab"/></svg>');
	window.__gCalls = { search: [], fetch: [] };
	class Place {
		constructor({ id }) {
			this.id = id;
		}
		async fetchFields({ fields }) {
			window.__gCalls.fetch.push({ id: this.id, fields });
			Object.assign(this, {
				rating: 4.6,
				userRatingCount: 1234,
				googleMapsURI: `https://maps.google.com/?q=${this.id}`,
				businessStatus: 'OPERATIONAL',
				photos: [{ getURI: () => PHOTO, authorAttributions: [{ displayName: 'A. Walker', uri: 'https://example.com/a-walker' }] }],
				// Monday first; never open on Sunday
				regularOpeningHours: {
					weekdayDescriptions: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `${d}: 10:00 – 18:00`).concat('Sun: Closed'),
					periods: [1, 2, 3, 4, 5, 6].map((day) => ({ open: { day, hour: 10, minute: 0 }, close: { day, hour: 18, minute: 0 } })),
				},
			});
		}
		static async searchByText(req) {
			window.__gCalls.search.push(JSON.parse(JSON.stringify(req)));
			const c = req.locationBias.center;
			const at = (dLat, dLng) => ({ lat: () => c.lat + dLat, lng: () => c.lng + dLng });
			// an id lookup (fields: id) finds the place itself; a search finds two made-up places near where it looked
			if (req.fields.length === 1) return { places: [{ id: `stub-${req.textQuery.length}` }] };
			return {
				places: [
					{ id: 'stub-a', displayName: 'Stand-in Noodle Bar', formattedAddress: '1 Made-up Lane', location: at(0.003, 0.002) },
					{ id: 'stub-b', displayName: 'Stand-in Tea Room', formattedAddress: '2 Made-up Lane', location: at(-0.004, 0.001) },
				],
			};
		}
	}
	window.google = { maps: { importLibrary: async (name) => (name === 'places' ? { Place } : {}) } };
}

/** Location that keeps updating, as a phone on the move does: a fix every 150 ms at the trip's first mapped place
 *  (read once the page has its data), counted in window.__fixes. Permission says granted. */
export function stubMovingGeo() {
	window.__fixes = 0;
	const here = () => {
		const g = window.GEO && Object.values(window.GEO.places || {}).find((p) => p.lat != null);
		return g ? { latitude: +g.lat + window.__fixes * 1e-5, longitude: +g.lng } : { latitude: 0, longitude: 0 };
	};
	navigator.permissions.query = (d) =>
		d && d.name === 'geolocation' ? Promise.resolve({ state: 'granted', onchange: null }) : Promise.reject(new Error('stub'));
	navigator.geolocation.watchPosition = (ok) => {
		setInterval(() => {
			window.__fixes++;
			ok({ coords: { ...here(), accuracy: 15, heading: null, speed: null }, timestamp: Date.now() });
		}, 150);
		return 1;
	};
	navigator.geolocation.getCurrentPosition = (ok) =>
		setTimeout(() => ok({ coords: { ...here(), accuracy: 15, heading: null, speed: null }, timestamp: Date.now() }), 10);
	navigator.geolocation.clearWatch = () => {};
}
