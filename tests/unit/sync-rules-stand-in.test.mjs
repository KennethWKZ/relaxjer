// The e2e tests' stand-in database (tests/support/fake-rtdb.mjs) against the same checks the real rules pass on
// Firebase's emulator (scripts/sync/rules-checks.mjs, `pnpm test:sync-rules`), so the two can't drift apart. The
// stand-in runs here on a local port; nothing leaves the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fakeRtdb } from '../support/fake-rtdb.mjs';
import { ruleChecks } from '../../scripts/sync/rules-checks.mjs';

test('the stand-in database takes and refuses what the real rules do', async () => {
	const server = http.createServer((req, res) => {
		if (!fakeRtdb(req, res, new URL(req.url, 'http://127.0.0.1'))) res.writeHead(404).end();
	});
	await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
	let n = 0;
	try {
		await ruleChecks({
			base: `http://127.0.0.1:${server.address().port}/__rtdb`,
			ns: `unit-${process.pid}`,
			check: (what, got, want) => {
				assert.equal(got, want, what);
				n++;
			},
		});
	} finally {
		server.close();
	}
	assert.ok(n > 100, `only ${n} checks ran`);
});
