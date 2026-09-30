// PreToolUse (Bash and context-mode's shells): publishing reaches the group, so it has exactly one door. A plain
// `pnpm publish:trip …` passes here and meets the settings.json "ask" rule, which prompts the planner in every mode.
// Every other route to the script, the share or the publish secrets is denied, since a hook "ask" isn't documented to
// prompt in bypass mode but a deny holds in all of them. The planner's own `!` commands don't go through hooks.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}').tool_input || {};
const cmd = typeof input.command === 'string' ? input.command : '';
// Bash sends `command`; ctx_execute `code`; ctx_execute_file `path` and `code`; ctx_batch_execute `commands[].command`
const text = JSON.stringify(input);
// the one door: the package script alone, with plain arguments (no chaining, substitution or redirects)
const plain = /^\s*pnpm\s+publish:trip(\s+[\w./-]+)*\s*$/.test(cmd) && input.code == null && input.commands == null;
// Bash: look at each command in the line, skipping heredoc bodies (a commit message may name the script) and parts that
// only read (grep, cat, sed -n, git show…). Code in a context-mode shell can run the script any way: any mention counts.
const READ_ONLY = /^(grep|rg|cat|head|tail|less|more|wc|ls|stat|file|echo|printf|sed\s+-n|git\s+(show|log|diff|grep|blame|status))\b/;
const noHeredocs = cmd.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g, ' ');
const parts = noHeredocs
	.split(/&&|\|\||[;|\n]/)
	.map((p) => p.trim())
	.filter((p) => p && !READ_ONLY.test(p));
const shellCode = input.code != null || input.commands != null;
const acts = (re) => (shellCode ? re.test(text) : parts.some((p) => re.test(p)));

const RULES = [
	// running it: a JS runtime pointed at the file (with or without flags, or inline code naming it), or the package
	// script under another spelling. `pnpm exec prettier … publish-trip.mjs` only touches the file
	[
		acts(shellCode ? /publish[-:]trip/ : /\b(node|bun|deno|tsx)\b(\s+-\S+)*\s+\S*publish-trip\b|\b(pnpm|npm|yarn|bun)\b(\s+\S+)*?\s+publish:trip\b/),
		'runs the publish script another way',
	],
	[acts(/lavish-axi\b.*\bshare\b.*--update-key/), 'republishes a live page directly'],
	// the secrets folder: even reading it is refused, whatever the tool
	[/\.config\/relaxjer\/publish/.test(text), 'touches the publish secrets'],
	[acts(/\bfind-generic-password\b.*relaxjer-publish/), 'reads the publish key from the Keychain'],
];

const hit = !plain && RULES.find(([on]) => on);
if (hit)
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason:
					`Publishing guard (.claude/hooks/guard-publish.mjs): this ${hit[1]}. Publishing reaches the group, so it has one ` +
					'door: run `pnpm publish:trip trips/<slug>` on its own in Bash, and the planner approves it (publish-htmlapp skill).',
			},
		}),
	);
