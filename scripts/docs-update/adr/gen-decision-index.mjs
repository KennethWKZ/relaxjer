// Regenerates memory-bank/standards/decision-index.md, the generated index over the one-file-per-decision ADRs in
// memory-bank/standards/decisions/, grouped by domain. Ported from the maintainer's boilerplate
// (serverless-aws-nodejs-typescript, scripts/docs-update/adr/gen-decision-index.ts) to plain ESM, plus a --check mode,
// the closed domain list, the one-line rule and the supersede links.
//   pnpm gen:adr-index           write the index
//   pnpm gen:adr-index --check   exit 1 if the index on disk is stale (pnpm verify, tests/repo)
// The contract is .claude/rules/memory-bank.md; the reason for domains is ADR-20261122-adr-index-by-domain.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { format, resolveConfig } from 'prettier';

const STANDARDS = path.join(import.meta.dirname, '..', '..', '..', 'memory-bank', 'standards');
const DECISIONS = path.join(STANDARDS, 'decisions');
export const INDEX = path.join(STANDARDS, 'decision-index.md');

/**
 * The closed list of domains: every ADR has exactly one. `patterns` names the pattern files in standards/patterns/ that
 * hold the domain's current rules; they must link every current ADR of the domain (tests/repo/memory-bank.test.mjs).
 * A domain with no pattern file keeps its rules in its ADRs only.
 */
export const DOMAINS = {
	engine: {
		about: 'How a trip becomes the page: the views, the sections, the day logic and the packs',
		patterns: ['engine.md'],
	},
	'trip-data': {
		about: "A trip's data and the pipeline that refreshes it: the fields, the contract and the cost of a refresh",
		patterns: ['trip-data.md', 'pipeline.md'],
	},
	sync: {
		about: 'Group sync: the shared database, who may change what, and the roles of each phone',
		patterns: [],
	},
	hosting: {
		about: 'Where the page and the demos are published, the keys they need, and the page security policy',
		patterns: [],
	},
	design: {
		about: 'How the page looks, moves and reads: type, colour, illustrations, motion, names and controls',
		patterns: ['frontend.md', 'affordances.md'],
	},
	tooling: {
		about: 'The repo layout, the toolchain, CI and releases, dependency rules, and the agent setup and docs',
		patterns: [],
	},
	testing: {
		about: 'The test tiers, the checks that gate a merge, and the rules for e2e tests',
		patterns: ['testing.md'],
	},
};
export const DOMAIN_SLUGS = Object.keys(DOMAINS);

const REQUIRED = ['id', 'date', 'title', 'domain', 'status', 'decision'];
export const STATUSES = ['proposed', 'accepted', 'amended', 'superseded', 'deprecated'];
// current decisions are listed open; superseded and deprecated ones are folded away under their domain
export const CURRENT = ['proposed', 'accepted', 'amended'];
export const MAX_RULE = 160;
const ID = /^ADR-(\d{4})(\d{2})(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Both YAML quote styles are unwrapped: single quotes are the norm once a title holds a colon or a backtick, and the
// quotes would otherwise leak into the table.
function unquote(value) {
	if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\(.)/g, '$1');
	if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
	return value;
}

/** A flow list (`[a, b]`) as an array; an absent value is an empty list, anything unbracketed is null (an error). */
function list(value) {
	if (!value) return [];
	const m = /^\[(.*)\]$/.exec(value);
	if (!m) return null;
	return m[1]
		.split(',')
		.map((s) => unquote(s.trim()))
		.filter(Boolean);
}

/** An ADR's frontmatter, or the list of what's wrong with it. */
export function parseAdr(file, text) {
	const m = /^---\n([\s\S]*?)\n---/.exec(text);
	if (!m) return { file, errors: ['missing YAML frontmatter'] };
	const fields = {};
	for (const line of m[1].split('\n')) {
		const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
		if (kv) fields[kv[1]] = unquote(kv[2].trim());
	}
	const errors = REQUIRED.filter((k) => !fields[k]).map((k) => `frontmatter lacks ${k}`);
	const id = ID.exec(fields.id || '');
	if (fields.id && !id) errors.push(`id ${fields.id} is not ADR-YYYYMMDD-kebab-slug`);
	if (fields.id && file !== `${fields.id}.md`) errors.push(`file name should be ${fields.id}.md`);
	if (id && fields.date !== `${id[1]}-${id[2]}-${id[3]}`) errors.push(`date ${fields.date} does not match the id's date`);
	if (fields.status && !STATUSES.includes(fields.status)) errors.push(`status ${fields.status} is not one of ${STATUSES.join(', ')}`);
	if (fields.domain && !DOMAIN_SLUGS.includes(fields.domain)) {
		errors.push(`domain ${fields.domain} is not one of ${DOMAIN_SLUGS.join(', ')}`);
	}
	if (fields.decision && fields.decision.length > MAX_RULE) {
		errors.push(`decision is ${fields.decision.length} characters: keep the one-line rule under ${MAX_RULE}`);
	}
	const tags = list(fields.tags);
	const supersedes = list(fields.supersedes);
	if (tags === null) errors.push('tags must be a [list]');
	if (supersedes === null) errors.push('supersedes must be a [list]');
	for (const t of tags || []) {
		if (!DOMAIN_SLUGS.includes(t) || t === fields.domain) errors.push(`tag ${t} must be a domain from the list, other than the domain`);
	}
	if (new Set(tags || []).size !== (tags || []).length) errors.push('tags repeat a domain');
	for (const s of supersedes || []) if (!ID.test(s)) errors.push(`supersedes ${s} is not an id`);
	if (fields.superseded_by && !ID.test(fields.superseded_by)) errors.push(`superseded_by ${fields.superseded_by} is not an id`);
	if (fields.status === 'superseded' && !fields.superseded_by) errors.push('a superseded ADR needs superseded_by');
	if (fields.superseded_by && fields.status !== 'superseded') errors.push('superseded_by needs status superseded');
	if (fields.id && (supersedes || []).includes(fields.id)) errors.push('an ADR cannot supersede itself');
	const body = text.slice(m[0].length);
	for (const [heading] of body.matchAll(/^## Amendment.*$/gm)) {
		if (!/^## Amendment \d{4}-\d{2}-\d{2}$/.test(heading)) errors.push(`"${heading}" should be "## Amendment YYYY-MM-DD"`);
	}
	const h1 = /^# (.+)$/m.exec(body);
	if (fields.title && (!h1 || h1[1].trim() !== fields.title)) errors.push('the first heading should repeat the title');
	return { ...fields, tags: tags || [], supersedes: supersedes || [], file, errors };
}

export function readAdrs(dir = DECISIONS) {
	return readdirSync(dir)
		.filter((f) => f.endsWith('.md'))
		.map((f) => parseAdr(f, readFileSync(path.join(dir, f), 'utf8')));
}

const byDateThenId = (a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date));

export async function render(adrs) {
	const problems = adrs.flatMap((a) => a.errors.map((e) => `${a.file}: ${e}`));
	const byId = new Map();
	for (const a of adrs) {
		if (!a.id) continue;
		if (byId.has(a.id)) problems.push(`${a.file}: id ${a.id} is already used by ${byId.get(a.id).file} (the newcomer takes a fresh id)`);
		else byId.set(a.id, a);
	}
	// both sides of a supersede link must name each other, so neither can drift
	for (const a of adrs) {
		for (const old of a.supersedes) {
			const target = byId.get(old);
			if (!target) problems.push(`${a.file}: supersedes ${old}, which does not exist`);
			else if (target.superseded_by !== a.id) {
				problems.push(`${a.file}: supersedes ${old}, but ${target.file} does not say superseded_by ${a.id}`);
			}
		}
		if (a.superseded_by) {
			const next = byId.get(a.superseded_by);
			if (!next) problems.push(`${a.file}: superseded_by ${a.superseded_by}, which does not exist`);
			else if (!next.supersedes.includes(a.id)) {
				problems.push(`${a.file}: superseded_by ${a.superseded_by}, but that ADR does not list supersedes ${a.id}`);
			}
		}
	}
	if (problems.length) throw new Error(`fix these ADRs first:\n  ${problems.join('\n  ')}`);

	const sorted = [...adrs].sort(byDateThenId);
	// the newest ADR's date, not the clock: re-running on an unchanged folder gives a byte-identical file
	const lastUpdated = sorted.reduce((max, a) => (a.date > max ? a.date : max), '');
	const cell = (s) => s.replace(/\|/g, '\\|');
	const table = (rows) => [
		'| ADR | Date | Status | Rule |',
		'| --- | ---- | ------ | ---- |',
		...rows.map((a) => `| [${a.id}](decisions/${a.file}) | ${a.date} | ${a.status} | ${cell(a.decision)} |`),
	];
	const sections = DOMAIN_SLUGS.flatMap((domain) => {
		const mine = sorted.filter((a) => a.domain === domain);
		const current = mine.filter((a) => CURRENT.includes(a.status));
		const folded = mine.filter((a) => !CURRENT.includes(a.status));
		const { about, patterns } = DOMAINS[domain];
		const where = patterns.length
			? `Patterns: ${patterns.map((p) => `[${p}](./patterns/${p})`).join(', ')}.`
			: 'No pattern file: the rules live in these ADRs.';
		return [
			`## ${domain}`,
			'',
			`${about}. ${where}`,
			'',
			...(current.length ? table(current) : ['No current decisions.']),
			...(folded.length
				? ['', '<details>', `<summary>Superseded or deprecated (${folded.length})</summary>`, '', ...table(folded), '', '</details>']
				: []),
			'',
		];
	});
	const out = [
		'---',
		`total_decisions: ${sorted.length}`,
		`last_updated: ${lastUpdated}`,
		'---',
		'',
		'# Decision Index',
		'',
		'<!-- AUTO-GENERATED by `pnpm gen:adr-index` from memory-bank/standards/decisions/*.md. DO NOT EDIT this file by hand. -->',
		'',
		'The decisions behind RelaxJer, one file each under [`decisions/`](./decisions/), grouped by domain. Read the Rule',
		'column first: it is the decision in one line. Open the ADR for its reasons (Context, Alternatives, Consequences).',
		'To add a decision, follow [`../../.claude/rules/memory-bank.md`](../../.claude/rules/memory-bank.md), then run',
		'`pnpm gen:adr-index`.',
		'',
		'**Ids** are `ADR-YYYYMMDD-slug`, never a shared counter, so parallel branches and pull requests never collide. A',
		'merged id never changes; a new ADR that collides takes a fresh slug.',
		'',
		...sections,
	].join('\n');
	// formatted with the repo's own Prettier config, so `pnpm format` never rewrites what this just wrote
	return format(out, { ...(await resolveConfig(INDEX)), filepath: INDEX });
}

if (import.meta.main) {
	const check = process.argv.includes('--check');
	try {
		const adrs = readAdrs();
		const next = await render(adrs);
		let current = '';
		try {
			current = readFileSync(INDEX, 'utf8');
		} catch {
			// no index yet
		}
		if (check) {
			if (current !== next) {
				console.error('decision-index.md is stale: run `pnpm gen:adr-index` and commit the result.');
				process.exit(1);
			}
		} else if (current !== next) {
			writeFileSync(INDEX, next);
			console.log(`wrote ${path.relative(process.cwd(), INDEX)}: ${adrs.length} ADRs`);
		} else console.log(`decision-index.md is up to date: ${adrs.length} ADRs`);
	} catch (e) {
		console.error(e.message);
		process.exit(1);
	}
}
