// Draws the landing page's home-screen icon (site/assets/apple-touch-icon.png, 180x180) from the logo's lantern
// (site/assets/logo-mark.svg, the favicon's lantern with 松 on its paper), on the page's morning sky. iOS ignores an SVG icon and fills a transparent one with black,
// so the icon is an opaque PNG. It gets a provenance sidecar (<file>.json) that tests/repo/site.test.mjs checks.
//   node scripts/docs-update/site-icon.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const ASSETS = path.join(ROOT, 'site', 'assets');
const OUT = path.join(ASSETS, 'apple-touch-icon.png');
const SIZE = 180;
const SKY = '#d3e6f9'; // the page's light theme-color: the top of the morning sky

const svg = readFileSync(path.join(ASSETS, 'logo-mark.svg'), 'utf8');
const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
	// iOS rounds the corners itself; the lantern keeps clear of them (the mark's own margins come on top)
	await page.setContent(
		`<body style="margin:0;width:${SIZE}px;height:${SIZE}px;background:${SKY};display:grid;place-items:center">` +
			`<div style="width:120px;height:120px">${svg.replace('<svg ', '<svg width="120" height="120" ')}</div></body>`,
	);
	await page.screenshot({ path: OUT, omitBackground: false });
} finally {
	await browser.close();
}
const prompt = `Drawn, not a screenshot or generated: site/assets/logo-mark.svg rendered with Playwright Chromium at 120 px on ${SKY}, ${SIZE}x${SIZE}. No trip data.`;
writeFileSync(`${OUT}.json`, `${JSON.stringify({ prompt, createdAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
