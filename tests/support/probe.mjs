// Debug aid, not a test: loads the built page offline and prints each page error with the engine line it came from.
// Usage: node tests/support/probe.mjs [hash] [width]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './stage.mjs';

const [hash = '', width = '390'] = process.argv.slice(2);
const page = path.join(ROOT, '.cache', 'pages', 'trip.html');
if (!fs.existsSync(page)) throw new Error('no built page: run the e2e tests once first');
// engine source lines, each tagged with its file, to point an error at engine/src/app/NN-*.js:line
const appDir = path.join(ROOT, 'engine', 'src', 'app');
const app = fs
	.readdirSync(appDir)
	.sort()
	.flatMap((f) =>
		fs
			.readFileSync(path.join(appDir, f), 'utf8')
			.split('\n')
			.map((text, i) => ({ text, at: `${f}:${i + 1}` })),
	);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +width, height: 844 }, timezoneId: 'Asia/Taipei' });
await ctx.route(/^https?:/, (r) => r.abort());
const p = await ctx.newPage();
p.on('pageerror', (e) => {
	console.log(`pageerror: ${e.message}`);
	for (const l of (e.stack || '').split('\n').slice(1, 4)) {
		const m = /:(\d+):(\d+)\)?$/.exec(l);
		console.log(`  ${l.trim()}`);
		// the engine script's line inside the built page is offset; show the matching app.js line when it is unique
		if (m) {
			const html = fs.readFileSync(page, 'utf8').split('\n');
			const src = (html[+m[1] - 1] || '').slice(Math.max(0, +m[2] - 80), +m[2] + 80);
			const hit = app.find((a) => src.trim().length > 20 && a.text.includes(src.trim().slice(20, 70)));
			console.log(`    near: ${src.trim().slice(0, 160)}${hit ? `  [${hit.at}]` : ''}`);
		}
	}
});
p.on('console', (m) => m.type() === 'error' && !/Failed to load/.test(m.text()) && console.log(`console: ${m.text()}`));
await p.goto(`file://${page}${hash}`);
await p.waitForTimeout(1500);
console.log('sections:', await p.locator('#app [data-sec]').count());
await browser.close();
