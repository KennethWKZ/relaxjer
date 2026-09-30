// Build: engine/src/* + a trip's data and img/ → taipei-trip.html (artifact body) and taipei-trip-standalone.html (single file,
// images inlined), plus the My Maps KML. Moved verbatim from the first trip's repo; only where files are read and written changed.
//   node engine/build.mjs --trip <trip dir> [--out <dir>] [--keys <google.json>]
// The trip dir holds data.js, the *.json side files and img/. The Google browser key + Map ID go in only when --keys
// names a file (keep it outside the repo, e.g. ~/.config/relaxjer/google.json, mode 600): a page built without it,
// like the demo, can be shared without leaking a key. Without one the page keeps the free MapLibre map.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { rangeLabel } from './src/core/time.mjs';
import { dayRoles } from './src/core/plan.mjs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const engine = path.dirname(new URL(import.meta.url).pathname);
const trip = path.resolve(arg('trip', ''));
const out = path.resolve(arg('out', path.join(trip, 'dist')));
const keysFile = arg('keys', 'none').replace(/^~(?=\/)/, os.homedir());
if (!arg('trip') || !fs.existsSync(path.join(trip, 'data.js'))) {
	console.error('usage: node engine/build.mjs --trip <dir with data.js> [--out <dir>] [--keys <google.json>]');
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
// the pure modules (engine/src/core/<name>.mjs, no imports) go in right after 00-open, each as a namespace: time.mjs → Time
const coreDir = path.join(engine, 'src', 'core');
const core = (
	fs.existsSync(coreDir)
		? fs
				.readdirSync(coreDir)
				.filter((f) => f.endsWith('.mjs'))
				.sort()
		: []
).map((f) => {
	const src = fs.readFileSync(path.join(coreDir, f), 'utf8');
	if (/^\s*import\s/m.test(src)) throw new Error(`engine/src/core/${f}: core modules can't import (the build inlines them)`);
	const names = [...src.matchAll(/^export (?:const|let|function) (\w+)/gm)].map((m) => m[1]);
	const ns = f.replace(/\.mjs$/, '').replace(/^./, (c) => c.toUpperCase());
	return `  const ${ns} = (() => {\n${src.replace(/^export /gm, '')}\n  return { ${names.join(', ')} };\n  })();`;
});
const app = [appParts[0], ...core, ...appParts.slice(1)].join('\n');
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

// credits: keep only photos whose files exist
const credits = readJSON('img/credits.json', []).filter((c) => fs.existsSync(path.join(trip, 'img', `${c.id}.webp`)));
const geoFull = readJSON('src/geo.json', null);
const geo = geoFull && { bbox: geoFull.bbox, attribution: geoFull.attribution, places: geoFull.places, legs: geoFull.legs || {} }; // live map draws the streets; pins, MRT and leg times ship
const extra = readJSON('src/extra.json', { food: [], tickets: [], sites: {} });
const forecast = readJSON('src/forecast.json', null);
const drinks = readJSON('src/drinks.json', []);
const toilets = readJSON('src/toilets.json', { wc: [], near: {}, gp: {}, borrow: {} });
const shops = readJSON('src/shops.json', []);
const mrt = readJSON('src/mrt.json', null);
const transit = readJSON('src/transit.json', { yb: [], bus: [] }); // scripts/mrt.py, scripts/gtransit.py
// scripts/gtoilets.py: public toilets, own-restroom flags, borrowable restrooms
// scripts/gdrinks.py: drink shops near every stop // scripts/resync.py writes it once trip days are inside the 16-day forecast
const wish = [...(readJSON('src/wish-a.json', { items: [] }).items || []), ...(readJSON('src/wish-b.json', { items: [] }).items || [])];

// brush glyphs → Google Fonts `text=` subset (Ma Shan Zheng is a large CJK face)
const ctx = {};
vm.createContext(ctx);
vm.runInContext(data + ';this.DAYS=DAYS;this.PRINCIPLE=PRINCIPLE;this.TRIP=TRIP;', ctx);
// the trip's name on the page, the home screen and the KML; the shell's {{brand}} / {{dates}} are filled from it
const { brand, description } = ctx.TRIP;
const title = `${brand} ${ctx.TRIP.start.slice(0, 4)}`;
const htmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const shell = shellSrc.replace(/\{\{brand\}\}/g, htmlEsc(brand)).replace(/\{\{dates\}\}/g, rangeLabel(ctx.TRIP.start, ctx.TRIP.end, 'zh'));
const brush = new Set([brand, '定', ...ctx.DAYS.map((d) => d.wish), ctx.PRINCIPLE.wish].join('').replace(/\s/g, ''));
const fontHref = `https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap&text=${encodeURIComponent([...brush].join(''))}`;

const safe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
// home-screen icons (scripts: /tmp render of the brand lettering → img/icon/); the host serves one file, so they go in as data: URLs
const iconURL = (n) => {
	const f = path.join(trip, 'img', 'icon', `icon-${n}.png`);
	return fs.existsSync(f) ? `data:image/png;base64,${fs.readFileSync(f).toString('base64')}` : '';
};
const APP_ICONS = { 192: iconURL(192), 512: iconURL(512) };
const head = `<title>${htmlEsc(title)}</title>
<meta name="description" content="${htmlEsc(description)}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c1017" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontHref}">`;

const scripts = (
	imgMap,
	kmlB64,
) => `<script>window.CREDITS=${safe(credits)};window.GEO=${safe(geo)};window.EXTRA=${safe(extra)};window.WISH=${safe(wish)};window.SHARE_URL=${safe(shareUrl)};window.APP_ICONS=${safe(APP_ICONS)};window.GMAPS=${safe(gmaps)};window.FORECAST=${safe(forecast)};window.DRINKS=${safe(drinks)};window.TOILETS=${safe(toilets)};window.MRT=${safe(mrt)};window.YB=${safe(transit.yb)};window.BUS=${safe(transit.bus)};window.SHOPS=${safe(shops)};window.KML_B64=${safe(kmlB64 || '')};${imgMap ? `window.IMG=${imgMap ? 'null' : 'null'};` : ''}</script>
<script>${data}</script>
<script>${app}</script>`;

// pages are written by writePages(); the final call happens after the KML exists
const writePages = (kmlB64) => {
	// 1) artifact body (the host adds doctype/head/body)
	const artifact = `${head}\n<style>${css}</style>\n${shell}\n${scripts(null, kmlB64)}\n`;
	fs.writeFileSync(path.join(out, 'taipei-trip.html'), artifact);

	// 2) standalone single file
	const imgMap = {};
	for (const c of credits)
		for (const k of [c.id, `${c.id}-sq`]) {
			const lite = path.join(trip, 'img', 'lite', `${k}.webp`);
			const f = fs.existsSync(lite) ? lite : path.join(trip, 'img', `${k}.webp`); // scripts/imglite.py: 720 px, lighter
			if (fs.existsSync(f)) imgMap[k] = `data:image/webp;base64,${fs.readFileSync(f).toString('base64')}`;
		}
	const standalone = `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${htmlEsc(brand)}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="mobile-web-app-capable" content="yes">
${iconURL(180) ? `<link rel="apple-touch-icon" href="${iconURL(180)}">` : ''}${iconURL(32) ? `\n<link rel="icon" type="image/png" sizes="32x32" href="${iconURL(32)}">` : ''}
${head}
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}${css}</style>
</head>
<body data-img-late="1">
${shell}
${scripts(imgMap, kmlB64)}
<script type="application/json" id="img-data">${safe(imgMap)}</script>
</body>
</html>
`;
	fs.writeFileSync(path.join(out, 'taipei-trip-standalone.html'), standalone);

	const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
	return { artifact, standalone, kb };
};
const { artifact, standalone, kb } = writePages('');
console.log(
	`google key ${gmaps ? 'yes' : 'no'} · artifact ${kb(artifact)} · standalone ${kb(standalone)} · photos ${credits.length} · geo ${geo ? 'yes' : 'no'} · food ${extra.food?.length || 0} · tickets ${extra.tickets?.length || 0} · wish ${wish.length} · brush glyphs ${brush.size}`,
);

// 3) Google My Maps export (KML): one combined file + one file per layer
{
	const c2 = {};
	vm.createContext(c2);
	vm.runInContext(data + ';this.PLACES=PLACES;this.DAYS=DAYS;this.SNOW=SNOW;this.OPTIONAL=OPTIONAL;this.TRIP=TRIP;this.FLIGHTS=FLIGHTS;', c2);
	const { PLACES, DAYS, SNOW, OPTIONAL, TRIP, FLIGHTS } = c2;
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
	(K.transport || ['hotel']).forEach((pid) => {
		const it = placeItem(pid);
		if (it) add('hotel', pid, { ...it, kind: pid === 'hotel' ? '酒店 Hotel' : '交通 Transport' });
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
	SNOW.shops.forEach((sh) => {
		const it = placeItem(sh.place, `${sh.when[0]} / ${sh.when[1]}`);
		if (it) add('optional', sh.place, { ...it, kind: '雪具店 Ski shop' });
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
	fs.writeFileSync(path.join(out, 'taipei-trip-mymaps.kml'), doc(title, layers));
	layers
		.filter((l) => l.items.length)
		.forEach((l, i) => fs.writeFileSync(path.join(outDir, `${String(i + 1).padStart(2, '0')}-${l.id}.kml`), doc(l.name, [l])));
	console.log(`kml ${layers.map((l) => `${l.id}:${l.items.length}`).join(' ')}`);
	const r = writePages(Buffer.from(doc(title, layers)).toString('base64'));
	console.log(`final: artifact ${r.kb(r.artifact)} · standalone ${r.kb(r.standalone)} (KML embedded)`);
}
