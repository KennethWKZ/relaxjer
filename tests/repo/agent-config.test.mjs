// The agent tooling stays loadable and safe: every skill is where every agent looks for it, the vendored ones are
// pinned and credited, reviewer agents can't write, hooks point at real scripts and block what they promise to, and
// path-scoped rules still match files (memory-bank/standards/decisions/ADR-20261001-memory-bank-agent-config.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT } from '../support/stage.mjs';

const at = (...p) => path.join(ROOT, ...p);
const read = (...p) => fs.readFileSync(at(...p), 'utf8');
const dirs = (...p) =>
	fs
		.readdirSync(at(...p), { withFileTypes: true })
		.filter((e) => e.isDirectory() || e.isSymbolicLink())
		.map((e) => e.name)
		.sort();
const frontmatter = (text) => {
	const m = /^---\n([\s\S]*?)\n---/.exec(text);
	if (!m) return null;
	const out = {};
	let list = null;
	for (const line of m[1].split('\n')) {
		const item = /^\s+-\s+['"]?(.+?)['"]?$/.exec(line);
		if (item && list) out[list].push(item[1]);
		const kv = /^([a-z-]+):\s*(.*)$/.exec(line);
		if (kv) {
			list = kv[2] === '' ? kv[1] : null;
			out[kv[1]] = kv[2] === '' ? [] : kv[2].replace(/^['"]|['"]$/g, '');
		}
	}
	return out;
};
const lock = JSON.parse(read('skills-lock.json')).skills;
const vendored = Object.keys(lock).sort();

test('every skill has a SKILL.md whose name matches its folder, and says when to use it', () => {
	const bad = [];
	for (const name of dirs('.agents', 'skills')) {
		const fm = frontmatter(read('.agents', 'skills', name, 'SKILL.md'));
		if (!fm) bad.push(`${name}: no frontmatter`);
		else {
			if (fm.name !== name) bad.push(`${name}: frontmatter name is ${fm.name}`);
			if (!fm.description || fm.description.length < 40) bad.push(`${name}: description too short to route on`);
		}
	}
	assert.deepEqual(bad, []);
});

test('Claude Code sees exactly the skills every other agent sees, through relative links', () => {
	const agents = dirs('.agents', 'skills');
	assert.deepEqual(dirs('.claude', 'skills'), agents, '.claude/skills and .agents/skills list different skills');
	for (const name of agents) {
		const link = at('.claude', 'skills', name);
		assert.ok(fs.lstatSync(link).isSymbolicLink(), `.claude/skills/${name} should be a link, not a copy`);
		assert.equal(fs.readlinkSync(link), `../../.agents/skills/${name}`);
		assert.ok(fs.existsSync(path.join(link, 'SKILL.md')), `.claude/skills/${name} doesn't resolve`);
	}
});

test('vendored skills are pinned, credited, and kept byte-for-byte', () => {
	for (const name of vendored) {
		assert.ok(fs.existsSync(at('.agents', 'skills', name, 'SKILL.md')), `skills-lock.json lists ${name}, but it isn't vendored`);
		assert.match(lock[name].computedHash, /^[0-9a-f]{64}$/, `${name} has no content hash`);
	}
	const notices = read('.agents', 'THIRD_PARTY_NOTICES.md');
	for (const source of new Set(vendored.map((n) => lock[n].source)))
		assert.ok(notices.includes(source), `THIRD_PARTY_NOTICES.md doesn't credit ${source}`);
	for (const name of vendored) assert.ok(notices.includes(`\`${name}\``), `THIRD_PARTY_NOTICES.md doesn't name ${name}`);
	const ignore = (f) =>
		read(f)
			.split('\n')
			.map((l) => l.trim());
	for (const name of vendored) {
		assert.ok(ignore('.prettierignore').includes(`.agents/skills/${name}/`), `.prettierignore would reformat ${name}`);
		assert.ok(ignore('.cbmignore').includes(`.agents/skills/${name}/`), `.cbmignore would index ${name}`);
	}
});

test("RelaxJer's own skills and roles are listed in AGENTS.md, so agents without .claude/ find them", () => {
	const agentsMd = read('AGENTS.md');
	const own = dirs('.agents', 'skills').filter((n) => !vendored.includes(n));
	const roles = fs.readdirSync(at('.claude', 'agents')).map((f) => f.replace(/\.md$/, ''));
	assert.deepEqual(
		[...own, ...roles].filter((n) => !agentsMd.includes(`\`${n}\``)),
		[],
	);
	assert.match(read('CLAUDE.md'), /^@AGENTS\.md$/m, 'CLAUDE.md imports AGENTS.md');
});

test('reviewer agents are read-only', () => {
	const bad = [];
	for (const f of fs.readdirSync(at('.claude', 'agents'))) {
		const fm = frontmatter(read('.claude', 'agents', f)) || {};
		if (fm.name !== f.replace(/\.md$/, '')) bad.push(`${f}: name is ${fm.name}`);
		if (!fm.description) bad.push(`${f}: no description`);
		const tools = String(fm.tools || '')
			.split(',')
			.map((t) => t.trim());
		if (!fm.tools) bad.push(`${f}: no tools list (it would inherit every tool, writes included)`);
		for (const t of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) if (tools.includes(t)) bad.push(`${f}: has ${t}`);
	}
	assert.deepEqual(bad, []);
});

test('every hook in .claude/settings.json runs a script that exists', () => {
	const settings = JSON.parse(read('.claude', 'settings.json'));
	const commands = Object.values(settings.hooks).flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.command)));
	assert.ok(commands.length >= 4);
	for (const c of commands) {
		const script = /\$CLAUDE_PROJECT_DIR\/([^"\s]+)/.exec(c);
		assert.ok(script, `hook command doesn't name a repo script: ${c}`);
		assert.ok(fs.existsSync(at(script[1])), `hook script missing: ${script[1]}`);
	}
	for (const [id, on] of Object.entries(settings.enabledPlugins)) {
		assert.ok(on);
		assert.ok(settings.extraKnownMarketplaces[id.split('@')[1]], `${id}: its marketplace isn't declared`);
	}
});

const hook = (name, input) =>
	spawnSync(process.execPath, [at('.claude', 'hooks', name)], {
		input: JSON.stringify(input),
		encoding: 'utf8',
		env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
	}).status;

test('the Bash guard blocks the hook bypasses and lets ordinary git through', () => {
	// built here, so this file's own text never trips the guard it tests
	const git = (...a) => ['git', ...a].join(' ');
	const blocked = [
		git('add', '-f', 'trips/x/data.js'),
		git('add', '--force', 'dist/'),
		git('commit', '--no-verify', '-m', 'x'),
		git('commit', '-nm', 'x'),
		['HUSKY', '0'].join('=') + ' ' + git('commit', '-m', 'x'),
		git('config', 'core.hooksPath', '/dev/null'),
	];
	const allowed = [
		git('add', '-A'),
		git('commit', '-m', '"feat(engine): find the next stop"'),
		git('commit', '--amend', '--no-edit'),
		'pnpm test',
		git('push', 'origin', 'main'),
	];
	for (const command of blocked) assert.equal(hook('guard-bash.mjs', { tool_input: { command } }), 2, `not blocked: ${command}`);
	for (const command of allowed) assert.equal(hook('guard-bash.mjs', { tool_input: { command } }), 0, `blocked: ${command}`);
});

test('the write guard blocks keys and key files, and lets ordinary writes through', () => {
	const googleKey = 'AIza' + 'B'.repeat(35);
	const anthropicKey = ['sk', 'ant', 'x'.repeat(24)].join('-');
	const write = (file_path, extra) => hook('guard-write.mjs', { tool_input: { file_path: at(file_path), ...extra } });
	assert.equal(write('x.md', { content: `key ${googleKey}` }), 2);
	assert.equal(write('y.md', { edits: [{ new_string: 'ok' }, { new_string: anthropicKey }] }), 2);
	assert.equal(write('a/.env', { content: 'X=1' }), 2);
	assert.equal(write('maps.key', { content: 'x' }), 2);
	assert.equal(write('.env.example', { content: 'X=' }), 0);
	assert.equal(write('z.md', { new_string: 'plain text' }), 0);
});

test('every path-scoped rule still matches a file in the repo', () => {
	const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
		.split('\n')
		.filter(Boolean);
	// the glob forms the rules use: `**/` (any folders), `**` (anything), `*` (within one folder)
	const PART = { '**/': '(?:.*/)?', '**': '.*', '*': '[^/]*' };
	const glob = (g) =>
		new RegExp(
			`^${g
				.split(/(\*\*\/|\*\*|\*)/)
				.map((t) => PART[t] ?? t.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
				.join('')}$`,
		);
	const stale = [];
	for (const f of fs.readdirSync(at('.claude', 'rules'))) {
		const fm = frontmatter(read('.claude', 'rules', f));
		assert.ok(fm && Array.isArray(fm.paths) && fm.paths.length, `${f}: no paths list`);
		for (const p of fm.paths) if (!files.some((file) => glob(p).test(file))) stale.push(`${f}: ${p}`);
	}
	assert.deepEqual(stale, [], 'these rule paths match nothing: fix them after a move');
});
