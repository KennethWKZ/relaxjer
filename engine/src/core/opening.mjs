// Is a place open at a moment? Near me's All tab (ADR-20261128-near-me-all) reads a week of hours: Google's own week
// (drinks.json `week`: Mon…Sun, each '24h', 'closed' or 'HH:MM–HH:MM,…') or the English hours line the data refresh
// writes ('Daily 11:00–21:00', 'Mon–Fri 11:00–14:00, 17:00–21:00; Sat–Sun 10:00–21:00; closed Tue', 'Open 24 h'). An
// hours line it can't read is unknown, never closed. Pure: no imports, no DOM, no trip globals.

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CLOCK = '(\\d{1,2}):(\\d{2})';
const toMin = (h, m) => +h * 60 + +m;

/** "11:00–14:00, 17:00–21:00" → [[660, 840], [1020, 1260]], or null when it isn't only ranges */
function ranges(text) {
	const parts = String(text).split(/,\s*/);
	const out = [];
	for (const p of parts) {
		const m = p.trim().match(new RegExp(`^${CLOCK}\\s*[–\\-~～]\\s*${CLOCK}$`));
		if (!m) return null;
		out.push([toMin(m[1], m[2]), toMin(m[3], m[4])]);
	}
	return out.length ? out : null;
}

/** "Mon–Fri, Sun" → [0, 1, 2, 3, 4, 6], or null */
function days(text) {
	const out = [];
	for (const p of String(text).split(/,\s*/)) {
		const m = p.trim().match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:–(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?$/);
		if (!m) return null;
		const a = DAY.indexOf(m[1]);
		const b = m[2] ? DAY.indexOf(m[2]) : a;
		for (let i = a; ; i = (i + 1) % 7) {
			out.push(i);
			if (i === b) break;
		}
	}
	return out;
}

/** one day of hours as ranges: '24h' → [[0, 1440]], 'closed' → [], 'HH:MM–HH:MM,…' → its ranges; null when unknown */
function dayRanges(v) {
	if (v === '24h') return [[0, 1440]];
	if (v === 'closed') return [];
	return typeof v === 'string' ? ranges(v) : null;
}

/** a week of hours, Mon…Sun, each a list of [from, to] minutes ([] closed), from Google's week or the English line;
 *  null when it can't be read whole */
export function weekOf(src) {
	if (Array.isArray(src)) {
		const w = src.map(dayRanges);
		return w.length === 7 && w.every(Boolean) ? w : null;
	}
	const t = String(src || '').trim();
	if (!t) return null;
	if (/^open 24 h$/i.test(t)) return Array.from({ length: 7 }, () => [[0, 1440]]);
	const bare = ranges(t);
	if (bare) return Array.from({ length: 7 }, () => bare); // a hand-written "11:00–21:00": every day
	const out = Array(7).fill(null);
	for (const part of t.split(/;\s*/)) {
		let m = part.match(/^daily\s+(.+)$/i);
		if (m) {
			const r = ranges(m[1]);
			if (!r) return null;
			out.fill(r);
			continue;
		}
		m = part.match(/^closed\s+(.+)$/i);
		if (m) {
			const ds = days(m[1]);
			if (!ds) return null;
			for (const d of ds) out[d] = [];
			continue;
		}
		m = part.match(/^((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^\d]*?)\s+(\d.*|24 h)$/);
		const ds = m && days(m[1]);
		const r = m && (/^24 h$/.test(m[2]) ? [[0, 1440]] : ranges(m[2]));
		if (!ds || !r) return null;
		for (const d of ds) out[d] = r;
	}
	return out.every(Boolean) ? out : null;
}

/** open at `m` minutes on weekday `wd` (Mon = 0)? A range that ends before it starts runs past midnight, so the day
 *  before counts too. null when the week is unknown */
export function openAt(week, wd, m) {
	if (!week || wd == null || m == null) return null;
	const today = week[wd] || [];
	const before = week[(wd + 6) % 7] || [];
	return today.some(([a, b]) => (b > a ? m >= a && m < b : m >= a)) || before.some(([a, b]) => b < a && m < b);
}
