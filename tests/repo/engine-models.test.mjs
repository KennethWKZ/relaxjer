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

// Walking counted ×1.4 for seniors only in the add sheet: stop cards, the metro planner and the nearby lists showed a fit
// adult's pace, from three formulas (75 m and 80 m a minute), until one model took over (first trip).
test('walking minutes come from one model, at the group pace (walkMinM, GROUP_WALK)', () => {
	const all = src;
	const formulas = all.flatMap(([f, s]) => [...s.matchAll(/\*\s*1\.3\)?\s*\/\s*(75|80)\b/g)].map(() => f));
	assert.deepEqual(formulas, ['02-helpers.js'], 'only walkMinM turns metres into walking minutes');
	const factors = all.flatMap(([f, s]) => [...s.matchAll(/\b(GROUP_WALK|WW)\s*=\s*[\d.]+/g)].map(() => f));
	assert.deepEqual(factors, ['02-helpers.js'], 'the group pace is set once');
	// Google's minutes (a station's walk, a leg's) are never printed raw: a walk gets the group pace, a ride keeps its own
	const raw = all.flatMap(([f, s]) => [...s.matchAll(/\$\{(m|t)\.min\}\s?(分|min\b)/g)].map((m) => `${f}: ${m[0]}`));
	assert.deepEqual(raw, [], "a Google walking time shown at a fit adult's pace");
});
