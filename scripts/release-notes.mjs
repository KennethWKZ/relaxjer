// A release's notes, cut from CHANGELOG.md (commit-and-tag-version writes it on `pnpm release`), for the GitHub release
// the release workflow makes from a pushed tag (.github/workflows/release.yml, ADR-20261002-ci-image-and-releases).
//   node scripts/release-notes.mjs v1.0.1 > notes.md
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * The section for a version, without its heading: from "## 1.0.0 (…)" or "## [1.0.1](…) (…)" to the next "## ". null
 * when the changelog has no such version.
 */
export function notesFor(changelog, tag) {
	const v = String(tag).replace(/^v/, '');
	const lines = String(changelog).split('\n');
	const head = new RegExp(`^## \\[?${v.replace(/\./g, '\\.')}\\]?[ (]`);
	const at = lines.findIndex((l) => head.test(l));
	if (at < 0) return null;
	const end = lines.findIndex((l, i) => i > at && l.startsWith('## '));
	return lines
		.slice(at + 1, end < 0 ? lines.length : end)
		.join('\n')
		.trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const tag = process.argv[2];
	const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
	const notes = tag && notesFor(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), tag);
	if (!notes) {
		console.error(`release-notes: no section for ${tag || '(no tag given)'} in CHANGELOG.md`);
		process.exit(1);
	}
	process.stdout.write(`${notes}\n`);
}
