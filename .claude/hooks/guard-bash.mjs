// PreToolUse (Bash, Monitor and context-mode's shells): stops the git moves that get around the repo's guards, and an
// agent agreeing to pay Google for a refresh. The husky hooks and the tests are the real gate for git; this catches the
// bypass before it runs. Exit 2 blocks the call, in every permission mode, and shows the reason to the agent.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}').tool_input || {};
const cmd = typeof input.command === 'string' ? input.command : '';
// everything the call would run: Bash's command, ctx_execute's code, ctx_batch_execute's commands. Heredoc bodies stay
// in (`python - <<EOF` runs one), so a commit message keeps the paid flag off the line that names the refresh
const runs = [cmd, input.code, ...(Array.isArray(input.commands) ? input.commands.map((c) => c?.command) : [])]
	.filter((s) => typeof s === 'string')
	.join('\n');

// a short-option cluster holding the letter, as its own word: -f, -fv, -nm
const flag = (letter) => `\\s-[a-zA-Z]*${letter}[a-zA-Z]*(?=\\s|$)`;
const FIX = 'Fix the cause instead (AGENTS.md § Rules).';
const PAY =
	'Run it without that and show the planner the estimate it prints; the planner runs the paid one themselves ' +
	'(`! pnpm resync --trip trips/<slug> … --yes`, the data-sync skill).';
const RULES = [
	[
		cmd,
		new RegExp(`\\bgit\\b[^;&|\\n]*\\badd\\b[^;&|\\n]*(\\s--force\\b|${flag('f')})`),
		'`git add -f` would add an ignored file: real trips, keys and builds are ignored on purpose.',
	],
	[
		cmd,
		/\bgit\b[^;&|\n]*\b(commit|push|merge|rebase|am)\b[^;&|\n]*\s--no-verify\b/,
		'`--no-verify` skips the husky guards (gitleaks, the trip guard, the release gate).',
	],
	[cmd, new RegExp(`\\bgit\\b[^;&|\\n]*\\bcommit\\b[^;&|\\n]*${flag('n')}`), '`git commit -n` skips the pre-commit guards.'],
	[cmd, /\bHUSKY=0\b/, '`HUSKY=0` turns the git hooks off.'],
	[cmd, /\bgit\b[^;&|\n]*\bconfig\b[^;&|\n]*\bcore\.hooksPath\b/, 'changing `core.hooksPath` unhooks husky.'],
	// Google bills every call, and one refresh can cost US$100+ (ADR-20261001-resync-cost-guard)
	[runs, /\bresync(\.py)?\b[^;&|\n]*[\s'",]--yes\b/, '`--yes` agrees to pay Google for a refresh, which is the planner’s call.', PAY],
	[runs, /\bRESYNC_PAID['"\]\s]*[=:,]/, '`RESYNC_PAID` agrees to pay Google for a refresh, which is the planner’s call.', PAY],
];

const hit = RULES.find(([text, re]) => re.test(text));
if (hit) {
	process.stderr.write(`Blocked by .claude/hooks/guard-bash.mjs: ${hit[2]} ${hit[3] || FIX}\n`);
	process.exit(2);
}
