// Publish a built trip page to its ht-ml.app site, then prove the live copy is the new build. This is the one step an
// agent may run, and only after the planner approves the prompt (.claude/settings.json "ask"): the script reads the
// secrets itself, so the update key and the viewer password never reach a chat, a log or the repo.
//   pnpm publish:trip trips/<slug>             publish, prove the live build id, open it on an iPhone and an Android phone
//   pnpm publish:trip trips/<slug> --dry-run   everything up to the share (and the rollback copy), without publishing
//   pnpm publish:trip trips/<slug> --check     only prove what's live and that it opens cleanly
//   pnpm publish:trip trips/<slug> --new-password   publish with a new page password, which the planner wrote to
//       <slug>.viewer.new themselves; once the host takes it, it becomes <slug>.viewer (also with an unchanged build)
//   pnpm publish:trip trips/<slug> --audit [--candidate <page>]   read-only, publishes nothing: the headers the host
//       sends and any tag it adds to the page, then a candidate build (default: the trip's dist page) opened at the live
//       address on an iPhone and an Android phone, served in place of the live copy: what its Content-Security-Policy
//       refused, what failed to load, page errors, and whether the map came up
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

/**
 * The next page password for a trip (--new-password), which the planner wrote to <slug>.viewer.new themselves, so it
 * never passes through a chat or a command line they'd paste. Throws naming the file.
 */
export function readNextViewer(dir, slug) {
	const f = path.join(dir, `${slug}.viewer.new`);
	const next = (readIf(f) || '').trim();
	if (!next) throw new Error(`--new-password: write the new page password to ${f} first (publish-htmlapp skill)`);
	if (next.length < 6) throw new Error(`--new-password: the page password in ${f} is shorter than 6 characters`);
	return next;
}

/** Once the host took the new password, it's the trip's page password: <slug>.viewer, and the .new file goes. */
export function commitViewer(dir, slug, next) {
	const f = path.join(dir, `${slug}.viewer`);
	fs.writeFileSync(f, `${next}\n`, { mode: 0o600 });
	fs.chmodSync(f, 0o600); // the mode above only applies to a new file

	fs.rmSync(path.join(dir, `${slug}.viewer.new`), { force: true });
}

/** Text with every secret value and every secret-looking line hidden, for anything the script prints. */
export function redact(text, secrets = []) {
	// the gate's cookie too: a browser's request log (Playwright's, in an error) shows it in its headers
	let out = String(text)
		.replace(/^(\s*(?:update_key|password)\s*:).*$/gim, '$1 <hidden>')
		.replace(/(ht_ml_pwd=)[^;\s'"\]]+/g, '$1<hidden>');
	for (const s of secrets) if (s) out = out.split(s).join('<hidden>');
	return out;
}

const gate = (viewer) => ({ Cookie: `ht_ml_pwd=${encodeURIComponent(viewer)}` });

// the head and embed tags a page can carry, as shapes (tag, attribute names, the origin of src/href, and rel/name/type
// values), so two builds of the same engine compare equal and only what the host adds stands out
const TAG_RE = /<(script|iframe|link|meta|base|object|embed|style)\b([^>]*)>/gi;
const tagShape = (name, attrs) => {
	const kv = [...attrs.matchAll(/([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)].map(([, k, v = '']) => [
		k.toLowerCase(),
		v.replace(/^["']|["']$/g, ''),
	]);
	const keep = (k, v) =>
		/^(src|href)$/.test(k)
			? /^data:/.test(v)
				? 'data:'
				: (/^https?:\/\/[^/]+/.exec(v) || ['local'])[0]
			: /^(rel|name|type|http-equiv|id)$/.test(k)
				? v
				: '';
	return `${name.toLowerCase()}[${kv
		.map(([k, v]) => (keep(k, v) ? `${k}=${keep(k, v)}` : k))
		.sort()
		.join(',')}]`;
};
const shapes = (html) => [...String(html).matchAll(TAG_RE)].map(([, n, a]) => tagShape(n, a));

/** What the host did to a page it serves: identical bytes, or the tag shapes it added that the build didn't write. */
export function hostDiff(served, local) {
	const left = shapes(local);
	const extra = [];
	for (const s of shapes(served)) {
		const i = left.indexOf(s);
		if (i >= 0) left.splice(i, 1);
		else extra.push(s);
	}
	return { identical: served === local, extra };
}

/** The page's inline scripts, as the Content-Security-Policy hashes them: a host that changes one byte breaks its hash. */
export const inlineScripts = (html) => [...String(html).matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

/** Where two texts first differ, with a little context; keys are hidden. */
export function firstDiff(a, b) {
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) i++;
	if (i === a.length && i === b.length) return null;
	const show = (s) => JSON.stringify(s.slice(Math.max(0, i - 30), i + 30)).replace(/AIza[0-9A-Za-z_-]{35}/g, '<key>');
	return { at: i, lengths: [a.length, b.length], local: show(a), served: show(b) };
}

// response headers that say nothing about what a page may do
const QUIET_HEADERS =
	/^(date|age|etag|vary|via|connection|content-length|content-encoding|transfer-encoding|alt-svc|x-cache|x-amz[\w-]*|x-amzn[\w-]*)$/i;
/** The response headers that matter to a page's behaviour; a cookie's value is never shown. */
export const loudHeaders = (headers) =>
	Object.fromEntries([...headers].filter(([k]) => !QUIET_HEADERS.test(k)).map(([k, v]) => [k, /^set-cookie$/i.test(k) ? '<present>' : v]));

/** Read-only host audit: nothing is published and the update key is never read. Returns the problems found. */
async function audit(sec, localFile, candidateFile) {
	const problems = [];
	const r = await fetch(sec.url, { headers: gate(sec.viewer), cache: 'no-store' });
	const served = await r.text();
	console.log(`  host: ${r.status} ${JSON.stringify(loudHeaders(r.headers))}`);
	if (!r.ok || !buildId(served)) problems.push(`the live page didn't come back past the gate (${r.status})`);
	const local = fs.readFileSync(localFile, 'utf8');
	const d = hostDiff(served, local);
	const same = buildId(served) === buildId(local);
	console.log(
		same
			? `  live = ${path.basename(localFile)} (${buildId(local)}): ${d.identical ? 'served byte for byte' : `served with changes; tags the host added: ${d.extra.join(' ') || 'none'}`}`
			: `  live ${buildId(served)} ≠ ${path.basename(localFile)} ${buildId(local)}: tag shapes the build doesn't write: ${d.extra.join(' ') || 'none'}`,
	);
	if (same && !d.identical) {
		const a = inlineScripts(local);
		const b = inlineScripts(served);
		const changed = a.map((s, i) => (s === b[i] ? null : i)).filter((i) => i != null);
		console.log(
			`  inline scripts: ${a.length} built, ${b.length} served, ${changed.length ? `changed: #${changed.join(', #')}` : 'every one served byte for byte'}`,
		);
		for (const i of changed.slice(0, 3)) console.log(`    script #${i}: ${JSON.stringify(firstDiff(a[i], b[i] || ''))}`);
		console.log(`  first difference in the page: ${JSON.stringify(firstDiff(local, served))}`);
		if (changed.length) problems.push(`the host changes ${changed.length} inline script(s): script hashes in a Content-Security-Policy would break`);
	}

	const candidate = fs.readFileSync(candidateFile, 'utf8');
	const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(candidate);
	console.log(
		`  candidate ${path.basename(candidateFile)} (${buildId(candidate)}): ${policy ? 'has a Content-Security-Policy' : 'no Content-Security-Policy'}`,
	);
	const { chromium, webkit, devices } = await import('@playwright/test');
	// the live copy as served first (the baseline), then the candidate in its place
	for (const [name, engine, device, swap] of [
		['iPhone, live copy', webkit, devices['iPhone 13'], false],
		['iPhone, candidate', webkit, devices['iPhone 13'], true],
		['Android, live copy', chromium, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, false],
		['Android, candidate', chromium, { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, true],
	]) {
		const browser = await engine.launch();
		try {
			const ctx = await browser.newContext(device);
			const host = new URL(sec.url).hostname;
			await ctx.addCookies([{ name: 'ht_ml_pwd', value: encodeURIComponent(sec.viewer), domain: host, path: '/', secure: true, sameSite: 'Lax' }]);
			const page = await ctx.newPage();
			const seen = { csp: [], failed: [], errors: [] };
			await page.addInitScript(() =>
				document.addEventListener('securitypolicyviolation', (e) => console.warn(`__csp ${e.effectiveDirective} ${e.blockedURI}`)),
			);
			page.on('console', (m) => {
				const t = m.text();
				if (t.startsWith('__csp ')) seen.csp.push(t.slice(6));
				else if (m.type() === 'error') seen.errors.push(t.slice(0, 200));
			});
			page.on('pageerror', (e) => seen.errors.push(`page error: ${e.message.slice(0, 200)}`));
			page.on('requestfailed', (q) => seen.failed.push(`${new URL(q.url()).host} ${q.failure()?.errorText || ''}`.trim()));
			// the live address, its real headers and cookies, with the candidate's bytes in place of the live copy
			if (swap)
				await page.route(sec.url, async (route) => {
					// the page's own update check can still be in flight when the browser closes: drop it quietly (its error
					// would carry the request's headers, the gate's cookie among them)
					try {
						const res = await route.fetch();
						const headers = Object.fromEntries(Object.entries(res.headers()).filter(([k]) => !/^(content-length|content-encoding)$/i.test(k)));
						await route.fulfill({ status: res.status(), headers, body: candidate });
					} catch {
						await route.abort().catch(() => {});
					}
				});
			await page.goto(sec.url, { waitUntil: 'load', timeout: 90_000 });
			const sections = await page.locator('#app [data-sec]').count();
			await page
				.locator('.map-wrap')
				.first()
				.scrollIntoViewIfNeeded()
				.catch(() => {});
			const map = await page
				.waitForFunction(
					() => (document.querySelector('.gm-style') ? 'google' : document.querySelector('.maplibregl-canvas') ? 'maplibre' : null),
					null,
					{ timeout: 30_000 },
				)
				.then((h) => h.jsonValue())
				.catch(() => 'none');
			await page.waitForTimeout(3000);
			// a page with group sync: its row in the sections menu says whether it reached the trip's database
			const sync = await page.evaluate(async () => {
				if (!window.SYNC) return null;
				document.querySelector('#tocBtn')?.click();
				await new Promise((ok) => setTimeout(ok, 800));
				return document.querySelector('#toc [data-sync-label]')?.textContent || 'no sync row';
			});
			console.log(
				`  ${name}: ${sections} sections · map ${map}${sync ? ` · ${sync}` : ''} · ${seen.csp.length} refused · ${seen.failed.length} failed loads · ${seen.errors.length} errors`,
			);
			for (const c of [...new Set(seen.csp)]) console.log(`    refused: ${c}`);
			for (const f of [...new Set(seen.failed)].slice(0, 12)) console.log(`    failed: ${f}`);
			for (const e of [...new Set(seen.errors)].slice(0, 12)) console.log(`    error: ${e}`);
			if (!swap) continue; // the baseline only shows what was already there
			if (!sections) problems.push(`${name}: didn't render at the live address`);
			if (seen.csp.length) problems.push(`${name}: the Content-Security-Policy refused ${seen.csp.length} thing(s)`);
			if (map === 'none') problems.push(`${name}: no live map within 30 s`);
			if (sync && !/synced|已同步/.test(sync)) problems.push(`${name}: group sync didn't reach the database (${sync})`);
		} finally {
			for (const c of browser.contexts()) for (const p of c.pages()) await p.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
			await browser.close();
		}
	}
	return problems;
}

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

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'" };
/** A page's Content-Security-Policy as the browser reads its meta tag (entities decoded, so a re-serialised copy that
 * means the same compares equal), or null when it has none. */
export const policyOf = (html) => {
	const m = /<meta\s+http-equiv=["']?Content-Security-Policy["']?\s+content="([^"]*)"/i.exec(String(html));
	return m ? m[1].replace(/&(amp|lt|gt|quot|apos|#39|#x27);/gi, (_, e) => ENTITIES[e.toLowerCase()]) : null;
};

/**
 * Opens the live page past the gate on an iPhone (WebKit) and an Android phone (Chromium); returns problems found: no
 * render, page errors, or anything its Content-Security-Policy refused.
 */
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
			const refused = [];
			await page.addInitScript(() =>
				document.addEventListener('securitypolicyviolation', (e) => console.warn(`__csp ${e.effectiveDirective} ${e.blockedURI}`)),
			);
			page.on('console', (m) => m.text().startsWith('__csp ') && refused.push(m.text().slice(6)));
			page.on('pageerror', (e) => errors.push(e.message));
			await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
			await page.waitForTimeout(2000);
			const sections = await page.locator('#app [data-sec]').count();
			if (!sections) problems.push(`${name}: the page didn't render past the gate`);
			for (const e of errors) problems.push(`${name}: page error: ${e}`);
			for (const r of [...new Set(refused)]) problems.push(`${name}: the Content-Security-Policy refused ${r}`);
			console.log(`  ${name}: ${sections} sections, ${errors.length} page errors, ${refused.length} refused`);
		} finally {
			await browser.close();
		}
	}
	return problems;
}

/** the trip folder and the flags; the word after `--candidate` is its page, never the trip */
export function parseArgs(argv) {
	const ci = argv.indexOf('--candidate');
	const candidateArg = ci >= 0 && argv[ci + 1] && !argv[ci + 1].startsWith('--') ? argv[ci + 1] : null;
	const tripArg = argv.find((a, i) => !a.startsWith('--') && (ci < 0 || i !== ci + 1));
	if (!tripArg || (ci >= 0 && !candidateArg))
		throw new Error('usage: pnpm publish:trip trips/<slug> [--new-password] [--dry-run | --check | --audit [--candidate <page>]]');
	return {
		tripArg,
		candidateArg,
		dry: argv.includes('--dry-run'),
		checkOnly: argv.includes('--check'),
		auditOnly: argv.includes('--audit'),
		newPassword: argv.includes('--new-password'),
	};
}

async function main(argv) {
	const { tripArg, candidateArg, dry, checkOnly, auditOnly, newPassword } = parseArgs(argv);
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
	const nextViewer = newPassword && !checkOnly && !auditOnly ? readNextViewer(SECRETS_DIR, slug) : null;
	const oldViewer = sec.viewer;
	const hide = (t) => redact(t, [updateKey, oldViewer, nextViewer]);
	const live = await liveBuild(sec.url, sec.viewer);
	console.log(`${sec.url}\n  live ${live || 'unknown (gate or network)'} → new ${next}`);
	const proveOpens = async () => {
		const problems = await smoke(sec.url, sec.viewer);
		if (problems.length) throw new Error(hide(`the live page has problems:\n  ${problems.join('\n  ')}`));
	};
	if (auditOnly) {
		const candidate = path.resolve(candidateArg || file);
		if (!fs.existsSync(candidate)) throw new Error(`no candidate page at ${candidate}`);
		const problems = await audit(sec, file, candidate);
		if (problems.length) throw new Error(hide(`audit found problems:\n  ${problems.join('\n  ')}`));
		console.log('  audit: the candidate behaves at the live address; nothing was published');
		return;
	}
	if (checkOnly) {
		await proveOpens();
		console.log(live === next ? '  checked: the live copy is this build and opens cleanly' : '  checked: it opens cleanly, but it is not this build');
		return;
	}
	if (live === next && !nextViewer) {
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
		console.log(`  dry run: not published${nextViewer ? ' (the page password would change too)' : ''}`);
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
				execFileSync(LAVISH, ['share', file, '--site', sec.site, '--update-key', updateKey, ...(nextViewer ? ['--password', nextViewer] : [])], {
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
	// the host wants the new password from now on, so it's saved before anything else can fail
	if (nextViewer) {
		commitViewer(SECRETS_DIR, slug, nextViewer);
		sec.viewer = nextViewer;
		console.log(`  the page password changed: give the group the new one (saved as ${slug}.viewer)`);
	}
	// the CDN can serve the old copy for minutes; sharing again fixed that within a minute on the first trip
	for (let i = 1; i <= 8; i++) {
		await sleep(20_000);
		const now = await liveBuild(sec.url, sec.viewer);
		console.log(`  check ${i}: live ${now || 'unknown'}`);
		if (now === next) {
			console.log(`  published: ${next} is live`);
			// the host re-serialises the HTML it stores: the policy has to come out as it went in
			const html = await (await fetch(sec.url, { headers: gate(sec.viewer), cache: 'no-store' })).text();
			const built = policyOf(fs.readFileSync(file, 'utf8'));
			if (policyOf(html) !== built)
				throw new Error(
					`the host changed the page's Content-Security-Policy (${built == null ? 'none built' : policyOf(html) == null ? 'removed' : 'rewritten'}): roll back with the copy above`,
				);
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
	// every way out goes through redact: a stray browser error prints its request headers, the gate's cookie among them
	const fail = (e) => {
		console.error(`publish: ${redact(e && e.message ? e.message : e)}`);
		process.exit(1);
	};
	process.on('unhandledRejection', fail);
	process.on('uncaughtException', fail);
	main(process.argv.slice(2)).catch(fail);
}
