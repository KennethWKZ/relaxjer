// The host refuses a page it reads as carrying a payment card number (scripts/host-scan.mjs, knowledge/hosting.md).
// An SVG drawn inline in the CSS, JS or HTML reaches every page as text: the snow world's hills ("… 400 104 540 70 640
// 92") held 4001 0454 0706 4092 and every publish was refused (2026-11-22). Commas between path numbers draw the same.
// Pictures the build base64-encodes (themes/*-art) aren't read that way by the host, so they're left out here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';
import { pageCardRuns } from '../../scripts/host-scan.mjs';

test('nothing the engine writes into the page as text reads as a payment card number', () => {
	const src = path.join(ROOT, 'engine', 'src');
	const found = fs
		.readdirSync(src, { recursive: true })
		.filter((f) => /\.(m?js|html|css)$/.test(f))
		.flatMap((f) => pageCardRuns(fs.readFileSync(path.join(src, f), 'utf8')).map((r) => `${f}: ${r.run}`));
	assert.deepEqual(found, [], 'use commas between the numbers of an inline SVG path (it draws the same)');
});
