// PreToolUse (Bash): stops the git moves that get around the repo's guards. The husky hooks and the tests are the real
// gate; this catches the bypass before it runs. Exit 2 blocks the call and shows the reason to the agent.
import { readFileSync } from 'node:fs';

const cmd = String(JSON.parse(readFileSync(0, 'utf8') || '{}').tool_input?.command || '');

// a short-option cluster holding the letter, as its own word: -f, -fv, -nm
const flag = (letter) => `\\s-[a-zA-Z]*${letter}[a-zA-Z]*(?=\\s|$)`;
const RULES = [
	[
		new RegExp(`\\bgit\\b[^;&|\\n]*\\badd\\b[^;&|\\n]*(\\s--force\\b|${flag('f')})`),
		'`git add -f` would add an ignored file: real trips, keys and builds are ignored on purpose.',
	],
	[
		/\bgit\b[^;&|\n]*\b(commit|push|merge|rebase|am)\b[^;&|\n]*\s--no-verify\b/,
		'`--no-verify` skips the husky guards (gitleaks, the trip guard, the release gate).',
	],
	[new RegExp(`\\bgit\\b[^;&|\\n]*\\bcommit\\b[^;&|\\n]*${flag('n')}`), '`git commit -n` skips the pre-commit guards.'],
	[/\bHUSKY=0\b/, '`HUSKY=0` turns the git hooks off.'],
	[/\bgit\b[^;&|\n]*\bconfig\b[^;&|\n]*\bcore\.hooksPath\b/, 'changing `core.hooksPath` unhooks husky.'],
];

const hit = RULES.find(([re]) => re.test(cmd));
if (hit) {
	process.stderr.write(`Blocked by .claude/hooks/guard-bash.mjs: ${hit[1]} Fix the cause instead (AGENTS.md § Rules).\n`);
	process.exit(2);
}
