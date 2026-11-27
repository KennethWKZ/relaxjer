// How far a place is by road, as Google's place search measures it from where the group is (the finder's line under the
// place's name, ADR-20261124-finder-google-distance): which way to ask about, which of Google's results is the place,
// and its leg in the group's minutes. Pure; wrapped as `Way` inside the page script.

// The group's walking pace (ADR-20261127-trip-walk-pace): how much longer the group takes to walk than Google's fit
// adult. A trip sets it as TRIP.walkPace; without one the group walks at the seniors' pace (AGENTS.md), and 1 is
// Google's own walking time, for a group of fit adults.

/** the pace when the trip doesn't set one: seniors walk 40 % longer */
export const DEFAULT_PACE = 1.4;
/** the paces a trip may set: Google's own time up to twice it */
export const PACE_MIN = 1;
export const PACE_MAX = 2;

/** what's wrong with a trip's TRIP.walkPace, or '' when it's fine (left out is fine) */
export const paceProblem = (v) =>
	v == null || (typeof v === 'number' && v >= PACE_MIN && v <= PACE_MAX)
		? ''
		: `TRIP.walkPace must be a number from ${PACE_MIN} to ${PACE_MAX}, got ${JSON.stringify(v)}`;

/** the group's pace from the trip's TRIP.walkPace: the trip's own, else DEFAULT_PACE */
export const paceOf = (v) => (v == null ? DEFAULT_PACE : v);

/** walking minutes for metres in a straight line, at a pace: 75 m a minute on streets 1.3× the straight line */
export const walkMin = (m, pace) => ((m * 1.3) / 75) * pace;

/** the longest walk the page offers before a ride: the add sheet's "taxi first" rule (20 min at the group's pace) */
export const WALK_MAX_MIN = 20;

/** Google's travel mode for a leg whose walk, at the group's pace, is walkMin minutes */
export const modeFor = (walkMin) => (walkMin <= WALK_MAX_MIN ? 'WALK' : 'DRIVE');

// km between two { lat, lng } points (haversine), as the page measures everything else
function km(a, b) {
	const r = Math.PI / 180;
	const dLat = (b.lat - a.lat) * r;
	const dLng = (b.lng - a.lng) * r;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
	return 12742 * Math.asin(Math.sqrt(h));
}

/** how close a result must be to a place's pin to count as that place, when it has no Google id to match */
export const SAME_PLACE_KM = 0.15;

/** the place among Google's results (Text Search's `places`): the one with its Google id, else the nearest within
 *  SAME_PLACE_KM of its pin; -1 when none is the place */
export function pickIndex(places, { gpid, lat, lng }) {
	if (!Array.isArray(places)) return -1;
	if (gpid) return places.findIndex((p) => p && p.id === gpid);
	let best = -1;
	let bestKm = SAME_PLACE_KM;
	places.forEach((p, i) => {
		const l = p && p.location;
		if (!l || l.latitude == null || l.longitude == null) return;
		const d = km({ lat, lng }, { lat: l.latitude, lng: l.longitude });
		if (d <= bestKm) {
			best = i;
			bestKm = d;
		}
	});
	return best;
}

/** the place's leg from Google's answer (Text Search with routingParameters and the routingSummaries field), or null:
 *  { m: metres by road, min: minutes, mode }. A walk is in the group's minutes (Google's × pace), as every walking
 *  time on the page is; a ride's minutes stay as Google gives them (no traffic: Google's default for a summary) */
export function legOf(json, place, mode, pace) {
	if (!json || !Array.isArray(json.places)) return null;
	const i = pickIndex(json.places, place);
	const leg = i < 0 ? null : json.routingSummaries?.[i]?.legs?.[0];
	if (!leg) return null;
	const m = Number(leg.distanceMeters);
	const s = parseFloat(String(leg.duration || '').replace(/s$/, ''));
	if (!(m >= 0) || !(s >= 0)) return null;
	const min = Math.max(1, Math.round((s / 60) * (mode === 'WALK' ? pace : 1)));
	return { m, min, mode };
}
