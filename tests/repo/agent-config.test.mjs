// The agent tooling stays loadable and safe: every skill is where every agent looks for it, the vendored ones are
// pinned and credited, reviewer agents can't write, hooks point at real scripts and block what they promise to, and
// path-scoped rules still match files (memory-bank/standards/decisions/ADR-20261001-memory-bank-agent-config.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
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

// knowledge/research.md: how to research a trip (audit facts, rednote posts, Google's route times, data costs,
// choices, rental cars, shop lists, cards, bookings, customs) reaches every agent that researches or writes a plan
test('trip research follows knowledge/research.md', () => {
	const r = read('knowledge', 'research.md');
	for (const must of [
		/## Every finding is an audit fact/,
		/www\.rednote\.com/,
		/last six months/,
		/Read only/,
		/Google's route times before any route advice/,
		/a dry run's too/,
		/two to three times/,
		/Give choices, not one pick/,
		/Never guess a paid date or an amount/,
		/duty-free allowance/,
	])
		assert.match(r, must, `knowledge/research.md keeps ${must}`);
	for (const f of [
		['.claude', 'agents', 'relaxbro.md'],
		['.claude', 'agents', 'destination-researcher.md'],
		['.agents', 'skills', 'trip-intake', 'SKILL.md'],
		['.agents', 'skills', 'data-sync', 'SKILL.md'],
		['.agents', 'skills', 'trip-customize', 'SKILL.md'],
		['memory-bank', 'standards', 'patterns', 'trip-data.md'],
	])
		assert.match(read(...f), /knowledge\/research\.md/, `${f.join('/')} links knowledge/research.md`);
	assert.match(read('knowledge', 'README.md'), /\(research\.md\)/, 'knowledge/README.md lists it');
});

// knowledge/stays.md: the lessons from researching stays (availability for the exact dates, the three sites and both
// kinds of stay, the planner's ranking) reach every agent that researches or writes a stay
test('stay research follows knowledge/stays.md', () => {
	const stays = read('knowledge', 'stays.md');
	for (const must of [
		/## Availability for the exact dates/,
		/Booking\.com, Agoda and Airbnb/,
		/hotels, and homes/,
		/recommended/,
		/Parking, whenever a car is an option/,
		/A separate test browser for public booking pages/,
	])
		assert.match(stays, must, `knowledge/stays.md keeps ${must}`);
	for (const f of [
		['.claude', 'agents', 'relaxbro.md'],
		['.agents', 'skills', 'trip-customize', 'SKILL.md'],
		['.agents', 'skills', 'trip-intake', 'SKILL.md'],
	])
		assert.match(read(...f), /knowledge\/stays\.md/, `${f.join('/')} links knowledge/stays.md`);
	assert.match(read('knowledge', 'README.md'), /\(stays\.md\)/, 'knowledge/README.md lists it');
	assert.match(read('.claude', 'agents', 'relaxbro.md'), /A car means parking/, 'relaxbro asks for parking on every self-drive option');
});

// "relaxed, not packed" means unhurried days, not thin ones: the travel agent once dropped stops to make a day look
// lighter, and the planner wants free evenings filled with easy extras instead
test('a relaxed pace keeps its places: the travel agent moves a stop before it drops one', () => {
	const bro = read('.claude', 'agents', 'relaxbro.md');
	assert.match(bro, /Pace first, not fewer places/, 'relaxbro names the rule');
	assert.match(bro, /never cut only to make a day look lighter/, 'relaxbro never cuts a sight for looks');
	assert.match(bro, /move a stop before you drop it/, 'relaxbro moves a stop first');
	const customize = read('.agents', 'skills', 'trip-customize', 'SKILL.md');
	assert.match(customize, /"We want it relaxed, not packed"/, 'trip-customize has the relaxed-pace row');
	assert.match(customize, /a stop moved to another day before one is dropped/, 'trip-customize moves a stop before dropping one');
});

// `--not` negates every ref after it, the branch included: `git log --not --remotes HEAD` lists nothing, so a check
// built on it passes over zero commits
test('agent commands that list unpushed commits name the branch before --not', () => {
	const files = [
		...fs.readdirSync(at('.claude', 'agents')).map((f) => path.join('.claude', 'agents', f)),
		...dirs('.agents', 'skills')
			.filter((n) => !vendored.includes(n))
			.map((n) => path.join('.agents', 'skills', n, 'SKILL.md')),
	];
	assert.deepEqual(
		files.filter((f) => /git (?:log|rev-list)(?: -\S+)* --not\b/.test(read(f))),
		[],
	);
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

test('the Bash guard leaves paying Google for a refresh to the planner', () => {
	// built here, like the git ones above
	const yes = ['-', '-yes'].join('');
	const paid = ['RESYNC', 'PAID'].join('_');
	const drives = ['-', '-fresh-drives'].join('');
	const drivesEnv = ['RESYNC', 'FRESH', 'DRIVES'].join('_');
	const blocked = [
		// --fresh-drives stays under the 200-call stop, so it pays with no yes, even in a dry run
		{ command: `pnpm resync --trip trips/x ${drives}` },
		{ command: `pnpm resync --trip trips/x ${drives} --no-weather --no-links --no-build` },
		{ command: `uv run --project pipeline pipeline/resync.py --trip trips/x --write ${drives}` },
		{ command: `${drivesEnv}=1 uv run --project pipeline python pipeline/steps/fetch.py` },
		{ code: `subprocess.run(['pnpm', 'resync', '--trip', 'x', '${drives}'])` },
		{ commands: [{ label: 'x', command: `pnpm resync --trip trips/x ${drives}` }] },
		{ command: `pnpm resync --trip trips/x --fresh ${yes}` },
		{ command: `pnpm resync --trip trips/x --write ${yes} --no-weather` },
		{ command: `uv run --project pipeline pipeline/resync.py --trip trips/x ${yes}` },
		{ command: `${paid}=1 uv run --project pipeline python pipeline/steps/fetch.py` },
		{ command: `python - <<'EOF'\nimport subprocess; subprocess.run(['pnpm', 'resync', '--trip', 'x', '${yes}'])\nEOF` },
		{ code: `import os; os.environ['${paid}'] = '1'` },
		{ code: `subprocess.run(['pnpm', 'resync', '--trip', 'x'], env=dict(os.environ, ${paid}='1'))` },
		{ commands: [{ label: 'x', command: `pnpm resync --trip trips/x ${yes}` }] },
	];
	const allowed = [
		{ command: 'pnpm resync --trip trips/x' },
		{ command: 'pnpm resync --trip trips/x --fresh' },
		{ command: 'pnpm resync --trip trips/x --write --no-weather' },
		{ command: `grep -n ${paid} pipeline/lib/google.py` },
		{ command: `rg -n ${drivesEnv} pipeline/lib/google.py` },
		{ command: `rg -n -- '${drives}' .agents/skills/data-sync/SKILL.md` },
		{ command: `npx -y firebase-tools@15.32.1 login ${yes}` },
	];
	for (const t of blocked) assert.equal(hook('guard-bash.mjs', { tool_input: t }), 2, `not blocked: ${JSON.stringify(t)}`);
	for (const t of allowed) assert.equal(hook('guard-bash.mjs', { tool_input: t }), 0, `blocked: ${JSON.stringify(t)}`);
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

// The Stop hook's checks run where the edit was: an agent building a branch in a git worktree (.claude/worktrees/<name>)
// gets its own tree linted and tested, not the main checkout that didn't change
// a timeout: a hook that read its stdin on import would otherwise hang the run
test(
	'the Stop hook checks the checkout that was edited: the main one or a worktree, never a trip, another repo or a removed tree',
	{ timeout: 30_000 },
	async () => {
		const { checkoutOf } = await import(pathToFileURL(at('.claude', 'hooks', 'mark-write.mjs')).href);
		const { CHECKS, checkoutsIn, runChecks } = await import(pathToFileURL(at('.claude', 'hooks', 'stop-checks.mjs')).href);
		const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rj-stop-')));
		// a throwaway repository with one worktree; its own git hooks off, so nothing of the machine's runs in it. Every GIT_*
		// variable is dropped: inside a git hook (pre-commit runs this test) GIT_DIR and GIT_INDEX_FILE would point these
		// calls at the real repository instead
		const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
		const git = (cwd, ...a) =>
			execFileSync('git', ['-C', cwd, '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], {
				env,
				encoding: 'utf8',
				stdio: 'pipe',
			});
		const root = path.join(tmp, 'repo');
		const other = path.join(tmp, 'other');
		try {
			for (const r of [root, other]) {
				fs.mkdirSync(r);
				git(r, 'init', '-q');
				// never add or commit anywhere but this throwaway repository
				assert.equal(fs.realpathSync(git(r, 'rev-parse', '--show-toplevel').trim()), r, `${r} is a repository of its own`);
				fs.writeFileSync(path.join(r, 'a.js'), '');
				git(r, 'add', 'a.js');
				git(r, 'commit', '-q', '-m', 'init');
			}
			const wt = path.join(root, '.claude', 'worktrees', 'w');
			git(root, 'worktree', 'add', '-q', wt, '-b', 'w');

			assert.equal(checkoutOf(root, 'engine/x.js'), root, 'a file in the main checkout');
			assert.equal(checkoutOf(root, path.join(wt, 'engine', 'new', 'x.js')), wt, 'a new file in a worktree');
			assert.equal(checkoutOf(root, 'trips/t/data.js'), '', 'a trip');
			assert.equal(checkoutOf(root, path.join(wt, 'trips', 't', 'data.js')), '', "a worktree's trip");
			assert.equal(checkoutOf(root, '.cache/x'), '', 'a build');
			assert.equal(checkoutOf(root, path.join(other, 'a.js')), '', 'another repository');
			assert.equal(checkoutOf(root, path.join(tmp, 'loose.md')), '', 'a file in no repository');

			// the hook itself: an edit in the worktree flags the worktree, in this session's flag in the main checkout
			fs.mkdirSync(path.join(root, '.claude'), { recursive: true });
			const mark = (file) =>
				spawnSync(process.execPath, [at('.claude', 'hooks', 'mark-write.mjs')], {
					input: JSON.stringify({ session_id: 's1', tool_input: { file_path: file } }),
					env: { ...env, CLAUDE_PROJECT_DIR: root },
				}).status;
			assert.equal(mark(path.join(wt, 'a.js')), 0);
			assert.equal(mark(path.join(root, 'trips', 'x.js')), 0);
			const flag = fs.readFileSync(path.join(root, '.claude', '.write-flag-s1'), 'utf8');
			assert.equal(flag, `${wt}\n`, 'only the worktree is flagged');

			// the Stop hook's side: each checkout once; an older flag's relative lines mean the main checkout; a removed tree drops
			assert.deepEqual(checkoutsIn(root, `${wt}\n${wt}\nengine/x.js\n${path.join(tmp, 'gone')}\n`), [wt, root]);
			fs.mkdirSync(path.join(wt, 'node_modules'));
			const ran = [];
			const { failed, skipped } = runChecks([wt, root], (cmd, cwd) => {
				ran.push([cmd, cwd]);
				throw Object.assign(new Error('lint'), { stdout: 'x.js: 1 problem' });
			});
			assert.deepEqual(ran, [[CHECKS, wt]], 'the checks run in the worktree, as one command');
			assert.deepEqual(failed, [{ top: wt, out: 'x.js: 1 problem' }]);
			assert.deepEqual(skipped, [root], 'a checkout without node_modules is named, not checked');
		} finally {
			fs.rmSync(tmp, { recursive: true, force: true });
		}
	},
);
