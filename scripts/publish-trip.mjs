// Publish a built trip page to its ht-ml.app site, then prove the live copy is the new build. This is the one step an
// agent may run, and only after the planner approves the prompt (.claude/settings.json "ask"): the script reads the
// secrets itself, so the update key and the viewer password never reach a chat, a log or the repo.
//   pnpm publish:trip trips/<slug>             publish, prove the live build id, open it on an iPhone and an Android phone
//   pnpm publish:trip trips/<slug> --dry-run   everything up to the share (and the rollback copy), without publishing
//   pnpm publish:trip trips/<slug> --check     only prove what's live and that it opens cleanly
// The update key comes from the macOS Keychain when it's there (service relaxjer-publish, account <slug>; macOS asks the
// planner before each read), and is read only right before the share. The rest live in ~/.config/relaxjer/publish/
// (never in the repo), either one value per file (<slug>.viewer, <slug>.site, and <slug>.update-key if the key isn't in
// the Keychain) or the first trip's labelled files (<slug>.txt as lavish-axi printed it, <slug>-viewer.txt).
// Before publishing it saves the live copy there as <slug>-rollback-<build id>.html, so a bad publish can be undone by
// publishing that file again.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SECRETS_DIR = path.join(os.homedir(), '.config', 'relaxjer', 'publish');
// lavish-axi is a devDependency, so a fresh clone has it after `pnpm install`; a global one is the fallback
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LAVISH = ['lavish-axi', 'lavish-axi.cmd'].map((b) => path.join(ROOT, 'node_modules', '.bin', b)).find((b) => fs.existsSync(b)) || 'lavish-axi';
const BUILD_RE = /<meta name="relaxjer-build" content="([0-9a-f]+)"/;

/** The build id the engine writes into the first bytes of a page, or null. */
export const buildId = (html) => (BUILD_RE.exec(String(html).slice(0, 8192)) || [])[1] || null;

const readIf = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const labelled = (text, key) => {
	const m = new RegExp(`^\\s*${key}:\\s*"?([^"\\s]+)"?\\s*$`, 'm').exec(text || '');
	return m ? m[1] : null;
};

export const KEYCHAIN_SERVICE = 'relaxjer-publish';

/**
 * The update key from the macOS Keychain (service relaxjer-publish, account = the trip's slug). The planner stores it
 * with no trusted apps (`-T ""`), so macOS asks them before every read. Returns null when there's no such item (then
 * the key comes from a file), and throws when there is one but the read was refused: a "Deny" must stop the publish,
 * never fall back to a copy on disk.
 */
export function keychainKey(slug, run = execFileSync) {
	if (process.platform !== 'darwin') return null;
	const args = ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', slug];
	const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
	try {
		run('security', args, opts); // the item's attributes only: no dialog
	} catch {
		return null;
	}
	try {
		return run('security', [...args, '-w'], opts).trim() || null;
	} catch {
		throw new Error('the Keychain read of the update key was refused (or timed out): not publishing');
	}
}

const oneValue = (dir, slug, ext) => (readIf(path.join(dir, `${slug}.${ext}`)) || '').trim() || null;

/** { site, url, viewer } for a trip, from one-value files or the labelled ones; throws naming what's missing. */
export function readSecrets(dir, slug) {
	const txt = readIf(path.join(dir, `${slug}.txt`));
	const siteFile = oneValue(dir, slug, 'site') || '';
	const site = labelled(siteFile, 'site_id') || (/^[a-z0-9]{6,}$/m.exec(siteFile) || [])[0] || labelled(txt, 'site_id');
	const url = (/https:\/\/[^\s"]+/.exec(siteFile) || [])[0] || labelled(txt, 'url') || (site ? `https://${site}.ht-ml.app/` : null);
	// the labelled viewer file is one line, "viewer password (…): <password>"; only the password goes into the cookie
	const viewerTxt = readIf(path.join(dir, `${slug}-viewer.txt`));
	const viewer = oneValue(dir, slug, 'viewer') || (viewerTxt ? viewerTxt.replace(/^[^\n]*\):\s*/, '').trim() : null);
	const missing = Object.entries({ site, viewer })
		.filter(([, v]) => !v)
		.map(([k]) => k);
	if (missing.length) throw new Error(`missing in ${dir} for ${slug}: ${missing.join(', ')} (see the publish-htmlapp skill)`);
	return { site, url, viewer };
}

/**
 * { key, from } for the share, read only right before it (so --check and --dry-run never ask for it): the Keychain
 * first, else <slug>.update-key, else the labelled <slug>.txt.
 */
export function readUpdateKey(dir, slug, { keychain = keychainKey } = {}) {
	const fromKeychain = keychain(slug);
	if (fromKeychain) return { key: fromKeychain, from: 'keychain' };
	const key = oneValue(dir, slug, 'update-key') || labelled(readIf(path.join(dir, `${slug}.txt`)), 'update_key');
	if (!key) throw new Error(`no update key for ${slug} in the Keychain or ${dir} (see the publish-htmlapp skill)`);
	return { key, from: 'file' };
}

/** Text with every secret value and every secret-looking line hidden, for anything the script prints. */
export function redact(text, secrets = []) {
	let out = String(text).replace(/^(\s*(?:update_key|password)\s*:).*$/gim, '$1 <hidden>');
	for (const s of secrets) if (s) out = out.split(s).join('<hidden>');
	return out;
}

const gate = (viewer) => ({ Cookie: `ht_ml_pwd=${encodeURIComponent(viewer)}` });

/** The live page's build id, from its first bytes only (the rest of the download is cancelled). */
async function liveBuild(url, viewer) {
	const r = await fetch(url, { headers: gate(viewer), cache: 'no-store' });
	if (!r.ok || !r.body) return null;
	const rd = r.body.getReader();
	const dec = new TextDecoder();
	let head = '';
	while (head.length < 8192 && !buildId(head)) {
		const { done, value } = await rd.read();
		if (done) break;
		head += dec.decode(value, { stream: true });
	}
	await rd.cancel().catch(() => {});
	return buildId(head);
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** Opens the live page past the gate on an iPhone (WebKit) and an Android phone (Chromium); returns problems found. */
async function smoke(url, viewer) {
	const { chromium, webkit, devices } = await import('@playwright/test');
	const problems = [];
	for (const [name, engine, device] of [
		['iPhone', webkit, devices['iPhone 13']],
		['Android', chromium, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }],
	]) {
		const browser = await engine.launch();
		try {
			const ctx = await browser.newContext(device);
			const host = new URL(url).hostname;
			await ctx.addCookies([{ name: 'ht_ml_pwd', value: encodeURIComponent(viewer), domain: host, path: '/', secure: true, sameSite: 'Lax' }]);
			const page = await ctx.newPage();
			const errors = [];
			page.on('pageerror', (e) => errors.push(e.message));
			await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
			await page.waitForTimeout(2000);
			const sections = await page.locator('#app [data-sec]').count();
			if (!sections) problems.push(`${name}: the page didn't render past the gate`);
			for (const e of errors) problems.push(`${name}: page error: ${e}`);
			console.log(`  ${name}: ${sections} sections, ${errors.length} page errors`);
		} finally {
			await browser.close();
		}
	}
	return problems;
}

async function main(argv) {
	const dry = argv.includes('--dry-run');
	const checkOnly = argv.includes('--check');
	const tripArg = argv.find((a) => !a.startsWith('--'));
	if (!tripArg) throw new Error('usage: pnpm publish:trip trips/<slug> [--dry-run | --check]');
	const tripDir = path.resolve(tripArg);
	const slug = path.basename(tripDir);
	const dist = path.join(tripDir, 'dist');
	const page = fs.existsSync(dist) && fs.readdirSync(dist).find((f) => f.endsWith('-standalone.html'));
	if (!page) throw new Error(`no built page in ${dist}: run pnpm build --trip ${tripArg} first`);
	const file = path.join(dist, page);
	const next = buildId(fs.readFileSync(file, 'utf8'));
	if (!next) throw new Error(`${file} has no build id: rebuild it with this engine`);

	const sec = readSecrets(SECRETS_DIR, slug);
	let updateKey = null;
	const hide = (t) => redact(t, [updateKey, sec.viewer]);
	const live = await liveBuild(sec.url, sec.viewer);
	console.log(`${sec.url}\n  live ${live || 'unknown (gate or network)'} → new ${next}`);
	const proveOpens = async () => {
		const problems = await smoke(sec.url, sec.viewer);
		if (problems.length) throw new Error(hide(`the live page has problems:\n  ${problems.join('\n  ')}`));
	};
	if (checkOnly) {
		await proveOpens();
		console.log(live === next ? '  checked: the live copy is this build and opens cleanly' : '  checked: it opens cleanly, but it is not this build');
		return;
	}
	if (live === next) {
		console.log('  already live: nothing to publish');
		return;
	}

	// the copy people have now, kept outside the repo so it can be republished to undo this one
	if (live) {
		const back = path.join(SECRETS_DIR, `${slug}-rollback-${live}.html`);
		if (!fs.existsSync(back)) {
			const html = await (await fetch(sec.url, { headers: gate(sec.viewer), cache: 'no-store' })).text();
			if (buildId(html) === live) fs.writeFileSync(back, html, { mode: 0o600 });
		}
		console.log(`  rollback: ${fs.existsSync(back) ? back : 'not saved (the live copy changed while reading)'}`);
	}
	if (dry) {
		console.log('  dry run: not published');
		return;
	}

	const got = readUpdateKey(SECRETS_DIR, slug);
	updateKey = got.key;
	if (got.from === 'file' && process.platform === 'darwin')
		console.log('  note: the update key is still in a file; move it into the Keychain so macOS asks before each publish (publish-htmlapp skill)');
	// the key has to go to lavish-axi as an argument; a failure's message repeats the whole command line, so hide it
	const share = () => {
		try {
			return hide(
				execFileSync(LAVISH, ['share', file, '--site', sec.site, '--update-key', updateKey], {
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'pipe'],
				}),
			);
		} catch (e) {
			// no `cause`: the original error holds the command line, key included
			// eslint-disable-next-line preserve-caught-error
			throw new Error(hide(`lavish-axi share failed: ${e.stderr || e.stdout || e.message}`));
		}
	};
	const out = share();
	if (!/updated:\s*true/.test(out)) throw new Error(`the host didn't confirm the update:\n${out}`);
	// the CDN can serve the old copy for minutes; sharing again fixed that within a minute on the first trip
	for (let i = 1; i <= 8; i++) {
		await sleep(20_000);
		const now = await liveBuild(sec.url, sec.viewer);
		console.log(`  check ${i}: live ${now || 'unknown'}`);
		if (now === next) {
			console.log(`  published: ${next} is live`);
			await proveOpens();
			console.log('  opens cleanly on iPhone and Android');
			return;
		}
		if (i === 3) {
			console.log('  still the old copy: sharing again');
			share();
		}
	}
	throw new Error(`published, but the live copy still isn't ${next} after about 3 minutes: run it again`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2)).catch((e) => {
		console.error(`publish: ${redact(e.message)}`);
		process.exit(1);
	});
}
