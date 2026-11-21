// Where a place fits the trip: the map's place finder. Pure; distances in km, times in minutes after midnight. Wrapped as
// `Fit` inside the page script. The rule (ADR-20261122-place-finder-best-day):
//  - each day's nearest stop to the place, by straight line; hotel rows and stops already behind the group today are
//    left out (the hotel is near every day's end, and a stop that's over is no anchor);
//  - the best day is one still ahead, not closed for the place and not already holding it: the one in the nearest
//    distance band (a short walk, a short ride, a ride, far), and within a band one with room after that stop (free
//    time, or ROOM_MIN minutes before the next timed stop on a day that isn't crowded), then the nearer;
//  - far: even the best day's stop is beyond the last band.

/** km between two { lat, lng }: the page's own straight-line measure (05-render-small-parts.js `km`) */
export function distKm(a, b) {
	const r = Math.PI / 180;
	const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
	const y = (b.lat - a.lat) * r;
	return 6371 * Math.hypot(x, y);
}

/** the distance bands, in km: a short walk (the wishlist chips' 700 m), a short ride, a ride; past the last is far */
export const BANDS = [0.7, 3, 8];

/** which band a distance falls in: 0 … BANDS.length (far) */
export const band = (k) => {
	const i = BANDS.findIndex((b) => k <= b);
	return i < 0 ? BANDS.length : i;
};

/** minutes free after a stop that counts as room for one more */
export const ROOM_MIN = 90;

/** where a day's room runs out when nothing timed comes after the stop: the evening */
export const DAY_END = 21 * 60;

/**
 * Minutes free after a stop (start s, end e; no end counts an hour) until the next timed start after it that day, else
 * until DAY_END. starts: every timed start on the day, on one clock. null when the stop has no time.
 */
export function freeAfter(s, e, starts) {
	if (s == null) return null;
	const end = e != null ? e : s + 60;
	const next = starts.filter((x) => x != null && x > s).sort((a, b) => a - b)[0];
	return Math.max(0, (next != null ? next : DAY_END) - end);
}

/**
 * How a place sits against each day of the trip.
 * place: { lat, lng }. days: [{ id, closed, planned, over, crowded, stops: [{ lat, lng, hotel, past, room, free, … }] }]
 * (closed: the place is shut that day; planned: the day already holds it; over: the day is behind the group; room:
 * freeAfter's minutes; free: the stop opens the day's free time). Any other fields ride along on the stop.
 * Returns { rows, best, far }: rows, one per day with a stop to measure from, nearest first, each
 * { id, stop, km, roomy, closed, planned, over, ok }; best, the row to suggest (null when no day can take it); far, true
 * when even the best is beyond the last band.
 */
export function fitDays(place, days) {
	const rows = [];
	for (const d of days) {
		let near = null;
		for (const s of d.stops || []) {
			if (s.lat == null || s.lng == null || s.hotel || s.past) continue;
			const k = distKm(place, s);
			if (!near || k < near.km) near = { stop: s, km: k };
		}
		if (!near) continue;
		const roomy = !d.crowded && (!!near.stop.free || (near.stop.room ?? 0) >= ROOM_MIN);
		const ok = !d.closed && !d.planned && !d.over;
		rows.push({ id: d.id, stop: near.stop, km: near.km, roomy, closed: !!d.closed, planned: !!d.planned, over: !!d.over, ok });
	}
	rows.sort((a, b) => a.km - b.km);
	const best = rows.filter((r) => r.ok).sort((a, b) => band(a.km) - band(b.km) || b.roomy - a.roomy || a.km - b.km)[0] || null;
	return { rows, best, far: !!best && band(best.km) === BANDS.length };
}
