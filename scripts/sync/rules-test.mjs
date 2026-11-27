// The group-sync database rules (scripts/sync/database.rules.json), checked on Firebase's own Realtime Database
// emulator: `pnpm test:sync-rules`. Two kinds of trip share the one rules file:
//  - a token trip (ADR-20261001-group-sync): `keys/<trip>` holds the write token, anyone with the page reads, and a
//    record needs the token;
//  - an approval trip (ADR-20261127-sync-approval): `gates/<trip>` says so and holds the planner-code proof; each device
//    signs in anonymously, asks to join under `devices/<uid>`, and reads or writes records only once a planner approved
//    it.
// It needs Java (the emulator is a Java program) and fetches the pinned firebase-tools through npx, so it runs on a
// planner's or a developer's machine, not in CI; the e2e tests' stand-in database (tests/support/fake-rtdb.mjs) enforces
// the same rules there. A demo- project needs no login and touches no real database.
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
import { FIREBASE_TOOLS } from './sync.mjs';
import { ruleChecks } from './rules-checks.mjs';

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

const n = { count: 0 };
await ruleChecks({
	base: 'http://127.0.0.1:9123',
	// the emulator applies firebase.json's rules to the project's default database, <project>-default-rtdb
	ns: `${PROJECT}-default-rtdb`,
	log: (text) => console.log(text),
	check: async (what, got, want) => {
		assert.equal(got, want, what);
		n.count++;
		console.log(`  ok  ${what}`);
	},
});
console.log(`group-sync rules: ${n.count} checks passed on the Firebase emulator`);
