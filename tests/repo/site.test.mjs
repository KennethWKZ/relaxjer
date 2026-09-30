// The landing page (site/) is public, so it may only ever show the synthetic demo, it must work under GitHub Pages'
// /relaxjer/ sub-path, and its deploy must publish site/ and nothing else (ADR-20260930-repo-layout; story step 6b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const SITE = path.join(ROOT, 'site');
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
const files = fs
	.readdirSync(SITE, { recursive: true, withFileTypes: true })
	.filter((e) => e.isFile())
	.map((e) => path.relative(SITE, path.join(e.parentPath, e.name)));

test('every local asset the page links resolves, relative to the page', () => {
	const refs = [...html.matchAll(/\s(?:src|href|srcset)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:)/.test(u));
	assert.ok(refs.length > 5);
	const bad = refs.filter((u) => u.startsWith('/') || !fs.existsSync(path.join(SITE, u)));
	assert.deepEqual(bad, [], 'a root-relative path breaks under the /relaxjer/ sub-path; a missing file breaks the page');
	// inline data: URLs (the lantern's paper fibre) hold their own url(#…) references; only files matter here
	const css = fs.readFileSync(path.join(SITE, 'assets', 'site.css'), 'utf8').replace(/url\("data:[^"]*"\)/g, '');
	for (const [, u] of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) assert.ok(fs.existsSync(path.join(SITE, 'assets', u)), `site.css: ${u}`);
});

test('the page loads no third-party script, style or font', () => {
	assert.doesNotMatch(html, /<script[^>]+src="https?:/);
	assert.doesNotMatch(html, /<link[^>]+href="https?:/);
	assert.doesNotMatch(fs.readFileSync(path.join(SITE, 'assets', 'site.css'), 'utf8'), /@import|url\(['"]?https?:/);
});

test('every image has alt text, and every screenshot is the synthetic demo with its provenance beside it', () => {
	for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) assert.match(tag, /\salt="/, `no alt: ${tag.slice(0, 80)}`);
	const shots = files.filter((f) => /\.(webp|png|jpe?g)$/.test(f));
	assert.ok(shots.length >= 3);
	for (const f of shots) {
		const side = path.join(SITE, `${f}.json`);
		assert.ok(fs.existsSync(side), `${f} has no provenance sidecar (impeccable embed-prompt)`);
		assert.match(fs.readFileSync(side, 'utf8'), /synthetic demo trip/, `${f} doesn't say it's the demo`);
	}
});

test('site/ holds only web assets, and the brush font ships with its licence', () => {
	const allowed = /\.(html|css|js|svg|webp|png|woff2|json|txt)$/;
	assert.deepEqual(
		files.filter((f) => !allowed.test(f)),
		[],
	);
	assert.ok(files.includes(path.join('assets', 'fonts', 'OFL.txt')), 'the SIL OFL goes with the font subset');
});

test('the Pages workflow publishes site/ only, with actions pinned to commit SHAs', () => {
	const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
	assert.match(wf, /upload-pages-artifact@[0-9a-f]{40}[\s\S]*?path: site\b/);
	for (const [, ref] of wf.matchAll(/uses:\s*[\w./-]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, `unpinned action ref: ${ref}`);
	assert.match(wf, /pages: write/);
	assert.match(wf, /id-token: write/);
});
