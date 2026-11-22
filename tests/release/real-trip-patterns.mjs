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
import { execFileSync } from 'node:child_process';

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

/** where real trips can be: this checkout, and in a linked git worktree (an agent's, say) the main checkout too. trips/
 *  is gitignored, so a worktree never has its own copy, and the real trips stay in the main checkout */
export function tripRoots(root) {
	let out;
	try {
		out = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], {
			// a git hook sets GIT_DIR and friends for the repo it runs in; the question here is about root itself
			env: Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
	} catch {
		return { roots: [root], worktree: false }; // not a git checkout: only its own folder
	}
	const [gitDir, common] = out.trim().split('\n');
	const worktree = path.resolve(gitDir) !== path.resolve(common);
	const main = path.basename(common) === '.git' ? path.dirname(common) : null;
	return { roots: worktree && main ? [root, main] : [root], worktree };
}

const tripDirsIn = (root) => {
	const trips = path.join(root, 'trips');
	if (!fs.existsSync(trips)) return [];
	return fs
		.readdirSync(trips, { withFileTypes: true })
		.filter((e) => e.isDirectory() && fs.existsSync(path.join(trips, e.name, 'data.js')))
		.map((e) => fs.realpathSync(path.join(trips, e.name)));
};

/** [what, literal] pairs for every real trip this checkout can see. A plain checkout with no trips (CI, a fresh clone)
 *  has nothing to leak, so it gets none. A worktree that finds none, in itself or in the main checkout, throws: there
 *  the gate would otherwise pass without checking anything. RELAXJER_NO_REAL_TRIPS=1 says this machine has no real
 *  trips at all. */
export function realTripTokens(root, env = process.env) {
	const { roots, worktree } = tripRoots(root);
	const dirs = [...new Set(roots.flatMap(tripDirsIn))];
	if (!dirs.length && worktree && env.RELAXJER_NO_REAL_TRIPS !== '1')
		throw new Error(
			`Real-trip gate: ${root} is a git worktree, and no real trip was found in it or in the main checkout ` +
				`(${roots.slice(1).join(', ') || 'not found'}), so this check would pass without checking anything. ` +
				'Run it from the main checkout that holds trips/, or set RELAXJER_NO_REAL_TRIPS=1 if this machine has no real trips.',
		);
	return dirs.flatMap(tokensOfTrip);
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
