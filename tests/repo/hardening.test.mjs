// Code the page loads from a CDN is pinned and checked (ADR-20261001-page-csp): every outside script or stylesheet the
// engine adds carries a subresource-integrity hash, and the main CDN and its fallback pin the same version, so one hash
// fits both. Google Maps is the exception by design: Google ships it weekly and it can't be pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const appDir = path.join(ROOT, 'engine', 'src', 'app');
const app = fs
	.readdirSync(appDir)
	.filter((f) => f.endsWith('.js'))
	.map((f) => [f, fs.readFileSync(path.join(appDir, f), 'utf8')]);

test('every CDN script and stylesheet the engine adds carries an integrity hash', () => {
	const loads = app.flatMap(([f, src]) => [...src.matchAll(/loadTag\(\s*'(script|link)'\s*,\s*\{([^}]*)\}/g)].map((m) => [f, m[2]]));
	assert.ok(loads.length >= 4, 'the MapLibre loads were found');
	const bare = loads.filter(([, attrs]) => !/integrity:\s*SRI\.(js|css)/.test(attrs) || !/crossOrigin:\s*'anonymous'/.test(attrs));
	assert.deepEqual(bare, [], 'a loadTag without integrity + crossOrigin');
});

test('the MapLibre CDN and its fallback pin one version, and the hashes are sha384', () => {
	const src = app.find(([f]) => f.includes('maplibre'))[1];
	const versions = new Set([...src.matchAll(/maplibre-gl[@/](\d+\.\d+\.\d+)/g)].map((m) => m[1]));
	assert.equal(versions.size, 1, `one MapLibre version everywhere, found ${[...versions].join(', ')}`);
	assert.match(src, /js: 'sha384-[A-Za-z0-9+/]{64}'/);
	assert.match(src, /css: 'sha384-[A-Za-z0-9+/]{64}'/);
});
