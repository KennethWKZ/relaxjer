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

/**
 * Where an added stop at minute m goes among a day's rows ({ s, e }: start and end minutes, null when the row has no
 * clock time, like "Evening: back to the hotel"). It goes before the first row that starts after m. A row with no
 * time starts when the row before it ends; one after the day's last timed row closes the day and stays last.
 */
export function slotFor(rows, m) {
	const t = minuteOn(rows, m);
	const at = effectiveRows(rows).findIndex((r) => (r.closes ? Infinity : r.s) != null && (r.closes ? Infinity : r.s) > t);
	return at < 0 ? rows.length : at;
}

/**
 * The time "+" under a stop suggests, so the new stop lands right after it: the stop's end (else its start + 60, else
 * 30 min before the next), on a quarter hour, kept before the next row's start (next) and after the stop's own
 * (start). Minutes, or null when nothing around it has a time.
 */
export function gapTime(start, end, next) {
	let t = end != null ? end : start != null ? start + 60 : next != null ? next - 30 : null;
	if (t == null) return null;
	t = Math.ceil(t / 15) * 15;
	if (next != null && t >= next) {
		const lo = start != null ? start : next - 60;
		t = next - 15 > lo ? next - 15 : Math.floor((lo + next) / 2);
	}
	return Math.max(0, Math.min(t, 23 * 60 + 45));
}

/**
 * A day's rows on one clock: a start more than 6 h before the one above it is after midnight (+24 h), like the last
 * day's 00:45 flight after a 21:00 check-in; an end before its start is the next morning too. rows = [{ s, e }].
 */
export function onOneClock(rows) {
	let prev = null;
	let add = 0;
	return rows.map((r) => {
		if (r.s == null) return { ...r };
		if (prev != null && r.s + add < prev - 360) add += 1440;
		const s = r.s + add;
		let e = r.e != null ? r.e + add : null;
		if (e != null && e < s) e += 1440;
		prev = s;
		return { ...r, s, e };
	});
}

/** a time m on a day's clock: more than 6 h before the day's first start is after midnight */
export function minuteOn(rows, m) {
	const first = rows.find((r) => r.s != null);
	return first && m != null && m < first.s - 360 ? m + 1440 : m;
}

/**
 * A day's rows with the start each one counts as (on one clock): its own, or for a row with no time the end of the timed row before
 * it; a row after the day's last timed row closes the day (closes: true). rows = [{ s, e }].
 */
export function effectiveRows(rows) {
	const lastTimed = rows.reduce((k, r, i) => (r.s != null ? i : k), -1);
	let end = null;
	return onOneClock(rows).map((r, i) => {
		const out = { s: r.s != null ? r.s : end, e: r.s != null ? r.e : null, closes: lastTimed >= 0 && i > lastTimed };
		if (r.s != null) end = r.e != null ? r.e : r.s;
		return out;
	});
}

/**
 * Which rows can take a stop right after them ("+" under the stop): not the row that closes the day, and not a row
 * with no length when the next one starts at the same minute (10:30 Arrive, then 10:30–12:15 Old Street): there's no
 * time between them, so the next row's "+" is the one to use. rows = [{ s, e }]; returns [true | false].
 */
export function roomAfter(rows) {
	const eff = effectiveRows(rows);
	return eff.map((r, i) => {
		if (r.closes) return false;
		const next = eff[i + 1];
		return !(next && next.s != null && r.s != null && next.s <= r.s && (r.e == null || r.e <= r.s));
	});
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
 *   flight: a day after `leave` that holds only that early take-off (no stops to add), else null
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

/**
 * The prefix a trip's page stores its state under (checklist, added stops, language…): TRIP.storageKey, else one per
 * trip start date, so two trips opened from the same site never share state.
 */
export const storeKey = (trip) => trip.storageKey || `rj.${trip.start}.`;

/**
 * Each day's hotel (place id): one hotel for the whole trip (TRIP.hotel, default 'hotel'), or DAYS[i].hotel from the
 * night the group moves; a day without one keeps the night before's. → { d1: 'hotel', d2: 'hotel', d3: 'onsen', … }
 */
export function hotelsByDay(days, tripHotel) {
	let h = tripHotel || 'hotel';
	return Object.fromEntries(days.map((d) => [d.id, (h = d.hotel || h)]));
}

/**
 * Does an added stop's time work with getting there and getting on (the add sheet's "Getting there" check)?
 * at: the stop's time; from: { start, end } of where the group is before it (null: nothing timed before); go and
 * onward: { walk, taxi, mrt } minutes there and to the next timed row (a mode is null when it doesn't apply); next:
 * that row's start, null for none. A stop set during the row before (a shop in the middle of an afternoon there) is
 * reached from that row's start; one after it, from its end. Times in minutes. Returns { best: { mode, min },
 * earliest, short (minutes too few to get there, over 5), onBest, leaveBy (to make the next row), tight (true when the next
 * row can't be made even leaving at once) }.
 */
export function legCheck({ at, from, go, next, onward }) {
	const fastest = (m) =>
		m
			? Object.entries(m)
					.filter(([, v]) => v != null && Number.isFinite(v))
					.map(([mode, v]) => ({ mode, min: Math.max(1, Math.round(v)) }))
					.sort((a, b) => a.min - b.min)[0] || null
			: null;
	const best = fastest(go);
	const depart = from ? (from.end != null && at >= from.start && at < from.end ? from.start : (from.end ?? from.start)) : null;
	const earliest = best && depart != null ? depart + best.min : null;
	const short = earliest != null && at < earliest - 5 ? earliest - at : 0; // a few minutes either way isn't worth a word
	const onBest = fastest(onward);
	const leaveBy = onBest && next != null ? next - onBest.min : null;
	return { best, earliest, short, onBest, leaveBy, tight: leaveBy != null && leaveBy < Math.max(at, earliest ?? at) };
}
