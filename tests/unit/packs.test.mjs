// Destination packs (destinations/<cc>/pack.mjs, regions/<city>/pack.mjs): pure modules the build inlines as `Pack`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';
import * as tw from '../../destinations/tw/pack.mjs';
import * as taipei from '../../destinations/tw/regions/taipei/pack.mjs';
import * as jp from '../../destinations/jp/pack.mjs';
import * as sapporo from '../../destinations/jp/regions/sapporo/pack.mjs';

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

test("a pack's theme names a world the engine has: its look and its build half", () => {
	for (const f of packFiles()) {
		const m = /^export const theme = '([^']*)'/m.exec(fs.readFileSync(f, 'utf8'));
		if (!m) continue;
		assert.match(m[1], /^[a-z][a-z0-9-]*$/, `${path.relative(ROOT, f)}: theme`);
		for (const ext of ['css', 'mjs'])
			assert.ok(fs.existsSync(path.join(ROOT, 'engine', 'src', 'themes', `${m[1]}.${ext}`)), `no engine/src/themes/${m[1]}.${ext}`);
	}
	assert.equal(sapporo.theme, 'snowlight'); // Sapporo and Otaru: Snow Light Path
	assert.equal(jp.theme, undefined); // the country has no world of its own: a Tokyo summer isn't snow
	assert.equal(tw.theme ?? taipei.theme, undefined); // Taiwan keeps the default world, its sky lanterns
});

test('the native layer: a pack that names its language gives a BCP 47 tag and a [zh, en] name', () => {
	assert.deepEqual(jp.native, { lang: 'ja', name: ['日文', 'Japanese'], ask: 'この場所までお願いします。' });
	assert.equal(tw.native, undefined); // the group reads Taiwan's own script: no layer, the page as before
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

test('Japan: tax-free minimum', () => {
	assert.equal(jp.taxRefund.min, 5000); // before tax, one shop, one day (the refund method, since 2026-11-01)
});

test('Sapporo: taxi meter, with the winter and night surcharges that never stack', () => {
	// 1 km straight = 1.3 km road: ¥600 + 1 × ¥100; winter all day ×1.2 = 840, low 10% under
	assert.deepEqual(sapporo.taxiFare(1, 600, '2027-02-20'), [760, 840]);
	// 5 km = 6.5 km road: ¥600 + 21 × ¥100 = 2,700; winter at 23:00 is still ×1.2 once
	assert.deepEqual(sapporo.taxiFare(5, 1380, '2027-02-20'), [2920, 3240]);
	// the same ride in October: day rate, then the night rate alone
	assert.deepEqual(sapporo.taxiFare(5, 720, '2026-10-05'), [2430, 2700]);
	assert.deepEqual(sapporo.taxiFare(5, 1380, '2026-10-05'), [2920, 3240]);
	// the edges of winter, and no date at all (day rate)
	assert.deepEqual(sapporo.taxiFare(0.5, 720, '2026-12-10'), [650, 720]);
	assert.deepEqual(sapporo.taxiFare(0.5, 720, '2027-03-27'), [540, 600]);
	assert.deepEqual(sapporo.taxiFare(0.5, 720), [540, 600]);
});
