// Lessons from the map search on a live trip, kept as checks on the engine's source:
// - the map's search box had no Enter handler, and a field outside a form gets nothing from Enter, so the phone's Search
//   key left the keyboard over the results. Every typing field says what its Enter key does (enterkeyhint), and 22-events
//   lets go of the field on Enter;
// - a Chinese or Japanese input method's Enter picks characters. A handler that read `key === 'Enter'` acted on it (a
//   half-typed name saved, a search jumped). Every Enter goes through enterKey (02-helpers.js);
// - a Google result's pin reused the toilet list's `.spot` class, a bordered flex row, which squeezed the pin's ring to a
//   sliver. A map pin's classes stay in its own family: lpin, lpin-*, and the states sel and dest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const src = path.join(ROOT, 'engine', 'src');
const files = ['app', 'core', '.'].flatMap((d) =>
	fs
		.readdirSync(path.join(src, d))
		.filter((f) => /\.(m?js|html)$/.test(f))
		.map((f) => ({ name: path.join(d, f), text: fs.readFileSync(path.join(src, d, f), 'utf8') })),
);

test('every field the page types into says what its Enter key does', () => {
	const fields = files.flatMap(({ name, text }) =>
		[...text.matchAll(/<input\b[^>]*>/g)]
			.map((m) => m[0])
			.filter((tag) => /type="(search|text|password)"/.test(tag))
			.map((tag) => ({ name, tag })),
	);
	assert.ok(fields.length >= 5, 'the fields were found');
	const missing = fields.filter((f) => !/enterkeyhint="(search|go|done|next|send|enter)"/.test(f.tag));
	assert.deepEqual(
		missing.map((f) => `${f.name}: ${f.tag.slice(0, 80)}`),
		[],
		'add enterkeyhint (search, go, done…), and make sure 22-events acts on that Enter',
	);
});

test('every Enter the engine acts on waits for an input method to finish (enterKey)', () => {
	const raw = files.flatMap(({ name, text }) =>
		text
			.split('\n')
			.map((line, i) => ({ name, line, n: i + 1 }))
			.filter(({ line }) => /key\s*===?\s*['"]Enter['"]/.test(line) && !/const enterKey\b/.test(line)),
	);
	assert.deepEqual(
		raw.map((r) => `${r.name}:${r.n}`),
		[],
		'use enterKey(e) from 02-helpers.js: a Chinese or Japanese input method’s Enter picks characters',
	);
	assert.ok(
		files.some(({ text }) => /const enterKey = \(e\) => e\.key === 'Enter' && !e\.isComposing && e\.keyCode !== 229/.test(text)),
		'enterKey checks isComposing and Safari’s keyCode 229',
	);
});

test('a map pin’s classes stay in the pin’s own family', () => {
	const sets = files.flatMap(({ name, text }) =>
		[...text.matchAll(/className\s*=\s*['"`]([^'"`]*\blpin\b[^'"`]*)['"`]/g)].map((m) => ({ name, cls: m[1] })),
	);
	assert.ok(sets.length >= 2, 'the pins were found');
	const stray = sets.flatMap(({ name, cls }) =>
		cls
			.split(/\s+/)
			.filter(Boolean)
			.filter((c) => !/^(lpin(-[a-z]+)*|sel|dest)$/.test(c))
			.map((c) => `${name}: "${c}" in "${cls}"`),
	);
	assert.deepEqual(stray, [], 'name it lpin-<thing>: a class shared with another component brings that component’s styles');
});
