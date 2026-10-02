// CI's browser jobs run inside Playwright's image, so its version must be the one package.json installs: an image for
// another version has other browser builds, and Playwright refuses to start them (ADR-20261002-ci-image-and-releases).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the e2e jobs run in the Playwright image of the version package.json pins', () => {
	const pinned = JSON.parse(read('package.json')).devDependencies['@playwright/test'];
	assert.match(pinned, /^\d+\.\d+\.\d+$/, '@playwright/test is pinned to an exact version');
	const images = [...read('.github/workflows/ci.yml').matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-\w+/g)].map((m) => m[1]);
	assert.ok(images.length, 'the e2e jobs name a Playwright image');
	for (const v of images) assert.equal(v, pinned, `ci.yml's Playwright image v${v} is not @playwright/test ${pinned}`);
});

test('the release workflow can write, so its actions are pinned to commit SHAs', () => {
	const wf = read('.github/workflows/release.yml');
	for (const [, ref] of wf.matchAll(/uses:\s*[\w./-]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, `unpinned action ref: ${ref}`);
	assert.match(wf, /tags:\s*\['v\*\.\*\.\*'\]/, 'it runs on version tags');
	assert.match(wf, /pnpm test:release/, 'it runs the release gate');
});
