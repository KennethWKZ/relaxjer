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

// a phone's own settings stay on that phone: group sync (26-sync.js) never reads or writes them, so one person reading
// the figures in their home currency, at their own rate, in their own language or theme, changes nobody else's page
test('personal settings never ride group sync', () => {
	const sync = fs.readFileSync(path.join(src, 'app', '26-sync.js'), 'utf8');
	assert.match(sync, /store\.(get|set)\(/, 'the sync code was read');
	const mine = ['amounts', 'rate', 'lang', 'theme', 'maps'].filter((k) => new RegExp(`store\\.(get|set|del)\\('${k}'`).test(sync));
	assert.deepEqual(mine, []);
});

// the planner's preview panel (ADR-20261122-day-views) is a build of its own: nothing of it may reach a page that can be
// published. Its code lives only in engine/src/preview/, the build reads that folder only behind --preview and then
// writes no artifact and no standalone page, and publishing uploads only a standalone page
test('the preview panel is only in a page built with --preview', () => {
	const pv = path.join(src, 'preview');
	assert.deepEqual(fs.readdirSync(pv).sort(), ['preview.css', 'preview.js']);
	const panel = fs.readFileSync(path.join(pv, 'preview.js'), 'utf8');
	const ids = [...new Set([...panel.matchAll(/\bid = '(pv[A-Za-z]+)'/g)].map((m) => m[1]))];
	assert.ok(ids.includes('pvPanel') && ids.includes('pvChip'), 'the panel was read');
	const shipped = [all, fs.readFileSync(path.join(src, 'style.css'), 'utf8'), ...read(path.join(src, 'themes'))].join('\n');
	for (const id of [...ids, 'data-preview', 'pv-panel', 'pv-chip']) assert.ok(!shipped.includes(id), `${id} outside engine/src/preview/`);
	const build = fs.readFileSync(path.join(ROOT, 'engine', 'build.mjs'), 'utf8');
	const reads = [...build.matchAll(/^.*previewDir.*$/gm)].map((m) => m[0].trim()).filter((l) => !l.startsWith('const previewDir'));
	assert.ok(reads.length >= 2, 'the build was read');
	for (const l of reads) assert.match(l, /= preview \?/, `read only behind --preview: ${l}`);
	assert.match(build, /if \(!preview\) fs\.writeFileSync\(path\.join\(out, `\$\{fileBase\}\.html`\), artifact\)/);
	assert.match(build, /`\$\{fileBase\}-\$\{preview \? 'preview' : 'standalone'\}\.html`/);
	const publish = fs.readFileSync(path.join(ROOT, 'scripts', 'publish-trip.mjs'), 'utf8');
	assert.match(publish, /endsWith\('-standalone\.html'\)/);
	assert.ok(!publish.includes('-preview'), 'publishing never picks up a preview page');
});
