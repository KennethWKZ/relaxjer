// Release gate, run by .husky/pre-push (not by `pnpm test`): nothing that would be published may carry a real trip's
// details (name, hotel, flights, dates, private notes). The details are derived from the real trips on this machine
// (tests/release/real-trip-patterns.mjs), so the gate itself never publishes them; on a machine without trips it
// checks nothing. The pre-push hook also scans every commit being pushed (scan-history.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../support/stage.mjs';
import { findRealTrip, realTripTokens } from './real-trip-patterns.mjs';

test("no committable file carries a real trip's details", () => {
	const tokens = realTripTokens(ROOT);
	const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
		.split('\n')
		.filter(Boolean);
	const hits = [];
	for (const f of files) {
		const abs = path.join(ROOT, f);
		if (!fs.existsSync(abs) || fs.statSync(abs).size > 5e6) continue;
		for (const h of findRealTrip(fs.readFileSync(abs, 'utf8'), tokens)) hits.push(`${f}: ${h}`);
	}
	assert.deepEqual(hits, [], 'push blocked: move these into trip data or reword them');
});
