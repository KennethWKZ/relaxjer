// A destination world's illustration, split for motion (ADR-20261121-world-motion). An illustration is one hand-drawn
// SVG, and it is the still picture: what the page shows under reduced motion. A part of it that may move is a group
// `<g data-actor="<part>" data-box="x y w h">`, with the box it moves in, in the drawing's own units. The build cuts
// each such group out into a picture of its own (the <defs> it uses, then the group, framed by its box) and the page
// lays it back over the rest at that box, so the drawing looks the same at rest and the world's stylesheet can move the
// part with transform and opacity alone. Pure: no imports, no files; engine/build.mjs reads and embeds.

/** the drawing's size, from its root viewBox ("0 0 640 260" → [640, 260]) */
export function artSize(svg) {
	const m = /^<svg\b[^>]*\sviewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
	if (!m) throw new Error('a world picture starts with <svg … viewBox="0 0 W H">');
	return [Number(m[1]), Number(m[2])];
}

/** where the <g> that opens at `at` closes: the index of its "</g>" (nested groups counted) */
function groupEnd(svg, at) {
	const tag = /<g[\s>]|<\/g>/g;
	tag.lastIndex = at + 2;
	let depth = 1;
	for (let m; (m = tag.exec(svg));) {
		depth += m[0] === '</g>' ? -1 : 1;
		if (!depth) return m.index;
	}
	throw new Error('an actor group is never closed');
}

const round = (n) => Math.round(n * 1000) / 1000;

/** the top-level elements inside <defs>, each with the ids it holds (a symbol's inner ids belong to the symbol) */
function defsParts(defs) {
	const body = defs.replace(/^<defs>|<\/defs>$/g, '');
	const parts = [];
	let at = 0;
	while (at < body.length) {
		const start = body.indexOf('<', at);
		if (start < 0) break;
		const name = /^<([a-zA-Z]+)/.exec(body.slice(start))[1];
		const head = body.indexOf('>', start);
		let end;
		if (body[head - 1] === '/') end = head + 1;
		else {
			// the matching close of this element, counting nested elements of the same name
			const tag = new RegExp(`<${name}[\\s>/]|</${name}>`, 'g');
			tag.lastIndex = head + 1;
			let depth = 1;
			for (let m; depth && (m = tag.exec(body));) {
				if (m[0] === `</${name}>`) depth--;
				else if (body[body.indexOf('>', m.index) - 1] !== '/') depth++;
				end = m.index + m[0].length;
			}
		}
		const el = body.slice(start, end);
		parts.push({ el, ids: [...el.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]) });
		at = end;
	}
	return parts;
}
const refs = (s) => [...s.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map((m) => m[1] || m[2]);

/** the <defs> a fragment needs: the parts it refers to, and the parts those refer to */
function defsFor(defs, fragment) {
	if (!defs) return '';
	const parts = defsParts(defs);
	const keep = new Set();
	const todo = refs(fragment);
	while (todo.length) {
		const id = todo.pop();
		const i = parts.findIndex((p) => p.ids.includes(id));
		if (i < 0 || keep.has(i)) continue;
		keep.add(i);
		todo.push(...refs(parts[i].el));
	}
	return keep.size
		? `<defs>${[...keep]
				.sort((a, b) => a - b)
				.map((i) => parts[i].el)
				.join('')}</defs>`
		: '';
}

/**
 * Split a drawing into its still part and its actors. Returns `{ base, actors }`: `base` is the drawing without the
 * actor groups; each actor is `{ part, svg, box }`, where `svg` is a picture of that group alone and `box` is
 * `[left, top, width, height]` in % of the drawing, where the page lays it. A drawing without actors comes back whole.
 */
export function splitArt(svg) {
	const [W, H] = artSize(svg);
	const defs = (/<defs>[\s\S]*?<\/defs>/.exec(svg) || [''])[0];
	const actors = [];
	let base = '';
	let from = 0;
	const open = /<g data-actor="([a-z]+)" data-box="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"([^>]*)>/g;
	for (let m; (m = open.exec(svg));) {
		const [whole, part, ...rest] = m;
		const [x, y, w, h] = rest.slice(0, 4).map(Number);
		if (!(w > 0 && h > 0)) throw new Error(`actor "${part}": its box needs a width and a height`);
		if (actors.some((a) => a.part === part)) throw new Error(`actor "${part}" twice in one drawing`);
		const end = groupEnd(svg, m.index);
		const inner = svg.slice(m.index + whole.length, end);
		if (/data-actor=/.test(inner)) throw new Error(`actor "${part}" holds another actor`);
		actors.push({
			part,
			svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" aria-hidden="true" focusable="false">${defsFor(defs, inner + rest[4])}<g${rest[4]}>${inner}</g></svg>`,
			box: [round((x / W) * 100), round((y / H) * 100), round((w / W) * 100), round((h / H) * 100)],
		});
		base += svg.slice(from, m.index);
		from = end + '</g>'.length;
		open.lastIndex = from;
	}
	return { base: base + svg.slice(from), actors };
}
