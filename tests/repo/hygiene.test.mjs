// The public repo never carries real trips, keys or builds, and the code graph never indexes them.
// These run in the pre-commit hook and in CI; gitleaks scans content on top (.gitleaks.toml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../support/stage.mjs';

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const ignored = (p) => {
  try { git('check-ignore', '-q', '--no-index', p); return true; } catch { return false; }
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
  ];
  assert.deepEqual(mustIgnore.filter((p) => !ignored(p)), []);
});

test('the framework files stay tracked', () => {
  const mustTrack = ['trips/README.md', 'engine/build.mjs', 'engine/src/app/00-open.js', 'engine/src/app/99-close.js', 'examples/demo-trip/data.js', 'examples/demo-trip/geo.json', 'tests/e2e/boot.spec.mjs', '.env.example', 'docs/adr/0001-repo-layout.md'];
  assert.deepEqual(mustTrack.filter(ignored), []);
});

test('the code graph ignores trips, builds and data fixtures', () => {
  const lines = fs.readFileSync(path.join(ROOT, '.cbmignore'), 'utf8').split('\n').map((l) => l.trim());
  for (const want of ['trips/', 'dist/', '.cache/', 'node_modules/', '.share/', 'examples/**/*.json']) assert.ok(lines.includes(want), `.cbmignore lacks ${want}`);
});

test('no file that would be committed holds a key or a real trip', () => {
  // everything git would pick up: tracked plus untracked-but-not-ignored
  const files = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean);
  const SECRETS = [
    [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
    [/\bgh[pousr]_[0-9A-Za-z]{36}\b/, 'GitHub token'],
    [/\bsk-ant-[0-9A-Za-z_-]{20,}/, 'Anthropic key'],
    [/ht_ml_pwd=[A-Za-z0-9%._~-]{6,}/, 'ht-ml.app password cookie'],
    [/update[_-]?key["']?\s*[:=]\s*["']?[0-9A-Za-z_-]{16,}/i, 'ht-ml.app update key'],
  ];
  const hits = [];
  for (const f of files) {
    if (f.startsWith('trips/') && f !== 'trips/README.md') hits.push(`${f}: real trip file`);
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs) || fs.statSync(abs).size > 2e6) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const [re, what] of SECRETS) if (re.test(text)) hits.push(`${f}: ${what}`);
  }
  assert.deepEqual(hits, []);
});

test('nothing under trips/ is tracked or staged except its README', () => {
  const tracked = git('ls-files', '--cached', '--', 'trips/').split('\n').filter(Boolean);
  assert.deepEqual(tracked.filter((f) => f !== 'trips/README.md'), []);
});

test('the pre-push hook runs the release gate', () => {
  const hook = fs.readFileSync(path.join(ROOT, '.githooks', 'pre-push'), 'utf8');
  assert.match(hook, /gitleaks/);
  assert.match(hook, /tests\/release/);
  assert.ok(fs.statSync(path.join(ROOT, '.githooks', 'pre-push')).mode & 0o111, 'hook is executable');
});

test('the pre-commit hook is wired and blocks trips and secrets', () => {
  const hook = fs.readFileSync(path.join(ROOT, '.githooks', 'pre-commit'), 'utf8');
  assert.match(hook, /gitleaks/);
  assert.match(hook, /trips\//);
  assert.ok(fs.statSync(path.join(ROOT, '.githooks', 'pre-commit')).mode & 0o111, 'hook is executable');
});
