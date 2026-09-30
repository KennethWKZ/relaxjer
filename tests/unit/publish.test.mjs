// scripts/publish-trip.mjs: it finds the build id, reads either secrets layout, prefers the Keychain for the key and
// stops when the Keychain says no, and never prints a secret.
// Every value here is a short made-up placeholder; the real ones live outside the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildId, keychainKey, readSecrets, readUpdateKey, redact } from '../../scripts/publish-trip.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rj-publish-'));
const KEY = 'fake-upd-1';
const VIEWER = 'fake viewer';
const noKeychain = { keychain: () => null };

test('publish: the build id comes from the first bytes of the page', () => {
	assert.equal(buildId('<!doctype html><meta charset="utf-8">\n<meta name="relaxjer-build" content="0a1b2c3d4e5f">'), '0a1b2c3d4e5f');
	assert.equal(buildId('<html>no id</html>'), null);
	assert.equal(buildId(`${'x'.repeat(9000)}<meta name="relaxjer-build" content="0a1b2c3d4e5f">`), null, 'only the head counts');
});

test('publish: one value per file', () => {
	const d = tmp();
	fs.writeFileSync(path.join(d, 'demo.site'), 'site_id: abc123de\nurl: https://abc123de.ht-ml.app/\n');
	fs.writeFileSync(path.join(d, 'demo.update-key'), `${KEY}\n`);
	fs.writeFileSync(path.join(d, 'demo.viewer'), `${VIEWER}\n`);
	assert.deepEqual(readSecrets(d, 'demo'), { site: 'abc123de', url: 'https://abc123de.ht-ml.app/', viewer: VIEWER });
	assert.deepEqual(readUpdateKey(d, 'demo', noKeychain), { key: KEY, from: 'file' });
});

test('publish: the first trip’s labelled files, as lavish-axi printed them', () => {
	const d = tmp();
	fs.writeFileSync(
		path.join(d, 'demo.txt'),
		`share:\n  source: /x.html\n  url: "https://abc123de.ht-ml.app/"\n  site_id: abc123de\n  update_key: ${KEY}\n  status: active\n`,
	);
	fs.writeFileSync(path.join(d, 'demo-viewer.txt'), `viewer password (set 2026-09-30, chosen by the planner): ${VIEWER}\n`);
	const s = readSecrets(d, 'demo');
	assert.equal(s.site, 'abc123de');
	assert.equal(s.url, 'https://abc123de.ht-ml.app/');
	assert.equal(s.viewer, VIEWER, 'only the password, never the label');
	assert.equal(readUpdateKey(d, 'demo', noKeychain).key, KEY);
});

test('publish: the Keychain wins over a file, and a missing key is named, not printed', () => {
	const d = tmp();
	fs.writeFileSync(path.join(d, 'demo.update-key'), `${KEY}\n`);
	assert.deepEqual(readUpdateKey(d, 'demo', { keychain: () => 'fake-kc-1' }), { key: 'fake-kc-1', from: 'keychain' });
	assert.throws(() => readUpdateKey(tmp(), 'demo', noKeychain), /no update key for demo/);
	fs.writeFileSync(path.join(d, 'demo.site'), 'site_id: abc123de\n');
	assert.throws(() => readSecrets(d, 'demo'), /missing in .* for demo: viewer/);
});

test('publish: a Keychain "Deny" stops the publish instead of falling back to a file', { skip: process.platform !== 'darwin' }, () => {
	const calls = [];
	const denied = (cmd, args) => {
		calls.push(args.includes('-w') ? 'read' : 'exists');
		if (args.includes('-w')) throw new Error('user canceled');
		return 'keychain: "login"\n';
	};
	assert.throws(() => keychainKey('demo', denied), /refused/);
	assert.deepEqual(calls, ['exists', 'read'], 'checks the item without a dialog, then asks for the key');
	const none = () => {
		throw new Error('The specified item could not be found in the keychain.');
	};
	assert.equal(keychainKey('demo', none), null, 'no item: the key may come from a file');
});

test('publish: output never carries a secret', () => {
	const out = redact(
		`url: "https://abc123de.ht-ml.app/"\n  update_key: ${KEY}\n  password: ${VIEWER}\nCommand failed: lavish-axi share x --update-key ${KEY}`,
		[KEY, VIEWER],
	);
	assert.doesNotMatch(out, new RegExp(`${KEY}|${VIEWER}`));
	assert.match(out, /abc123de\.ht-ml\.app/, 'the URL stays');
});
