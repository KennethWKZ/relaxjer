// What would tell a stranger when and where a real family travels, derived from the real trips on this machine
// (trips/<slug>/, gitignored), so the patterns themselves are never committed. Per trip:
//   - its name on the page (TRIP.brand), the hotel's name and address, the flight numbers;
//   - every trip date, in each form the page writes it (2027-03-13, 3/13, 3月13日, 13 Mar) and the header range
//     (3.13–3.19); the dotted day (3.13) only in prose (Markdown, plain text, commit messages), where people write
//     dates that way. In code it is just a decimal (line-height: 1.4, an SVG path), and the page never writes it;
//   - any extra lines in trips/<slug>/never-publish.txt (one literal per line, # for comments).
// Used by the release test (files as they are), the commit-msg scan (the staged diff and the message: scan-staged.mjs)
// and the pre-push history scan (every commit being published).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function tokensOfTrip(dir) {
	const out = [];
	// [what, literal, where]: where is 'all', or 'prose' for a form that is only a date in prose
	const add = (what, s, min = 3, where = 'all') => {
		if (typeof s === 'string' && s.trim().length >= min) out.push([what, s.trim(), where]);
	};
	const ctx = {};
	vm.createContext(ctx);
	vm.runInContext(`${fs.readFileSync(path.join(dir, 'data.js'), 'utf8')};this.__t={TRIP,DAYS,FLIGHTS,PLACES};`, ctx);
	const { TRIP, DAYS, FLIGHTS, PLACES } = ctx.__t;
	add('the trip name', TRIP.brand);
	const hotel = PLACES && PLACES.hotel;
	if (hotel) {
		for (const n of hotel.name || []) add('the hotel', n);
		add('the hotel address', hotel.addr);
		add('the hotel address', hotel.addrEn);
	}
	for (const f of [FLIGHTS?.out, FLIGHTS?.ret]) if (f) add('a flight number', f.no);
	for (const d of DAYS || []) {
		const [m, day] = [+d.date.slice(5, 7), +d.date.slice(8, 10)];
		for (const s of [d.date, `${m}/${day}`, `${m}月${day}日`, `${day} ${MON[m - 1]}`]) add('a trip date', s);
		add('a trip date', `${m}.${day}`, 3, 'prose');
	}
	if (TRIP.start && TRIP.end) {
		const [m1, d1, m2, d2] = [+TRIP.start.slice(5, 7), +TRIP.start.slice(8, 10), +TRIP.end.slice(5, 7), +TRIP.end.slice(8, 10)];
		add('the trip dates', `${d1}–${d2}`);
		add('the trip dates', `${m1}.${d1}–${m2}.${d2}`);
	}
	const extra = path.join(dir, 'never-publish.txt');
	if (fs.existsSync(extra))
		for (const l of fs.readFileSync(extra, 'utf8').split('\n')) if (l.trim() && !l.trim().startsWith('#')) add('a private note', l, 2);
	return out;
}

/** [what, literal] pairs for every real trip under root/trips (none on a machine without trips, e.g. CI) */
export function realTripTokens(root) {
	const trips = path.join(root, 'trips');
	if (!fs.existsSync(trips)) return [];
	return fs
		.readdirSync(trips, { withFileTypes: true })
		.filter((e) => e.isDirectory() && fs.existsSync(path.join(trips, e.name, 'data.js')))
		.flatMap((e) => tokensOfTrip(path.join(trips, e.name)));
}

// a date like "3/13" must not match inside "13/3/130" or "2026/3/13": require a non-digit (or edge) on both sides
// … nor touch a letter, so a hash in a URL or a lock file (packages/b1/32d/) is not a date
const boundary = (lit) => new RegExp(`(^|[^0-9A-Za-z])${lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`, 'g');
// a dotted day in prose stands alone ("land 1.4", "1.4落地"); a multiplier (×1.4), a version (v1.4.0, @1.4.2), a value
// after a colon or in a list of values (lineHeight: 1.4; 600 px; 1.12), after a measurement word (line height 1.4),
// or a measurement (1.4rem, 1.5 px, 1.5 s, 1.4°, 1.5:1, 1.5–3) is not a date
const UNIT = '\\s?(?:px|pt|em|rem|s|ms|min|h|km|m|x|°|%)(?![A-Za-z])';
const dottedDay = (lit) =>
	new RegExp(
		`(?<![0-9A-Za-z@×*/.:−-])(?<![:;−-]\\s)(?<!(?:height|width|ratio|scale|opacity|weight|size|spacing|factor)\\s)${lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9]|\\.[0-9]|[A-Za-z%°]|:[0-9]|\\s?[–-]\\s?[0-9]|${UNIT})`,
		'g',
	);
// in Markdown, code (fenced blocks, `spans`) and YAML front matter are code, not prose
const proseOnly = (text) =>
	text
		.replace(/^---\n[\s\S]*?\n---\n/, '')
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`[^`\n]*`/g, '');

/** prose is where a dotted date (1.4) means a date: Markdown, plain text (commit messages are prose too) */
export const isProse = (file) => /\.(md|markdown|txt)$/i.test(file);

/** a diff's added lines, per file: [{ file, text }] (git diff/show --unified=0 output) */
export function addedByFile(diff) {
	const out = [];
	let cur = null;
	for (const l of diff.split('\n')) {
		if (l.startsWith('+++ ')) {
			cur = { file: l.replace(/^\+\+\+ (b\/)?/, ''), lines: [] };
			out.push(cur);
		} else if (cur && l.startsWith('+')) cur.lines.push(l.slice(1));
	}
	return out.map((x) => ({ file: x.file, text: x.lines.join('\n') }));
}

/** "what ×n" for each real-trip detail found in a text; never echoes the detail itself. `prose: false` (code) skips
    the forms that are only dates in prose; the default checks every form */
export function findRealTrip(text, tokens, { prose = true } = {}) {
	const counts = new Map();
	for (const [what, lit, where = 'all'] of tokens) {
		if (where === 'prose' && !prose) continue;
		const re = where === 'prose' ? dottedDay(lit) : /^[0-9]/.test(lit) ? boundary(lit) : new RegExp(lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
		const n = ((where === 'prose' ? proseOnly(text) : text).match(re) || []).length;
		if (n) counts.set(what, (counts.get(what) || 0) + n);
	}
	return [...counts].map(([what, n]) => `${what} ×${n}`);
}
