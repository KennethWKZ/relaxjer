// The group-sync database rules (scripts/sync/database.rules.json, ADR-20261001-group-sync), checked on Firebase's own
// Realtime Database emulator: `pnpm test:sync-rules`. It needs Java (the emulator is a Java program) and fetches the
// pinned firebase-tools through npx, so it runs on a planner's or a developer's machine, not in CI; the e2e tests' stand-in
// database (tests/support/fake-rtdb.mjs) enforces the same rules there. A demo- project needs no login and touches no
// real database.
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FIREBASE_TOOLS } from './sync.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PROJECT = 'demo-relaxjer';

// firebase-tools 14 and later want Java 21 for the emulator; 13.35.1 runs on Java 11+ and evaluates the same rules
// language, so a machine with an older Java still gets the check
// (java -version writes to stderr)
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
const javaMajor = Number((/version "(\d+)/.exec(`${java.stdout || ''}${java.stderr || ''}`) || [])[1] || 0);
const TOOLS = javaMajor >= 21 ? FIREBASE_TOOLS : 'firebase-tools@13.35.1';

if (!process.argv.includes('--inside')) {
	if (!javaMajor) throw new Error('the Firebase emulator needs Java (11 or later; 21+ for the current firebase-tools)');
	console.log(`group-sync rules on the emulator: Java ${javaMajor}, ${TOOLS}`);
	execFileSync(
		'npx',
		[
			'-y',
			TOOLS,
			'emulators:exec',
			'--only',
			'database',
			'--project',
			PROJECT,
			'--config',
			path.join(HERE, 'firebase.json'),
			`node ${path.join(HERE, 'rules-test.mjs')} --inside`,
		],
		{ stdio: 'inherit' },
	);
	process.exit(0);
}

const DB = `http://127.0.0.1:9123`;
// the emulator applies firebase.json's rules to the project's default database, <project>-default-rtdb
const at = (p) => `${DB}${p}.json?ns=${PROJECT}-default-rtdb`;
const admin = { Authorization: 'Bearer owner' };
const req = async (method, p, body, headers = {}) =>
	(await fetch(at(p), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })).status;

const TRIP = 'T'.repeat(22);
const OTHER = 'O'.repeat(22);
const TOKEN = 'w'.repeat(32);
const name = (c) => c.repeat(22);
const rec = (over = {}) => ({ c: 'aaaa.bbbb', u: Date.now(), d: 'device1', k: TOKEN, ...over });
const r = (p = '') => `/trips/${TRIP}/r${p}`;

let n = 0;
const check = async (what, got, want) => {
	assert.equal(got, want, what);
	n++;
	console.log(`  ok  ${what}`);
};

await check('the planner sets the trip’s write token', await req('PUT', `/keys/${TRIP}`, TOKEN, admin), 200);
await check('a phone reads a trip that has a token', await req('GET', r()), 200);
await check('no reading a trip without a token', await req('GET', `/trips/${OTHER}/r`), 401);
await check('no reading the tokens', await req('GET', '/keys'), 401);
await check('no listing the trips', await req('GET', '/trips'), 401);
await check('a record with the token goes in', await req('PATCH', r(), { [name('a')]: rec({ u: 1000 }) }), 200);
await check('the wrong token is refused', await req('PATCH', r(), { [name('b')]: rec({ k: 'x'.repeat(32) }) }), 401);
await check('a missing field is refused', await req('PATCH', r(), { [name('b')]: { c: 'x', u: 5, k: TOKEN } }), 401);
await check('an extra field is refused', await req('PATCH', r(), { [name('b')]: rec({ extra: 1 }) }), 401);
await check('a record over 4 KB is refused', await req('PATCH', r(), { [name('b')]: rec({ c: 'x'.repeat(4097) }) }), 401);
await check('an edit time far in the future is refused', await req('PATCH', r(), { [name('b')]: rec({ u: Date.now() + 2 * 86_400_000 }) }), 401);
await check('a record name the page wouldn’t make is refused', await req('PATCH', r(), { short: rec() }), 401);
await check('an older version can’t replace a newer one', await req('PATCH', r(), { [name('a')]: rec({ u: 999 }) }), 401);
await check('the same time from a smaller device id loses', await req('PATCH', r(), { [name('a')]: rec({ u: 1000, d: 'device0' }) }), 401);
await check('the same time from a larger device id wins', await req('PATCH', r(), { [name('a')]: rec({ u: 1000, d: 'device2' }) }), 200);
await check('a newer version replaces it', await req('PATCH', r(), { [name('a')]: rec({ u: 2000 }) }), 200);
await check('a batch with one bad record is refused whole', await req('PATCH', r(), { [name('c')]: rec(), [name('d')]: rec({ k: 'nope' }) }), 401);
await check('nothing from that batch went in', await (await fetch(at(r(`/${name('c')}`)))).text(), 'null');
await check('no deleting a record', await req('DELETE', r(`/${name('a')}`)), 401);
await check('no deleting through a null', await req('PATCH', r(), { [name('a')]: null }), 401);
await check('no writing to a trip without a token', await req('PATCH', `/trips/${OTHER}/r`, { [name('a')]: rec() }), 401);
await check('no writing a token from a phone', await req('PUT', `/keys/${OTHER}`, TOKEN), 401);
await check('the planner ends sync: the token goes', await req('DELETE', `/keys/${TRIP}`, undefined, admin), 200);
await check('then the trip can’t be read', await req('GET', r()), 401);
await check('nor written', await req('PATCH', r(), { [name('e')]: rec({ u: 3000 }) }), 401);
console.log(`group-sync rules: ${n} checks passed on the Firebase emulator`);
