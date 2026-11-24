// Stop: after a turn that changed framework files, runs lint, the format check and tier 0 (the fast half of
// `pnpm verify`; the pipeline's tests need uv and run on pre-push), in each checkout the turn changed: the main one, or
// a git worktree of it (mark-write.mjs names them). A failure keeps the agent working once (exit 2 feeds the output
// back); a second failure in a row only warns, so a stuck turn can't loop forever.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CHECKS = 'pnpm --silent lint:check && pnpm --silent format:check && pnpm --silent test';

/** The checkouts a flag names, once each: a line is a checkout's path (an older flag's lines are files in `root`). */
export function checkoutsIn(root, text) {
	const tops = new Set();
	for (const line of String(text)
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)) {
		const top = path.isAbsolute(line) ? line : root;
		if (existsSync(top)) tops.add(top); // a worktree removed since the edit has nothing left to check
	}
	return [...tops];
}

/** Runs the checks in each checkout with `run(command, cwd)`; a checkout without node_modules can't run them. */
export function runChecks(tops, run) {
	const failed = [];
	const skipped = [];
	for (const top of tops) {
		if (!existsSync(path.join(top, 'node_modules'))) {
			skipped.push(top);
			continue;
		}
		try {
			run(CHECKS, top);
		} catch (e) {
			failed.push({ top, out: `${e.stdout || ''}${e.stderr || ''}` });
		}
	}
	return { failed, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
	const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
	// this session's flag only (mark-write.mjs): another agent in the same tree keeps its own
	const session = String(input.session_id || 'default').replace(/[^\w-]/g, '');
	const flag = path.join(root, '.claude', `.write-flag-${session}`);
	if (!existsSync(flag)) process.exit(0);
	const retried = input.stop_hook_active === true;
	const name = (top) => (path.relative(root, top) ? path.relative(root, top) : 'the main checkout');

	const { failed, skipped } = runChecks(checkoutsIn(root, readFileSync(flag, 'utf8')), (cmd, cwd) =>
		execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }),
	);
	const note = skipped.length ? `Not checked (no node_modules; run pnpm install there): ${skipped.map(name).join(', ')}.` : '';
	if (!failed.length || retried) {
		rmSync(flag, { force: true });
		const msg = failed.length
			? `Checks still failing after a retry in ${failed.map((f) => name(f.top)).join(', ')}: run pnpm verify there and fix them by hand.`
			: '';
		if (msg || note) process.stdout.write(JSON.stringify({ systemMessage: [msg, note].filter(Boolean).join(' ') }));
		process.exit(0);
	}
	const out = failed.map((f) => `── ${name(f.top)} ──\n${f.out.split('\n').slice(-60).join('\n')}`).join('\n');
	process.stderr.write(`Checks failed after your edits (lint:check, format:check, pnpm test). Fix them before stopping:\n${out}\n${note}\n`);
	process.exit(2);
}
