// Which ci jobs a change needs (ADR-20261002-required-ci). The browser tests (e2e) run unless every changed file is on
// SAFE: a list of what may skip them, not of what needs them, so a path nobody listed runs everything. The secrets scan
// and tier 0 always run: any file can leak a key, and tier 0 checks the docs too.
//   node scripts/ci/needs-e2e.mjs <base>   prints e2e=true|false for $GITHUB_OUTPUT (and why, on stderr)
// <base> is the commit to compare with: the pull request's base, the push's previous main, or origin/main.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// docs and release bookkeeping: nothing the page, the build or the browser tests read
export const SAFE = [
	/^[^/]+\.md$/, // README, AGENTS, CLAUDE, DESIGN, PRODUCT, CHANGELOG
	/^\.release-please-manifest\.json$/,
	/^(memory-bank|knowledge|guides)\//,
];

/** package.json changed nothing but its "version" (what a release pull request does) */
export function versionOnly(before, after) {
	try {
		const [a, b] = [JSON.parse(before), JSON.parse(after)];
		delete a.version;
		delete b.version;
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		return false;
	}
}

/** true when the change needs the browser tests: no files known, or any file off the safe list.
 *  pkg: package.json before and after, when it changed */
export function needsE2e(files, pkg = null) {
	if (!files.length) return true;
	return files.some((f) => !SAFE.some((re) => re.test(f)) && !(f === 'package.json' && pkg && versionOnly(pkg.before, pkg.after)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const base = process.argv[2] || '';
	const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
	let e2e = true;
	let why = 'no commit to compare with';
	try {
		if (base && !/^0+$/.test(base)) {
			const from = git('merge-base', base, 'HEAD').trim();
			const files = git('diff', '--name-only', from, 'HEAD').split('\n').filter(Boolean);
			const pkg = files.includes('package.json') ? { before: git('show', `${from}:package.json`), after: git('show', 'HEAD:package.json') } : null;
			e2e = needsE2e(files, pkg);
			why = `${files.length} file(s) changed${e2e ? '' : ', all docs or release bookkeeping'}`;
		}
	} catch (e) {
		e2e = true; // can't tell: run everything
		why = `git failed: ${String(e.message).split('\n')[0]}`;
	}
	console.error(`e2e ${e2e ? 'runs' : 'skipped'}: ${why}`);
	console.log(`e2e=${e2e}`);
}
