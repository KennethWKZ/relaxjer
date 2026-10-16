// No dead wiring: a click handler waited on a [data-zoom] button that nothing rendered, for weeks, until a known-issue
// pass found it (first trip). Every data attribute the event code acts on must appear in something the engine draws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const src = path.join(ROOT, 'engine', 'src');
const read = (dir) =>
	fs
		.readdirSync(dir)
		.filter((f) => /\.(js|mjs|html)$/.test(f))
		.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
const events = fs.readFileSync(path.join(src, 'app', '22-events.js'), 'utf8');
const all = [...read(path.join(src, 'app')), ...read(path.join(src, 'core')), ...read(src)].join('\n');

test('every data attribute the event code acts on is drawn somewhere', () => {
	const attrs = new Set([...events.matchAll(/\[data-([a-z0-9-]+)/g)].map((m) => m[1]));
	assert.ok(attrs.size > 20, 'the event code was read');
	// drawn: written as markup (data-x="…", or a bare data-x) once the selectors themselves are taken out, or set
	// through the dataset
	const markup = all.replace(/\[data-[a-z0-9-]+[^\]]*\]/g, '');
	const dead = [...attrs].filter((a) => {
		const camel = a.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
		return !new RegExp(`data-${a}(?=[=\\s>"'\`$])`).test(markup) && !new RegExp(`dataset\\.${camel}\\s*=(?!=)`).test(all);
	});
	assert.deepEqual(dead, [], 'remove the handler, or draw what it waits for');
});
