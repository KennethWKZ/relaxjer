// Refreshes the landing page's phone screenshots (site/assets/screens/*.webp) from the synthetic demo trip, never a
// real one: builds it without a key, serves it on localhost, pins the trip clock, language and theme through the
// page's own storage, and captures three views in light and dark. Each image gets a provenance sidecar (<file>.json)
// that tests/repo/site.test.mjs checks. Needs cwebp (brew install webp).
//   node scripts/docs-update/site-screens.mjs            # Taipei: now, day and costs (the Lanterns world)
//   node scripts/docs-update/site-screens.mjs sapporo    # Sapporo: the hero's now-snow (the Snow world)
import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const BUILD = path.join(ROOT, '.cache', 'site-screens');
const OUT = path.join(ROOT, 'site', 'assets', 'screens');
const PORT = 8179;
// each demo: day 3, mid-morning, so Now/Next has something to show; KEY is its storage prefix (Plan.storeKey: rj.<start>.)
const DEMOS = {
	taipei: { dir: 'demo-trip', CLOCK: '2027-03-15 10:20', KEY: 'rj.2027-03-13.', TZ: 'Asia/Taipei', prefix: '', shots: ['now', 'day', 'costs'] },
	sapporo: { dir: 'demo-sapporo', CLOCK: '2027-02-08 10:35', KEY: 'rj.2027-02-06.', TZ: 'Asia/Tokyo', prefix: '-snow', shots: ['now'] },
};
const which = process.argv[2] || 'taipei';
if (!DEMOS[which]) throw new Error(`site-screens: taipei or sapporo, got ${which}`);
const { dir, CLOCK, KEY, TZ, prefix, shots } = DEMOS[which];

execFileSync(
	process.execPath,
	[path.join(ROOT, 'engine', 'build.mjs'), '--trip', path.join(ROOT, 'examples', dir), '--out', BUILD, '--keys', 'none'],
	{ stdio: 'inherit' },
);
const server = spawn(process.execPath, [path.join(ROOT, 'tests', 'support', 'serve.mjs'), BUILD, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
	for (const theme of ['light', 'dark']) {
		const ctx = await browser.newContext({
			viewport: { width: 390, height: 844 },
			deviceScaleFactor: 2,
			colorScheme: theme,
			isMobile: true,
			hasTouch: true,
			timezoneId: TZ,
		});
		await ctx.addInitScript(
			([key, clock, theme]) => {
				localStorage.setItem(key + 'now', JSON.stringify(clock));
				localStorage.setItem(key + 'lang', JSON.stringify('en'));
				localStorage.setItem(key + 'theme', JSON.stringify(theme));
			},
			[KEY, CLOCK, theme],
		);
		await ctx.route(new RegExp(`^https?://(?!127\\.0\\.0\\.1:${PORT})`), (r) => r.abort());
		const page = await ctx.newPage();
		const errors = [];
		page.on('pageerror', (e) => errors.push(e.message));
		await page.goto(`http://127.0.0.1:${PORT}/trip-standalone.html`);
		await page.waitForTimeout(which === 'sapporo' ? 5000 : 1500); // a world's first-open snowfall plays out first
		const shot = async (name) => {
			const png = path.join(BUILD, `${name}-${theme}.png`);
			const webp = path.join(OUT, `${name}${prefix}-${theme}.webp`);
			await page.screenshot({ path: png });
			execFileSync('cwebp', ['-quiet', '-q', '82', png, '-o', webp]);
			const prompt = `Screenshot, not generated: RelaxJer's synthetic demo trip (examples/${dir}), built by engine/build.mjs with no key and captured with Playwright Chromium at 390x844 @2x, English, clock pinned to ${CLOCK}, theme ${theme}. No real trip data.`;
			writeFileSync(`${webp}.json`, `${JSON.stringify({ prompt, createdAt: new Date().toISOString() }, null, 2)}\n`);
			console.log(`wrote ${path.relative(ROOT, webp)}`);
		};
		await shot('now');
		if (!shots.includes('day')) {
			if (errors.length) throw new Error(`the demo page threw: ${errors.join('; ')}`);
			await ctx.close();
			continue;
		}
		// the page's own day tab: its jump holds the landing while skipped sections draw (knowledge/engine-browser.md)
		await page.locator('.tabs a[href="#d3"]').tap();
		await page.waitForTimeout(3000);
		await shot('day');
		await page.evaluate(() => {
			const el = document.getElementById('airport');
			window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 380, behavior: 'instant' });
		});
		await page.waitForTimeout(2600);
		await shot('costs');
		if (errors.length) throw new Error(`the demo page threw: ${errors.join('; ')}`);
		await ctx.close();
	}
} finally {
	await browser.close();
	server.kill();
	rmSync(BUILD, { recursive: true, force: true });
}
