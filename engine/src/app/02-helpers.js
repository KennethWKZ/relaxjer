/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const L = (x) => (Array.isArray(x) ? x[lang === 'en' ? 1 : 0] || x[0] || '' : x == null ? '' : String(x));
const Z = (zh, en) => (lang === 'en' ? en : zh);
/* search alias: names in the language not on screen, so 中 mode still finds an English name and EN mode a Chinese one */
const alt = (...xs) => {
	const seen = new Set();
	const v = xs
		.flat()
		.filter(Boolean)
		.map((x) => String(x).replace(/\*\*/g, '').trim())
		.filter((x) => {
			const k = x.toLowerCase();
			return x && !seen.has(k) && seen.add(k);
		})
		.join(' · ');
	return v ? ` data-alt="${esc(v)}"` : '';
};
const altX = (shown, ...xs) => alt(...xs.filter((x) => x && String(x).trim().toLowerCase() !== String(shown).trim().toLowerCase()));
// one side of an optional [zh, en] field, with a fallback when the trip leaves it out
const L0 = (x, fb) => (Array.isArray(x) ? x[0] : fb);
const L1 = (x, fb) => (Array.isArray(x) ? x[1] : fb);
const other = (x) => (Array.isArray(x) ? x[lang === 'en' ? 0 : 1] : '');
/** the keyboard's Enter as an action. Not while a Chinese or Japanese input method is still composing: its Enter picks
 *  the characters (isComposing; Safari reports that last Enter as keyCode 229, after composition has ended) */
const enterKey = (e) => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* the group may split up, so every group figure also shows a rough share each (÷ group size, to the nearest 10) */
const GROUP = Money.groupWord(PAX); // how the data marks a group figure: ["五人", "for 5"]
const each = (n) => Money.share(n, PAX);
const numsIn = (x) => Money.amountsIn(x, CUR.sym);
/* figures lead with the trip's currency or, when this phone picked it (homeFirst), the group's home currency. The page
   converts as it draws, here: the figure helpers below, fmt() for trip text, and cvHtml() for text drawn without fmt.
   A converted figure is a span holding its trip-currency figures (data-cv), so a new rate re-texts it in place */
const tripText = (min, max = min) => `${CUR.sym}${num(min)}${max > min ? '–' + num(max) : ''}`;
const cvSpan = (min, max = min) => `<span class="cv" data-cv="${min},${max}">${Money.homeAmount(min, max, rate, CUR.home)}</span>`;
// the original figure beside a converted one, so it's never lost: "≈ RM 140 (¥5,300)". Half-width brackets in both
// languages: they hold a figure, and a full-width one starting a wrapped line indents it
const origText = (t) => `<span class="cv-o"> (${t})</span>`;
/** a figure in the trip's currency as this phone reads it: "¥1,000–2,000", or "≈ RM 26–51" (no ≈ after 约, ~ or about) */
const money = (min, max = min, approx = false) => (homeFirst ? `${approx ? '' : '≈ '}${cvSpan(min, max)}` : tripText(min, max));
// each person's share of a group figure, in the trip's currency as before (copied text keeps it too), or converted
const eachTrip = (min, max) => `${CUR.sym}${num(each(min))}${max > min ? '–' + num(each(max)) : ''}`;
const eachText = (min, max) => (homeFirst ? cvSpan(each(min), each(max)) : eachTrip(min, max));
/** escaped text (or markup) with its amounts in the home currency when the phone reads that, each with its original */
const cvHtml = (h, orig = true) =>
	homeFirst
		? Money.mapAmounts(
				h,
				CUR.sym,
				(a) => (a.hi ? `${a.approx ? '' : '≈ '}${cvSpan(a.lo, a.hi)}${a.plus ? '+' : ''}${orig ? origText(a.text) : ''}` : `${esc(CUR.home)} 0`),
				CUR.home,
			)
		: h;
/** plain text (an SVG label or description, a tag inside a list line) the same way, without markup */
const cvPlain = (t) => (homeFirst ? Money.toHome(t, CUR.sym, rate, CUR.home) : t);
// walking, one model (core/way.mjs walkMin), at the group's pace: the trip's TRIP.walkPace, else the seniors' pace
// (ADR-20261127-trip-walk-pace). Every walking time the page shows is at that pace, Google's walking minutes too; a
// ride's minutes stay as they are.
const GROUP_WALK = Way.paceOf(TRIP.walkPace);
const walkMinM = (m) => Way.walkMin(m, GROUP_WALK); // metres in a straight line → minutes, at the group's pace
// number ranges and phone numbers stay on one line (core/wrap.mjs), in lists, hours, tables, notes and the airport
// tiles' narrow cells. keepRanges takes escaped text; escText is esc for text people read (never an attribute).
const keepRanges = Wrap.keepRanges;
const escText = (s) => keepRanges(cvHtml(esc(s))); // amounts converted as in fmt()
// shares go in before **bold** turns into <strong>, so a bold group figure gets its share too; then the conversion, if
// the phone reads the home currency (the shares are already in it); ranges go in last. orig: false where the line
// under the text already shows the original figure
const fmt = (x, orig = true) =>
	keepRanges(
		cvHtml(
			esc(L(x)).replace(Money.groupFigureRe(CUR.sym, PAX), (m, amt, a, b, tail, _at, text) => {
				const lo = +a.replace(/,/g, ''),
					hi = b ? +b.replace(/,/g, '') : lo;
				if (Money.statesShare(text, CUR.sym, lo, hi, PAX)) return m; // "NT$600 each, NT$3,000 for 5" says it already
				return `${amt}${tail}<span class="each-i"> · ${Z(`每人约${eachText(lo, hi)}`, `≈${eachText(lo, hi)} each`)}</span>`;
			}),
			orig,
		).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
	);
const eachLine = (min, max) =>
	`<span class="each">${Z('每人约', 'Each ≈')} <b>${eachText(min, max)}</b> <span class="rm-i" data-rm="${each(min)},${each(max)}">${rmText(each(min), each(max))}</span></span>`;
const ddEach = (v) => {
	const n = numsIn(v);
	return n && n[1] >= 100 ? `<small class="dd-each">${Z('每人', 'each')} ${eachText(n[0], n[1])}</small>` : '';
};
const icon = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const num = (n) => Math.round(n).toLocaleString('en-US');
// what Google's search and map answer in, and the country they lean to: English, or the pack's own Chinese (`googleZh`,
// plain 'zh' without one); the trip's country code (TRIP.destination), none without one. Never a fixed country
const gLang = () => (lang === 'en' ? 'en' : Pack.googleZh || 'zh');
const gRegion = () => (TRIP.destination ? String(TRIP.destination).toLowerCase() : '');
// the line under a figure, in the other currency: "≈ RM 26–51" under the trip's, or the original "(¥1,000–2,000)"
// under a converted one (it doesn't follow the rate, so a new rate leaves it as it is)
const rmText = (min, max) => (homeFirst ? `(${tripText(min, max)})` : Money.homeText(min, max, rate, CUR.home));
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const imgSrc = (id, sq) => {
	if (!credit[id]) return '';
	const key = id + (sq ? '-sq' : '');
	return IMG ? IMG[key] || BLANK : IMG_LATE ? BLANK : `img/${key}.webp`;
};
const imgKey = (id, sq) => id + (sq ? '-sq' : '');
function imgLoad() {
	// after first paint: parse the photos once, then fill every placeholder
	if (IMG || !IMG_LATE) return;
	const el = document.getElementById('img-data');
	if (!el) return;
	try {
		IMG = JSON.parse(el.textContent);
	} catch {
		return;
	}
	el.remove();
	$$('img[data-img]').forEach((i) => {
		const v = IMG[i.dataset.img];
		if (v) i.src = v;
	});
}
const dayById = Object.fromEntries(DAYS.map((d) => [d.id, d]));
const colorVars = (c) => `--c:var(--l${c});--ci:var(--l${c}-ink);--cf:var(--l${c}-fill);--cm:var(--l${c}-mute);--cg:var(--l${c}-glow)`;

/* Map and directions links: Google Maps, or Apple Maps when the phone chose it (mapsApp). The whole-day route
   (gmMulti) stays on Google: an Apple Maps link can't carry the stops in between. */
const gpidOf = (q) => {
	for (const k in PLACES) if (PLACES[k].maps === q) return PLACES[k].gpid || (GEO && GEO.places && GEO.places[k] && GEO.places[k].gpid) || '';
	return '';
};
// a search text's position: a trip place's pin, or the "lat,lng" some lists put at the end of the text
const llOf = (q) => {
	const m = /\s(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)\s*$/.exec(` ${q}`);
	if (m) return { q: q.slice(0, q.length - m[0].length + 1).trim(), ll: `${m[1]},${m[2]}` };
	for (const k in PLACES) {
		const g = PLACES[k].maps === q && GEO && GEO.places && GEO.places[k];
		if (g && g.lat) return { q, ll: `${g.lat},${g.lng}` };
	}
	return { q, ll: '' };
};
const mapsName = (a) => (a === 'apple' ? Z('Apple 地图', 'Apple Maps') : Z('Google 地图', 'Google Maps'));
const APPLE_MODE = { transit: 'r', driving: 'd', walking: 'w', bicycling: 'w' };
// Apple Maps: a pin labelled with the name at the place's position (or a search for the name when there is none)
const appleSearch = (q) => {
	const p = llOf(q);
	return `https://maps.apple.com/?q=${encodeURIComponent(p.q)}${p.ll ? `&ll=${p.ll}` : ''}`;
};
const appleDir = (dest, mode, origin) => {
	const at = (x) => llOf(x).ll || x;
	return `https://maps.apple.com/?${origin ? `saddr=${encodeURIComponent(at(origin))}&` : ''}daddr=${encodeURIComponent(at(dest))}&dirflg=${APPLE_MODE[mode] || 'r'}`;
};
const gmSearch = (q, pid) => {
	if (mapsApp === 'apple') return appleSearch(q);
	const id = pid || gpidOf(q);
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${id ? `&query_place_id=${id}` : ''}`;
};
const gmDir = (dest, mode = 'transit', origin, destId) =>
	mapsApp === 'apple'
		? appleDir(dest, mode, origin)
		: `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${encodeURIComponent(origin)}${gpidOf(origin) ? `&origin_place_id=${gpidOf(origin)}` : ''}` : ''}&destination=${encodeURIComponent(dest)}${destId || gpidOf(dest) ? `&destination_place_id=${destId || gpidOf(dest)}` : ''}&travelmode=${mode}`;
const gmMulti = (stops, mode = 'driving') => {
	const [o, ...rest] = stops;
	const d = rest.pop();
	const w = rest.length ? `&waypoints=${encodeURIComponent(rest.join('|'))}` : '';
	return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}${w}&travelmode=${mode}`;
};
const siteFor = (pid) => (PLACES[pid] && PLACES[pid].site) || (EXTRA.sites && EXTRA.sites[pid]) || '';
const addrFor = (pid) => {
	const p = PLACES[pid] || {};
	const g = GEO && GEO.places && GEO.places[pid];
	return { zh: p.addr || (g && g.addr) || '', en: p.addrEn || (g && g.addr_en) || '' };
};
// a link to one of the trip's SITES by key, or nothing when the trip has no such site; `label` overrides its name
const siteLink = (key, ic = 'ext', label) => (SITES[key] ? ext(SITES[key].url, label ? L(label) : L(SITES[key].name), ic) : '');
// a chart axis under the bars: 0 … top in round steps
const axisHTML = (ax) =>
	`<div class="bar-axis"><span></span><div class="bar-axis-t">${ax.marks.map((v) => `<span>${num(v)}</span>`).join('')}</div></div>`;
const ext = (href, label, ic = 'ext', cls = 'mlink') =>
	`<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${icon(ic)}${keepRanges(esc(label))}</a>`; // a long label wraps (a date in it stays whole)
// same, but icon-only on phones (the label stays for screen readers): for the 地图 / 路线 rows repeated on every card. Only
// conventional glyphs go icon-only; the generic "ext" glyph doesn't say "website", so 官网 keeps its label
const extI = (href, label, ic = 'ext') =>
	ic === 'ext'
		? ext(href, label)
		: `<a class="mlink ic" href="${esc(href)}" target="_blank" rel="noopener">${icon(ic)}<span class="dlbl">${esc(label)}</span></a>`;
const MODES = {
	transit: ['搭车', 'Transit', 'train'],
	driving: ['开车', 'Drive', 'car'],
	walking: ['步行', 'Walk', 'walk'],
	bicycling: ['骑车', 'Bike', 'bike'],
};

function placeLinks(pid, opts = {}) {
	const p = PLACES[pid];
	if (!p) return '';
	const out = [
		opts.noNative ? '' : nativeChip(p.trad, p.roma),
		// Google's rating and photos (with the key): by the place's Google id, or looked up near its pin
		GEO && GEO.places && GEO.places[pid] ? gBtn(GEO.places[pid].gpid || p.gpid, `p:${pid}`) : '',
		extI(gmSearch(p.maps), Z('地图', 'Map'), 'pin'),
		extI(gmDir(p.maps, opts.mode || 'transit'), Z('路线', 'Directions'), 'route'),
	];
	const s = siteFor(pid);
	if (s && !opts.noSite) out.push(extI(s, Z('官网', 'Website'), 'ext'));
	if (!opts.noDriver) out.push(`<button type="button" class="mlink" data-driver="${pid}">${icon('car')}${Z('给司机看', 'Show driver')}</button>`);
	return out.join('');
}
/* the native layer: the destination's own words (Japanese in Japan) beside the page's two languages, one tap to copy
   them, so the group can match a sign, a menu or a map search to what the page says. On only when the pack names the
   language (Pack.native); a pack without it (Taiwan, whose names the group already reads) shows nothing new. */
const nativeLang = () => (Pack.native && Pack.native.lang) || '';
function nativeChip(text, roma) {
	const lg = nativeLang();
	if (!lg || !text) return '';
	const name = L(Pack.native.name) || lg;
	return `<button type="button" class="mlink native" data-native="${esc(text)}" aria-label="${esc(Z(`复制${name}：${text}`, `Copy ${name}: ${text}`))}">${icon('copy')}<span class="nat-t" lang="${esc(lg)}">${esc(text)}</span>${roma ? `<span class="nat-r">${esc(roma)}</span>` : ''}</button>`;
}
// a stop's native line: its own words (`native`, `roma`) or its place's
function stopNative(it) {
	if (!nativeLang()) return '';
	const p = (it.place && PLACES[it.place]) || {};
	const chip = it.native ? nativeChip(it.native, it.roma) : nativeChip(p.trad, p.roma);
	return chip ? `<div class="stop-native">${chip}</div>` : '';
}
// the same words as plain text, for what the group copies into the chat
function nativeText(it) {
	if (!nativeLang()) return '';
	const p = (it.place && PLACES[it.place]) || {};
	return it.native || p.trad || '';
}
