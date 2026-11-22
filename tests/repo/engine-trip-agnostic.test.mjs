// The engine serves any destination. The country Google's search and map lean to, and the Chinese they answer in, come
// from the trip (TRIP.destination, a country code) and its pack (googleZh): a fixed 'tw' and 'zh-TW' once sent a Japan
// trip's place searches to Taiwan (2026-11-22).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const src = path.join(ROOT, 'engine', 'src');
const files = fs
	.readdirSync(src, { recursive: true })
	.filter((f) => /\.(m?js|html|css)$/.test(f))
	.map((f) => [f, fs.readFileSync(path.join(src, f), 'utf8')]);
const hits = (re) => files.flatMap(([f, s]) => [...s.matchAll(re)].map((m) => `${f}: ${m[0]}`));

test('no country or region code is fixed in the engine', () => {
	assert.deepEqual(hits(/\bregion\s*[:=]\s*['"`][A-Za-z]{2}['"`]/g), [], 'a region literal in a Google request');
	assert.deepEqual(hits(/[?&]region=[A-Za-z]{2}\b/g), [], 'a region literal in a Google URL');
	assert.deepEqual(hits(/\blanguage\s*[:=][^,\n]*['"`][a-z]{2,3}-[A-Z]{2}['"`]/g), [], 'a language tied to a country');
	assert.deepEqual(hits(/[?&]language=[a-z]{2,3}-[A-Z]{2}\b/g), [], 'a language tied to a country, in a URL');
	assert.deepEqual(hits(/['"`](zh-TW|zh-HK|zh-CN|ja-JP|ko-KR)['"`]/g), [], "a destination's language tag: the pack's to say");
});

test("every Google search asks in the trip's language and country", () => {
	const calls = files.flatMap(([f, s]) => [...s.matchAll(/searchByText\(\{[\s\S]*?\}\);/g)].map((m) => [f, m[0]]));
	assert.ok(calls.length >= 2, 'the place searches are where this test looks for them');
	for (const [f, c] of calls) {
		assert.match(c, /language: gLang\(\)/, `${f}: a search without the page's Google language`);
		assert.match(c, /gRegion\(\) \? \{ region: gRegion\(\) \}/, `${f}: a search without the trip's country`);
	}
	const url = hits(/maps\.googleapis\.com\/maps\/api\/js\?.*/g); // the script's address, to the end of its line
	assert.equal(url.length, 1);
	assert.match(url[0], /language=\$\{encodeURIComponent\(gLang\(\)\)\}/);
	assert.match(url[0], /region=\$\{gRegion\(\)\.toUpperCase\(\)\}/);
});
