// The memory-bank and the docs around it stay navigable: ADRs follow their contract and the generated index is current,
// and every relative link and every backticked repo path in the docs points at something that exists. A file move
// that leaves a dangling reference fails here, naming each one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../support/stage.mjs';
import { INDEX, parseAdr, readAdrs, render } from '../../scripts/docs-update/adr/gen-decision-index.mjs';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
	.split('\n')
	.filter(Boolean)
	.filter((f) => fs.existsSync(path.join(ROOT, f)) && fs.lstatSync(path.join(ROOT, f)).isFile());
const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills-lock.json'), 'utf8')).skills;
const vendored = (f) => Object.keys(lock).some((name) => f.startsWith(`.agents/skills/${name}/`));
// the prose an agent or a person navigates by; vendored skills keep their upstream links as they are
const docs = files.filter((f) => f.endsWith('.md') && !vendored(f) && f !== 'CHANGELOG.md');

test('every ADR follows the contract, and decision-index.md is current', async () => {
	const adrs = readAdrs();
	assert.ok(adrs.length >= 1);
	const next = await render(adrs); // throws, listing each ADR's problems
	assert.equal(fs.readFileSync(INDEX, 'utf8'), next, 'decision-index.md is stale: run `pnpm gen:adr-index`');
});

test('the ADR generator rejects what the contract forbids', () => {
	const adr = (file, fm, h1) => parseAdr(file, `---\n${fm}\n---\n\n# ${h1}\n`).errors;
	const ok = "id: ADR-20261001-x\ndate: 2026-10-01\ntitle: 'X: y'\ndomain: agents\nstatus: accepted";
	assert.deepEqual(adr('ADR-20261001-x.md', ok, 'X: y'), []);
	assert.match(adr('ADR-0005.md', ok.replace('ADR-20261001-x', 'ADR-0005'), 'X: y').join(), /not ADR-YYYYMMDD/);
	assert.match(adr('other.md', ok, 'X: y').join(), /file name should be/);
	assert.match(adr('ADR-20261001-x.md', ok.replace('2026-10-01', '2026-10-02'), 'X: y').join(), /does not match/);
	assert.match(adr('ADR-20261001-x.md', ok.replace('accepted', 'done'), 'X: y').join(), /status/);
	assert.match(adr('ADR-20261001-x.md', ok, 'Something else').join(), /first heading/);
	assert.match(adr('ADR-20261001-x.md', ok.replace(/\ndomain: agents/, ''), 'X: y').join(), /lacks domain/);
});

/** the file's text with fenced code blocks blanked, so example links and paths inside them aren't checked */
const prose = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^```[\s\S]*?^```/gm, '');

test('every relative link in the docs resolves', () => {
	const broken = [];
	for (const f of docs) {
		for (const [, target] of prose(f).matchAll(/\]\(([^)\s]+)\)/g)) {
			if (/^(https?:|mailto:|#|data:)/.test(target)) continue;
			const file = decodeURIComponent(target.split('#')[0]);
			if (file && !fs.existsSync(path.resolve(ROOT, path.dirname(f), file))) broken.push(`${f} → ${target}`);
		}
	}
	assert.deepEqual(broken, []);
});

// top-level folders whose paths the docs name in backticks; a placeholder (<slug>, NN, *, {a,b}, …) isn't checked
const REPO_DIRS = [
	'engine',
	'tests',
	'pipeline',
	'destinations',
	'examples',
	'memory-bank',
	'knowledge',
	'guides',
	'site',
	'.claude',
	'.agents',
	'.husky',
	'scripts',
];
test('every backticked repo path in the docs exists', () => {
	const missing = [];
	for (const f of docs) {
		for (const [, p] of prose(f).matchAll(/`([^`\s]+)`/g)) {
			if (!REPO_DIRS.includes(p.split('/')[0]) || !p.includes('/') || /[<>*{}…$]|NN|\.\.\.|:/.test(p)) continue;
			if (!fs.existsSync(path.join(ROOT, p.replace(/\/$/, '')))) missing.push(`${f}: ${p}`);
		}
	}
	assert.deepEqual(missing, []);
});

test('nothing points at the old docs/ folder', () => {
	const old = new RegExp(['docs', '(adr/|roadmap\\.md|brief\\.md|trip-format\\.md|naming\\.md)'].join('/'));
	const hits = files.filter(
		(f) => !vendored(f) && fs.statSync(path.join(ROOT, f)).size < 2e6 && old.test(fs.readFileSync(path.join(ROOT, f), 'utf8')),
	);
	assert.deepEqual(hits, [], 'docs/ moved to memory-bank/ (ADR-20261001-memory-bank-agent-config)');
});
