// Prints a trip's data as JSON for the Python pipeline: the globals of data.js (evaluated the way the build does),
// plus what the engine derives from them (day roles, each night's hotel) and the destination pack's data. Usage: node pipeline/trip-data.mjs <trip dir>
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { dayRoles, hotelsByDay } from '../engine/src/core/plan.mjs';

const dir = path.resolve(process.argv[2] || '');
const src = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
const NAMES = ['TRIP', 'DAYS', 'PLACES', 'FLIGHTS', 'OPTIONAL', 'SITES'];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${src};this.__t={${NAMES.map((k) => `${k}:typeof ${k}==='undefined'?undefined:${k}`).join(',')}}`, ctx);
const t = ctx.__t;
// the destination pack's plain data (the country's, then the city's over it), as the build merges it into `Pack`; its
// functions don't travel (JSON leaves them out). A step reads its own settings from it (drive-stops: driveStops)
const pack = {};
const cc = String(t.TRIP.destination || '');
if (/^[a-z]{2}$/.test(cc)) {
	const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'destinations', cc);
	const region = String(t.TRIP.region || '');
	for (const f of [path.join(root, 'pack.mjs'), ...(/^[a-z0-9-]+$/.test(region) ? [path.join(root, 'regions', region, 'pack.mjs')] : [])])
		if (fs.existsSync(f)) Object.assign(pack, await import(f));
}
const out = { ...t, roles: dayRoles(t.DAYS, t.FLIGHTS.ret), hotels: hotelsByDay(t.DAYS, t.TRIP.hotel), pack };
process.stdout.write(JSON.stringify(out));
