// PostToolUse (Write|Edit|MultiEdit): notes that this turn changed framework files, so the Stop hook runs the checks.
// A write under trips/ doesn't count: a trip's own checks are the contract run in the trip-intake and data-sync skills.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const file = String(JSON.parse(readFileSync(0, 'utf8') || '{}').tool_input?.file_path || '');
const rel = path.relative(root, path.resolve(root, file));

if (rel && !rel.startsWith('..') && !rel.startsWith('trips/') && !rel.startsWith('.cache/')) {
	writeFileSync(path.join(root, '.claude', '.write-flag'), `${rel}\n`, { flag: 'a' });
}
