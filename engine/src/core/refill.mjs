// Free water refill points (refill.json, ADR-20261128-water-refill): which spots are shut for winter on a day, which are
// open at a time, and which to list near a place. Pure: no imports, no DOM, no trip globals.

/** the season OpenStreetMap's seasonal=* means when a pack sets none: winter, December to February north of the equator
 *  and June to August south of it, as ['MM-DD', 'MM-DD'] (a span may run over New Year) */
export const defaultWinter = (lat) => (lat < 0 ? ['06-01', '08-31'] : ['12-01', '02-29']);

/** is 'YYYY-MM-DD' inside a span ['MM-DD', 'MM-DD'], ends included; a span that ends before it starts runs over New Year */
export function inWindow(date, win) {
	if (!date || !Array.isArray(win) || win.length !== 2) return false;
	const md = date.slice(5, 10);
	const [a, b] = win;
	return a <= b ? md >= a && md <= b : md >= a || md <= b;
}

/** is this spot shut for winter on `date`? Only an outdoor tap can be: a shop, a public indoor place (`shelter`) and a tap
 *  known to be indoors stay open, and so does one marked open all year (`seasonal: false`). Under the pack's rule
 *  (`Pack.refillWinter`, the span outdoor taps close in a cold place) every other tap is shut inside it, since
 *  a tap not known to be indoors is taken as outdoors (better a walk saved than a walk to a frozen fountain); without one,
 *  only a tap marked seasonal, in the default winter */
export function shutFor(spot, date, rule) {
	if (!spot || !date || spot.kind === 'shop' || spot.kind === 'shelter' || spot.indoor === true || spot.seasonal === false) return false;
	if (rule && inWindow(date, rule)) return true;
	return spot.seasonal === true && inWindow(date, defaultWinter(spot.lat));
}

const mins = (s) => {
	const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
	return m ? +m[1] * 60 + +m[2] : null;
};

/** a spot's opening ranges on an ISO weekday (1 is Monday … 7 Sunday) as [['10:00', '22:00'], …] ([] closed that day), or
 *  null when its hours aren't known */
export function dayRanges(hours, wd) {
	if (!hours || !hours.known || !hours.days) return null;
	const r = hours.days[String(wd)];
	return Array.isArray(r) ? r : null;
}

/** is a spot open at `m` minutes past midnight on ISO weekday `wd`: true, false, or null when its hours aren't known. A
 *  range that ends before it starts, or past 24:00, runs into the next day */
export function openAt(hours, wd, m) {
	const today = dayRanges(hours, wd);
	if (!today) return null;
	for (const [o, c] of today) {
		const a = mins(o);
		const b = mins(c);
		if (a == null || b == null) continue;
		if (a === b || (b > a ? m >= a && m < b : m >= a)) return true;
	}
	for (const [o, c] of dayRanges(hours, wd === 1 ? 7 : wd - 1) || []) {
		const a = mins(o);
		const b = mins(c);
		if (a == null || b == null) continue;
		if ((b < a && m < b) || (b > 1440 && m < b - 1440)) return true;
	}
	return false;
}

/** what to list near a place: `near` is [[spot, metres], …]; returns the nearest `n` within `maxM` that aren't shut for
 *  winter on `date`, how many within reach are shut (the page says "N closed for winter"), and how many more are open */
export function listNear(near, date, rule, maxM = 600, n = 3) {
	const reach = near.filter(([, m]) => m <= maxM).sort((a, b) => a[1] - b[1]);
	const open = reach.filter(([s]) => !shutFor(s, date, rule));
	return { list: open.slice(0, n), shut: reach.length - open.length, more: Math.max(0, open.length - n) };
}
