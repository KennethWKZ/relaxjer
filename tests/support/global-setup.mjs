// Builds the page under test once per run and drops it where tests/support/serve.mjs serves it.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, resolveEngine, resolveTrip, stagePage } from './stage.mjs';

export const PAGES_DIR = path.join(ROOT, '.cache', 'pages');

export default async function globalSetup() {
	const engine = resolveEngine();
	const trip = resolveTrip();
	const built = stagePage({ engine, trip, outDir: path.join(ROOT, '.cache', 'stage') });
	fs.mkdirSync(PAGES_DIR, { recursive: true });
	fs.copyFileSync(built, path.join(PAGES_DIR, 'trip.html'));
	const kb = Math.round(fs.statSync(built).size / 1024);
	console.log(`[relaxjer] ${engine.kind === 'legacy' ? 'legacy' : 'in-repo'} engine · trip ${trip.demo ? 'demo' : trip.dir} · page ${kb} KB`);
}
