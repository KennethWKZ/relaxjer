// The release gate's patterns (tests/release/real-trip-patterns.mjs) on a synthetic January trip, on days no real trip can have (32–34), so this file never trips the gate itself: a dotted day (1.33)
// is a date only in prose, so code full of decimals (CSS, SVG paths, versions) passes, while every form the page
// writes is still caught everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { addedByFile, findRealTrip, isProse, realTripTokens, tokensOfTrip } from '../release/real-trip-patterns.mjs';

function januaryTrip(dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'))) {
	fs.mkdirSync(dir, { recursive: true });
	const days = ['2031-01-32', '2031-01-33', '2031-01-34'].map((date, i) => ({ id: `d${i + 1}`, date }));
	fs.writeFileSync(
		path.join(dir, 'data.js'),
		`const TRIP = { brand: '示范雪季行', start: '2031-01-32', end: '2031-01-34' };
const PLACES = { hotel: { name: ['示范旅店', 'Sample Inn'] } };
const FLIGHTS = { out: { no: 'XX 901' }, ret: { no: 'XX 902' } };
const DAYS = ${JSON.stringify(days)};`,
	);
	return tokensOfTrip(dir);
}

test('a dotted day is a date in prose, a decimal in code', () => {
	const tokens = januaryTrip();
	const code = '.stop { scale: 1.33; } <path d="M5.3 5.3l1.32 1.32"/> <circle r="1.34"/>';
	assert.deepEqual(findRealTrip(code, tokens, { prose: false }), []);
	assert.deepEqual(findRealTrip('we land 1.32, ski on 1.33', tokens), ['a trip date ×2']);
	assert.deepEqual(findRealTrip('1.32落地', tokens, { prose: true }), ['a trip date ×1']);
});

test('in prose, a multiplier, a version or a size is not a date', () => {
	const tokens = januaryTrip();
	const prose =
		'walking ×1.33, v1.32.0, [1.33.3](x), skills@1.34.0, clamp 1.32rem, 100%/1.33, 1.34x zoom, 1.5 px, a 1.33 px border, ' +
		'held 1.32 s, tilt −1.33° to 1.34°, 1.33:1 contrast, 1.32–3 s, lineHeight: 1.34, line height 1.33, (600 px; 1.32)';
	assert.deepEqual(findRealTrip(prose, tokens), []);
});

test('every form the page writes is still caught in code', () => {
	const tokens = januaryTrip();
	for (const s of ["date: '2031-01-33'", '1/33 08:00', '1月33日', '33 Jan', '1.32–1.34', '示范雪季行', 'XX 901'])
		assert.notDeepEqual(findRealTrip(s, tokens, { prose: false }), [], s);
});

test('prose is Markdown or plain text', () => {
	assert.ok(isProse('memory-bank/story-index.md'));
	assert.ok(isProse('NOTES.TXT'));
	assert.ok(!isProse('engine/src/style.css'));
	assert.ok(!isProse('engine/src/shell.html'));
});

test('Markdown code and front matter are not prose', () => {
	const tokens = januaryTrip();
	assert.deepEqual(findRealTrip('---\nlineHeight: 1.33\n---\nsee `scale(1.32)` and\n```\nr = 1.34\n```\n', tokens), []);
	assert.deepEqual(findRealTrip('---\nx: 1\n---\nwe land 1.33', tokens), ['a trip date ×1']);
});

test('a hash in a URL is not a date', () => {
	const tokens = januaryTrip();
	assert.deepEqual(findRealTrip('files.pythonhosted.org/packages/b1/33d/8b2c', tokens, { prose: false }), []);
	assert.deepEqual(findRealTrip('"1/33 08:00"', tokens, { prose: false }), ['a trip date ×1']);
});

test("a diff's added lines are split per file", () => {
	const diff = [
		'diff --git a/a.css b/a.css',
		'--- a/a.css',
		'+++ b/a.css',
		'@@ -1 +1 @@',
		'-x',
		'+scale: 1.33;',
		'diff --git a/n.md b/n.md',
		'+++ b/n.md',
		'+land 1.33',
	].join('\n');
	assert.deepEqual(addedByFile(diff), [
		{ file: 'a.css', text: 'scale: 1.33;' },
		{ file: 'n.md', text: 'land 1.33' },
	]);
});

// a throwaway repo with one commit (plumbing, so no hooks run) and a linked worktree beside it, as an agent's would be
function repoWithWorktree() {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-wt-'));
	const main = path.join(base, 'main');
	const wt = path.join(base, 'wt');
	// inside a git hook GIT_DIR and GIT_INDEX_FILE point at the real repo: none of them may reach the throwaway one
	const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
	const env = {
		...clean,
		GIT_AUTHOR_NAME: 'Test',
		GIT_AUTHOR_EMAIL: 'test@example.invalid',
		GIT_COMMITTER_NAME: 'Test',
		GIT_COMMITTER_EMAIL: 'test@example.invalid',
	};
	const git = (cwd, ...a) => execFileSync('git', a, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	fs.mkdirSync(main);
	git(main, 'init', '-q', '-b', 'main');
	const tree = git(main, 'hash-object', '-t', 'tree', '-w', '--stdin');
	git(main, 'update-ref', 'refs/heads/main', git(main, 'commit-tree', tree, '-m', 'init'));
	git(main, 'worktree', 'add', '-q', wt, '-b', 'side');
	return { main, wt };
}

test("a worktree checks the main checkout's real trips, since it has no trips/ of its own", () => {
	const { main, wt } = repoWithWorktree();
	januaryTrip(path.join(main, 'trips', 'sample'));
	const tokens = realTripTokens(wt, {});
	assert.ok(tokens.length > 0, 'the main checkout’s trip is seen from the worktree');
	assert.deepEqual(findRealTrip('back on 1/33', tokens, { prose: false }), ['a trip date ×1']);
});

test('a worktree with no real trips anywhere stops the gate, unless the machine says it has none', () => {
	const { main, wt } = repoWithWorktree();
	assert.throws(() => realTripTokens(wt, {}), /worktree.*would pass without checking anything/s);
	assert.deepEqual(realTripTokens(wt, { RELAXJER_NO_REAL_TRIPS: '1' }), []);
	// a plain checkout without trips (CI, a fresh clone) has nothing to leak: no tokens, no error
	assert.deepEqual(realTripTokens(main, {}), []);
});
