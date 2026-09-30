// PreToolUse (Write|Edit|MultiEdit): an agent never writes a key into a file, and never creates a key or env file.
// Same patterns as the hygiene test (tests/support/secret-patterns.mjs). Exit 2 blocks the write.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { secretsIn } from '../../tests/support/secret-patterns.mjs';

const input = JSON.parse(readFileSync(0, 'utf8') || '{}').tool_input || {};
const file = String(input.file_path || '');
const text = [input.content, input.new_string, ...(input.edits || []).map((e) => e.new_string)].filter(Boolean).join('\n');

const base = path.basename(file);
const keyFile = /\.(key|pem)$/.test(base) || (/^\.env(\..+)?$/.test(base) && base !== '.env.example');
const found = secretsIn(text);

if (keyFile || found.length) {
	const why = keyFile ? `${base} is a key or env file` : `the new text holds a ${found.join(', ')}`;
	process.stderr.write(
		`Blocked by .claude/hooks/guard-write.mjs: ${why}. Keys live outside the repo, and the user writes them themselves ` +
			'(memory-bank/standards/decisions/ADR-20260930-google-keys.md). Never paste a key into a file, a test or the chat.\n',
	);
	process.exit(2);
}
