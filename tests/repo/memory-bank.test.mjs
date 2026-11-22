// The memory-bank and the docs around it stay navigable: ADRs follow their contract and the generated index is current,
// and every relative link and every backticked repo path in the docs points at something that exists. A file move
// that leaves a dangling reference fails here, naming each one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../support/stage.mjs';
import { CURRENT, DOMAINS, INDEX, parseAdr, readAdrs, render } from '../../scripts/docs-update/adr/gen-decision-index.mjs';

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
	const ok = "id: ADR-20261001-x\ndate: 2026-10-01\ntitle: 'X: y'\ndomain: tooling\nstatus: accepted\ndecision: 'A rule.'";
	assert.deepEqual(adr('ADR-20261001-x.md', ok, 'X: y'), []);
	assert.match(adr('ADR-0005.md', ok.replace('ADR-20261001-x', 'ADR-0005'), 'X: y').join(), /not ADR-YYYYMMDD/);
	assert.match(adr('other.md', ok, 'X: y').join(), /file name should be/);
	assert.match(adr('ADR-20261001-x.md', ok.replace('2026-10-01', '2026-10-02'), 'X: y').join(), /does not match/);
	assert.match(adr('ADR-20261001-x.md', ok.replace('accepted', 'done'), 'X: y').join(), /status/);
	assert.match(adr('ADR-20261001-x.md', ok, 'Something else').join(), /first heading/);
	assert.match(adr('ADR-20261001-x.md', ok.replace(/\ndomain: tooling/, ''), 'X: y').join(), /lacks domain/);
	assert.match(adr('ADR-20261001-x.md', ok.replace("\ndecision: 'A rule.'", ''), 'X: y').join(), /lacks decision/);
});

test('the ADR generator keeps domains closed, the rule short, and supersede links two-sided', async () => {
	const fm = (id, extra = '') =>
		`id: ${id}\ndate: ${id.slice(4, 8)}-${id.slice(8, 10)}-${id.slice(10, 12)}\ntitle: X\ndomain: engine\nstatus: accepted\ndecision: 'A rule.'${extra}`;
	const parse = (id, extra, body = '') => parseAdr(`${id}.md`, `---\n${fm(id, extra)}\n---\n\n# X\n${body}`);
	const errs = (a) => a.errors.join('\n');
	assert.deepEqual(parse('ADR-20261001-x', '').errors, []);
	assert.match(errs(parse('ADR-20261001-x', '\ntags: [engine]')), /other than the domain/);
	assert.match(errs(parse('ADR-20261001-x', '\ntags: [nope]')), /must be a domain/);
	assert.match(errs(parse('ADR-20261001-x', '\nsupersedes: ADR-20261001-y')), /must be a \[list\]/);
	assert.match(errs(parse('ADR-20261001-x', '', '\n## Amendment 2026\n')), /should be "## Amendment YYYY-MM-DD"/);
	const tooLong = parseAdr('ADR-20261001-x.md', `---\n${fm('ADR-20261001-x').replace("'A rule.'", `'${'a'.repeat(161)}'`)}\n---\n\n# X\n`);
	assert.match(errs(tooLong), /keep the one-line rule under 160/);
	const badDomain = parseAdr('ADR-20261001-x.md', `---\n${fm('ADR-20261001-x').replace('domain: engine', 'domain: agents')}\n---\n\n# X\n`);
	assert.match(errs(badDomain), /domain agents is not one of/);
	const oldAdr = parseAdr('ADR-20261001-old.md', `---\n${fm('ADR-20261001-old').replace('accepted', 'superseded')}\n---\n\n# X\n`);
	assert.match(errs(oldAdr), /needs superseded_by/);

	// both sides of a supersede link must name each other, and the ids must exist
	const oldSide = parseAdr(
		'ADR-20261001-old.md',
		`---\n${fm('ADR-20261001-old').replace('accepted', 'superseded')}\nsuperseded_by: ADR-20261002-new\n---\n\n# X\n`,
	);
	const newSide = parse('ADR-20261002-new', '\nsupersedes: [ADR-20261001-old]');
	assert.deepEqual([oldSide.errors, newSide.errors], [[], []]);
	await render([oldSide, newSide]); // resolves: the links agree
	await assert.rejects(render([oldSide, parse('ADR-20261002-new', '')]), /does not list supersedes ADR-20261001-old/);
	await assert.rejects(render([newSide]), /supersedes ADR-20261001-old, which does not exist/);
	await assert.rejects(render([oldSide]), /superseded_by ADR-20261002-new, which does not exist/);
});

test('every current decision is linked from the pattern files of its domain', () => {
	const adrs = readAdrs();
	const missing = [];
	// a domain with no pattern file (sync, hosting, tooling) keeps its rules in its ADRs and is exempt
	for (const [domain, { patterns }] of Object.entries(DOMAINS)) {
		if (!patterns.length) continue;
		const text = patterns.map((p) => fs.readFileSync(path.join(ROOT, 'memory-bank', 'standards', 'patterns', p), 'utf8')).join('\n');
		for (const a of adrs.filter((x) => x.domain === domain && CURRENT.includes(x.status))) {
			if (!text.includes(`decisions/${a.file}`)) missing.push(`${domain}: link ${a.file} from ${patterns.join(' or ')}`);
		}
	}
	assert.deepEqual(missing, [], 'add a "Decisions behind these rules" link to each pattern file named above');
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
