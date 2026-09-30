/* ───────── storage (per device) ───────── */
const KEY = 'tp5.';
const store = {
	get(k, d) {
		try {
			const v = localStorage.getItem(KEY + k);
			return v == null ? d : JSON.parse(v);
		} catch {
			return d;
		}
	},
	set(k, v) {
		try {
			localStorage.setItem(KEY + k, JSON.stringify(v));
		} catch {
			/* storage blocked */
		}
	},
};

try {
	if (CSS.supports('overflow-anchor', 'auto')) document.documentElement.classList.add('cv-ok');
} catch {
	/* old browser: no section skipping */
} // see style.css: content-visibility needs scroll anchoring
let lang = store.get('lang', 'zh') === 'en' ? 'en' : 'zh';
let themePref = ['dark', 'system'].includes(store.get('theme', 'light')) ? store.get('theme') : 'light';
let checks = store.get('checks', {}) || {};
// the trip's own settings (data.js TRIP): group size, currency, the destination's clock, the name on the home screen
const PAX = TRIP.pax;
const CUR = TRIP.currency; // { sym: 'NT$', home: 'RM', rate: 7.8, rateNote: [zh, en] }
const TZ = TRIP.tz;
const BRAND = TRIP.brand;
let rate = Number(store.get('rate', CUR.rate)) || CUR.rate;

const GEO = window.GEO || null;
const EXTRA = window.EXTRA || { food: [], tickets: [], sites: {} };
const CREDITS = window.CREDITS || [];
const WISH = (window.WISH || []).filter((w) => w && w.branches && w.branches.length);
let IMG = window.IMG || null; // standalone: photos sit in #img-data at the very end, read after the plan is on screen
const IMG_LATE = document.body.dataset.imgLate === '1';
const SHARE_URL = window.SHARE_URL || '';
const credit = Object.fromEntries(CREDITS.map((c) => [c.id, c]));
