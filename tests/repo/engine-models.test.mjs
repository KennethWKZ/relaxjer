// One estimate, one place: the engine once timed the same 2.6 km taxi leg as 19 min in the add sheet and 13 min on the
// added stop, because four copies of the formula had drifted apart (pre-departure pass, 2026-10-07).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const app = path.join(ROOT, 'engine', 'src', 'app');
const src = fs
	.readdirSync(app)
	.filter((f) => f.endsWith('.js'))
	.map((f) => [f, fs.readFileSync(path.join(app, f), 'utf8')]);

test('taxi minutes come from one model (taxiMin)', () => {
	const copies = src.flatMap(([f, s]) => [...s.matchAll(/\/\s*22\)\s*\*\s*60/g)].map(() => f));
	assert.deepEqual(copies, ['05-render-small-parts.js'], 'only taxiMin computes a taxi time');
});
