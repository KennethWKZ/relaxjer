// Timeline rules. Pure; times are minutes after midnight. Wrapped as `Plan` inside the page script.
//  - Fixed items (flights, a show, a pickup, checkout) never move.
//  - Flight-tied items (`rel`) follow the flight: offsets after landing, or before take-off.
//  - A push-back ("running late") moves a stop only when no fixed item sits between the push's start and the stop.

/** a take-off time as minutes from the departure day's midnight: an after-midnight flight counts as the next day */
export const depMinutes = (dep) => (dep < 12 * 60 ? dep + 1440 : dep);

/**
 * A flight-tied item's start and end in minutes. arr = landing, dep = take-off (from depMinutes); lastDay = the item
 * is on the day of an after-midnight take-off, so its clock starts a day later.
 */
export function relMinutes(rel, arr, dep, lastDay) {
	const base = rel.arr ? arr : dep - (lastDay ? 1440 : 0);
	const o = rel.arr || rel.dep;
	let a = o[0] == null ? null : base + o[0];
	const b = o[1] == null ? null : base + o[1];
	if (a != null && rel.min != null) a = Math.max(a, rel.min);
	return { a, b };
}

/** minutes a planned start s0 moves: every push that begins at or before it, with no fixed start in between */
export function shiftAt(fixedStarts, s0, pushes) {
	if (s0 == null || !pushes.length) return 0;
	return pushes.reduce((m, g) => (g.from <= s0 && !fixedStarts.some((f) => f > g.from && f <= s0) ? m + g.min : m), 0);
}

/** the stored pushes for a day that are valid ({ from, min > 0 }) */
export const validPushes = (list) => (Array.isArray(list) ? list.filter((x) => x && x.from != null && x.min > 0) : []);

/** the fixed item an added stop at minute m runs into: from 45 min before it until its end (or 30 min after start) */
export function nearFixed(m, fixed) {
	return fixed.find((x) => m >= x.s - 45 && m <= (x.e != null ? x.e : x.s + 30)) || null;
}

/**
 * Which day does what, read from the trip itself (any number of days, ids d1…dN):
 *   arrive: the first day
 *   leave:  the day the group leaves the hotel for the airport: the evening before an after-midnight take-off (before
 *           12:00), else the flight's own day
 *   flight: a day after `leave` that holds only that early take-off (no stops to add, no day tab), else null
 *   free:   the day marked `freeFrom` (its free time gets the ideas list), else the leave day
 */
export function dayRoles(days, ret) {
	const [h, m] = String(ret.dep).split(':').map(Number);
	const eve = h * 60 + m < 12 * 60 ? new Date(Date.parse(ret.date) - 864e5).toISOString().slice(0, 10) : ret.date;
	const leave = (days.find((d) => d.date === eve) || days[days.length - 1]).id;
	const flight = (days.find((d) => d.date === ret.date && d.id !== leave) || {}).id || null;
	const free = (days.find((d) => d.freeFrom) || days.find((d) => d.id === leave)).id;
	return { arrive: days[0].id, leave, flight, free };
}
