// The public repo never carries real trips, keys or builds, and the code graph never indexes them.
// These run in the pre-commit hook and in CI; gitleaks scans content on top (.gitleaks.toml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../support/stage.mjs';
import { secretsIn } from '../support/secret-patterns.mjs';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const ignored = (p) => {
	try {
		git('check-ignore', '-q', '--no-index', p);
		return true;
	} catch {
		return false;
	}
};

test('real trips, keys, caches and builds are gitignored', () => {
	const mustIgnore = [
		'trips/hokkaido-2027/requirements.md',
		'trips/hokkaido-2027/data/data.js',
		'trips/hokkaido-2027/img/photo.webp',
		'trips/hokkaido-2027/dist/page.html',
		'.share/google.json',
		'maps.key',
		'deploy.pem',
		'.env',
		'.env.local',
		'.secrets/token',
		'dist/page.html',
		'.cache/pages/trip.html',
		'test-results/x/trace.zip',
		'playwright-report/index.html',
		'pipeline/.venv/bin/python',
		'pipeline/lib/__pycache__/trip.cpython-313.pyc',
		'trips/hokkaido-2027/.cache/google-cache.json',
		'trips/hokkaido-2027/pipeline.json',
	];
	assert.deepEqual(
		mustIgnore.filter((p) => !ignored(p)),
		[],
	);
});

test('the framework files stay tracked', () => {
	const mustTrack = [
		'trips/README.md',
		'engine/build.mjs',
		'engine/src/app/00-open.js',
		'engine/src/app/99-close.js',
		'examples/demo-trip/data.js',
		'examples/demo-trip/geo.json',
		'tests/e2e/boot.spec.mjs',
		'.env.example',
		'memory-bank/standards/decisions/ADR-20260930-repo-layout.md',
		'AGENTS.md',
		'skills-lock.json',
		'.claude/settings.json',
		'.agents/skills/trip-intake/SKILL.md',
	];
	assert.deepEqual(mustTrack.filter(ignored), []);
});

test('the code graph ignores trips, builds and data fixtures', () => {
	const lines = fs
		.readFileSync(path.join(ROOT, '.cbmignore'), 'utf8')
		.split('\n')
		.map((l) => l.trim());
	for (const want of ['trips/', 'dist/', '.cache/', 'node_modules/', '.share/', 'examples/**/*.json'])
		assert.ok(lines.includes(want), `.cbmignore lacks ${want}`);
});

test('no file that would be committed holds a key or a real trip', () => {
	// everything git would pick up: tracked plus untracked-but-not-ignored
	const files = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean);
	const hits = [];
	for (const f of files) {
		if (f.startsWith('trips/') && f !== 'trips/README.md') hits.push(`${f}: real trip file`);
		const abs = path.join(ROOT, f);
		// a skill link (.claude/skills/<name> → .agents/skills/<name>) is listed as a file; its target is scanned there
		const st = fs.existsSync(abs) && fs.lstatSync(abs);
		if (!st || !st.isFile() || st.size > 2e6) continue;
		for (const what of secretsIn(fs.readFileSync(abs, 'utf8'))) hits.push(`${f}: ${what}`);
	}
	assert.deepEqual(hits, []);
});

test('nothing under trips/ is tracked or staged except its README', () => {
	const tracked = git('ls-files', '--cached', '--', 'trips/').split('\n').filter(Boolean);
	assert.deepEqual(
		tracked.filter((f) => f !== 'trips/README.md'),
		[],
	);
});

test('the pre-push hook runs the release gate', () => {
	const hook = fs.readFileSync(path.join(ROOT, '.husky', 'pre-push'), 'utf8');
	assert.match(hook, /gitleaks/);
	assert.match(hook, /test:release/);
	assert.match(hook, /scan-history/);
	assert.ok(fs.statSync(path.join(ROOT, '.husky', 'pre-push')).mode & 0o111, 'hook is executable');
});

test('the pre-commit hook is wired and blocks trips and secrets', () => {
	const hook = fs.readFileSync(path.join(ROOT, '.husky', 'pre-commit'), 'utf8');
	assert.match(hook, /gitleaks/);
	assert.match(hook, /trips\//);
	assert.ok(fs.statSync(path.join(ROOT, '.husky', 'pre-commit')).mode & 0o111, 'hook is executable');
});

test('the hooks are wired by husky and commits are linted', () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
	assert.equal(pkg.scripts.prepare, 'husky');
	assert.match(pkg.packageManager, /^pnpm@\d+\.\d+\.\d+$/, 'pnpm is pinned');
	assert.match(fs.readFileSync(path.join(ROOT, '.husky', 'commit-msg'), 'utf8'), /commitlint/);
	assert.match(fs.readFileSync(path.join(ROOT, '.husky', 'pre-commit'), 'utf8'), /lint-staged/);
	assert.ok(!fs.existsSync(path.join(ROOT, 'package-lock.json')), 'one lockfile: pnpm-lock.yaml');
});

test('new dependency releases wait before they install', () => {
	const ws = fs.readFileSync(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
	const age = Number((/^minimumReleaseAge:\s*(\d+)/m.exec(ws) || [])[1]);
	assert.ok(age >= 1440, 'minimumReleaseAge is at least a day');
});
