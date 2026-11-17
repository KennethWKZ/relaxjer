// The release gate's patterns (tests/release/real-trip-patterns.mjs) on a synthetic January trip, on days no real trip can have (32–34), so this file never trips the gate itself: a dotted day (1.33)
// is a date only in prose, so code full of decimals (CSS, SVG paths, versions) passes, while every form the page
// writes is still caught everywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addedByFile, findRealTrip, isProse, tokensOfTrip } from '../release/real-trip-patterns.mjs';

function januaryTrip() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
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
