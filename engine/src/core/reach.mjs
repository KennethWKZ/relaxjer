// How a wishlist place past a short walk is reached from a stop (ADR-20261128-near-me-all): by the metro when both ends
// have a station within a walk (the walk to it, a ride between the two, the walk out), by car on a day that drives,
// else only "far" with its distance. Estimates for a chip, never a plan. Pure: no imports, no DOM, no trip globals.

/** past this many km in a straight line a chip stops giving a walk */
export const WALK_KM = 1.2;

/** a ride between two stations, in minutes: a five-minute wait, then about 25 km/h with the stops */
export const rideMin = (km) => Math.round(5 + km * 2.4);

/** a station from geo.json (`mrt`: { zh, en, min, m, walk, train, lat, lng }) that a group can walk to */
const walkable = (s) => !!(s && s.walk && typeof s.m === 'number' && s.zh);

/**
 * `km` from the stop; `walkMin` and `driveMin` as the page counts them (the group's pace; a taxi or a car); `driving`
 * for a day that goes by car; `from` the stop's station and `to` the place's, `rideKm` the distance between the two
 * (the page's one distance model) and `walkOf` the page's walk for a station's metres, so the walks in and out are at
 * the group's pace. Returns { mode: 'walk' | 'metro' | 'train' | 'drive' | 'far', min?, km, station? }, or null without
 * a distance.
 */
export function reach({ km, walkMin, driveMin, driving = false, from = null, to = null, rideKm = null, walkOf = null }) {
	if (typeof km !== 'number' || !Number.isFinite(km)) return null;
	if (km <= WALK_KM) return { mode: 'walk', min: Math.max(1, Math.round(walkMin)), km };
	if (driving && typeof driveMin === 'number') return { mode: 'drive', min: Math.round(driveMin), km };
	if (walkable(from) && walkable(to) && from.zh !== to.zh && typeof rideKm === 'number' && typeof walkOf === 'function') {
		const min = Math.round(walkOf(from.m) + rideMin(rideKm) + walkOf(to.m));
		return { mode: from.train || to.train ? 'train' : 'metro', min, km, station: to };
	}
	return { mode: 'far', km };
}
