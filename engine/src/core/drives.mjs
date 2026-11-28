// Rest stops along a long drive (drive-stops.json, ADR-20261128-drive-stops): which of a day's rows a drive's stops show
// under, when the drive sets off, and which stop is next while it's under way. Reference only: nothing here moves a time
// or plans a stop. Pure: no imports, no DOM, no trip globals.

/** the stop kinds the refresh writes, in the order a legend lists them */
export const kinds = ['sa', 'pa', 'roadside', 'fuel', 'store'];

/** every clock time written in a row's time ('~10:30–12:00' → [630, 720]); a [zh, en] time reads its first */
const clocks = (t) => [...String((Array.isArray(t) ? t[0] : t) ?? '').matchAll(/(\d{1,2}):(\d{2})/g)].map((x) => +x[1] * 60 + +x[2]);

/**
 * For each leg of a day's route ([from, to, mode, …]): the row its stops show under (`at`, an index into `rows`) and
 * when it sets off (`dep`, minutes, or null), or null for a leg whose destination the schedule doesn't reach.
 * `rows` are the day's planned stops in order, each { place, t }. A leg arrives at the first later row at its
 * destination; it sets off at the end of the row before, the time the data refresh asked Google about
 * (pipeline/lib/trip.py leg_departures, which this follows). Its stops show under the row the group is in while it
 * drives: the arrival row when that starts by the time the drive sets off (a "Drive to …" row at the destination),
 * else the row before it (a "Leave for …" row, or the visit it leaves from).
 */
export function legRows(rows, route) {
	const list = Array.isArray(rows) ? rows : [];
	const out = [];
	let cur = -1;
	for (const leg of Array.isArray(route) ? route : []) {
		const to = Array.isArray(leg) ? leg[1] : null;
		let k = -1;
		for (let j = cur + 1; j < list.length; j++)
			if (list[j] && list[j].place === to) {
				k = j;
				break;
			}
		if (k < 0) {
			out.push(null);
			continue;
		}
		cur = k;
		const before = k > 0 ? clocks(list[k - 1].t) : [];
		const dep = before.length ? before[before.length - 1] : null;
		const starts = clocks(list[k].t)[0];
		const drivesHere = k === 0 || (starts != null && dep != null && starts <= dep + 1);
		out.push({ at: drivesHere ? k : k - 1, dep });
	}
	return out;
}

/**
 * Which stop is next on a drive under way: the first whose minutes from the start are still ahead of the minutes
 * `gone` since it set off, by Google's pace (no location is read). -1 before it sets off, once it should long have
 * arrived (its own minutes and half an hour more), or when every stop is behind.
 */
export function nextStop(stops, gone, len) {
	if (!Array.isArray(stops) || typeof gone !== 'number' || !Number.isFinite(gone) || gone < 0) return -1;
	if (typeof len === 'number' && gone > len + 30) return -1;
	return stops.findIndex((s) => s && typeof s.min === 'number' && s.min > gone);
}
