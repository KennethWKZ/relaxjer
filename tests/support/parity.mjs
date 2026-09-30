// Dev tool, not a test (it may read a real trip): builds a trip twice and diffs what the reader sees.
//   reference = the engine at a git ref (a commit from before your change) + the trip's data as it was
//   current   = engine/ now + the trip's data now
// Both are rendered offline in Chromium at 390 px, in both languages, with every <details> opened; the text of each
// top-level section is compared. Usage:
//   node tests/support/parity.mjs --ref <commit> --trip trips/<slug> [--ref-data /path/to/the/trip/as/it/was]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { ROOT } from './stage.mjs';

const argv = process.argv.slice(2);
const arg = (n, f) => {
	const i = argv.indexOf(`--${n}`);
	return i >= 0 ? argv[i + 1] : f;
};
const trip = path.resolve(arg('trip', 'examples/demo-trip'));
const refData = path.resolve(arg('ref-data', trip));
const ref = arg('ref', '');
if (!ref) {
	console.error('usage: node tests/support/parity.mjs --ref <commit> --trip <dir> [--ref-data <dir>]');
	process.exit(2);
}
const work = path.join(ROOT, '.cache', 'parity');
fs.rmSync(work, { recursive: true, force: true });

// reference engine: engine/ as it was at `ref`
const refEngine = path.join(work, 'ref-engine');
for (const f of execFileSync('git', ['ls-tree', '-r', '--name-only', ref, 'engine/'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)) {
	const to = path.join(refEngine, f.replace(/^engine\//, ''));
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.writeFileSync(to, execFileSync('git', ['show', `${ref}:${f}`], { cwd: ROOT }));
}
const build = (engineDir, tripDir, out) => {
	// the baseline engine had one src/app.js; the current one has src/app/*.js; both builds take the same flags
	execFileSync(process.execPath, [path.join(engineDir, 'build.mjs'), '--trip', tripDir, '--out', out, '--keys', 'none'], {
		cwd: ROOT,
		env: { PATH: process.env.PATH },
		stdio: 'pipe',
	});
	return path.join(out, 'taipei-trip-standalone.html');
};
const pages = { ref: build(refEngine, refData, path.join(work, 'ref')), cur: build(path.join(ROOT, 'engine'), trip, path.join(work, 'cur')) };

const server = http
	.createServer((req, res) => {
		const which = req.url.startsWith('/ref') ? 'ref' : 'cur';
		res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		res.end(fs.readFileSync(pages[which]));
	})
	.listen(0, '127.0.0.1');
const port = await new Promise((r) => server.on('listening', () => r(server.address().port)));

const browser = await chromium.launch();
async function sections(which, lang) {
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Taipei' });
	await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
	await ctx.addInitScript(
		({ lang }) => {
			localStorage.setItem('tp5.lang', JSON.stringify(lang));
			localStorage.setItem('tp5.now', JSON.stringify('2020-01-01 09:00'));
		},
		{ lang },
	);
	const p = await ctx.newPage();
	const errors = [];
	p.on('pageerror', (e) => errors.push(e.message));
	await p.goto(`http://127.0.0.1:${port}/${which}`);
	await p.waitForTimeout(600);
	const out = await p.evaluate(async () => {
		document.querySelectorAll('#app details').forEach((d) => {
			d.open = true;
			d.dispatchEvent(new Event('toggle'));
		});
		await new Promise((r) => setTimeout(r, 400));
		const norm = (s) => s.replace(/\s+/g, ' ').trim();
		const o = {
			_bar: norm(document.querySelector('.bar')?.textContent || ''),
			_title: document.title,
			_q: document.querySelector('#q')?.placeholder || '',
			_foot: norm(document.querySelector('#foot')?.textContent || ''),
		};
		for (const s of document.querySelectorAll('#app > section')) o[s.id] = norm(s.textContent);
		return o;
	});
	await ctx.close();
	return { out, errors };
}

let diffs = 0;
for (const lang of ['zh', 'en']) {
	const a = await sections('ref', lang),
		b = await sections('cur', lang);
	for (const e of [...a.errors.map((x) => `ref: ${x}`), ...b.errors.map((x) => `cur: ${x}`)]) console.log(`[${lang}] PAGE ERROR ${e}`);
	for (const k of new Set([...Object.keys(a.out), ...Object.keys(b.out)])) {
		const x = a.out[k] ?? '(missing)',
			y = b.out[k] ?? '(missing)';
		if (x === y) continue;
		diffs++;
		// show the first place the two differ, with a little context
		let i = 0;
		while (i < x.length && x[i] === y[i]) i++;
		console.log(
			`[${lang}] #${k} differs at ${i}:\n    ref: …${x.slice(Math.max(0, i - 50), i + 90)}…\n    cur: …${y.slice(Math.max(0, i - 50), i + 90)}…`,
		);
	}
}
await browser.close();
server.close();
console.log(diffs ? `${diffs} section(s) differ` : 'PARITY: every section reads the same in both languages');
