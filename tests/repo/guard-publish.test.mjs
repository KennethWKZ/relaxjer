// .claude/hooks/guard-publish.mjs: publishing has one door. A plain `pnpm publish:trip …` passes (the settings "ask"
// rule then prompts the planner); every other route to the script, the share or the secrets is denied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const hook = path.join(root, '.claude', 'hooks', 'guard-publish.mjs');
const decide = (toolInput) => {
	const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_input: toolInput }), encoding: 'utf8' });
	assert.equal(r.status, 0, r.stderr);
	return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'pass';
};

test('guard-publish: the plain package script passes, to meet the settings ask rule', () => {
	const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));
	assert.ok(settings.permissions.ask.includes('Bash(pnpm publish:trip:*)'), 'the ask rule the door leads to');
	for (const command of ['pnpm publish:trip trips/demo', 'pnpm publish:trip trips/demo --dry-run', ' pnpm publish:trip trips/demo --check '])
		assert.equal(decide({ command }), 'pass', command);
});

test('guard-publish: every other route is denied', () => {
	for (const command of [
		'node scripts/publish-trip.mjs trips/demo',
		'pnpm run publish:trip trips/demo',
		'pnpm exec node scripts/publish-trip.mjs trips/demo',
		'npx tsx scripts/publish-trip.mjs trips/demo',
		`node -e "import('./scripts/publish-trip.mjs')"`,
		'npm run publish:trip -- trips/demo',
		'cd /tmp && pnpm publish:trip trips/demo',
		'pnpm publish:trip trips/demo; echo done',
		'pnpm publish:trip $(echo trips/demo)',
		'lavish-axi share x.html --site abc123de --update-key "$K"',
		'cat ~/.config/relaxjer/publish/demo.txt',
		'security find-generic-password -s relaxjer-publish -a demo -w',
	])
		assert.equal(decide({ command }), 'deny', command);
	assert.equal(decide({ code: "import('./scripts/publish-trip.mjs')" }), 'deny', 'ctx_execute code');
	assert.equal(decide({ path: '/x/.config/relaxjer/publish/demo.txt', code: 'print(1)' }), 'deny', 'ctx_execute_file path');
	assert.equal(decide({ commands: [{ label: 'x', command: 'pnpm publish:trip trips/demo' }] }), 'deny', 'ctx_batch_execute');
});

test('guard-publish: work on the script itself is not publishing', () => {
	for (const command of [
		'git add scripts/publish-trip.mjs',
		'pnpm exec prettier --write scripts/publish-trip.mjs',
		'pnpm test',
		'pnpm build --trip trips/demo --keys ~/.config/relaxjer/google.json',
		'grep -n "pnpm publish:trip" .agents/skills/publish-htmlapp/SKILL.md',
		'sed -n 1,30p scripts/publish-trip.mjs',
		'git show fb7b7a9 -- scripts/publish-trip.mjs | head',
		'rg "lavish-axi share .* --update-key" knowledge',
		"git commit -F - -- scripts/publish-trip.mjs <<'EOF'\nfeat: pnpm publish:trip trips/demo now asks\nEOF",
		'node --test tests/unit/publish.test.mjs',
	])
		assert.equal(decide({ command }), 'pass', command);
});
