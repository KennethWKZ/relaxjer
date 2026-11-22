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
import * as Sky from '../../engine/src/core/sky.mjs';
import { splitArt } from '../../engine/world-art.mjs';

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

// the page's own colours, under a world's: what a word on the page paper may be drawn in, light and dark
const BASE_CSS = fs.readFileSync(path.join(ROOT, 'engine', 'src', 'style.css'), 'utf8');
const baseLight = props(/^:root \{([^}]*)\}/m.exec(BASE_CSS)[1]);
const baseDark = props(/^:root\[data-theme='dark'\] \{([^}]*)\}/m.exec(BASE_CSS)[1]);
const TEXT = ['--ink', '--ink-2', '--ink-3', '--seal', '--link', '--mine-ink', '--good', '--warn', '--bad'];
const mixHex = (a, b, t) =>
	`#${[1, 3, 5]
		.map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t))
		.map((x) => x.toString(16).padStart(2, '0'))
		.join('')}`;

test("a world's sky behind the page: every word on the paper keeps 4.5:1 over it, light and dark, stars and flakes too", async () => {
	for (const w of worlds) {
		const { backdrop } = await import(path.join(THEMES, `${w}.mjs`));
		if (!backdrop) continue;
		const css = fs.readFileSync(path.join(THEMES, `${w}.css`), 'utf8');
		const light = { ...baseLight, ...props(css.slice(0, css.indexOf('@media'))) };
		const dark = { ...baseDark, ...props(/\[data-theme='dark'\]\s*\{([^}]*)\}/.exec(css)[1]) };
		const inColumn = (block) => Number((/--sky-in-column:\s*([\d.]+)/.exec(block) || [])[1]);
		const lightAlpha = inColumn(css.slice(0, css.indexOf('@media')));
		const darkAlpha = inColumn(/\[data-theme='dark'\]\s*\{([^}]*)\}/.exec(css)[1]);
		for (const [name, set, alpha] of [
			['light', light, lightAlpha],
			['dark', dark, darkAlpha],
		]) {
			const sky = Object.entries(set).filter(([k]) => k.startsWith('--sky-') && k !== '--sky-star');
			assert.ok(sky.length >= 6, `${w} ${name}: read its sky`);
			assert.ok(alpha > 0 && alpha <= 1, `${w} ${name}: --sky-in-column`);
			// a star or a flake over the text column shows at --sky-in-column over the night
			const star = mixHex(set['--sky-night'], set['--sky-star'], alpha);
			for (const [k, bg] of [...sky, ['a star over the column', star]])
				for (const t of TEXT) assert.ok(contrast(set[t], bg) >= 4.5, `${w} ${name}: ${t} over ${k} ${contrast(set[t], bg).toFixed(2)}`);
		}
		// every layer the build lays has its look, and the sky moves only with the scroll: its animations sit under
		// @supports (animation-timeline) and no-preference, on scroll or view timelines, with no time of their own
		for (const l of backdrop.layers) assert.match(css, new RegExp(`\\.sky-${l}\\b`), `${w}.css draws .sky-${l}`);
		const at = css.indexOf('@supports (animation-timeline: scroll())');
		assert.ok(at > 0, `${w}.css: the sky's motion waits for scroll timelines`);
		let depth = 0;
		let end = at;
		for (let i = css.indexOf('{', at); i < css.length; i++) {
			if (css[i] === '{') depth++;
			else if (css[i] === '}' && !--depth) {
				end = i;
				break;
			}
		}
		const block = css.slice(at, end);
		assert.match(block, /@media \(prefers-reduced-motion: no-preference\)/);
		assert.doesNotMatch(block, /animation:|animation-duration:(?!\s*auto)/, 'no time-based animation in the sky');
		assert.match(block, /animation-timeline: scroll\(root\)/);
		for (const [, name] of css.matchAll(/animation-name:\s*([\w-]+)/g))
			assert.ok(css.indexOf(name) > 0 && block.includes(name), `${name} runs on the scroll`);
		for (const sel of ['.world-sky', '.sky-', '.world-end']) {
			const outside = css.slice(0, at) + css.slice(end);
			assert.doesNotMatch(outside, new RegExp(`${sel.replace('.', '\\.')}[^{]*\\{[^}]*animation`), `${sel}: no motion outside the scroll`);
		}
	}
});

// the sky over the views (ADR-20261122-day-views): its band and header take each weather's colours, with the day's
// colour blended into the band's foot, and the words on them must stay readable whatever the day and the weather
test("a world's live sky: the band's words keep 4.5:1 on every weather, and the wish 3:1 in every day colour", async () => {
	const pct = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([\d.]+)%/g)].map((m) => [m[1], Number(m[2]) / 100]));
	for (const w of worlds) {
		const { sky } = await import(path.join(THEMES, `${w}.mjs`));
		if (!sky) continue;
		const css = fs.readFileSync(path.join(THEMES, `${w}.css`), 'utf8');
		const lightBlock = css.slice(0, css.indexOf('@media'));
		const darkBlock = /\[data-theme='dark'\]\s*\{([^}]*)\}/.exec(css)[1];
		const days = [1, 2, 3, 4, 5, 6, 7].map((n) => props(lightBlock)[`--l${n}`]);
		for (const [name, block] of [
			['light', lightBlock],
			['dark', darkBlock],
		]) {
			const set = { ...props(block), ...pct(block) };
			const tint = set['--sky-band-tint'];
			assert.ok(tint > 0 && tint < 0.5, `${w} ${name}: --sky-band-tint`);
			for (const kind of Sky.KINDS) {
				const k = (s) => set[`--wx-${kind}-${s}`];
				for (const s of ['top', 'mid', 'low', 'ink', 'ink-2', 'wish']) assert.ok(k(s), `${w} ${name}: --wx-${kind}-${s}`);
				assert.ok(k('amt') >= 0 && k('amt') <= 1, `${w} ${name}: --wx-${kind}-amt`);
				// the header runs top → mid, the band mid → its foot, the foot taking the day's colour at --sky-band-tint
				const feet = days.map((c) => mixHex(k('low'), c, tint));
				for (const t of ['ink', 'ink-2'])
					for (const [where, bg] of [
						['top', k('top')],
						['mid', k('mid')],
						['low', k('low')],
						...feet.map((f, i) => [`the foot on day colour ${i + 1}`, f]),
					])
						assert.ok(contrast(k(t), bg) >= 4.5, `${w} ${name} ${kind}: ${t} on ${where} ${contrast(k(t), bg).toFixed(2)}`);
				// the wish: the day's colour mixed with the weather's wish colour, large brush lettering on the band
				days.forEach((c, i) => {
					const wish = mixHex(c, k('wish'), k('amt'));
					for (const bg of [k('mid'), feet[i]])
						assert.ok(contrast(wish, bg) >= 3, `${w} ${name} ${kind}: day ${i + 1}'s wish ${contrast(wish, bg).toFixed(2)}`);
				});
			}
		}
	}
});

test("a world's banners: every activity's picture has its own moving part", () => {
	for (const w of worlds) {
		const dir = path.join(THEMES, `${w}-art`);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg') && f !== 'hero.svg'))
			assert.ok(splitArt(fs.readFileSync(path.join(dir, f), 'utf8')).actors.length > 0, `${w}-art/${f}: something in it moves`);
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

test("a world's illustrations: plain SVG named by an activity mark or 'hero', with ids of their own", () => {
	for (const w of worlds) {
		const dir = path.join(THEMES, `${w}-art`);
		if (!fs.existsSync(dir)) continue;
		const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));
		assert.ok(files.length, `${w}-art holds no SVG`);
		for (const f of files) {
			const name = f.replace(/\.svg$/, '');
			assert.ok(name === 'hero' || Motif.names.includes(name), `${w}-art/${f}: a DAYS[i].motif name or hero`);
			const svg = fs.readFileSync(path.join(dir, f), 'utf8');
			assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 640 (260|300)"/, `${f}: the banner's viewBox`);
			// the build embeds these in the page: nothing that runs, loads or blurs
			assert.doesNotMatch(svg, /<script|<foreignObject|<image|<text|<filter|\son[a-z]+=|href="(?!#)|url\((?!#)/i, `${f}: plain SVG only`);
			for (const [, id] of svg.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith(`${name}-`), `${f}: id "${id}" starts with "${name}-"`);
			assert.ok(svg.length <= (name === 'hero' ? 24000 : 16000), `${f}: ${svg.length} bytes`);
		}
	}
});

test('a drawing splits into its still part and its moving parts, each with only the defs it uses', () => {
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 260"><defs><linearGradient id="t-a"><stop/></linearGradient>' +
		'<symbol id="t-s" viewBox="0 0 10 10"><path id="t-p" d="M0 0"/><use href="#t-p"/></symbol><radialGradient id="t-g"/></defs>' +
		'<rect fill="url(#t-a)"/><g data-actor="van" data-box="64 26 128 52" transform="translate(1 2)"><g><use href="#t-s"/></g></g>' +
		'<path d="M1 1"/><g data-actor="puff" data-box="-64 0 768 26"><circle fill="url(#t-g)"/></g></svg>';
	const { base, actors } = splitArt(svg);
	assert.equal(
		base,
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 260">' +
			svg.slice(svg.indexOf('<defs>'), svg.indexOf('<g data-actor')) +
			'<path d="M1 1"/></svg>',
	);
	assert.deepEqual(
		actors.map((a) => [a.part, a.box]),
		[
			['van', [10, 10, 20, 20]],
			['puff', [-10, 0, 120, 10]],
		],
	);
	// framed by its box, keeping its own attributes, and carrying the symbol it uses (with the symbol's insides), nothing else
	assert.match(actors[0].svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="64 26 128 52"[^>]*><defs><symbol id="t-s"/);
	assert.match(actors[0].svg, /<g transform="translate\(1 2\)"><g><use href="#t-s"\/><\/g><\/g><\/svg>$/);
	assert.doesNotMatch(actors[0].svg, /t-a|t-g/);
	assert.match(actors[1].svg, /<defs><radialGradient id="t-g"\/><\/defs>/);
	// a drawing with nothing that moves comes back whole
	const still = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300"><rect/></svg>';
	assert.deepEqual(splitArt(still), { base: still, actors: [] });
	for (const bad of [
		'<svg viewBox="0 0 640 260"><g data-actor="a" data-box="0 0 0 10"></g></svg>',
		'<svg viewBox="0 0 640 260"><g data-actor="a" data-box="0 0 10 10"></g><g data-actor="a" data-box="0 0 10 10"></g></svg>',
		'<svg viewBox="0 0 640 260"><g data-actor="a" data-box="0 0 10 10"><g data-actor="b" data-box="0 0 10 10"></g></g></svg>',
		'<svg viewBox="0 0 640 260"><g data-actor="a" data-box="0 0 10 10"><g></g></svg>',
	])
		assert.throws(() => splitArt(bad), undefined, bad);
});

test("a world's moving parts: each one moves in its stylesheet, every motion rule has its part, and the overview scene holds still", () => {
	for (const w of worlds) {
		const dir = path.join(THEMES, `${w}-art`);
		if (!fs.existsSync(dir)) continue;
		const css = fs.readFileSync(path.join(THEMES, `${w}.css`), 'utf8');
		const drawn = new Set();
		for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
			const name = f.replace(/\.svg$/, '');
			const { base, actors } = splitArt(fs.readFileSync(path.join(dir, f), 'utf8'));
			assert.ok(base.length > 1000, `${f}: a picture is left under its moving parts`);
			// the overview's scene crops to a strip on a phone, and a crop would cut a moving part off where it's drawn
			if (name === 'hero') assert.equal(actors.length, 0, `${f}: the overview scene has no moving parts`);
			for (const a of actors) {
				drawn.add(`${name}-${a.part}`);
				assert.match(css, new RegExp(`\\[data-actor(='${name}-${a.part}'|\\^='${name}-')\\]`), `${w}.css moves ${name}-${a.part}`);
			}
		}
		for (const [, actor] of css.matchAll(/\[data-actor\^?='([a-z]+(?:-[a-z]+)?)'\]/g))
			assert.ok(actor.endsWith('-') ? [...drawn].some((d) => d.startsWith(actor)) : drawn.has(actor), `${w}.css: no part "${actor}" in its art`);
		// motion only where reduced motion isn't asked for, and only while the picture is on screen
		const anims = [...css.matchAll(/([^{}]+)\{[^{}]*\banimation:\s*snowlight-(?!flame|sway|hello)[^{}]*\}/g)].map((m) => m[1].trim());
		assert.ok(anims.length > 8, `${w}.css: read its picture motion`);
		for (const sel of anims) assert.match(sel, /\.is-live/, `${w}.css: "${sel}" moves only while on screen`);
		const spans = [...css.matchAll(/@media \(prefers-reduced-motion: no-preference\) \{/g)].map((m) => {
			let depth = 0;
			for (let i = m.index; i < css.length; i++) {
				if (css[i] === '{') depth++;
				else if (css[i] === '}' && !--depth) return [m.index, i];
			}
			return [m.index, css.length];
		});
		for (const sel of anims) {
			const at = css.indexOf(sel);
			assert.ok(
				spans.some(([a, b]) => at > a && at < b),
				`${w}.css: "${sel}" sits under prefers-reduced-motion: no-preference`,
			);
		}
	}
});
