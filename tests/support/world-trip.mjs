// The trip under test, dressed in a destination world (ADR-20261117-destination-themes) for tests/e2e/world.spec.mjs:
// a copy whose pack is Sapporo's (which picks Snow Light Path) and whose days each carry an activity mark, in turn.
// Written to .cache/trips/world-trip/ (never committed); the trip's own folder is never touched.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './stage.mjs';
import { names } from '../../engine/src/core/motif.mjs';

export const WORLD_TRIP = path.join(ROOT, '.cache', 'trips', 'world-trip');
export const WORLD = { destination: 'jp', region: 'sapporo', theme: 'snowlight' };

export function makeWorldTrip(from, out = WORLD_TRIP) {
	fs.rmSync(out, { recursive: true, force: true });
	// the trip's data and side files; not its img/icon/, so the world draws the home-screen icon
	fs.cpSync(from, out, { recursive: true, filter: (p) => !/(^|[\\/])(dist|\.share|icon)([\\/]|$)/.test(path.relative(from, p)) });
	fs.appendFileSync(
		path.join(out, 'data.js'),
		`\n/* world-trip fixture (tests/support/world-trip.mjs) */\nTRIP.destination = '${WORLD.destination}';\nTRIP.region = '${WORLD.region}';\nDAYS.forEach((d, i) => { d.motif = ${JSON.stringify(names)}[i % ${names.length}]; });\n`,
	);
	return out;
}
