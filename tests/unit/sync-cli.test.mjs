// scripts/sync/sync.mjs: which Firebase database a url names, and the shape of a trip's fresh keys. Every value here is
// made up; real keys live in ~/.config/relaxjer/sync/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hide, newSecrets, parseDb } from '../../scripts/sync/sync.mjs';
import { secretsIn } from '../support/secret-patterns.mjs';

test('sync: a database url names its instance, and its project when it is the default database', () => {
	assert.deepEqual(parseDb('https://demo-proj-default-rtdb.asia-southeast1.firebasedatabase.app/'), {
		url: 'https://demo-proj-default-rtdb.asia-southeast1.firebasedatabase.app',
		instance: 'demo-proj-default-rtdb',
		project: 'demo-proj',
	});
	assert.deepEqual(parseDb('https://trips-db.firebaseio.com'), { url: 'https://trips-db.firebaseio.com', instance: 'trips-db', project: null });
	for (const bad of ['http://demo-default-rtdb.firebaseio.com', 'https://demo.example.com', 'https://x.firebaseio.com/trips', 'not a url'])
		assert.equal(parseDb(bad), null, bad);
});

test('sync: fresh keys have the shapes the build and the rules check', () => {
	const s = newSecrets();
	assert.match(s.trip, /^[A-Za-z0-9_-]{22}$/);
	assert.match(s.writeToken, /^[A-Za-z0-9_-]{32}$/);
	assert.match(s.syncKey, /^[A-Za-z0-9_-]{43}$/);
	assert.notDeepEqual(newSecrets(), s, 'random each time');
});

test('sync: a sync file pasted into the repo is caught as a secret', () => {
	const s = newSecrets();
	assert.deepEqual(secretsIn(JSON.stringify({ url: 'https://x.firebaseio.com', ...s })).sort(), ['group-sync key', 'group-sync write token']);
	assert.deepEqual(secretsIn('const sync = { writeToken: b64u(24), syncKey: b64u(32) };'), [], 'code that names the fields is fine');
});

test('sync: a Firebase CLI failure is printed with every secret hidden', () => {
	const s = newSecrets();
	const out = hide(`Error at /keys/${s.trip}: token ${s.writeToken} refused`, [s.trip, s.writeToken, s.syncKey]);
	assert.equal(out, 'Error at /keys/<hidden>: token <hidden> refused');
});
