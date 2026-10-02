// The landing page (site/) is public, so it may only ever show the synthetic demo, it must work under GitHub Pages'
// /relaxjer/ sub-path, and its deploy must publish site/ and the demo trip's page and nothing else
// (ADR-20260930-repo-layout, ADR-20261002-live-demo-on-pages; story step 6b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

const SITE = path.join(ROOT, 'site');
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
// pages built at deploy time, beside site/ (pages.yml): the live demo
const BUILT = new Set(['demo/']);
const files = fs
	.readdirSync(SITE, { recursive: true, withFileTypes: true })
	.filter((e) => e.isFile())
	.map((e) => path.relative(SITE, path.join(e.parentPath, e.name)));

test('every local asset the page links resolves, relative to the page', () => {
	const refs = [...html.matchAll(/\s(?:src|href|srcset)="([^"#]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:)/.test(u));
	assert.ok(refs.length > 5);
	const bad = refs.filter((u) => u.startsWith('/') || !(BUILT.has(u) || fs.existsSync(path.join(SITE, u))));
	assert.deepEqual(bad, [], 'a root-relative path breaks under the /relaxjer/ sub-path; a missing file breaks the page');
	// inline data: URLs (the lantern's paper fibre) hold their own url(#…) references; only files matter here
	const css = fs.readFileSync(path.join(SITE, 'assets', 'site.css'), 'utf8').replace(/url\("data:[^"]*"\)/g, '');
	for (const [, u] of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) assert.ok(fs.existsSync(path.join(SITE, 'assets', u)), `site.css: ${u}`);
});

test('the page loads no third-party script, style or font', () => {
	assert.doesNotMatch(html, /<script[^>]+src="https?:/);
	// a canonical link names the page's own address; it loads nothing
	assert.doesNotMatch(html, /<link(?![^>]*rel="canonical")[^>]+href="https?:/);
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

test('site/ holds only web assets, and each self-hosted font ships with its licence', () => {
	const allowed = /\.(html|css|js|svg|webp|png|woff2|json|txt|xml)$/;
	assert.deepEqual(
		files.filter((f) => !allowed.test(f)),
		[],
	);
	assert.ok(files.includes(path.join('assets', 'fonts', 'OFL.txt')), 'the SIL OFL goes with the brush subset');
	assert.ok(files.includes(path.join('assets', 'fonts', 'OFL-gabarito.txt')), 'the SIL OFL goes with the headline face');
});

test('search engines and link previews get a title, a description, cards and structured data', () => {
	const meta = (attr, key) => html.match(new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`))?.[1];
	const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
	assert.equal(canonical, 'https://kennethwkz.github.io/relaxjer/');
	const title = html.match(/<title>([^<]+)<\/title>/)?.[1] || '';
	assert.ok(title.length >= 20 && title.length <= 70, `title is ${title.length} characters`);
	const desc = meta('name', 'description') || '';
	assert.ok(desc.length >= 70 && desc.length <= 170, `description is ${desc.length} characters`);
	for (const k of ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt']) assert.ok(meta('property', k), `missing ${k}`);
	for (const k of ['twitter:card', 'twitter:title', 'twitter:image']) assert.ok(meta('name', k), `missing ${k}`);
	// the card image is a file on the site, under the canonical address
	const img = meta('property', 'og:image');
	assert.ok(img.startsWith(canonical), 'og:image lives under the canonical address');
	assert.ok(fs.existsSync(path.join(SITE, img.slice(canonical.length))), `no file for ${img}`);
	const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
	assert.ok(ld, 'no JSON-LD');
	const graph = JSON.parse(ld)['@graph'];
	assert.ok(graph.some((n) => n['@type'] === 'SoftwareApplication' && n.isAccessibleForFree === true));
	const sitemap = fs.readFileSync(path.join(SITE, 'sitemap.xml'), 'utf8');
	assert.match(sitemap, new RegExp(`<loc>${canonical}</loc>`));
});

test('every animated demo can be paused, and says in words what it shows', () => {
	const demos = html.split(/(?=<[^>]+\bdata-demo\b)/).slice(1);
	assert.ok(demos.length >= 8, `only ${demos.length} demos`);
	for (const d of demos) {
		const chunk = d.slice(0, d.indexOf('class="pause"') + 400);
		assert.match(chunk, /class="pause"/, 'a demo without a Pause button (WCAG 2.2.2)');
		assert.match(chunk, /role="img"\s+aria-label="Animated: [^"]{40,}"/, 'a demo without a description');
	}
});

test('the Pages workflow publishes site/ and the demo trip, never a real trip, with actions pinned to commit SHAs', () => {
	const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8');
	assert.match(wf, /upload-pages-artifact@[0-9a-f]{40}[\s\S]*?path: _site\b/);
	// what goes up: site/ as it is, and the demo trip's single file at demo/
	const copies = [...wf.matchAll(/^\s*cp\s+(.+)$/gm)].map((m) => m[1].trim());
	assert.deepEqual(copies, ['-R site/. _site/', '.cache/demo/trip-standalone.html _site/demo/index.html']);
	// the only trip it ever builds is the synthetic demo, with no key, no sync file and no secret anywhere
	const trips = [...wf.matchAll(/--trip\s+(\S+)/g)].map((m) => m[1]);
	assert.deepEqual(trips, ['examples/demo-trip']);
	assert.doesNotMatch(wf, /--keys|--sync|secrets\.|GOOGLE_|FIREBASE_/);
	assert.match(wf, /grep -q 'google key no · group sync no · demo clock /, 'the build itself must report no key and no sync');
	assert.match(wf, /set -o pipefail[\s\S]*engine\/build\.mjs[^\n]*\| tee/, 'a failing build must fail the step, not hide behind tee');
	assert.match(wf, /pnpm test && pnpm test:release[\s\S]*engine\/build\.mjs/, 'the demo contract and the release gate run before the build');
	for (const [, ref] of wf.matchAll(/uses:\s*[\w./-]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, `unpinned action ref: ${ref}`);
	assert.match(wf, /pages: write/);
	assert.match(wf, /id-token: write/);
});

test("the demo clock is the demo trip's only: the build refuses it for any other trip", () => {
	const r = spawnSync(
		process.execPath,
		[path.join(ROOT, 'engine', 'build.mjs'), '--trip', path.join(ROOT, 'tests'), '--demo-clock', '2027-03-15 10:05'],
		{ encoding: 'utf8' },
	);
	assert.equal(r.status, 2);
	assert.match(r.stderr, /for the demo trip \(examples\/demo-trip\) only/);
	const bad = spawnSync(
		process.execPath,
		[path.join(ROOT, 'engine', 'build.mjs'), '--trip', path.join(ROOT, 'examples', 'demo-trip'), '--demo-clock', 'tomorrow'],
		{ encoding: 'utf8' },
	);
	assert.equal(bad.status, 2);
	assert.match(bad.stderr, /YYYY-MM-DD HH:MM/);
});
