// Builds the page under test once per run and drops it where tests/support/serve.mjs serves it. With this repo's
// engine it also builds trip-sync.html: the same trip with group sync on, pointed at the test server's stand-in database
// (tests/support/fake-rtdb.mjs), with keys made fresh for each run and kept in .cache, never in the repo.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { plannerCode, plannerProof } from '../../scripts/sync/sync.mjs';
import { DEMO_TRIPS, ROOT, resolveEngine, resolveTrip, stagePage } from './stage.mjs';
import { makeWorldTrip, SKIES } from './world-trip.mjs';

export const PAGES_DIR = path.join(ROOT, '.cache', 'pages');
export const SYNC_TEST_FILE = path.join(ROOT, '.cache', 'sync-test.json');
export const APPROVAL_TEST_FILE = path.join(ROOT, '.cache', 'sync-approval-test.json');
export const GKEY_TEST_FILE = path.join(ROOT, '.cache', 'gkey-test.json');
/** the live demo's clock, read from the workflow that publishes it, so the tests open the page visitors get */
export const DEMO_CLOCK = (fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8').match(/--demo-clock "([^"]+)"/) || [])[1];
/** the Sapporo demo's clock, the same way: the workflow line that builds examples/demo-sapporo */
export const SAPPORO_CLOCK = (fs
	.readFileSync(path.join(ROOT, '.github', 'workflows', 'pages.yml'), 'utf8')
	.match(/demo-sapporo[^\n]*--demo-clock "([^"]+)"/) || [])[1];
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
	// the landing page, as GitHub Pages serves it, for tests/e2e/site.spec.mjs
	fs.rmSync(path.join(PAGES_DIR, 'site'), { recursive: true, force: true });
	fs.cpSync(path.join(ROOT, 'site'), path.join(PAGES_DIR, 'site'), { recursive: true });

	fs.rmSync(path.join(PAGES_DIR, 'trip-sync.html'), { force: true });
	fs.rmSync(path.join(PAGES_DIR, 'trip-approval.html'), { force: true });
	for (const f of fs.readdirSync(PAGES_DIR).filter((x) => /^trip-world/.test(x))) fs.rmSync(path.join(PAGES_DIR, f), { force: true });
	fs.rmSync(path.join(PAGES_DIR, 'trip-gkey.html'), { force: true });
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
	// the same trip as an approval trip (ADR-20261127-sync-approval): devices sign in on the stand-in's sign-in with a
	// made-up web API key, ask to join, and sync once a planner let them in. The proof salt goes in the page; the specs
	// work the proof out from the code, as the CLI would put it in the database
	const approval = {
		url: sync.url,
		trip: b64u(16),
		syncKey: b64u(32),
		approval: true,
		apiKey: `standin${b64u(24)}`,
		planner: { ...plannerCode(TEST_PLANNER_CODE), proofSalt: plannerProof(TEST_PLANNER_CODE).proofSalt },
	};
	fs.writeFileSync(APPROVAL_TEST_FILE, JSON.stringify(approval), { mode: 0o600 });
	const gated = stagePage({ engine, trip, outDir: path.join(ROOT, '.cache', 'stage-approval'), args: ['--sync', APPROVAL_TEST_FILE] });
	fs.copyFileSync(gated, path.join(PAGES_DIR, 'trip-approval.html'));

	// the same trip as a planner's key builds it, so the Google parts are drawn (tests/e2e/place-finder.spec.mjs). The key
	// is a stand-in no Google service takes, made here, never in the repo; the spec stubs Google's library in the page,
	// and the network guard still refuses every Google host
	fs.writeFileSync(GKEY_TEST_FILE, JSON.stringify({ browserKey: `stand-in-${b64u(9)}`, mapId: 'stand-in-map' }), { mode: 0o600 });
	const gkey = stagePage({ engine, trip, outDir: path.join(ROOT, '.cache', 'stage-gkey'), keys: GKEY_TEST_FILE });
	fs.copyFileSync(gkey, path.join(PAGES_DIR, 'trip-gkey.html'));

	// the same trip in a destination world, with a mark on every day (tests/e2e/world.spec.mjs)
	const world = stagePage({ engine, trip: { dir: makeWorldTrip(trip.dir) }, outDir: path.join(ROOT, '.cache', 'stage-world') });
	fs.copyFileSync(world, path.join(PAGES_DIR, 'trip-world.html'));
	// the same world with each other sky a trip can pick (TRIP.sky), and the planner's preview build of it
	// (tests/e2e/sky.spec.mjs); the preview build writes <name>-preview.html, never a page that could be published
	for (const sky of SKIES) {
		const dir = makeWorldTrip(trip.dir, path.join(ROOT, '.cache', 'trips', `world-trip-${sky}`), sky);
		const p = stagePage({ engine, trip: { dir }, outDir: path.join(ROOT, '.cache', `stage-world-${sky}`) });
		fs.copyFileSync(p, path.join(PAGES_DIR, `trip-world-${sky}.html`));
	}
	const pvOut = path.join(ROOT, '.cache', 'stage-world-preview');
	const pv = stagePage({ engine, trip: { dir: makeWorldTrip(trip.dir) }, outDir: pvOut, args: ['--preview'] });
	const wrote = fs.readdirSync(pvOut).filter((f) => f.endsWith('.html'));
	if (wrote.length !== 1 || !wrote[0].endsWith('-preview.html')) throw new Error(`--preview wrote ${wrote.join(', ')}: only <name>-preview.html`);
	fs.copyFileSync(pv, path.join(PAGES_DIR, 'trip-world-preview.html'));

	// the live demo, built as pages.yml builds it, with the workflow's own clock (tests/e2e/demo.spec.mjs)
	fs.rmSync(path.join(PAGES_DIR, 'trip-demo.html'), { force: true });
	if (!trip.demo) return;
	const demo = stagePage({ engine, trip, outDir: path.join(ROOT, '.cache', 'stage-demo'), args: ['--demo-clock', DEMO_CLOCK] });
	fs.copyFileSync(demo, path.join(PAGES_DIR, 'trip-demo.html'));

	// the second live demo, Sapporo in Snow Light Path, built the same way (tests/e2e/demo.spec.mjs)
	const sapporo = stagePage({
		engine,
		trip: { dir: DEMO_TRIPS[1] },
		outDir: path.join(ROOT, '.cache', 'stage-demo-sapporo'),
		args: ['--demo-clock', SAPPORO_CLOCK],
	});
	fs.copyFileSync(sapporo, path.join(PAGES_DIR, 'trip-demo-sapporo.html'));
}
