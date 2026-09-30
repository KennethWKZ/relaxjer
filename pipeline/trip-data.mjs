// Prints a trip's data as JSON for the Python pipeline: the globals of data.js (evaluated the way the build does),
// plus what the engine derives from them (day roles, each night's hotel). Usage: node pipeline/trip-data.mjs <trip dir>
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
const out = { ...t, roles: dayRoles(t.DAYS, t.FLIGHTS.ret), hotels: hotelsByDay(t.DAYS, t.TRIP.hotel) };
process.stdout.write(JSON.stringify(out));
