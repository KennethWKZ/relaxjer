// Group sync for a trip (ADR-20261001-group-sync), through the planner's own Firebase Realtime Database.
//   pnpm sync rules --db <database url>                    deploy the database rules (once, and again after they change)
//   pnpm sync init --trip trips/<slug> --db <database url> new keys for the trip, its write token into the database
//   pnpm sync end --trip trips/<slug>                      after the trip: the token and every record go
//   pnpm sync status --trip trips/<slug>                   is it set up, and on which database (never a key)
//   pnpm sync planner --trip trips/<slug>                  the planner code: the first phone to give it is a planner
// The database url is https://<name>.<region>.firebasedatabase.app (Firebase console → Realtime Database). A trip's
// keys go to ~/.config/relaxjer/sync/<slug>.json (mode 600, outside the repo), which `pnpm build --sync` reads. They are
// never printed, and never on a command line: the write token reaches the Firebase CLI on its standard input.
// Needs `firebase login` once; npx fetches the pinned firebase-tools.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLANNER_ROUNDS } from '../../engine/src/core/sync.mjs';

export const FIREBASE_TOOLS = 'firebase-tools@15.32.1';
export const SYNC_DIR = path.join(os.homedir(), '.config', 'relaxjer', 'sync');
const HERE = path.dirname(new URL(import.meta.url).pathname);

/** fresh keys for a trip: its id (the database path), the write token the rules check, the key records are sealed with */
export const newSecrets = (rand = crypto.randomBytes) => ({
	trip: rand(16).toString('base64url'),
	writeToken: rand(24).toString('base64url'),
	syncKey: rand(32).toString('base64url'),
});

/** the Firebase database a url names: its instance, and the project when it's the project's default database */
export function parseDb(url) {
	let u;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	const m = /^([a-z0-9-]+)\.(?:[a-z0-9-]+\.firebasedatabase\.app|firebaseio\.com)$/.exec(u.hostname);
	if (u.protocol !== 'https:' || !m || u.pathname !== '/') return null;
	const project = (/^(.+)-default-rtdb$/.exec(m[1]) || [])[1] || null;
	return { url: `https://${u.hostname}`, instance: m[1], project };
}

const fileFor = (slug) => path.join(SYNC_DIR, `${slug}.json`);

/**
 * The trip's planner code as the page checks it (ADR-20261002-sync-planners): a salt and the code's PBKDF2 hash. The
 * code itself is never kept. Whoever gives it on a phone becomes a planner, and a planner can make others planners.
 */
export function plannerCode(code, rand = crypto.randomBytes) {
	if (String(code ?? '').trim().length < 6) throw new Error('the code needs at least 6 characters');
	const salt = rand(16);
	const hash = crypto.pbkdf2Sync(String(code).trim(), salt, PLANNER_ROUNDS, 32, 'sha256').toString('base64url');
	return { salt: salt.toString('base64url'), hash };
}

/** asks for a value on the terminal without showing it; piped input (a test) is read as it comes */
async function askHidden(prompt) {
	if (!process.stdin.isTTY) {
		let s = '';
		for await (const c of process.stdin) s += c;
		return s.split('\n')[0];
	}
	process.stdout.write(prompt);
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.setEncoding('utf8');
	return new Promise((resolve, reject) => {
		let s = '';
		const on = (ch) => {
			for (const c of ch) {
				if (c === '\r' || c === '\n') {
					process.stdin.setRawMode(false);
					process.stdin.pause();
					process.stdin.off('data', on);
					process.stdout.write('\n');
					return resolve(s);
				}
				if (c === '\u0003') {
					process.stdin.setRawMode(false);
					return reject(new Error('stopped'));
				}
				if (c === '\u007f') s = s.slice(0, -1);
				else s += c;
			}
		};
		process.stdin.on('data', on);
	});
}

/** text with every secret value hidden, for anything the script prints */
export const hide = (text, secrets) => secrets.filter(Boolean).reduce((t, s) => t.split(s).join('<hidden>'), String(text));

/**
 * Runs the pinned Firebase CLI. Its output is shown as it comes for a deploy; for a database command it's captured and
 * dropped, because the CLI echoes the path ("View data at …/keys/<trip id>"), and only a failure is printed, with every
 * secret in `secrets` hidden.
 */
function firebase(args, { input, secrets = [] } = {}) {
	if (!secrets.length)
		return execFileSync('npx', ['-y', FIREBASE_TOOLS, ...args], { input, stdio: [input == null ? 'inherit' : 'pipe', 'inherit', 'inherit'] });
	try {
		return execFileSync('npx', ['-y', FIREBASE_TOOLS, ...args], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
	} catch (e) {
		// no `cause`: the original error holds the command line, the trip id included
		// eslint-disable-next-line preserve-caught-error
		throw new Error(hide(`firebase ${args[0]} failed: ${e.stderr || e.stdout || e.message}`, secrets));
	}
}

async function main(argv) {
	const [cmd] = argv;
	const val = (f) => {
		const i = argv.indexOf(f);
		return i >= 0 ? argv[i + 1] : null;
	};
	const tripDir = val('--trip');
	const slug = tripDir ? path.basename(path.resolve(tripDir)) : null;
	const projectFlag = val('--project');
	const need = (ok, msg) => {
		if (!ok) throw new Error(msg);
	};
	const dbFrom = (url) => {
		const db = parseDb(url);
		need(db, `--db: a Firebase Realtime Database url (https://<name>.<region>.firebasedatabase.app), got ${JSON.stringify(url)}`);
		const project = projectFlag || db.project;
		need(project, '--project <firebase project id>: the database isn’t its project’s default one, so name the project');
		return { ...db, project };
	};

	if (cmd === 'rules') {
		const db = dbFrom(val('--db'));
		firebase(['deploy', '--only', 'database', '--config', path.join(HERE, 'firebase.json'), '--project', db.project]);
		console.log(`sync: rules deployed to ${db.instance}`);
	} else if (cmd === 'init') {
		need(slug && fs.existsSync(path.join(path.resolve(tripDir), 'data.js')), 'usage: pnpm sync init --trip trips/<slug> --db <database url>');
		const db = dbFrom(val('--db'));
		const file = fileFor(slug);
		need(
			!fs.existsSync(file) || argv.includes('--force'),
			`${file} exists: the group's phones are on it. --force starts a new database for this trip (everyone starts over)`,
		);
		const s = newSecrets();
		// the token goes in first: a file that names a token the database doesn't hold would build a page that can't write
		firebase(['database:set', `/keys/${s.trip}`, '--project', db.project, '--instance', db.instance, '--force'], {
			input: JSON.stringify(s.writeToken),
			secrets: [s.trip, s.writeToken, s.syncKey],
		});
		fs.mkdirSync(SYNC_DIR, { recursive: true, mode: 0o700 });
		fs.writeFileSync(file, `${JSON.stringify({ url: db.url, project: db.project, ...s }, null, '\t')}\n`, { mode: 0o600 });
		console.log(`sync: ${slug} is set up on ${db.instance}. Build with: pnpm build --trip ${tripDir} --keys … --sync ${file}`);
	} else if (cmd === 'end') {
		need(slug, 'usage: pnpm sync end --trip trips/<slug>');
		const file = fileFor(slug);
		need(fs.existsSync(file), `no sync file for ${slug} at ${file}`);
		const s = JSON.parse(fs.readFileSync(file, 'utf8'));
		const db = parseDb(s.url);
		for (const p of [`/trips/${s.trip}`, `/keys/${s.trip}`])
			firebase(['database:remove', p, '--project', projectFlag || s.project, '--instance', db.instance, '--force'], {
				secrets: [s.trip, s.writeToken, s.syncKey],
			});
		fs.renameSync(file, `${file}.ended`);
		console.log(
			`sync: ended for ${slug}. Its records and token are gone; the phones keep their own copies. A rebuild without --sync stops the page asking.`,
		);
	} else if (cmd === 'status') {
		need(slug, 'usage: pnpm sync status --trip trips/<slug>');
		const file = fileFor(slug);
		if (!fs.existsSync(file)) console.log(`sync: ${slug} isn't set up${fs.existsSync(`${file}.ended`) ? ' (ended)' : ''}`);
		else {
			const s = JSON.parse(fs.readFileSync(file, 'utf8'));
			console.log(`sync: ${slug} is on ${parseDb(s.url)?.instance || 'an unreadable url'} (project ${s.project}); build with --sync ${file}`);
		}
	} else if (cmd === 'planner') {
		need(slug, 'usage: pnpm sync planner --trip trips/<slug>');
		const file = fileFor(slug);
		need(fs.existsSync(file), `no sync file for ${slug} at ${file}: pnpm sync init first`);
		const s = JSON.parse(fs.readFileSync(file, 'utf8'));
		const code = await askHidden('Planner code (6+ characters, not shown; give it on your own phone in Group sync): ');
		if (process.stdin.isTTY) need((await askHidden('Again: ')) === code, 'the two codes differ');
		s.planner = plannerCode(code);
		fs.writeFileSync(file, `${JSON.stringify(s, null, '\t')}\n`, { mode: 0o600 });
		console.log(`sync: planner code set for ${slug}. Rebuild with --sync ${file} and republish; phones already planners stay planners.`);
	} else {
		throw new Error('usage: pnpm sync rules|init|end|status|planner … (see scripts/sync/sync.mjs)');
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2)).catch((e) => {
		console.error(`sync: ${e.message}`);
		process.exit(1);
	});
}
