// scripts/ci/needs-e2e.mjs: docs and release bookkeeping skip the browser tests; anything else, or anything unknown,
// runs them (ADR-20261002-required-ci).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { needsE2e, versionOnly } from '../../scripts/ci/needs-e2e.mjs';

const pkg = (version, extra = {}) => JSON.stringify({ name: 'relaxjer', version, devDependencies: { eslint: '^10.11.0' }, ...extra }, null, '\t');

test('docs and release bookkeeping skip the browser tests', () => {
	assert.equal(needsE2e(['README.md', 'DESIGN.md', 'CHANGELOG.md']), false);
	assert.equal(needsE2e(['memory-bank/standards/decisions/ADR-x.md', 'knowledge/hosting.md', 'guides/trip-page.md']), false);
	// a release pull request: the changelog, the manifest and package.json's version
	assert.equal(needsE2e(['CHANGELOG.md', '.release-please-manifest.json', 'package.json'], { before: pkg('1.2.2'), after: pkg('1.2.3') }), false);
});

test('anything the page, the build or the tests can see runs them', () => {
	for (const f of [
		'engine/src/style.css',
		'engine/build.mjs',
		'examples/demo-trip/data.js',
		'destinations/tw/pack.mjs',
		'site/index.html',
		'tests/e2e/boot.spec.mjs',
		'playwright.config.mjs',
		'.github/workflows/ci.yml',
		'pnpm-lock.yaml',
		'scripts/publish-trip.mjs',
	])
		assert.equal(needsE2e(['README.md', f]), true, f);
	// a markdown file inside a folder that isn't docs (a skill, a pack's knowledge) is not on the list either
	assert.equal(needsE2e(['.agents/skills/build-page/SKILL.md']), true);
	assert.equal(needsE2e(['destinations/tw/knowledge.md']), true);
});

test('package.json skips them only when nothing but the version changed', () => {
	assert.equal(versionOnly(pkg('1.2.2'), pkg('1.2.3')), true);
	assert.equal(versionOnly(pkg('1.2.2'), pkg('1.2.3', { devDependencies: { eslint: '^10.12.0' } })), false, 'a dependency bump');
	assert.equal(versionOnly('{', pkg('1.2.3')), false, 'unreadable: run them');
	assert.equal(needsE2e(['package.json'], { before: pkg('1.2.2'), after: pkg('1.2.2', { scripts: { test: 'x' } }) }), true);
	assert.equal(needsE2e(['package.json']), true, 'no before and after to compare: run them');
});

test('nothing known runs everything', () => {
	assert.equal(needsE2e([]), true);
	const script = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'scripts', 'ci', 'needs-e2e.mjs');
	for (const base of ['', '0000000000000000000000000000000000000000', 'no-such-ref'])
		assert.equal(
			execFileSync(process.execPath, [script, base], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(),
			'e2e=true',
			`base ${JSON.stringify(base)}`,
		);
});
