// Group sync for a trip, through the planner's own Firebase Realtime Database.
//   pnpm sync rules --db <database url>                    deploy the database rules (once, and again after they change)
//   pnpm sync init --trip trips/<slug> --db <database url> --api-key <web API key>
//                                                          new keys for the trip, and its gate into the database
//   pnpm sync planner --trip trips/<slug>                  the planner code: a device that gives it approves itself as planner
//   pnpm sync approve --trip trips/<slug> [--code <join code> [--planner]]
//                                                          the join requests waiting; with --code, approve that device
//   pnpm sync status --trip trips/<slug>                   is it set up, and on which database (never a key)
//   pnpm sync end --trip trips/<slug>                      after the trip: the gate (or token) and every record go
// A new trip is an approval trip (ADR-20261127-sync-approval): each device signs in to Firebase anonymously, asks to
// join, and reads or writes the group's changes only once a planner approved it. `init --token` still makes a token trip
// (ADR-20261001-group-sync: anyone with the page reads and writes), and trips already set up that way keep working.
// The database tells them apart by `gates/<trip>`, which only this script writes. The database url is
// https://<name>.<region>.firebasedatabase.app (Firebase console → Realtime Database); the web API key is in Project
// settings → General. A trip's keys go to ~/.config/relaxjer/sync/<slug>.json (mode 600, outside the repo), which
// `pnpm build --sync` reads. They are never printed, and never on a command line: what goes into the database reaches
// the Firebase CLI on its standard input. Needs `firebase login` once; npx fetches the pinned firebase-tools.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLANNER_ROUNDS, approvalWrites, groupOf, openName, recordKey } from '../../engine/src/core/sync.mjs';

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

/**
 * The planner-code proof an approval trip's database checks (ADR-20261127-sync-approval): the code's PBKDF2 hash under a
 * second, separate salt. The proof goes only into the database, at gates/<trip>/proof, which no device can read; the
 * salt goes into the page, so a device that's given the code can work the proof out and send it. The page's own hash
 * (plannerCode) is under the other salt, so holding the page doesn't give the proof.
 */
export function plannerProof(code, rand = crypto.randomBytes) {
	if (String(code ?? '').trim().length < 6) throw new Error('the code needs at least 6 characters');
	const salt = rand(16);
	const proof = crypto.pbkdf2Sync(String(code).trim(), salt, PLANNER_ROUNDS, 32, 'sha256').toString('base64url');
	return { proofSalt: salt.toString('base64url'), proof };
}

/** the project's web API key as the page sends it to Firebase's sign-in (not a secret: it names the project) */
export const parseApiKey = (k) => (typeof k === 'string' && /^[A-Za-z0-9_-]{30,60}$/.test(k) ? k : null);

// control characters (C0, C1), zero-width and direction marks, isolates and the byte-order mark, as code point ranges
const UNPRINTABLE = new RegExp(
	`[${[
		[0x00, 0x1f],
		[0x7f, 0x9f],
		[0x200b, 0x200f],
		[0x2028, 0x202e],
		[0x2060, 0x206f],
		[0xfeff, 0xfeff],
	]
		.map(([a, b]) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`)
		.join('')}]`,
	'g',
);
/** text someone typed on a device, safe to print on the planner's terminal: no control or direction characters */
export const printable = (s) =>
	String(s ?? '')
		.replace(UNPRINTABLE, '')
		.slice(0, 40);

const KIND_OS = {
	iphone: 'iPhone',
	ipad: 'iPad',
	android: 'Android',
	huawei: 'Huawei',
	mac: 'Mac',
	windows: 'Windows',
	chromebook: 'Chromebook',
	linux: 'Linux',
};
const KIND_APP = {
	app: 'home-screen app',
	safari: 'Safari',
	chrome: 'Chrome',
	firefox: 'Firefox',
	edge: 'Edge',
	samsung: 'Samsung Internet',
	wechat: 'WeChat',
};
/** "iPhone · Safari" for a device's kind ("iphone/safari"), as the page says it */
export function kindLabel(kind) {
	const [os, app] = String(kind || '').split('/');
	const o = KIND_OS[os] || '';
	const a = KIND_APP[app] || (app && app !== 'other' ? `${app[0].toUpperCase()}${app.slice(1)} Browser` : '');
	return [o, a].filter(Boolean).join(' · ') || 'a device';
}

/** an approval trip's join requests (devices/ as the database holds it), each name opened with the trip's key */
export async function joinRequests(devices, { trip, syncKey }) {
	const key = await recordKey(syncKey);
	const names = {};
	for (const [uid, e] of Object.entries(devices && typeof devices === 'object' ? devices : {}))
		names[uid] = await openName(key, trip, uid, e && e.name);
	return groupOf(devices, {}, names).requests;
}

/** the database writes that approve the join request showing `code`, as its own person, and a planner too if asked */
export function approveByCode(requests, code, { planner = false } = {}) {
	const hits = requests.filter((r) => r.code === String(code ?? '').trim());
	if (!hits.length) throw new Error(`no join request shows the code ${printable(code)}: run without --code to see them`);
	if (hits.length > 1)
		throw new Error(`${hits.length} join requests show the code ${printable(code)}: ask one device to clear its site data and ask again`);
	const r = hits[0];
	return { request: r, writes: approvalWrites('approve', { uid: r.uid, dev: r.dev, planner }) };
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
		const token = argv.includes('--token');
		const apiKey = parseApiKey(val('--api-key'));
		need(
			token || apiKey,
			'--api-key <web API key>: Firebase console → Project settings → General → Web API key (devices sign in with it; not a secret)',
		);
		const s = newSecrets();
		const all = [s.trip, s.writeToken, s.syncKey];
		// what the rules check goes in first: a file the database doesn't match would build a page that can't sync. A token
		// trip's write token at keys/<trip>; an approval trip's gate at gates/<trip>, which no device can read or write
		if (token)
			firebase(['database:set', `/keys/${s.trip}`, '--project', db.project, '--instance', db.instance, '--force'], {
				input: JSON.stringify(s.writeToken),
				secrets: all,
			});
		else
			firebase(['database:set', `/gates/${s.trip}`, '--project', db.project, '--instance', db.instance, '--force'], {
				input: JSON.stringify({ approval: true }),
				secrets: all,
			});
		const saved = token
			? { url: db.url, project: db.project, ...s }
			: { url: db.url, project: db.project, trip: s.trip, syncKey: s.syncKey, approval: true, apiKey };
		fs.mkdirSync(SYNC_DIR, { recursive: true, mode: 0o700 });
		fs.writeFileSync(file, `${JSON.stringify(saved, null, '\t')}\n`, { mode: 0o600 });
		console.log(
			`sync: ${slug} is set up on ${db.instance}${token ? ' (write token)' : `. Next: pnpm sync planner --trip ${tripDir}`}. Build with: pnpm build --trip ${tripDir} --keys … --sync ${file}`,
		);
	} else if (cmd === 'end') {
		need(slug, 'usage: pnpm sync end --trip trips/<slug>');
		const file = fileFor(slug);
		need(fs.existsSync(file), `no sync file for ${slug} at ${file}`);
		const s = JSON.parse(fs.readFileSync(file, 'utf8'));
		const db = parseDb(s.url);
		for (const p of [`/trips/${s.trip}`, s.approval ? `/gates/${s.trip}` : `/keys/${s.trip}`])
			firebase(['database:remove', p, '--project', projectFlag || s.project, '--instance', db.instance, '--force'], {
				secrets: [s.trip, s.writeToken, s.syncKey],
			});
		fs.renameSync(file, `${file}.ended`);
		console.log(
			`sync: ended for ${slug}. Its records and ${s.approval ? 'gate' : 'token'} are gone; the devices keep their own copies. A rebuild without --sync stops the page asking.`,
		);
	} else if (cmd === 'status') {
		need(slug, 'usage: pnpm sync status --trip trips/<slug>');
		const file = fileFor(slug);
		if (!fs.existsSync(file)) console.log(`sync: ${slug} isn't set up${fs.existsSync(`${file}.ended`) ? ' (ended)' : ''}`);
		else {
			const s = JSON.parse(fs.readFileSync(file, 'utf8'));
			console.log(
				`sync: ${slug} is on ${parseDb(s.url)?.instance || 'an unreadable url'} (project ${s.project}), ${s.approval ? 'devices join with a planner’s approval' : 'with a write token'}, planner code ${s.planner ? 'set' : 'not set'}; build with --sync ${file}`,
			);
		}
	} else if (cmd === 'planner') {
		need(slug, 'usage: pnpm sync planner --trip trips/<slug>');
		const file = fileFor(slug);
		need(fs.existsSync(file), `no sync file for ${slug} at ${file}: pnpm sync init first`);
		const s = JSON.parse(fs.readFileSync(file, 'utf8'));
		// the code comes from the planner's own terminal (asked twice, hidden), or, where there's no terminal to ask on
		// (a `!` command in Claude Code has none), from a file the planner wrote themselves, deleted once read
		const codeFile = path.join(SYNC_DIR, `${slug}.planner-code`);
		const fromFile = fs.existsSync(codeFile);
		let code;
		if (fromFile) code = fs.readFileSync(codeFile, 'utf8').split('\n')[0];
		else if (process.stdin.isTTY) {
			code = await askHidden('Planner code (6+ characters, not shown; give it on your own phone in Group sync): ');
			need((await askHidden('Again: ')) === code, 'the two codes differ');
		} else code = await askHidden('');
		need(
			fromFile || process.stdin.isTTY || code,
			`no terminal to ask for the code on. Run \`pnpm sync planner --trip ${tripDir}\` in your own terminal, or write the code alone in ${codeFile} (chmod 600) and run it again: the file is deleted once read`,
		);
		s.planner = plannerCode(code);
		if (s.approval) {
			// the proof goes into the database first, where no device reads it; the page gets only its salt
			const p = plannerProof(code);
			firebase(['database:set', `/gates/${s.trip}/proof`, '--project', projectFlag || s.project, '--instance', parseDb(s.url).instance, '--force'], {
				input: JSON.stringify(p.proof),
				secrets: [s.trip, s.syncKey, p.proof],
			});
			s.planner.proofSalt = p.proofSalt;
		}
		fs.writeFileSync(file, `${JSON.stringify(s, null, '\t')}\n`, { mode: 0o600 });
		if (fromFile) fs.rmSync(codeFile);
		console.log(`sync: planner code set for ${slug}. Rebuild with --sync ${file} and republish; devices already planners stay planners.`);
	} else if (cmd === 'approve') {
		need(slug, 'usage: pnpm sync approve --trip trips/<slug> [--code <join code> [--planner]]');
		const file = fileFor(slug);
		need(fs.existsSync(file), `no sync file for ${slug} at ${file}`);
		const s = JSON.parse(fs.readFileSync(file, 'utf8'));
		need(s.approval, `${slug} is a write-token trip: every device with the page is in already, nothing to approve`);
		const where = ['--project', projectFlag || s.project, '--instance', parseDb(s.url).instance];
		const secrets = [s.trip, s.syncKey];
		const out = firebase(['database:get', `/trips/${s.trip}/devices`, ...where], { secrets });
		const requests = await joinRequests(JSON.parse(out || 'null'), s);
		const code = val('--code');
		if (!code) {
			if (!requests.length) console.log(`sync: no join requests for ${slug}. A device asks once its person saves a name in Group sync.`);
			else {
				console.log(`sync: ${requests.length} join request${requests.length > 1 ? 's' : ''} for ${slug}:`);
				for (const r of requests)
					console.log(
						`  ${printable(r.name) || '(no readable name)'} · ${kindLabel(r.kind)} · join code ${r.code}${r.at ? ` · asked ${new Date(r.at).toLocaleString()}` : ''}`,
					);
				console.log(`Approve one: pnpm sync approve --trip ${tripDir} --code <join code> [--planner]`);
			}
		} else {
			const { request: r, writes } = approveByCode(requests, code, { planner: argv.includes('--planner') });
			firebase(['database:update', `/trips/${s.trip}`, ...where, '--force'], { input: JSON.stringify(writes), secrets });
			console.log(`sync: approved ${printable(r.name) || 'the device'} (${kindLabel(r.kind)})${argv.includes('--planner') ? ' as a planner' : ''}.`);
		}
	} else {
		throw new Error('usage: pnpm sync rules|init|planner|approve|status|end … (see scripts/sync/sync.mjs)');
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2)).catch((e) => {
		console.error(`sync: ${e.message}`);
		process.exit(1);
	});
}
