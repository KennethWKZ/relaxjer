// What would tell a stranger when and where a real family travels, derived from the real trips on this machine
// (trips/<slug>/, gitignored), so the patterns themselves are never committed. Per trip:
//   - its name on the page (TRIP.brand), the hotel's name and address, the flight numbers;
//   - every trip date, in each form the page writes it (2027-03-13, 3/13, 3月13日, 13 Mar, 3.13) and the header range;
//   - any extra lines in trips/<slug>/never-publish.txt (one literal per line, # for comments).
// Used by the release test (files as they are) and the pre-push history scan (every commit being published).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function tokensOfTrip(dir) {
	const out = [];
	const add = (what, s, min = 3) => {
		if (typeof s === 'string' && s.trim().length >= min) out.push([what, s.trim()]);
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
		for (const s of [d.date, `${m}/${day}`, `${m}月${day}日`, `${day} ${MON[m - 1]}`, `${m}.${day}`]) add('a trip date', s);
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
const boundary = (lit) => new RegExp(`(^|[^0-9])${lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9])`, 'g');

/** "what ×n" for each real-trip detail found in a text; never echoes the detail itself */
export function findRealTrip(text, tokens) {
	const counts = new Map();
	for (const [what, lit] of tokens) {
		const n = (text.match(/^[0-9]/.test(lit) ? boundary(lit) : new RegExp(lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
		if (n) counts.set(what, (counts.get(what) || 0) + n);
	}
	return [...counts].map(([what, n]) => `${what} ×${n}`);
}
