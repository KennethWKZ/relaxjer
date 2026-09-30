// Pre-push history scan: every commit about to be published is checked for the first trip's details, in every file
// it adds or changes (trips/ is ignored by git, so this covers the engine, docs and tests).
// Reads git's pre-push lines on stdin: "<local ref> <local sha> <remote ref> <remote sha>".
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { findRealTrip, realTripTokens } from './real-trip-patterns.mjs';

const tokens = realTripTokens(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'));

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const ZERO = /^0+$/;
const lines = fs.readFileSync(0, 'utf8').split('\n').filter(Boolean);
const commits = new Set();
for (const line of lines) {
	const [, local, , remote] = line.split(' ');
	if (!local || ZERO.test(local)) continue; // deleting a remote branch publishes nothing
	const range = ZERO.test(remote) ? [local, '--not', '--remotes'] : [`${remote}..${local}`];
	for (const c of git('rev-list', ...range)
		.split('\n')
		.filter(Boolean))
		commits.add(c);
}
const hits = [];
for (const c of commits) {
	// only what this commit adds: the "+" lines of its diff
	const added = git('show', '--format=', '--unified=0', '--no-color', c)
		.split('\n')
		.filter((l) => l.startsWith('+') && !l.startsWith('+++'))
		.join('\n');
	const found = findRealTrip(added, tokens);
	if (found.length) hits.push(`${c.slice(0, 7)} ${git('log', '-1', '--format=%s', c).trim()}: ${found.join(', ')}`);
}
if (hits.length) {
	console.error("pre-push: these commits would publish a real trip's details:");
	for (const h of hits) console.error(`  ${h}`);
	console.error('Rewrite them before pushing (for example squash into one clean commit); see docs/roadmap.md.');
	process.exit(1);
}
console.log(`pre-push: ${commits.size} commit(s) scanned, no real-trip details`);
