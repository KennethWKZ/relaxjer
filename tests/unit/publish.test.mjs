// scripts/publish-trip.mjs: it finds the build id, reads either secrets layout, prefers the Keychain for the key and
// stops when the Keychain says no, and never prints a secret.
// Every value here is a short made-up placeholder; the real ones live outside the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
	buildId,
	commitViewer,
	firstDiff,
	hostDiff,
	inlineScripts,
	keychainKey,
	loudHeaders,
	policyOf,
	readNextViewer,
	readSecrets,
	readUpdateKey,
	redact,
} from '../../scripts/publish-trip.mjs';

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

test('publish: a browser’s request log never shows the gate’s cookie', () => {
	const log = `route.fetch: Request context disposed.\n    - cookie: ht_ml_pwd=${encodeURIComponent('a b c 1')}; other=1\n    - cookie: ht_ml_pwd=x`;
	const out = redact(log);
	assert.doesNotMatch(out, /ht_ml_pwd=(?!<hidden>)/);
	assert.match(out, /other=1/, 'other cookies stay');
});

test('publish audit: two builds compare by tag shape, so only what the host adds stands out', () => {
	const page = (id, extra = '') =>
		`<!doctype html><head><meta charset="utf-8">\n<meta name="relaxjer-build" content="${id}">\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'">${extra}<link rel="icon" href="data:image/png;base64,AAA${id}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X&text=${id}"></head><body><script>var a=${id}</script><script type="application/json" id="img-data">{}</script></body>`;
	assert.deepEqual(hostDiff(page('0a1b'), page('0a1b')), { identical: true, extra: [] });
	assert.deepEqual(hostDiff(page('0a1b'), page('9f8e')), { identical: false, extra: [] }, 'another build of the same engine adds no shapes');
	const injected = hostDiff(page('0a1b', '<script src="https://cdn.example/beacon.js" defer></script>'), page('0a1b'));
	assert.deepEqual(injected.extra, ['script[defer,src=https://cdn.example]']);
});

test('publish audit: header report drops transport noise and never shows a cookie', () => {
	const h = new Headers({
		'content-type': 'text/html',
		via: '1.1 x (CloudFront)',
		'x-amz-cf-id': 'abc',
		'set-cookie': 'ht_ml_pwd=x',
		'content-security-policy': "frame-ancestors 'none'",
	});
	assert.deepEqual(loudHeaders(h), { 'content-security-policy': "frame-ancestors 'none'", 'content-type': 'text/html', 'set-cookie': '<present>' });
});

test('publish audit: inline scripts are found as the policy hashes them, and a difference is located without the key', () => {
	assert.deepEqual(inlineScripts('<script>a()</script><script type="application/json" id="x">{}</script><script>b()</script>'), ['a()', 'b()']);
	assert.equal(firstDiff('same', 'same'), null);
	const d = firstDiff(`var k="AIza${'x'.repeat(35)}";a()`, `var k="AIza${'x'.repeat(35)}";b()`);
	assert.equal(d.at, 48);
	assert.doesNotMatch(JSON.stringify(d), /AIza/, 'a Google key in the context is hidden');
});

test('publish: the live policy must read the same as the built one, however the host re-serialises it', () => {
	const built = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:">`;
	assert.equal(policyOf(built), "default-src 'none'; img-src 'self' data:");
	assert.equal(policyOf(built.replace(/'/g, '&#39;')), policyOf(built), 'an entity for a quote means the same');
	assert.equal(policyOf('<meta charset="utf-8">'), null);
	assert.notEqual(policyOf(built.replace("'self' ", '')), policyOf(built));
});

test('publish: a new page password comes from the file the planner wrote, and replaces the old one once taken', () => {
	const d = tmp();
	fs.writeFileSync(path.join(d, 'demo.site'), 'site_id: abc123de\n');
	fs.writeFileSync(path.join(d, 'demo.viewer'), `${VIEWER}\n`);
	assert.throws(() => readNextViewer(d, 'demo'), /demo\.viewer\.new first/, 'no file: says where to write it');
	fs.writeFileSync(path.join(d, 'demo.viewer.new'), 'short\n');
	assert.throws(() => readNextViewer(d, 'demo'), /shorter than 6/);
	fs.writeFileSync(path.join(d, 'demo.viewer.new'), '  fake new viewer  \n');
	const next = readNextViewer(d, 'demo');
	assert.equal(next, 'fake new viewer');
	commitViewer(d, 'demo', next);
	assert.equal(readSecrets(d, 'demo').viewer, 'fake new viewer');
	assert.ok(!fs.existsSync(path.join(d, 'demo.viewer.new')), 'the .new file is gone');
	assert.equal(fs.statSync(path.join(d, 'demo.viewer')).mode & 0o777, 0o600);
});
