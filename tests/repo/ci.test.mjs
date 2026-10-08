// CI's browser jobs run inside Playwright's image, so its version must be the one package.json installs: an image for
// another version has other browser builds, and Playwright refuses to start them. An image built for one architecture
// won't start on runners of the other (ADR-20261002-ci-image-and-releases).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the e2e jobs run in the Playwright image of the version package.json pins, built for their runners', () => {
	const pinned = JSON.parse(read('package.json')).devDependencies['@playwright/test'];
	assert.match(pinned, /^\d+\.\d+\.\d+$/, '@playwright/test is pinned to an exact version');
	const wf = read('.github/workflows/ci.yml');
	const images = [...wf.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-\w+/g)].map((m) => m[1]);
	assert.ok(images.length, 'the e2e jobs name a Playwright image');
	for (const v of images) assert.equal(v, pinned, `ci.yml's Playwright image v${v} is not @playwright/test ${pinned}`);
	// a tag built for one architecture runs only on runners of it: GitHub's arm64 runners are the `-arm` labels
	const e2e = wf.slice(wf.indexOf('\n  e2e:'), wf.indexOf('\n  ci-ok:'));
	const runsOn = (/^ {4}runs-on:\s*(\S+)/m.exec(e2e) || [])[1];
	const arch = (/mcr\.microsoft\.com\/playwright:v[\d.]+-\w+-(amd64|arm64)\b/.exec(e2e) || [])[1];
	const runnerArch = /-arm$/.test(runsOn) ? 'arm64' : 'amd64';
	if (arch) assert.equal(arch, runnerArch, `the e2e image is built for ${arch}, but ${runsOn} runners are ${runnerArch}`);
});

test('the release workflow can write, so its actions are pinned to commit SHAs, and it publishes only past the gate', () => {
	const wf = read('.github/workflows/release.yml');
	for (const [, ref] of wf.matchAll(/uses:\s*[\w./-]+@(\S+)/g)) assert.match(ref, /^[0-9a-f]{40}$/, `unpinned action ref: ${ref}`);
	assert.match(wf, /pnpm test:release/, 'it runs the release gate before publishing');
	const cfg = JSON.parse(read('release-please-config.json'));
	assert.equal(cfg.draft, true, 'releases start as drafts, published once ci is green');
	assert.equal(cfg['force-tag-creation'], true, 'a draft still gets its tag');
	const manifest = JSON.parse(read('.release-please-manifest.json'));
	assert.equal(manifest['.'], JSON.parse(read('package.json')).version, 'the manifest and package.json name the same version');
	// the release pull request also moves AGENTS.md's status: release-please rewrites the first x.y.z on its marked line
	assert.ok((cfg.packages['.']['extra-files'] || []).includes('AGENTS.md'), 'release-please updates AGENTS.md');
	assert.deepEqual(
		read('AGENTS.md')
			.split('\n')
			.filter((l) => l.includes('x-release-please')),
		[`**Status:** v${manifest['.']}. <!-- x-release-please-version -->`],
		"AGENTS.md's status line names the current release, on the one line release-please updates",
	);
});

// main's ruleset requires one check, ci-ok (ADR-20261002-required-ci): it must wait on every other job, or a job added
// later could fail and still let the merge through
test('the ci-ok gate waits on every other ci job and runs even when one fails', () => {
	const wf = read('.github/workflows/ci.yml');
	const jobs = [...wf.split(/^jobs:\s*$/m)[1].matchAll(/^ {2}([\w-]+):\s*$/gm)].map((m) => m[1]);
	assert.ok(jobs.includes('ci-ok'), 'ci.yml has the ci-ok job');
	const gate = wf.slice(wf.indexOf('\n  ci-ok:'));
	const needs = (/needs:\s*\[([^\]]*)\]/.exec(gate) || [])[1].split(',').map((s) => s.trim());
	assert.deepEqual(needs.sort(), jobs.filter((j) => j !== 'ci-ok').sort(), 'ci-ok needs every other job');
	assert.match(gate, /if:\s*always\(\)/, 'it runs (and fails) when a job it needs failed');
});

test('ci runs once per pull request, and on every push to main', () => {
	const on = read('.github/workflows/ci.yml')
		.split(/^on:\s*$/m)[1]
		.split(/^\S/m)[0];
	assert.match(on, /^ {2}pull_request:/m, 'every pull request runs ci');
	assert.match(on, /^ {2}push:\s*\n {4}branches: \[main\]/m, 'a push runs ci only on main (the release job waits for that run)');
	// the release job doesn't start workflows: a run it started wouldn't count for the release pull request's gate
	assert.doesNotMatch(read('.github/workflows/release.yml'), /actions: write/, 'the release job keeps to the permissions it needs');
});

test('the browser tests skip only when the changes job says so, and the gate knows it', () => {
	const wf = read('.github/workflows/ci.yml');
	const e2e = wf.slice(wf.indexOf('\n  e2e:'), wf.indexOf('\n  ci-ok:'));
	assert.match(e2e, /needs: changes/, 'e2e waits for the changes job');
	assert.match(e2e, /if: \$\{\{ needs\.changes\.outputs\.e2e == 'true' \}\}/, 'and runs when it says so');
	assert.match(wf, /node scripts\/ci\/needs-e2e\.mjs/, 'the changes job asks scripts/ci/needs-e2e.mjs');
	const gate = wf.slice(wf.indexOf('\n  ci-ok:'));
	assert.match(
		gate,
		/\.key == "e2e" and \.value\.result == "skipped" and \$want == "false"/,
		'ci-ok accepts a skip of e2e alone, and only a wanted one',
	);
	assert.doesNotMatch(wf.split(/^jobs:/m)[0], /paths(-ignore)?:/, 'no path filter on the triggers: ci-ok must always report');
});
