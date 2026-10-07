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
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* the group may split up, so every group figure also shows a rough share each (÷ group size, to the nearest 10) */
const GROUP = Money.groupWord(PAX); // how the data marks a group figure: ["五人", "for 5"]
const each = (n) => Money.share(n, PAX);
const eachText = (min, max) => `${CUR.sym}${num(each(min))}${max > min ? '–' + num(each(max)) : ''}`;
const numsIn = (x) => Money.amountsIn(x, CUR.sym);
// shares go in before **bold** turns into <strong>, so a bold group figure gets its share too
const fmt = (x) =>
	esc(L(x))
		.replace(Money.groupFigureRe(CUR.sym, PAX), (m, amt, a, b, tail, _at, text) => {
			const lo = +a.replace(/,/g, ''),
				hi = b ? +b.replace(/,/g, '') : lo;
			if (Money.statesShare(text, CUR.sym, lo, hi, PAX)) return m; // "NT$600 each, NT$3,000 for 5" says it already
			return `${amt}${tail}<span class="each-i"> · ${Z(`每人约${eachText(lo, hi)}`, `≈${eachText(lo, hi)} each`)}</span>`;
		})
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const eachLine = (min, max) =>
	`<span class="each">${Z('每人约', 'Each ≈')} <b>${eachText(min, max)}</b> <span class="rm-i" data-rm="${each(min)},${each(max)}">${rmText(each(min), each(max))}</span></span>`;
const ddEach = (v) => {
	const n = numsIn(v);
	return n && n[1] >= 100 ? `<small class="dd-each">${Z('每人', 'each')} ${eachText(n[0], n[1])}</small>` : '';
};
const icon = (n, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const num = (n) => Math.round(n).toLocaleString('en-US');
const rmText = (min, max) => Money.homeText(min, max, rate, CUR.home); // the group's home currency
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

/* Google Maps links */
const gpidOf = (q) => {
	for (const k in PLACES) if (PLACES[k].maps === q) return PLACES[k].gpid || (GEO && GEO.places && GEO.places[k] && GEO.places[k].gpid) || '';
	return '';
};
const gmSearch = (q, pid) => {
	const id = pid || gpidOf(q);
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${id ? `&query_place_id=${id}` : ''}`;
};
const gmDir = (dest, mode = 'transit', origin, destId) =>
	`https://www.google.com/maps/dir/?api=1${origin ? `&origin=${encodeURIComponent(origin)}${gpidOf(origin) ? `&origin_place_id=${gpidOf(origin)}` : ''}` : ''}&destination=${encodeURIComponent(dest)}${destId || gpidOf(dest) ? `&destination_place_id=${destId || gpidOf(dest)}` : ''}&travelmode=${mode}`;
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
	`<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${icon(ic)}${esc(label)}</a>`;
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
	const out = [extI(gmSearch(p.maps), Z('地图', 'Map'), 'pin'), extI(gmDir(p.maps, opts.mode || 'transit'), Z('路线', 'Directions'), 'route')];
	const s = siteFor(pid);
	if (s && !opts.noSite) out.push(extI(s, Z('官网', 'Website'), 'ext'));
	if (!opts.noDriver) out.push(`<button type="button" class="mlink" data-driver="${pid}">${icon('car')}${Z('给司机看', 'Show driver')}</button>`);
	return out.join('');
}
