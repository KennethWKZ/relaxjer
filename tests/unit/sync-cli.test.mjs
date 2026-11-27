// scripts/sync/sync.mjs: which Firebase database a url names, and the shape of a trip's fresh keys. Every value here is
// made up; real keys live in ~/.config/relaxjer/sync/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	approveByCode,
	hide,
	joinRequests,
	kindLabel,
	newSecrets,
	parseApiKey,
	parseDb,
	plannerCode,
	plannerProof,
	printable,
} from '../../scripts/sync/sync.mjs';
import { recordKey, sealName } from '../../engine/src/core/sync.mjs';
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

test('sync: the planner code is kept only as a salted hash the page can check', async () => {
	const { pbkdf2Sync } = await import('node:crypto');
	const { PLANNER_ROUNDS } = await import('../../engine/src/core/sync.mjs');
	const p = plannerCode('demo-code-1234');
	assert.match(p.salt, /^[A-Za-z0-9_-]{22}$/);
	assert.match(p.hash, /^[A-Za-z0-9_-]{43}$/);
	assert.ok(!JSON.stringify(p).includes('demo-code-1234'));
	assert.equal(pbkdf2Sync('demo-code-1234', Buffer.from(p.salt, 'base64url'), PLANNER_ROUNDS, 32, 'sha256').toString('base64url'), p.hash);
	assert.notEqual(plannerCode('demo-code-1234').hash, p.hash, 'a fresh salt each time');
	assert.throws(() => plannerCode('short'), /6 characters/);
});

test('sync: the planner-code proof is a second hash under its own salt, never the page’s', async () => {
	const { pbkdf2Sync } = await import('node:crypto');
	const { PLANNER_ROUNDS } = await import('../../engine/src/core/sync.mjs');
	const page = plannerCode('demo-code-1234');
	const p = plannerProof('demo-code-1234');
	assert.match(p.proofSalt, /^[A-Za-z0-9_-]{22}$/);
	assert.match(p.proof, /^[A-Za-z0-9_-]{43}$/);
	assert.equal(pbkdf2Sync('demo-code-1234', Buffer.from(p.proofSalt, 'base64url'), PLANNER_ROUNDS, 32, 'sha256').toString('base64url'), p.proof);
	assert.notEqual(p.proof, page.hash, 'the hash in the page is no proof');
	assert.notEqual(p.proofSalt, page.salt);
	assert.throws(() => plannerProof('short'), /6 characters/);
});

test('sync: a web API key is a plain token; anything else is refused', () => {
	const k = `demo${'x'.repeat(35)}`;
	assert.equal(parseApiKey(k), k);
	for (const bad of ['', 'short', `${k} `, `${k}/`, null]) assert.equal(parseApiKey(bad), null, String(bad));
});

test('sync: a name typed on a device prints without control or direction characters', () => {
	assert.equal(printable(`Mei${String.fromCharCode(0x1b)}[2J${String.fromCharCode(0x202e)}${String.fromCharCode(7)}`), 'Mei[2J');
	assert.equal(printable('x'.repeat(80)).length, 40);
	assert.equal(kindLabel('iphone/safari'), 'iPhone · Safari');
	assert.equal(kindLabel('android/app'), 'Android · home-screen app');
	assert.equal(kindLabel('huawei/huawei'), 'Huawei · Huawei Browser');
	assert.equal(kindLabel('nonsense'), 'a device');
});

test('sync: approve lists the join requests by name and approves the one with the code', async () => {
	const trip = 'T'.repeat(22);
	const syncKey = 'k'.repeat(43);
	const key = await recordKey(syncKey);
	const uid = (c) => `${c.repeat(27)}1`;
	const entry = async (u, name, over) => ({
		name: await sealName(key, trip, u, name),
		kind: 'ipad/safari',
		dev: u.slice(0, 24),
		code: '4821',
		state: 'pending',
		at: 5,
		...over,
	});
	const devices = {
		[uid('A')]: await entry(uid('A'), 'Mei', {}),
		[uid('B')]: await entry(uid('B'), 'Ken', { state: 'approved', code: '1111' }),
		[uid('C')]: await entry(uid('C'), 'Copied', { name: (await entry(uid('A'), 'Mei')).name, code: '2222', at: 1 }),
	};
	const list = await joinRequests(devices, { trip, syncKey });
	assert.deepEqual(
		list.map((r) => [r.name, r.code]),
		[
			['', '2222'],
			['Mei', '4821'],
		],
		'pending only, oldest first; a name sealed for another device doesn’t open',
	);
	const { request, writes } = approveByCode(list, '4821', { planner: true });
	assert.equal(request.uid, uid('A'));
	assert.deepEqual(writes, {
		[`devices/${uid('A')}/state`]: 'approved',
		[`devices/${uid('A')}/person`]: uid('A').slice(0, 24),
		[`planners/${uid('A')}`]: true,
	});
	assert.throws(() => approveByCode(list, '9999'), /no join request/);
	assert.throws(() => approveByCode([...list, { ...list[1], uid: uid('D') }], '4821'), /2 join requests/);
});
