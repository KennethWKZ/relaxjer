// Draws RelaxJer's logo from the landing page's own brand pieces: the sky lantern (site/assets/lantern.svg) carrying
// 松 ("relax", as in 放轻松) brushed on its paper, beside "RelaxJer" in the brush face. The letters are the glyph
// outlines of the page's own subset (site/assets/fonts/ma-shan-zheng-subset.woff2, SIL OFL), shaped with HarfBuzz and
// written as paths, so the logo needs no font wherever it goes. Needs uv (fontTools + uharfbuzz, fetched on the fly).
//   node scripts/docs-update/site-logo.mjs
// Writes site/assets/logo.svg and logo-mark.svg (the lantern alone) for light ground, and each one's -dark.svg for night
// ground, where only the ink changes: the letters and the lantern's cord.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const ASSETS = path.join(ROOT, 'site', 'assets');
const FONT = path.join(ASSETS, 'fonts', 'ma-shan-zheng-subset.woff2');

// DESIGN.md tokens
const INK = '#15161a';
const NIGHT_INK = '#eef0f4';
const LANTERN = '#d9352b'; // lantern-1, Firecracker Red
const GOLD = '#e0b020'; // lantern-7, Imperial Gold
const PAPER_INK = '#ffffff'; // lantern-1-ink

// Shapes each text with the brush face and returns its glyph outlines in font units, y pointing down, origin on the
// baseline at the pen's start, plus the ink's bounding box.
const PY = String.raw`
import io, json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb
font = TTFont(sys.argv[1])
font.flavor = None
buf = io.BytesIO(); font.save(buf)
hbfont = hb.Font(hb.Face(buf.getvalue()))
glyphs = font.getGlyphSet()
order = font.getGlyphOrder()
out = {}
for text in sys.argv[2:]:
    b = hb.Buffer(); b.add_str(text); b.guess_segment_properties()
    hb.shape(hbfont, b, {'kern': True, 'liga': True})
    pen_x, parts, box = 0, [], [1e9, 1e9, -1e9, -1e9]
    for info, pos in zip(b.glyph_infos, b.glyph_positions):
        name = order[info.codepoint]
        x, y = pen_x + pos.x_offset, pos.y_offset
        svg = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(svg, (1, 0, 0, -1, x, -y)))
        bp = BoundsPen(glyphs); glyphs[name].draw(bp)
        if bp.bounds:
            x0, y0, x1, y1 = bp.bounds
            box = [min(box[0], x + x0), min(box[1], -(y + y1)), max(box[2], x + x1), max(box[3], -(y + y0))]
        parts.append({'d': svg.getCommands()})
        pen_x += pos.x_advance
    out[text] = {'parts': parts, 'box': box}
print(json.dumps(out))
`;
const shaped = JSON.parse(
	execFileSync(
		'uv',
		[
			'run',
			'--no-project',
			'--quiet',
			'--with',
			'fonttools[woff]==4.66.1',
			'--with',
			'uharfbuzz==0.56.2',
			'python',
			'-c',
			PY,
			FONT,
			'RelaxJer',
			'松',
		],
		{
			encoding: 'utf8',
		},
	),
);

const r = (n) => Math.round(n * 100) / 100;
// The brand's letter-spacing (DESIGN.md brush-brand, 0.02em), added after every glyph but the last
const TRACK = 20;
function word(text) {
	const { parts, box } = shaped[text];
	// the outlines already sit at their shaped pen positions; only the tracking moves them
	const d = parts.map((p, i) => (p.d ? `<path${i ? ` transform="translate(${TRACK * i} 0)"` : ''} d="${p.d}"/>` : '')).join('');
	return { d, box: [box[0], box[1], box[2] + TRACK * (parts.length - 1), box[3]] };
}

// The lantern, on a 100 × 100 grid: lantern.svg's shape at 3×, with the page lantern's bamboo-ring hairlines and 松
// brushed on the paper. `string` is the colour of the cord it hangs from, so it shows on either ground.
function lantern(string) {
	const glyph = shaped['松'];
	const [gx0, gy0, gx1, gy1] = glyph.box;
	const size = 40; // the glyph's ink height on the lantern
	const k = size / (gy1 - gy0);
	const tx = 50 - ((gx0 + gx1) / 2) * k;
	const ty = 49 - ((gy0 + gy1) / 2) * k;
	return [
		`<path d="M50 4v11" stroke="${string}" stroke-width="3.2" stroke-linecap="round"/>`,
		`<rect x="20" y="14" width="60" height="68" rx="19" fill="${LANTERN}"/>`,
		`<path d="M21 25h58M21 71h58" stroke="${PAPER_INK}" stroke-opacity=".35" stroke-width="1.6"/>`,
		`<g fill="${PAPER_INK}" transform="translate(${r(tx)} ${r(ty)}) scale(${r(k * 1000) / 1000})"><path d="${glyph.parts[0].d}"/></g>`,
		`<rect x="37" y="82" width="26" height="10" rx="3" fill="${GOLD}"/>`,
	].join('');
}

const NOTE = '<!-- RelaxJer logo, drawn by scripts/docs-update/site-logo.mjs; letters from Ma Shan Zheng (SIL OFL) -->';

function lockup(ink, title) {
	const w = word('RelaxJer');
	const [x0, y0, x1, y1] = w.box;
	// the lantern stands a little taller than the letters' ink and centres on it
	const markH = (y1 - y0) * 1.12;
	const k = markH / 100;
	const gap = markH * 0.2;
	const pad = markH * 0.04;
	const markY = (y0 + y1) / 2 - markH / 2;
	const top = Math.min(markY, y0) - pad;
	const bottom = Math.max(markY + markH, y1) + pad;
	const textX = markH + gap - x0;
	const width = markH + gap + (x1 - x0);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(-pad)} ${r(top)} ${r(width + pad * 2)} ${r(bottom - top)}" role="img" aria-labelledby="t">`,
		NOTE,
		`<title id="t">${title}</title>`,
		`<g transform="translate(0 ${r(markY)}) scale(${r(k * 1000) / 1000})">${lantern(ink)}</g>`,
		`<g fill="${ink}" transform="translate(${r(textX)} 0)">${w.d}</g>`,
		'</svg>',
		'',
	].join('\n');
}

const mark = (ink) =>
	[
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="t">',
		NOTE,
		'<title id="t">RelaxJer</title>',
		lantern(ink),
		'</svg>',
		'',
	].join('\n');
const files = {
	'logo.svg': lockup(INK, 'RelaxJer'),
	'logo-dark.svg': lockup(NIGHT_INK, 'RelaxJer'),
	'logo-mark.svg': mark(INK),
	'logo-mark-dark.svg': mark(NIGHT_INK),
};
for (const [name, svg] of Object.entries(files)) {
	writeFileSync(path.join(ASSETS, name), svg);
	console.log(`wrote site/assets/${name} (${(svg.length / 1024).toFixed(1)} KB)`);
}
