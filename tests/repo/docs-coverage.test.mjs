// What RelaxJer can do stays written down where planners and agents look for it: every field the demo trip uses is in
// trip-format.md, every side file the build reads too, every skill and role is listed where a planner or an agent
// starts, every guide is linked from the README, every command is in AGENTS.md, and every link to a heading still lands
// on one. A feature that ships without its docs fails here, naming what's missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DEMO_TRIP } from '../support/stage.mjs';
import { loadTrip } from '../support/trip-contract.mjs';

const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const lock = JSON.parse(read('skills-lock.json')).skills;
const ownSkills = fs
	.readdirSync(path.join(ROOT, '.agents', 'skills'))
	.filter((n) => !lock[n])
	.sort();
const roles = fs
	.readdirSync(path.join(ROOT, '.claude', 'agents'))
	.map((f) => f.replace(/\.md$/, ''))
	.sort();
const missingFrom = (file, names) => names.filter((n) => !read(file).includes(`\`${n}\``)).map((n) => `${file}: ${n}`);

/** every word inside a backtick span of trip-format.md, so `DAYS[i].split` documents both DAYS and split */
const documented = new Set(
	[...read('memory-bank', 'standards', 'trip-format.md').matchAll(/`([^`]+)`/g)].flatMap((m) => m[1].match(/[A-Za-z_][\w-]*/g) || []),
);
const keys = (objs) => [...new Set(objs.filter((o) => o && typeof o === 'object' && !Array.isArray(o)).flatMap(Object.keys))];

test('every field the demo trip uses is documented in trip-format.md', () => {
	const t = loadTrip(DEMO_TRIP);
	const days = t.DAYS;
	const stops = days.flatMap((d) => d.schedule);
	const used = {
		'top-level blocks': Object.keys(t).filter((k) => t[k] !== undefined),
		TRIP: Object.keys(t.TRIP),
		'DAYS[i]': keys(days),
		'a stop': keys(stops),
		'a stop’s rel': keys(stops.map((s) => s.rel)),
		'day card types': [...new Set(days.flatMap((d) => d.blocks.map((b) => b.type)))],
		'a split': keys(days.map((d) => d.split)),
		'a split plan': keys(days.flatMap((d) => d.split?.options || [])),
		'a place': keys(Object.values(t.PLACES)),
		OPTIONAL: keys(t.OPTIONAL),
		SHOPLISTS: keys(t.SHOPLISTS || []),
		'a shop': keys((t.SHOPLISTS || []).flatMap((l) => l.shops)),
		CHECKLIST: keys(t.CHECKLIST),
		'a checklist item': keys(t.CHECKLIST.flatMap((g) => g.items)),
		AIRPORT: Object.keys(t.AIRPORT),
		'FLIGHTS.ret.plan': Object.keys(t.FLIGHTS.ret.plan || {}),
	};
	const missing = Object.entries(used).flatMap(([where, names]) => names.filter((n) => !documented.has(n)).map((n) => `${where}: ${n}`));
	assert.deepEqual(missing, [], 'add each to memory-bank/standards/trip-format.md, in backticks');
});

test('every TRIP setting the engine or the build reads is documented', () => {
	const src = [
		...fs.readdirSync(path.join(ROOT, 'engine', 'src', 'app')).map((f) => read('engine', 'src', 'app', f)),
		read('engine', 'build.mjs'),
	].join('\n');
	const fields = [...new Set([...src.matchAll(/\bTRIP\??\.([a-zA-Z]\w*)/g)].map((m) => m[1]))].sort();
	assert.ok(fields.length > 10);
	assert.deepEqual(
		fields.filter((f) => !documented.has(f)),
		[],
	);
});

test('every side file the build reads is in trip-format.md', () => {
	const files = [...read('engine', 'build.mjs').matchAll(/readJSON\('(?:src\/)?([^']+\.json)'/g)].map((m) => m[1]);
	assert.ok(files.length >= 8);
	const format = read('memory-bank', 'standards', 'trip-format.md');
	assert.deepEqual(
		files.filter((f) => !format.includes(path.basename(f))),
		[],
	);
});

test('every skill and role is listed where planners and agents start', () => {
	assert.deepEqual(
		[
			...missingFrom('README.md', ownSkills),
			...missingFrom('.agents/README.md', ownSkills),
			...missingFrom('guides/getting-started.md', [...ownSkills, ...roles]),
			...missingFrom('AGENTS.md', [...ownSkills, ...roles]),
		],
		[],
	);
});

test('every guide is linked from the README', () => {
	const readme = read('README.md');
	const guides = fs.readdirSync(path.join(ROOT, 'guides')).filter((f) => f.endsWith('.md'));
	assert.deepEqual(
		guides.filter((g) => !readme.includes(`](guides/${g}`)),
		[],
	);
});

test('every package script a person runs is in AGENTS.md', () => {
	const internal = new Set(['prepare', 'lint:check', 'format:check']); // husky's install hook; the halves of `pnpm verify`
	const scripts = Object.keys(JSON.parse(read('package.json')).scripts).filter((s) => !internal.has(s));
	const agents = read('AGENTS.md');
	assert.deepEqual(
		scripts.filter((s) => !new RegExp(`pnpm ${s.replace(/[:]/g, '\\:')}(?![\\w:-])`).test(agents)),
		[],
	);
});

test('every group-sync command is in the sync-setup skill', () => {
	const cmds = [...read('scripts', 'sync', 'sync.mjs').matchAll(/cmd === '(\w+)'/g)].map((m) => m[1]);
	assert.ok(cmds.length >= 5);
	const skill = read('.agents', 'skills', 'sync-setup', 'SKILL.md');
	assert.deepEqual(
		cmds.filter((c) => !skill.includes(`pnpm sync ${c}`)),
		[],
	);
});

// GitHub's heading anchors: lower case, punctuation dropped (letters, digits, spaces, `-` and `_` kept), spaces → `-`,
// and a repeated heading gets -1, -2…
const anchorsOf = (file) => {
	const seen = new Map();
	const out = new Set();
	const text = fs.readFileSync(file, 'utf8').replace(/^```[\s\S]*?^```/gm, '');
	for (const [, h] of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
		const base = h
			.replace(/<[^>]+>/g, '')
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s_-]/gu, '')
			.trim()
			.replace(/\s/g, '-');
		const n = seen.get(base) || 0;
		seen.set(base, n + 1);
		out.add(n ? `${base}-${n}` : base);
	}
	return out;
};

test('every link to a heading in the docs lands on one', () => {
	const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], { cwd: ROOT, encoding: 'utf8' })
		.split('\n')
		.filter((f) => f && !Object.keys(lock).some((n) => f.startsWith(`.agents/skills/${n}/`)) && fs.existsSync(path.join(ROOT, f)));
	const broken = [];
	for (const f of files) {
		const prose = read(f).replace(/^```[\s\S]*?^```/gm, '');
		for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
			if (/^(https?:|mailto:|data:)/.test(target) || !target.includes('#')) continue;
			const [file, anchor] = target.split('#');
			const into = file ? path.resolve(ROOT, path.dirname(f), decodeURIComponent(file)) : path.join(ROOT, f);
			if (!into.endsWith('.md') || !fs.existsSync(into)) continue;
			if (!anchorsOf(into).has(decodeURIComponent(anchor))) broken.push(`${f} → ${target}`);
		}
	}
	assert.deepEqual(broken, []);
});
