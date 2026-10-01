// Builds a trip page with the engine's own build script into a scratch folder, with no Google key and a bare environment.
// Default: this repo's engine/ (`node engine/build.mjs --trip … --out … --keys none`).
// LEGACY_ENGINE_DIR still points the tests at the old single-trip repo (to compare the two engines): its build.mjs +
// src/{app.js,style.css,shell.html} are copied into the scratch folder with the trip data and built there, so the old
// repo is never written to and its keys are never read. Trip data comes from TRIP_DIR (default: the committed demo trip).
// memory-bank/standards/decisions/ADR-20260930-test-strategy.md explains why.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const DEMO_TRIP = path.join(ROOT, 'examples', 'demo-trip');
export const ENGINE = path.join(ROOT, 'engine');

const LEGACY_ENGINE_FILES = ['build.mjs', 'src/app.js', 'src/style.css', 'src/shell.html'];
// the build reads these from the trip; missing ones fall back to empty data
export const TRIP_FILES = [
	'data.js',
	'geo.json',
	'extra.json',
	'drinks.json',
	'toilets.json',
	'mrt.json',
	'transit.json',
	'shops.json',
	'forecast.json',
	'wish-a.json',
	'wish-b.json',
];

// a bare env: the build must not see keys, share URLs or anything else from the caller's shell
const BARE_ENV = { PATH: process.env.PATH };

export function resolveEngine(env = process.env) {
	if (env.LEGACY_ENGINE_DIR) {
		const dir = path.resolve(env.LEGACY_ENGINE_DIR);
		const missing = LEGACY_ENGINE_FILES.filter((f) => !fs.existsSync(path.join(dir, f)));
		if (missing.length) throw new Error(`LEGACY_ENGINE_DIR=${dir} is missing ${missing.join(', ')}`);
		return { kind: 'legacy', dir };
	}
	if (!fs.existsSync(path.join(ENGINE, 'build.mjs'))) throw new Error(`no engine at ${ENGINE}/build.mjs`);
	return { kind: 'engine', dir: ENGINE };
}

export function resolveTrip(env = process.env) {
	const dir = path.resolve(env.TRIP_DIR || DEMO_TRIP);
	if (!fs.existsSync(path.join(dir, 'data.js'))) throw new Error(`TRIP_DIR=${dir} has no data.js`);
	return { dir, demo: dir === DEMO_TRIP };
}

/** Builds engine + trip into outDir and returns the built single-file page's path. args: more build flags (--sync …). */
export function stagePage({ engine, trip, outDir, args = [] }) {
	fs.rmSync(outDir, { recursive: true, force: true });
	let page;
	if (engine.kind === 'engine') {
		// --keys none: explicit, so tests never embed a key even if the default changes
		execFileSync(process.execPath, [path.join(engine.dir, 'build.mjs'), '--trip', trip.dir, '--out', outDir, '--keys', 'none', ...args], {
			cwd: ROOT,
			env: BARE_ENV,
			stdio: 'pipe',
		});
		// <TRIP.fileName>-standalone.html: the one single-file page the build writes
		page = path.join(outDir, fs.readdirSync(outDir).find((f) => f.endsWith('-standalone.html')) || 'trip-standalone.html');
	} else {
		for (const f of LEGACY_ENGINE_FILES) copy(path.join(engine.dir, f), path.join(outDir, f));
		for (const f of TRIP_FILES) {
			const src = path.join(trip.dir, f);
			if (fs.existsSync(src)) copy(src, path.join(outDir, 'src', f));
		}
		const img = path.join(trip.dir, 'img');
		if (fs.existsSync(img)) fs.cpSync(img, path.join(outDir, 'img'), { recursive: true });
		execFileSync(process.execPath, ['build.mjs'], { cwd: outDir, env: BARE_ENV, stdio: 'pipe' });
		page = path.join(outDir, 'dist', 'taipei-trip-standalone.html');
	}
	if (!fs.existsSync(page)) throw new Error(`build finished but ${page} is missing`);
	return page;
}

function copy(from, to) {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(from, to);
}
