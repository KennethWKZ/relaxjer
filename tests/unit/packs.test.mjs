// Destination packs (destinations/<cc>/pack.mjs, regions/<city>/pack.mjs): pure modules the build inlines as `Pack`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';
import * as tw from '../../destinations/tw/pack.mjs';
import * as taipei from '../../destinations/tw/regions/taipei/pack.mjs';

const packFiles = (dir = path.join(ROOT, 'destinations')) =>
	fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((e) => (e.isDirectory() ? packFiles(path.join(dir, e.name)) : e.name === 'pack.mjs' ? [path.join(dir, e.name)] : []));

test('every pack is a pure module: no imports, only named exports', () => {
	const files = packFiles();
	assert.ok(files.length >= 2);
	for (const f of files) {
		const src = fs.readFileSync(f, 'utf8');
		assert.doesNotMatch(src, /^\s*import\s/m, `${path.relative(ROOT, f)} imports`);
		assert.doesNotMatch(src, /^export default/m, `${path.relative(ROOT, f)}: the build inlines named exports only`);
		assert.doesNotMatch(src, /\b(document|window|localStorage|fetch)\b/, `${path.relative(ROOT, f)} touches the page`);
	}
});

test('Taiwan: tax refund and lucky draw', () => {
	assert.equal(tw.taxRefund.min, 2000);
	assert.deepEqual(tw.luckyShares(5, 3), { repeat: 3, companions: 2, left: 0, total: 3 * 5000 + 2 * 3000 });
	assert.deepEqual(tw.luckyShares(5, 1), { repeat: 1, companions: 1, left: 3, total: 8000 });
	assert.deepEqual(tw.luckyShares(4, 9), { repeat: 4, companions: 0, left: 0, total: 20000 }); // clamped to the group
	assert.equal(tw.luckyShares(5, 0).total, 0);
});

test('Taipei: taxi meter', () => {
	assert.deepEqual(taipei.taxiFare(0.5, 600), [90, 100]); // under the first 1.25 km of road
	assert.deepEqual(taipei.taxiFare(3, 600), [160, 190]); // 3.9 km road: 85 + 14 × 5 = 155, +20% for traffic
	assert.deepEqual(taipei.taxiFare(3, 1400), [180, 210]); // the same after 23:00: +20
});

test('Taipei: YouBike request and answer', () => {
	const q = taipei.bikeShare.request(['500101001']);
	assert.equal(q.init.method, 'POST');
	assert.deepEqual(JSON.parse(q.init.body), { station_no: ['500101001'] });
	const got = taipei.bikeShare.parse({ retVal: { data: [{ station_no: 500101001, available_spaces: 4, empty_spaces: 9, status: 1 }] } });
	assert.deepEqual(got, [{ no: '500101001', bikes: 4, docks: 9, on: true }]);
	assert.deepEqual(taipei.bikeShare.parse({}), []);
});
