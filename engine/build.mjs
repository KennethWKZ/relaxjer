// Build: engine/src/* + a trip's data and img/ → <name>.html (artifact body) and <name>-standalone.html (single file,
// images inlined), plus the My Maps KML. Moved verbatim from the first trip's repo; only where files are read and written changed.
//   node engine/build.mjs --trip <trip dir> [--out <dir>] [--keys <google.json>] [--sync <sync.json>] [--demo-clock <YYYY-MM-DD HH:MM>] [--preview]
// --preview writes <name>-preview.html only, with the planner's preview panel (engine/src/preview/): a page to look at,
// never the one published, which stays <name>-standalone.html from a build without the flag (ADR-20261122-day-views).
// The trip dir holds data.js, the *.json side files and img/. The Google browser key + Map ID go in only when --keys
// names a file (keep it outside the repo, e.g. ~/.config/relaxjer/google.json, mode 600): a page built without it,
// like the demo, can be shared without leaking a key. Without one the page keeps the free MapLibre map.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { renderPNG } from './icons.mjs';
import { rangeLabel } from './src/core/time.mjs';
import { dayRoles, hotelsByDay, storeKey } from './src/core/plan.mjs';
import { leadMotif } from './src/core/motif.mjs';
import { MODES as SKY_MODES, modeFor as skyModeFor } from './src/core/sky.mjs';
import { paceProblem } from './src/core/way.mjs';
import { splitArt } from './world-art.mjs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const engine = path.dirname(new URL(import.meta.url).pathname);
const trip = path.resolve(arg('trip', ''));
const out = path.resolve(arg('out', path.join(trip, 'dist')));
const keysFile = arg('keys', 'none').replace(/^~(?=\/)/, os.homedir());
const syncFile = arg('sync', 'none').replace(/^~(?=\/)/, os.homedir());
// the live demo's clock (ADR-20261002-live-demo-on-pages): the page opens at this moment of the trip, in the trip's own
// time, and runs on from there, so a visitor sees a day under way. The demo trip only: a real trip keeps the real time.
const demoClock = arg('demo-clock', null);
// the planner's preview panel (sky, weather, snow, theme, clock): only in a page built with --preview, which is written
// under its own name so a publish can never pick it up
const preview = argv.includes('--preview');
if (demoClock && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(demoClock)) {
	console.error(`--demo-clock: YYYY-MM-DD HH:MM in the trip's time, got ${JSON.stringify(demoClock)}`);
	process.exit(2);
}
// strict on purpose: the repo's own demo folders by path, so a copy or a link of one is refused too
const DEMOS = ['demo-trip', 'demo-sapporo'].map((d) => path.resolve(engine, '..', 'examples', d));
if (demoClock && !DEMOS.includes(trip)) {
	console.error('--demo-clock is for the demo trips (examples/demo-trip, examples/demo-sapporo) only: a real trip keeps the real time');
	process.exit(2);
}
if (!arg('trip') || !fs.existsSync(path.join(trip, 'data.js'))) {
	console.error(
		'usage: node engine/build.mjs --trip <dir with data.js> [--out <dir>] [--keys <google.json>] [--sync <sync.json>] [--demo-clock <YYYY-MM-DD HH:MM>] [--preview]',
	);
	process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

// engine files come from engine/src; everything else (data.js, *.json, img/) from the trip
const from = (p) => (/^src\/(style\.css|shell\.html)$/.test(p) ? path.join(engine, p) : path.join(trip, p.replace(/^src\//, '')));
const rd = (p) => fs.readFileSync(from(p), 'utf8');
const readJSON = (p, fallback) => {
	const f = from(p);
	if (!fs.existsSync(f)) return fallback;
	try {
		return JSON.parse(fs.readFileSync(f, 'utf8'));
	} catch (e) {
		console.warn(`! ${p} is not valid JSON: ${e.message}`);
		return fallback;
	}
};

const css = rd('src/style.css');
const shellSrc = rd('src/shell.html');
const data = rd('src/data.js');
// the engine script: engine/src/app/NN-*.js joined in order (00-open starts the one IIFE they share, 99-close ends it)
const appDir = path.join(engine, 'src', 'app');
const appParts = fs
	.readdirSync(appDir)
	.filter((f) => /^\d\d-[\w-]+\.js$/.test(f))
	.sort()
	.map((f) => fs.readFileSync(path.join(appDir, f), 'utf8'));
// a pure module (no imports) as a namespace inside the page script: its exports become the namespace's members
const pureModule = (file, label) => {
	const src = fs.readFileSync(file, 'utf8');
	if (/^\s*import\s/m.test(src)) throw new Error(`${label}: pure modules can't import (the build inlines them)`);
	const names = [...src.matchAll(/^export (?:const|let|function) (\w+)/gm)].map((m) => m[1]);
	return { body: src.replace(/^export /gm, ''), names, file };
};
// engine/src/core/<name>.mjs go in right after 00-open, each as a namespace: time.mjs → Time
const coreDir = path.join(engine, 'src', 'core');
const core = (
	fs.existsSync(coreDir)
		? fs
				.readdirSync(coreDir)
				.filter((f) => f.endsWith('.mjs'))
				.sort()
		: []
).map((f) => {
	const { body, names } = pureModule(path.join(coreDir, f), `engine/src/core/${f}`);
	const ns = f.replace(/\.mjs$/, '').replace(/^./, (c) => c.toUpperCase());
	return `  const ${ns} = (() => {\n${body}\n  return { ${names.join(', ')} };\n  })();`;
});
const shareUrl = (process.env.SHARE_URL || '').trim();
// Google Maps browser key + Map ID live outside the repo (--keys); without them the page keeps the free MapLibre map
const gmaps = (() => {
	if (keysFile === 'none') return null;
	try {
		const g = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
		return g.browserKey && g.mapId ? { key: g.browserKey, mapId: g.mapId } : null;
	} catch {
		return null;
	}
})();

// group sync (ADR-20261001-group-sync): the trip's own Firebase database and its keys, from a file outside the repo
// (`pnpm sync init` writes ~/.config/relaxjer/sync/<slug>.json). A rebuild must keep the same file, or the group's phones
// start over on a new database. Without one, everything stays on each phone. A bad file stops the build (a planner who
// asked for sync should get it), and no value is ever printed.
const sync = (() => {
	if (syncFile === 'none') return null;
	let s;
	try {
		s = JSON.parse(fs.readFileSync(syncFile, 'utf8'));
	} catch {
		throw new Error(`--sync ${syncFile}: not a readable sync file (pnpm sync init writes one)`);
	}
	const u = (() => {
		try {
			return new URL(s.url);
		} catch {
			return null;
		}
	})();
	// a real database is a Firebase Realtime Database root; the tests' stand-in is the local test server
	const local = u && u.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(u.hostname);
	const firebase = u && u.protocol === 'https:' && /\.(firebasedatabase\.app|firebaseio\.com)$/.test(u.hostname) && u.pathname === '/';
	// an approval trip (ADR-20261127-sync-approval) has no write token: each device signs in anonymously with the
	// project's web API key and asks a planner to let it in
	const approval = s.approval === true;
	const salt = (x) => /^[A-Za-z0-9_-]{22}$/.test(x || '');
	const bad = [
		!(local || firebase) && 'url (https://<name>.<region>.firebasedatabase.app)',
		!/^[A-Za-z0-9_-]{22}$/.test(s.trip || '') && 'trip',
		!approval && !/^[A-Za-z0-9_-]{32,}$/.test(s.writeToken || '') && 'writeToken',
		approval && !/^[A-Za-z0-9_-]{30,60}$/.test(s.apiKey || '') && 'apiKey',
		!/^[A-Za-z0-9_-]{43}$/.test(s.syncKey || '') && 'syncKey',
		// the planner code (`pnpm sync planner`, ADR-20261002-sync-planners): a salt and the code's hash, never the code; on
		// an approval trip also the salt of the proof the database checks (the proof itself is only in the database)
		!(s.planner == null || (salt(s.planner.salt) && /^[A-Za-z0-9_-]{43}$/.test(s.planner.hash || '') && (!approval || salt(s.planner.proofSalt)))) &&
			'planner',
	].filter(Boolean);
	if (bad.length) throw new Error(`--sync ${syncFile}: bad ${bad.join(', ')}`);
	const planner = s.planner ? { salt: s.planner.salt, hash: s.planner.hash, ...(approval ? { proofSalt: s.planner.proofSalt } : {}) } : null;
	const url = u.href.replace(/\/$/, '');
	if (!approval) return { url, trip: s.trip, token: s.writeToken, key: s.syncKey, planner };
	// Firebase's sign-in endpoints; the tests' stand-in answers them on the local test server
	const auth = local
		? { signUp: `${u.origin}/__auth/v1/accounts:signUp`, token: `${u.origin}/__auth/v1/token` }
		: { signUp: 'https://identitytoolkit.googleapis.com/v1/accounts:signUp', token: 'https://securetoken.googleapis.com/v1/token' };
	return { url, trip: s.trip, key: s.syncKey, planner, approval: { apiKey: s.apiKey, ...auth } };
})();

// credits: keep only photos whose files exist
const credits = readJSON('img/credits.json', []).filter((c) => fs.existsSync(path.join(trip, 'img', `${c.id}.webp`)));
const geoFull = readJSON('src/geo.json', null);
const geo = geoFull && { bbox: geoFull.bbox, attribution: geoFull.attribution, places: geoFull.places, legs: geoFull.legs || {} }; // live map draws the streets; pins, MRT and leg times ship
const extra = readJSON('src/extra.json', { food: [], tickets: [], sites: {} });
const forecast = readJSON('src/forecast.json', null);
const drinks = readJSON('src/drinks.json', []);
// a file with only some of the parts (no Google step ran, so no gp) still gives the page every part it reads
const toilets = { wc: [], near: {}, gp: {}, borrow: {}, ...readJSON('src/toilets.json', {}) };
const shops = readJSON('src/shops.json', []);
// pipeline/steps/refill.py: free water refill points (OpenStreetMap + the trip's own refill-*.json), ADR-20261128-water-refill
const refill = { checked: null, spots: [], ...readJSON('src/refill.json', {}) };
const mrt = readJSON('src/mrt.json', null);
const transit = readJSON('src/transit.json', { yb: [], bus: [] }); // scripts/mrt.py, scripts/gtransit.py
// scripts/gtoilets.py: public toilets, own-restroom flags, borrowable restrooms
// scripts/gdrinks.py: drink shops near every stop // scripts/resync.py writes it once trip days are inside the 16-day forecast
const wish = [...(readJSON('src/wish-a.json', { items: [] }).items || []), ...(readJSON('src/wish-b.json', { items: [] }).items || [])];

// brush glyphs → Google Fonts `text=` subset of the trip's brush face (TRIP.brushFont, default Ma Shan Zheng: a
// large Chinese face, so only the glyphs the page letters go into the page)
const ctx = {};
vm.createContext(ctx);
vm.runInContext(data + ';this.DAYS=DAYS;this.PRINCIPLE=PRINCIPLE;this.TRIP=TRIP;this.TAX=typeof TAX==="undefined"?undefined:TAX;', ctx);
// the tax refund's shop coupons (TAX.coupons[].img, ADR-20261128-tax-refund): each a trip image (img/<key>.webp, .png,
// .jpg or .svg) put in the page at its full size, never the lighter copy, so the cashier's scanner reads its barcode.
// They count apart from the photos in the summary line; a missing one is left out with a warning (the contract fails it)
const COUPON_TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
const coupons = {};
for (const c of (ctx.TAX && Array.isArray(ctx.TAX.coupons) ? ctx.TAX.coupons : []).filter((x) => x && x.img)) {
	const key = String(c.img);
	if (!/^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i.test(key)) {
		console.warn(`! TAX coupon ${c.id}: img "${key}" must be a key like tax/coupon-shop (letters, digits, - _ /)`);
		continue;
	}
	const ext = Object.keys(COUPON_TYPES).find((e) => fs.existsSync(path.join(trip, 'img', `${key}.${e}`)));
	if (!ext) {
		console.warn(`! TAX coupon ${c.id}: no img/${key}.webp (or .png, .jpg, .svg) in the trip`);
		continue;
	}
	const bytes = fs.readFileSync(path.join(trip, 'img', `${key}.${ext}`));
	coupons[key] = { file: `img/${key}.${ext}`, data: `data:${COUPON_TYPES[ext]};base64,${bytes.toString('base64')}`, kb: bytes.length / 1024 };
}
// the trip's name on the page, the home screen and the KML; the shell's {{brand}} / {{dates}} are filled from it
const { brand, description } = ctx.TRIP;
// the header's short name, for a phone whose header can't fit the whole brand beside its buttons (09-main-render.js)
const brandShort = ctx.TRIP.brandShort || brand;
// the output files' base name: TRIP.fileName (e.g. 'taipei-trip'), else 'trip' → trip.html, trip-standalone.html, trip-mymaps.kml
const fileBase = ctx.TRIP.fileName || 'trip';
if (!/^[a-z0-9][a-z0-9-]*$/.test(fileBase))
	throw new Error(`TRIP.fileName: lower-case letters, digits and dashes only, got ${JSON.stringify(fileBase)}`);
// the destination pack (destinations/<cc>/pack.mjs, merged with regions/<region>/pack.mjs) as `Pack`: what the page
// knows about the country and the city (tax refund, taxi meter, bike share…). No destination: an empty Pack, and the
// page leaves those features out.
const destinations = path.join(engine, '..', 'destinations');
const packParts = [];
if (ctx.TRIP.destination) {
	const cc = String(ctx.TRIP.destination);
	const files = [path.join(destinations, cc, 'pack.mjs')];
	if (ctx.TRIP.region) files.push(path.join(destinations, cc, 'regions', String(ctx.TRIP.region), 'pack.mjs'));
	for (const f of files) {
		if (!/^[a-z]{2}$/.test(cc) || !/^[a-z0-9-]*$/.test(String(ctx.TRIP.region || '')) || !fs.existsSync(f))
			throw new Error(`TRIP.destination/region: no pack at ${path.relative(path.join(engine, '..'), f)}`);
		packParts.push(pureModule(f, path.relative(path.join(engine, '..'), f)));
	}
}
// the destination's world (ADR-20261117-destination-themes): a pack's `theme` names engine/src/themes/<theme>.css (its
// look, scoped to <html data-world="<theme>">) and <theme>.mjs (its paper colours and home-screen icon). The city's
// pack overrides the country's. No theme: none of this goes in, and the page is the default world, unchanged.
const packTheme = (await Promise.all(packParts.map((p) => import(pathToFileURL(p.file).href)))).reduce((t, m) => m.theme ?? t, undefined);
const world = packTheme ? await loadWorld(packTheme) : null;
async function loadWorld(name) {
	const base = path.join(engine, 'src', 'themes', String(name));
	if (!/^[a-z][a-z0-9-]*$/.test(String(name)) || !fs.existsSync(`${base}.css`) || !fs.existsSync(`${base}.mjs`))
		throw new Error(`pack theme ${JSON.stringify(name)}: no engine/src/themes/${name}.css and .mjs`);
	const mod = await import(pathToFileURL(`${base}.mjs`).href);
	const backdrop = mod.backdrop || null;
	if (backdrop && !(Array.isArray(backdrop.layers) && backdrop.layers.every((l) => /^[a-z]+$/.test(l))))
		throw new Error(`engine/src/themes/${name}.mjs backdrop.layers: a list of lower-case names`);
	if (mod.sky != null && !SKY_MODES.includes(mod.sky)) throw new Error(`engine/src/themes/${name}.mjs sky: one of ${SKY_MODES.join('|')}`);
	return {
		name,
		css: fs.readFileSync(`${base}.css`, 'utf8'),
		paper: mod.paper,
		iconPaint: mod.iconPaint,
		iconMarks: mod.iconMarks || [],
		backdrop,
		sky: mod.sky || null,
	};
}
// the live sky (ADR-20261122-day-views): TRIP.sky picks it ('live', 'globe', 'pile' or 'off'), else the world's own; a
// world without a sky (the default lantern world) draws none whatever the trip says
if (ctx.TRIP.sky != null && !SKY_MODES.includes(ctx.TRIP.sky))
	throw new Error(`TRIP.sky: one of ${SKY_MODES.join('|')}, got ${JSON.stringify(ctx.TRIP.sky)}`);
const skyMode = skyModeFor(ctx.TRIP.sky, world?.sky);
// the group's walking pace (ADR-20261127-trip-walk-pace): left out is the seniors' pace; anything else is a number in range
if (paceProblem(ctx.TRIP.walkPace)) throw new Error(paceProblem(ctx.TRIP.walkPace));
if (ctx.TRIP.sky && ctx.TRIP.sky !== 'off' && skyMode === 'off')
	console.warn(`! TRIP.sky ${JSON.stringify(ctx.TRIP.sky)}: ${world ? `the ${world.name} world` : 'the default world'} has no sky, so none is drawn`);
// a world's backdrop (ADR-20261121-world-motion): the sky behind the whole page, fixed layers the world's stylesheet
// draws and ties to the scroll (one <i class="sky-<layer>"> each, in the order named), and a closing scene after the
// footer. Decoration only (aria-hidden), and none of it for a page without a world or a world without one.
const backdropHTML = (w) =>
	w?.backdrop
		? {
				sky: `<div class="world-sky" aria-hidden="true">${w.backdrop.layers.map((l) => `<i class="sky-${l}"></i>`).join('')}</div>\n`,
				end: w.backdrop.end ? `\n<div class="world-end" aria-hidden="true"><i></i></div>` : '',
			}
		: { sky: '', end: '' };
// each part in its own scope (the country and the city may both define helpers); later parts override earlier ones
const pack = `  const Pack = Object.freeze(Object.assign({}, ${packParts.map((p) => `(() => {\n${p.body}\n  return { ${p.names.join(', ')} };\n  })()`).join(', ')}));`;
// the outside hosts a pack's code calls (its bike share's live counts…): the page may connect to them, nothing else of theirs
const packHosts = [...new Set(packParts.flatMap((p) => [...p.body.matchAll(/https:\/\/[a-z0-9.-]+\.[a-z]{2,}/g)].map((m) => m[0])))];

// Content-Security-Policy for the single-file page (ADR-20261001-page-csp). Every inline script is allowed by its
// hash, and code, data and images may only come from or go to the hosts the page uses: a tampered library can read the
// page, but can't send what it reads anywhere else. Google's Maps JavaScript API needs its documented allowlist and
// 'unsafe-eval', so a page built with a Google key carries those too.
const GOOGLE = [
	'https://*.googleapis.com',
	'https://*.gstatic.com',
	'https://*.google.com',
	'https://*.googleusercontent.com',
	'https://*.ggpht.com',
];
const MAP_CDNS = ['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net']; // MapLibre, with subresource integrity
const MAP_TILES = ['https://tiles.openfreemap.org', 'https://tile.openstreetmap.org'];
function contentSecurityPolicy(html) {
	const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`,
	);
	const g = gmaps ? GOOGLE : [];
	const dirs = {
		'default-src': ["'none'"],
		'script-src': [...hashes, ...MAP_CDNS, 'blob:', ...(gmaps ? [...GOOGLE, "'unsafe-eval'"] : [])],
		// the brush face is inline (brushFace); Google's fonts hosts stay only for the Maps JavaScript API's own Roboto
		'style-src': ["'unsafe-inline'", ...MAP_CDNS, ...(gmaps ? ['https://fonts.googleapis.com'] : [])],
		'font-src': ['data:', ...(gmaps ? ['https://fonts.gstatic.com'] : [])],
		'img-src': ["'self'", 'data:', 'blob:', ...MAP_TILES, ...g],
		// group sync: the trip's database, and on an approval trip Firebase's two sign-in endpoints (ADR-20261127-sync-approval)
		'connect-src': [
			"'self'",
			...MAP_TILES,
			...packHosts,
			...(sync ? [new URL(sync.url).origin] : []),
			...(sync && sync.approval ? [new URL(sync.approval.signUp).origin, new URL(sync.approval.token).origin] : []),
			...g,
			...(gmaps ? ['data:', 'blob:'] : []),
		],
		'worker-src': ['blob:'],
		'child-src': ['blob:'],
		'frame-src': gmaps ? ['https://*.google.com'] : ["'none'"],
		'manifest-src': ['data:'],
		'object-src': ["'none'"],
		'base-uri': ["'none'"],
		'form-action': ["'none'"],
	};
	return Object.entries(dirs)
		.map(([k, v]) => `${k} ${[...new Set(v)].join(' ')}`)
		.join('; ');
}
// the preview panel's script joins the page's own, before 99-close, so it can reach the sky, the theme and the clock
const previewDir = path.join(engine, 'src', 'preview');
const previewJS = preview ? [fs.readFileSync(path.join(previewDir, 'preview.js'), 'utf8')] : [];
const app = [appParts[0], ...core, pack, ...appParts.slice(1, -1), ...previewJS, appParts.at(-1)].join('\n');
const title = `${brand} ${ctx.TRIP.start.slice(0, 4)}`;
const htmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const backdrop = backdropHTML(world);
const shell = shellSrc
	.replace(/\{\{brand\}\}/g, htmlEsc(brand))
	.replace(/\{\{brandShort\}\}/g, htmlEsc(brandShort))
	.replace(/\{\{dates\}\}/g, rangeLabel(ctx.TRIP.start, ctx.TRIP.end, 'zh'))
	.replace(/\{\{storeKey\}\}/g, () => JSON.stringify(storeKey(ctx.TRIP)).replace(/</g, '\\u003c'))
	.replace('<header class="bar" id="bar">', () => `${backdrop.sky}<header class="bar" id="bar">`)
	.replace('<footer class="foot" id="foot"></footer>', () => `<footer class="foot" id="foot"></footer>${backdrop.end}`);
const brush = new Set([brand, brandShort, '定', ...ctx.DAYS.map((d) => d.wish), ctx.PRINCIPLE.wish].join('').replace(/\s/g, ''));
const brushFont = ctx.TRIP.brushFont || 'Ma Shan Zheng';
if (!/^[A-Za-z0-9 ]+$/.test(brushFont)) throw new Error(`TRIP.brushFont: a Google Fonts family name, got ${JSON.stringify(brushFont)}`);
const fontHref = `https://fonts.googleapis.com/css2?family=${brushFont.replace(/ /g, '+')}&display=swap&text=${encodeURIComponent([...brush].join(''))}`;

// the brush face travels in the page (ADR-20261002-embed-brush-font): a stylesheet from Google Fonts held the first paint
// until Google answered, so a weak signal meant a blank page for seconds. The build fetches the subset once, keeps it in
// .cache/fonts/ (so a rebuild works offline), and inlines it as a data: URL. With no network and no cached copy, the
// page letters in the system Kaiti faces (style.css's fallbacks) and the build says so.
const FONT_CACHE = path.join(engine, '..', '.cache', 'fonts');
async function brushFace(href) {
	const cached = path.join(FONT_CACHE, `${crypto.createHash('sha256').update(href).digest('hex').slice(0, 16)}.css`);
	if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
	const get = async (url, headers) => {
		const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
		if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
		return r;
	};
	try {
		// a current browser's user agent, or Google answers with an older format than woff2
		const ua = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
		const sheet = await (await get(href, ua)).text();
		const faces = [];
		for (const [, block] of sheet.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
			const src = /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)\s'"]+)\)\s*format\(['"]woff2['"]\);/.exec(block);
			if (!src) continue;
			const rest = block.replace(src[0], '').replace(/\s+/g, ' ').trim();
			if (/[<>\\]/.test(rest)) throw new Error('unexpected characters in the stylesheet'); // it lands inside <style>
			const font = Buffer.from(await (await get(src[1])).arrayBuffer()).toString('base64');
			faces.push(`@font-face{${rest}src:url(data:font/woff2;base64,${font}) format('woff2');}`);
		}
		if (!faces.length) throw new Error('no woff2 face in the stylesheet');
		fs.mkdirSync(FONT_CACHE, { recursive: true });
		fs.writeFileSync(cached, faces.join(''));
		return faces.join('');
	} catch (e) {
		console.warn(`! brush font: couldn't fetch ${brushFont} from Google Fonts (${e.message}); the page letters in the system Kaiti faces`);
		return '';
	}
}
const fontCSS = await brushFace(fontHref);

// the brush face goes first in the lettering's font stack (style.css keeps system Kaiti faces as the fallback)
const brushCSS = brushFont === 'Ma Shan Zheng' ? '' : `:root{--font-brush:'${brushFont}','STKaiti','KaiTi','Kaiti SC','BiauKai',serif}`;
const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
// home-screen icons (scripts: /tmp render of the brand lettering → img/icon/); the host serves one file, so they go in as
// data: URLs. A trip with no img/icon/ in a world that draws one gets the world's icon, drawn here (engine/icons.mjs).
const tripIcons = fs.existsSync(path.join(trip, 'img', 'icon'));
const drawnIcon = new Map();
// the trip's leading activity, drawn beside the world's emblem when the world can draw it (core/motif.mjs leadMotif)
const iconMark = world?.iconPaint && !tripIcons ? leadMotif(ctx.DAYS, world.iconMarks) : null;
const iconURL = (n) => {
	const f = path.join(trip, 'img', 'icon', `icon-${n}.png`);
	if (fs.existsSync(f)) return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
	if (tripIcons || !world?.iconPaint) return '';
	if (!drawnIcon.has(n)) {
		const png = renderPNG(n, (u, v) => world.iconPaint(u, v, iconMark), {
			Software: 'RelaxJer engine/icons.mjs',
			Source: `drawn by code from the ${world.name} world (engine/src/themes/${world.name}.mjs iconPaint); no photo, stock or image model`,
			...(iconMark ? { Mark: `${iconMark}, the mark on the most days (DAYS[i].motif)` } : {}),
		});
		drawnIcon.set(n, `data:image/png;base64,${png.toString('base64')}`);
	}
	return drawnIcon.get(n);
};
const APP_ICONS = { 192: iconURL(192), 512: iconURL(512) };
// the world's illustrations (engine/src/themes/<world>-art/<motif>.svg, and hero.svg for the overview): only the ones this
// trip's days use go in, each as an image, so their ids never meet on the page. A world without the folder adds nothing.
// A drawing's moving parts (<g data-actor>, ADR-20261121-world-motion) go in as images of their own, with the box the
// page lays each one at (engine/world-art.mjs); the rest of the drawing is the picture under them.
const svgURL = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const { WORLD_ART, WORLD_ACTORS } = (() => {
	const none = { WORLD_ART: null, WORLD_ACTORS: null };
	if (!world) return none;
	const dir = path.join(engine, 'src', 'themes', `${world.name}-art`);
	if (!fs.existsSync(dir)) return none;
	const want = new Set(['hero', ...ctx.DAYS.map((d) => d.motif).filter(Boolean)]);
	const art = {};
	const actors = {};
	for (const name of want) {
		const f = path.join(dir, `${name}.svg`);
		if (!/^[a-z]+$/.test(name) || !fs.existsSync(f)) continue;
		const svg = fs.readFileSync(f, 'utf8');
		if (/<script|<foreignObject|<image|on[a-z]+=|href="(?!#)|url\((?!#)/i.test(svg))
			throw new Error(`${path.relative(path.join(engine, '..'), f)}: a world's art is plain SVG: no script, image, handler or outside link`);
		const { base, actors: parts } = splitArt(svg);
		art[name] = svgURL(base);
		if (parts.length) actors[name] = parts.map((a) => ({ part: a.part, src: svgURL(a.svg), box: a.box }));
	}
	return Object.keys(art).length ? { WORLD_ART: art, WORLD_ACTORS: Object.keys(actors).length ? actors : null } : none;
})();
const head = `<title>${htmlEsc(title)}</title>
<meta name="description" content="${htmlEsc(description)}">
<meta name="theme-color" content="${world?.paper?.light || '#ffffff'}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${world?.paper?.dark || '#0c1017'}" media="(prefers-color-scheme: dark)">`;
// the world on <html> before first paint: the standalone page's own tag carries it, the artifact (whose host writes the
// <html>) sets it from a one-line script
const skyAttr = skyMode !== 'off' ? ` data-sky="${skyMode}"` : '';
const worldAttr = world ? ` data-world="${world.name}"${skyAttr}` : '';
const worldScript = world
	? `<script>document.documentElement.dataset.world=${JSON.stringify(world.name)}${skyAttr ? `;document.documentElement.dataset.sky=${JSON.stringify(skyMode)}` : ''}</script>\n`
	: '';
// the preview panel's own style and script, only with --preview (and never in the artifact or the standalone page)
const previewCSS = preview ? fs.readFileSync(path.join(previewDir, 'preview.css'), 'utf8') : '';
const worldCSS = (world ? world.css : '') + previewCSS;

const scripts = (
	imgMap,
	kmlB64,
) => `<script>window.CREDITS=${safe(credits)};window.GEO=${safe(geo)};window.EXTRA=${safe(extra)};window.WISH=${safe(wish)};window.SHARE_URL=${safe(shareUrl)};window.APP_ICONS=${safe(APP_ICONS)};${WORLD_ART ? `window.WORLD_ART=${safe(WORLD_ART)};` : ''}${WORLD_ACTORS ? `window.WORLD_ACTORS=${safe(WORLD_ACTORS)};` : ''}window.GMAPS=${safe(gmaps)};window.SYNC=${safe(sync)};window.DEMO_CLOCK=${safe(demoClock)};window.FORECAST=${safe(forecast)};window.DRINKS=${safe(drinks)};window.TOILETS=${safe(toilets)};window.REFILL=${safe(refill)};window.COUPON_FILES=${safe(Object.fromEntries(Object.entries(coupons).map(([k, v]) => [k, v.file])))};window.MRT=${safe(mrt)};window.YB=${safe(transit.yb)};window.BUS=${safe(transit.bus)};window.SHOPS=${safe(shops)};window.KML_B64=${safe(kmlB64 || '')};${imgMap ? `window.IMG=${imgMap ? 'null' : 'null'};` : ''}</script>
<script>${data}</script>
<script>${app}</script>`;

// pages are written by writePages(); the final call happens after the KML exists
const writePages = (kmlB64) => {
	// 1) artifact body (the host adds doctype/head/body)
	const artifact = `${worldScript}${head}\n<style>${fontCSS}${css}${worldCSS}${brushCSS}</style>\n${shell}\n${scripts(null, kmlB64)}\n`;
	if (!preview) fs.writeFileSync(path.join(out, `${fileBase}.html`), artifact);

	// 2) standalone single file
	const imgMap = {};
	for (const c of credits)
		for (const k of [c.id, `${c.id}-sq`]) {
			const lite = path.join(trip, 'img', 'lite', `${k}.webp`);
			const f = fs.existsSync(lite) ? lite : path.join(trip, 'img', `${k}.webp`); // scripts/imglite.py: 720 px, lighter
			if (fs.existsSync(f)) imgMap[k] = `data:image/webp;base64,${fs.readFileSync(f).toString('base64')}`;
		}
	for (const [k, v] of Object.entries(coupons)) imgMap[k] = v.data;
	const draft = `<!doctype html>
<html lang="zh-Hans"${worldAttr}>
<head>
<meta charset="utf-8">
<meta name="relaxjer-build" content="{{build}}">
<meta http-equiv="Content-Security-Policy" content="{{csp}}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${htmlEsc(brand)}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="mobile-web-app-capable" content="yes">
${iconURL(180) ? `<link rel="apple-touch-icon" href="${iconURL(180)}">` : ''}${iconURL(32) ? `\n<link rel="icon" type="image/png" sizes="32x32" href="${iconURL(32)}">` : ''}
${head}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}${fontCSS}${css}${worldCSS}${brushCSS}</style>
</head>
<body data-img-late="1">
${shell}
${scripts(imgMap, kmlB64)}
<script type="application/json" id="img-data">${safe(imgMap)}</script>
</body>
</html>
`;
	// the policy hashes the page's own inline scripts, so it's written once they're final
	const withCsp = draft.replace('{{csp}}', () => htmlEsc(contentSecurityPolicy(draft)));
	// the page's own version, first bytes of the file: a paused home-screen app reads the live copy's to offer an update
	const build = crypto.createHash('sha256').update(withCsp).digest('hex').slice(0, 12);
	const standalone = withCsp.replace('{{build}}', build);
	fs.writeFileSync(path.join(out, `${fileBase}-${preview ? 'preview' : 'standalone'}.html`), standalone);

	const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
	return { artifact, standalone, kb };
};
const { artifact, standalone, kb } = writePages('');
console.log(
	`${preview ? 'PREVIEW (not for publishing) · ' : ''}google key ${gmaps ? 'yes' : 'no'} · group sync ${sync ? `yes (${sync.approval ? 'approval, ' : ''}planner code ${sync.planner ? 'set' : 'not set'})` : 'no'}${demoClock ? ` · demo clock ${demoClock}` : ''}${skyMode !== 'off' ? ` · sky ${skyMode}` : ''} · artifact ${kb(artifact)} · standalone ${kb(standalone)} · photos ${credits.length}${
		Object.keys(coupons).length
			? ` · coupons ${Object.keys(coupons).length} (${Object.values(coupons)
					.reduce((n, v) => n + v.kb, 0)
					.toFixed(0)} KB)`
			: ''
	} · geo ${geo ? 'yes' : 'no'} · food ${extra.food?.length || 0} · tickets ${extra.tickets?.length || 0} · wish ${wish.length} · refill ${refill.spots.length} · brush glyphs ${brush.size} (${fontCSS ? 'font in the page' : 'system Kaiti'})${drawnIcon.size ? ` · icon drawn (${world.name}${iconMark ? ` + ${iconMark}` : ''})` : ''}`,
);

// 3) Google My Maps export (KML): one combined file + one file per layer
{
	const c2 = {};
	vm.createContext(c2);
	vm.runInContext(
		data +
			';this.PLACES=PLACES;this.DAYS=DAYS;this.SHOPLISTS=typeof SHOPLISTS==="undefined"?undefined:SHOPLISTS;this.SNOW=typeof SNOW==="undefined"?undefined:SNOW;this.OPTIONAL=OPTIONAL;this.TRIP=TRIP;this.FLIGHTS=FLIGHTS;',
		c2,
	);
	const { PLACES, DAYS, OPTIONAL, TRIP, FLIGHTS } = c2;
	const SHOPLISTS = c2.SHOPLISTS || (c2.SNOW ? [{ id: 'snow', ...c2.SNOW }] : []);
	// one layer per day, except a day that holds only an after-midnight take-off
	const planDays = DAYS.filter((d) => d.id !== dayRoles(DAYS, FLIGHTS.ret).flight);
	const K = TRIP.kml || {}; // the trip's KML layer names and the places that go on its hotel/transport layer
	const X = (s) => String(s ?? '').replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch]);
	const gm = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
	const DAYCOL = { 1: 'd9352b', 2: '2466c8', 3: 'ec6a1c', 4: '1b7f52', 5: '8a3ca6', 6: 'ee82a6', 7: 'e0b020' };
	const kmlColor = (hex) => `ff${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}`; // aabbggrr
	const layers = [
		{ id: 'hotel', name: '酒店与交通 Hotel & transport', color: '15161a', items: [] },
		...planDays.map((d) => ({
			id: d.id,
			name: `Day ${d.n} · ${d.date.slice(5).replace('-', '/')} ${d.dow[1]} · ${d.title[0]}`,
			color: DAYCOL[d.c],
			items: [],
		})),
		{ id: 'optional', name: K.optional || '备选 Optional', color: '636873', items: [] },
		{ id: 'wish', name: '想去清单 Wishlist', color: 'f2a900', items: [] },
	];
	const L = Object.fromEntries(layers.map((l) => [l.id, l]));
	const seen = new Set();
	const add = (layer, key, it) => {
		if (seen.has(key) || it.lat == null || it.lng == null) return;
		seen.add(key);
		(L[layer] || L.optional).items.push(it); // a day this trip doesn't have: with the optional places
	};
	const placeItem = (pid, extra = '') => {
		const p = PLACES[pid],
			g = geo && geo.places && geo.places[pid];
		if (!p || !g) return null;
		return {
			name: `${p.name[0]}${p.name[1] && p.name[1] !== p.name[0] ? ' · ' + p.name[1] : ''}`,
			lat: g.lat,
			lng: g.lng,
			addr: p.addr || g.addr || '',
			addrEn: p.addrEn || g.addr_en || '',
			q: p.maps,
			note: extra,
			kind: '景点 Sight',
			site: p.site,
		};
	};
	const HOTELS = [...new Set(Object.values(hotelsByDay(DAYS, TRIP.hotel)))]; // one or one per night
	[...new Set([...(K.transport || []), ...HOTELS])].forEach((pid) => {
		const it = placeItem(pid);
		if (it) add('hotel', pid, { ...it, kind: HOTELS.includes(pid) ? '酒店 Hotel' : '交通 Transport' });
	});
	planDays.forEach((d) => {
		d.schedule.forEach((s) => {
			if (!s.place) return;
			const t = Array.isArray(s.t) ? s.t[0] : s.t || '';
			const it = placeItem(s.place, `${t} ${s.what[0]} / ${s.what[1]}`);
			if (it) add(d.id, s.place, it);
		});
		d.blocks.forEach((b) =>
			(b.places || []).concat((b.opts || []).map((o) => o.place).filter(Boolean)).forEach((pid) => {
				const it = placeItem(pid);
				if (it) add(d.id, pid, it);
			}),
		);
	});
	(extra.food || []).forEach((f, i) => {
		// on the layer of the day that lists its slot (DAYS[].foodSlots), else with the optional places
		const layer = (planDays.find((d) => (d.foodSlots || []).includes(f.slot)) || { id: 'optional' }).id;
		add(layer, 'food' + i, {
			name: `${f.name_trad}${f.name_en ? ' · ' + f.name_en : ''}`,
			lat: f.lat,
			lng: f.lng,
			addr: f.address_trad,
			addrEn: f.address_en,
			q: f.maps_query || f.address_trad,
			note: `${f.dish_zh || ''} / ${f.dish_en || ''}${f.note_zh ? '\n' + f.note_zh : ''}`,
			kind: '美食 Food',
			site: f.site,
			rating: f.rating,
			reviews: f.reviews,
		});
	});
	OPTIONAL.forEach((o) => {
		const it = placeItem(o.place, `${o.meta[0]}`);
		if (it) add('optional', o.place, it);
	});
	SHOPLISTS.flatMap((l) => (l.shops || []).map((sh) => ({ ...sh, kind: l.kind }))).forEach((sh) => {
		const it = placeItem(sh.place, `${sh.when[0]} / ${sh.when[1]}`);
		if (it) add('optional', sh.place, { ...it, kind: (sh.kind || ['商店', 'Shop']).join(' ') });
	});
	wish
		.filter((w) => w.status !== 'closed')
		.forEach((w) => {
			const f0 = (w.fits || [])[0];
			const layer = f0 && L[f0.day] && planDays.some((d) => d.id === f0.day) ? f0.day : 'wish'; // a day of this trip, else the wishlist layer
			(w.branches || []).forEach((br, bi) =>
				add(layer, `wish-${w.id}-${bi}`, {
					name: `★ ${w.name_trad || w.name_zh}${w.name_en ? ' · ' + w.name_en : ''}${w.branches.length > 1 && br.label_zh ? ' (' + br.label_zh + ')' : ''}`,
					lat: br.lat,
					lng: br.lng,
					addr: br.address_trad,
					addrEn: br.address_en,
					q: br.maps_query || br.address_trad,
					note: `${w.order_zh || ''}${w.order_en ? ' / ' + w.order_en : ''}${br.hours_zh ? '\n' + br.hours_zh : ''}${f0 ? '\n' + f0.zh : ''}`,
					kind: '想去 Wishlist',
					site: w.site,
					rating: w.rating,
					reviews: w.reviews,
				}),
			);
		});
	const placemark = (it, layer) => `<Placemark><name>${X(it.name)}</name><styleUrl>#s-${layer.id}</styleUrl>
<description><![CDATA[${[it.note, it.addr, it.addrEn, it.rating ? `★ ${it.rating}${it.reviews ? ` (${it.reviews})` : ''}` : '', `Google Maps: ${gm(it.q || it.addr || it.name)}`, it.site ? `Web: ${it.site}` : ''].filter(Boolean).join('<br>').replace(/\n/g, '<br>')}]]></description>
<ExtendedData><Data name="Layer"><value>${X(layer.name)}</value></Data><Data name="Type"><value>${X(it.kind)}</value></Data><Data name="Address"><value>${X(it.addr)}</value></Data></ExtendedData>
<Point><coordinates>${(+it.lng).toFixed(6)},${(+it.lat).toFixed(6)},0</coordinates></Point></Placemark>`;
	const style = (l) =>
		`<Style id="s-${l.id}"><IconStyle><color>${kmlColor(l.color)}</color><scale>1.1</scale><Icon><href>https://maps.google.com/mapfiles/kml/paddle/wht-blank.png</href></Icon></IconStyle></Style>`;
	const doc = (title, ls) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${X(title)}</name>
${ls.map(style).join('\n')}
${ls
	.filter((l) => l.items.length)
	.map((l) => `<Folder><name>${X(l.name)}</name>\n${l.items.map((it) => placemark(it, l)).join('\n')}\n</Folder>`)
	.join('\n')}
</Document></kml>
`;
	const outDir = path.join(out, 'mymaps');
	fs.mkdirSync(outDir, { recursive: true });
	for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f));
	fs.writeFileSync(path.join(out, `${fileBase}-mymaps.kml`), doc(title, layers));
	layers
		.filter((l) => l.items.length)
		.forEach((l, i) => fs.writeFileSync(path.join(outDir, `${String(i + 1).padStart(2, '0')}-${l.id}.kml`), doc(l.name, [l])));
	console.log(`kml ${layers.map((l) => `${l.id}:${l.items.length}`).join(' ')}`);
	const r = writePages(Buffer.from(doc(title, layers)).toString('base64'));
	console.log(`final: artifact ${r.kb(r.artifact)} · standalone ${r.kb(r.standalone)} (KML embedded)`);
}
