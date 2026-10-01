// Builds the page under test once per run and drops it where tests/support/serve.mjs serves it. With this repo's
// engine it also builds trip-sync.html: the same trip with group sync on, pointed at the test server's stand-in database
// (tests/support/fake-rtdb.mjs), with keys made fresh for each run and kept in .cache, never in the repo.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { plannerCode } from '../../scripts/sync/sync.mjs';
import { ROOT, resolveEngine, resolveTrip, stagePage } from './stage.mjs';

export const PAGES_DIR = path.join(ROOT, '.cache', 'pages');
export const SYNC_TEST_FILE = path.join(ROOT, '.cache', 'sync-test.json');
/** the sync page's planner code: the phone that gives it becomes a planner */
export const TEST_PLANNER_CODE = 'demo-planner-2468';

const b64u = (n) => crypto.randomBytes(n).toString('base64url');

export default async function globalSetup() {
	const engine = resolveEngine();
	const trip = resolveTrip();
	const built = stagePage({ engine, trip, outDir: path.join(ROOT, '.cache', 'stage') });
	fs.mkdirSync(PAGES_DIR, { recursive: true });
	fs.copyFileSync(built, path.join(PAGES_DIR, 'trip.html'));
	const kb = Math.round(fs.statSync(built).size / 1024);
	console.log(`[relaxjer] ${engine.kind === 'legacy' ? 'legacy' : 'in-repo'} engine · trip ${trip.demo ? 'demo' : trip.dir} · page ${kb} KB`);

	fs.rmSync(path.join(PAGES_DIR, 'trip-sync.html'), { force: true });
	if (engine.kind !== 'engine') return; // the legacy engine has no group sync
	const port = Number(process.env.RELAXJER_TEST_PORT || 8124);
	const sync = {
		url: `http://127.0.0.1:${port}/__rtdb`,
		trip: b64u(16),
		writeToken: b64u(24),
		syncKey: b64u(32),
		planner: plannerCode(TEST_PLANNER_CODE),
	};
	fs.writeFileSync(SYNC_TEST_FILE, JSON.stringify(sync), { mode: 0o600 });
	const page = stagePage({ engine, trip, outDir: path.join(ROOT, '.cache', 'stage-sync'), args: ['--sync', SYNC_TEST_FILE] });
	fs.copyFileSync(page, path.join(PAGES_DIR, 'trip-sync.html'));
}
