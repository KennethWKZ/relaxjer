// Commit-time scan, run by .husky/commit-msg: the staged diff and the commit message are checked for a real trip's
// details before the commit exists, so a slip costs a reword instead of a history rewrite at push time
// (scan-history.mjs still checks every commit being pushed). While a trip runs, today is one of its dates.
// Usage: node tests/release/scan-staged.mjs <commit message file>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { findRealTrip, realTripTokens } from './real-trip-patterns.mjs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();
const tokens = realTripTokens(git('rev-parse', '--show-toplevel'));
if (!tokens.length) process.exit(0); // no real trips on this machine (CI, a fresh clone): nothing to look for

// only what the commit adds: the "+" lines of the staged diff
const added = git('diff', '--cached', '--unified=0', '--no-color')
	.split('\n')
	.filter((l) => l.startsWith('+') && !l.startsWith('+++'))
	.join('\n');
// the message as git will keep it: no comment lines, nothing below the scissors line of `commit -v`
const msgFile = process.argv[2];
const message = msgFile
	? fs
			.readFileSync(msgFile, 'utf8')
			.split(/^# -+ >8 -+$/m)[0]
			.split('\n')
			.filter((l) => !l.startsWith('#'))
			.join('\n')
	: '';

const hits = [
	...findRealTrip(added, tokens).map((h) => `the staged changes: ${h}`),
	...findRealTrip(message, tokens).map((h) => `the commit message: ${h}`),
];
if (hits.length) {
	console.error("commit-msg: this commit would carry a real trip's details:");
	for (const h of hits) console.error(`  ${h}`);
	console.error(
		'Reword them (say "the first trip", and leave dates out while a trip runs); see memory-bank/standards/patterns/trip-data.md ("Real trips").',
	);
	process.exit(1);
}
