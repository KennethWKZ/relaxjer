// Home-screen and browser-tab icons drawn by code, for a trip with no img/icon/ whose destination world can draw one
// (ADR-20261117-destination-themes). The world's module gives a colour for any point of the square; this samples it
// 4 × 4 per pixel (smooth edges) and writes a PNG with Node's own zlib, so any machine and CI can build it: no browser,
// no image tool, no image model. Each PNG says where it came from in its text chunks.
import zlib from 'node:zlib';

const chunk = (type, body) => {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(body.length, 0);
	head.write(type, 4, 'latin1');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
	return Buffer.concat([head, body, crc]);
};
const text = (k, v) => chunk('tEXt', Buffer.from(`${k}\0${v}`, 'latin1'));

/** A size × size RGB PNG of `paint(u, v)` → [r, g, b] (0–255; u, v in 0–1 from the top left), with provenance text. */
export function renderPNG(size, paint, provenance = {}) {
	const S = 4; // samples per side
	const row = size * 3 + 1;
	const raw = Buffer.alloc(row * size);
	for (let y = 0; y < size; y++) {
		raw[y * row] = 0; // filter: none
		for (let x = 0; x < size; x++) {
			let r = 0,
				g = 0,
				b = 0;
			for (let j = 0; j < S; j++)
				for (let i = 0; i < S; i++) {
					const c = paint((x + (i + 0.5) / S) / size, (y + (j + 0.5) / S) / size);
					r += c[0];
					g += c[1];
					b += c[2];
				}
			const o = y * row + 1 + x * 3;
			raw[o] = Math.round(r / (S * S));
			raw[o + 1] = Math.round(g / (S * S));
			raw[o + 2] = Math.round(b / (S * S));
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 2; // colour type: RGB
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		...Object.entries(provenance).map(([k, v]) => text(k, v)),
		chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	]);
}
