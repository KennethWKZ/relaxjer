// Stop: after a turn that changed framework files, runs lint, the format check and tier 0 (the fast half of
// `pnpm verify`; the pipeline's tests need uv and run on pre-push). A failure keeps the agent working once (exit 2 feeds
// the output back); a second failure in a row only warns, so a stuck turn can't loop forever.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const flag = path.join(root, '.claude', '.write-flag');
if (!existsSync(flag)) process.exit(0);
const retried = JSON.parse(readFileSync(0, 'utf8') || '{}').stop_hook_active === true;

try {
	execSync('pnpm --silent lint:check && pnpm --silent format:check && pnpm --silent test', { cwd: root, stdio: 'pipe', encoding: 'utf8' });
	rmSync(flag, { force: true });
} catch (e) {
	if (retried) {
		rmSync(flag, { force: true });
		process.stdout.write(JSON.stringify({ systemMessage: 'Checks still failing after a retry: run pnpm verify and fix them by hand.' }));
		process.exit(0);
	}
	const out = `${e.stdout || ''}${e.stderr || ''}`.split('\n').slice(-60).join('\n');
	process.stderr.write(`Checks failed after your edits (lint:check, format:check, pnpm test). Fix them before stopping:\n${out}\n`);
	process.exit(2);
}
