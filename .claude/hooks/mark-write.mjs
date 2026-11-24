// PostToolUse (Write|Edit|MultiEdit): notes which checkout this turn changed framework files in, so the Stop hook runs
// the checks there: the main checkout, or a git worktree of it (.claude/worktrees/<name>, where agents build branches).
// A write under trips/ or .cache/ doesn't count: a trip's own checks are the contract run in the trip-intake and
// data-sync skills. Nor does a file in another repository.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// -C alone picks the repository: a GIT_DIR or GIT_INDEX_FILE inherited from a git hook would point every call at that one
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const git = (cwd, ...args) => {
	try {
		return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return '';
	}
};
// the repository a checkout belongs to: a worktree's common git dir is its main checkout's .git
const commonDir = (dir) => {
	const c = git(dir, 'rev-parse', '--git-common-dir');
	return c ? realpathSync(path.resolve(dir, c)) : '';
};

/** The checkout (the main one or a worktree of the same repository) that holds `file`, or '' when it doesn't count. */
export function checkoutOf(root, file) {
	if (!file) return '';
	const abs = path.resolve(root, file);
	let dir = path.dirname(abs);
	while (!existsSync(dir) && dir !== path.dirname(dir)) dir = path.dirname(dir); // a new file in a new folder
	const top = git(dir, 'rev-parse', '--show-toplevel');
	if (!top || !commonDir(root) || commonDir(top) !== commonDir(root)) return '';
	// both sides real paths (macOS: /tmp is /private/tmp), so the file's place inside its checkout is exact
	const rel = path.relative(top, path.join(realpathSync(dir), path.relative(dir, abs)));
	const first = rel.split(path.sep)[0];
	if (!rel || rel.startsWith('..') || first === 'trips' || first === '.cache') return '';
	return top;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
	const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
	const top = checkoutOf(root, String(input.tool_input?.file_path || ''));
	// one flag per session, kept in the main checkout: several agents can share a tree, and one's Stop hook must not
	// run or clear another's
	const session = String(input.session_id || 'default').replace(/[^\w-]/g, '');
	if (top) appendFileSync(path.join(root, '.claude', `.write-flag-${session}`), `${top}\n`);
}
