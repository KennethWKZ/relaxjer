// Destination worlds (ADR-20261117-destination-themes) and the activity marks (DAYS[i].motif): the parts that need no
// browser. Each world's day colours are checked against its own paper here; tests/e2e/world.spec.mjs checks the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT } from '../support/stage.mjs';
import { renderPNG } from '../../engine/icons.mjs';
import * as Motif from '../../engine/src/core/motif.mjs';

const THEMES = path.join(ROOT, 'engine', 'src', 'themes');
const worlds = fs
	.readdirSync(THEMES)
	.filter((f) => f.endsWith('.css'))
	.map((f) => f.replace(/\.css$/, ''));

const lum = (hex) => {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
	const [x, y] = [lum(a), lum(b)];
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// the custom properties a CSS block sets, by name
const props = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2].toLowerCase()]));

test('every world has its look and its build half, and every rule stays inside its own data-world', () => {
	assert.ok(worlds.includes('snowlight'));
	for (const w of worlds) {
		assert.ok(fs.existsSync(path.join(THEMES, `${w}.mjs`)), `${w}.mjs`);
		const css = fs.readFileSync(path.join(THEMES, `${w}.css`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		const selectors = [...css.matchAll(/(^|[{};])\s*([^{}@;]+?)\s*\{/g)].map((m) => m[2].trim()).filter((s) => !/^(from|to|\d+%)/.test(s));
		assert.ok(selectors.length > 10, `${w}.css: read its rules`);
		for (const s of selectors)
			for (const part of s.split(','))
				assert.match(part.trim(), new RegExp(`^:root\\[data-world='${w}'\\]`), `${w}.css: "${part.trim()}" would leak into other worlds`);
	}
});

test('a world day colours: white or their ink at 4.5:1, and 3:1 on the light and the dark paper', async () => {
	for (const w of worlds) {
		const css = fs.readFileSync(path.join(THEMES, `${w}.css`), 'utf8');
		const light = props(css.slice(0, css.indexOf('@media')));
		const dark = props(/\[data-theme='dark'\]\s*\{([^}]*)\}/.exec(css)[1]);
		const { paper } = await import(path.join(THEMES, `${w}.mjs`));
		assert.equal(light['--paper'], paper.light, `${w}: the theme-color is the light paper`);
		assert.equal(dark['--paper'], paper.dark, `${w}: the theme-color is the dark paper`);
		for (let n = 1; n <= 7; n++) {
			const c = light[`--l${n}`];
			assert.ok(c, `${w}: --l${n}`);
			assert.ok(contrast(c, light[`--l${n}-ink`]) >= 4.5, `${w} --l${n}: its ink`);
			assert.ok(contrast(c, paper.light) >= 3, `${w} --l${n} on the light paper: ${contrast(c, paper.light).toFixed(2)}`);
			assert.ok(contrast(c, paper.dark) >= 3, `${w} --l${n} on the dark paper: ${contrast(c, paper.dark).toFixed(2)}`);
		}
		for (const [name, set] of [
			['light', light],
			['dark', dark],
		]) {
			for (const t of ['--ink', '--ink-2', '--ink-3', '--seal'])
				for (const bg of ['--paper', '--paper-2'])
					assert.ok(contrast(set[t], set[bg]) >= 4.5, `${w} ${name}: ${t} on ${bg} ${contrast(set[t], set[bg]).toFixed(2)}`);
			assert.ok(contrast(set['--seal'], set['--seal-ink']) >= 4.5, `${w} ${name}: the seal's glyph`);
		}
	}
});

test("a world's icon: a real PNG of the asked size, the same every build, saying where it came from", async () => {
	for (const w of worlds) {
		const { iconPaint } = await import(path.join(THEMES, `${w}.mjs`));
		if (!iconPaint) continue;
		const png = renderPNG(32, iconPaint, { Source: 'drawn by code' });
		assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		assert.equal(png.readUInt32BE(16), 32); // IHDR width
		assert.equal(png.readUInt32BE(20), 32);
		assert.ok(png.includes(Buffer.from('tEXtSource\0drawn by code', 'latin1')), 'provenance chunk');
		assert.ok(renderPNG(32, iconPaint).equals(renderPNG(32, iconPaint)), 'deterministic');
		// the pixels decode back to 32 rows of 32 RGB pixels
		const idat = png.indexOf('IDAT');
		const raw = zlib.inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
		assert.equal(raw.length, 32 * (32 * 3 + 1));
	}
});

test('activity marks: each one drawn, named in both languages; anything else draws nothing', () => {
	assert.ok(Motif.names.length >= 8);
	for (const k of Motif.names) {
		assert.match(Motif.svg(k), /^<svg class="i " viewBox="0 0 24 24" aria-hidden="true">.+<\/svg>$/, k);
		const [zh, en] = Motif.MARKS[k].name;
		assert.ok(zh && en, `${k}: [zh, en]`);
	}
	for (const k of ['snowboard', 'onsen', 'zoo', 'train', 'city', 'sea']) assert.ok(Motif.names.includes(k), k);
	for (const bad of [undefined, null, '', 'constructor', 'toString', 'Skiing', 'ski day']) assert.equal(Motif.svg(bad), '', String(bad));
	// a mark borrowed from the page's sprite must be one the sprite has
	const sprite = fs.readFileSync(path.join(ROOT, 'engine', 'src', 'shell.html'), 'utf8');
	for (const m of Object.values(Motif.MARKS)) if (m.use) assert.match(sprite, new RegExp(`<symbol id="i-${m.use}"`));
});

test("the icon's mark: the drawable one on the most days, ties to the first, none when no day carries one", () => {
	const days = (...m) => m.map((motif, i) => ({ id: `d${i + 1}`, motif }));
	const draws = ['snowboard', 'onsen'];
	assert.equal(Motif.leadMotif(days('plane', 'onsen', 'snowboard', 'snowboard', 'onsen', 'snowboard', 'plane'), draws), 'snowboard');
	assert.equal(Motif.leadMotif(days('plane', 'onsen', 'snowboard', 'plane'), draws), 'onsen', 'a tie goes to the first');
	assert.equal(Motif.leadMotif(days('plane', 'plane', 'plane', 'zoo'), draws), null, 'flying days decide nothing the world cannot draw');
	assert.equal(Motif.leadMotif(days(undefined, 'city'), draws), null);
	assert.equal(Motif.leadMotif([], draws), null);
	assert.equal(Motif.leadMotif(days('snowboard'), []), null, 'a world that draws no mark');
});

test("a world's icon marks: each changes the picture, only inside the middle 80 %, and nothing else does", async () => {
	for (const w of worlds) {
		const { iconPaint, iconMarks = [] } = await import(path.join(THEMES, `${w}.mjs`));
		if (!iconPaint) continue;
		for (const m of iconMarks) assert.ok(Motif.names.includes(m), `${w}: ${m} is a DAYS[i].motif name`);
		const plain = renderPNG(64, iconPaint);
		assert.ok(renderPNG(64, (u, v) => iconPaint(u, v, null)).equals(plain), 'no mark: the plain emblem');
		assert.ok(renderPNG(64, (u, v) => iconPaint(u, v, 'not-a-mark')).equals(plain), 'an unknown mark draws nothing');
		for (const m of iconMarks) {
			assert.ok(!renderPNG(64, (u, v) => iconPaint(u, v, m)).equals(plain), `${w}: ${m} shows`);
			// a phone's round or squircle mask cuts the outer 10 % on each side: the mark stays inside it
			for (let i = 0; i <= 40; i++)
				for (const [u, v] of [
					[i / 40, 0.02],
					[i / 40, 0.98],
					[0.02, i / 40],
					[0.98, i / 40],
				]) {
					// the sky and the drifts reach the edge; the mark and its spray don't (a candle's glow may tint it faintly)
					const most = Math.max(...iconPaint(u, v, m).map((x, k) => Math.abs(x - iconPaint(u, v)[k])));
					assert.ok(most < 8, `${w} ${m} at ${u},${v}: ${most.toFixed(1)} off the plain icon`);
				}
		}
	}
});

test('a destination without a world keeps its own icon: only a pack that names a theme draws one', () => {
	const packs = fs
		.readdirSync(path.join(ROOT, 'destinations'), { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.flatMap((d) => {
			const regions = path.join(ROOT, 'destinations', d.name, 'regions');
			const sub = fs.existsSync(regions) ? fs.readdirSync(regions).map((r) => path.join(regions, r, 'pack.mjs')) : [];
			return [path.join(ROOT, 'destinations', d.name, 'pack.mjs'), ...sub].filter((f) => fs.existsSync(f));
		});
	const themed = packs.filter((f) => /^export const theme\b/m.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
	assert.deepEqual(themed, ['destinations/jp/regions/sapporo/pack.mjs'], 'a new world is a reviewed change (ADR-20261117-destination-themes)');
});
