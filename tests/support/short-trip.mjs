// A 4-day test trip, made from the demo trip so it stays synthetic and in step with it: demo days 1, 2, 6 and 7
// become days 1–4 (arrival, one full day, the free day + airport evening, the after-midnight flight). It proves the
// engine reads day roles from the trip, not from fixed ids d1…d7. Written to .cache/trips/short-trip/ (never committed).
//   node tests/support/short-trip.mjs            → prints the folder
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_TRIP, ROOT } from './stage.mjs';

export const SHORT_TRIP = path.join(ROOT, '.cache', 'trips', 'short-trip');

// runs inside the page after the demo's data.js: keeps four days and renumbers them
const RESHAPE = `
/* ───────── short-trip fixture (tests/support/short-trip.mjs): demo days 1, 2, 6, 7 → days 1–4 ───────── */
{
	const keep = ['d1', 'd2', 'd6', 'd7'];
	const rename = { d1: 'd1', d2: 'd2', d6: 'd3', d7: 'd4' };
	const DOW = [['日', 'Sun'], ['一', 'Mon'], ['二', 'Tue'], ['三', 'Wed'], ['四', 'Thu'], ['五', 'Fri'], ['六', 'Sat']];
	const day = (i) => new Date(Date.parse(TRIP.start) + i * 864e5);
	DAYS.splice(0, DAYS.length, ...DAYS.filter((d) => keep.includes(d.id)));
	DAYS.forEach((d, i) => {
		d.id = rename[d.id];
		d.n = i + 1;
		d.date = day(i).toISOString().slice(0, 10);
		d.dow = DOW[day(i).getUTCDay()];
	});
	TRIP.end = DAYS.at(-1).date;
	FLIGHTS.ret.date = DAYS.at(-1).date;
	for (const x of TRIP.shopDays || []) for (const k of ['zh', 'en']) x[k] = x[k].replace(/\\{d([3-7])\\}/g, (m, n) => ({ 6: '{d3}' })[n] || '');
	// other data that points at a day: follow the renumbering, or drop the pointer to a day that is gone
	for (const x of [...(SNOW.shops || []), ...(WEATHER.outfits || [])]) if (x.day) x.day = rename[x.day];
	for (const x of SNOW.shops || []) if (!x.day) delete x.day;
	WEATHER.outfits = (WEATHER.outfits || []).filter((x) => x.day);
}
`;

export function makeShortTrip(out = SHORT_TRIP) {
	fs.rmSync(out, { recursive: true, force: true });
	fs.mkdirSync(out, { recursive: true });
	for (const f of fs.readdirSync(DEMO_TRIP)) {
		const from = path.join(DEMO_TRIP, f);
		if (fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(out, f));
		else fs.cpSync(from, path.join(out, f), { recursive: true });
	}
	fs.appendFileSync(path.join(out, 'data.js'), RESHAPE);
	return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(makeShortTrip());
