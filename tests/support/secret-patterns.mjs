// Key and secret patterns that must never reach a committable file. Shared by the hygiene test (every file git would
// pick up) and the Claude Code write guard (.claude/hooks/guard-write.mjs), so both block the same things.
export const SECRETS = [
	[/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
	[/\bgh[pousr]_[0-9A-Za-z]{36}\b/, 'GitHub token'],
	[/\bsk-ant-[0-9A-Za-z_-]{20,}/, 'Anthropic key'],
	[/ht_ml_pwd=[A-Za-z0-9%._~-]{6,}/, 'ht-ml.app password cookie'],
	[/update[_-]?key["']?\s*[:=]\s*["']?[0-9A-Za-z_-]{16,}/i, 'ht-ml.app update key'],
];

/** what each matching pattern is, for a text; never echoes the match itself */
export const secretsIn = (text) => SECRETS.filter(([re]) => re.test(text)).map(([, what]) => what);
