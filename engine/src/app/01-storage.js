/* ───────── storage (per device) ───────── */
const KEY = Plan.storeKey(TRIP); // TRIP.storageKey, else rj.<start>. (the first trip keeps its tp5.)
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
	// WebKit (every iPhone browser, and Safari) answers yes to overflow-anchor but doesn't hold the scroll position, so
	// sections drawing late there make the page jump; only Chromium-family browsers get section skipping
	const ua = navigator.userAgent;
	const webkit = /iP(hone|ad|od)/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua));
	if (!webkit && CSS.supports('overflow-anchor', 'auto')) document.documentElement.classList.add('cv-ok');
} catch {
	/* old browser: no section skipping */
} // see style.css: content-visibility needs scroll anchoring
let lang = store.get('lang', 'zh') === 'en' ? 'en' : 'zh';
let themePref = ['dark', 'system'].includes(store.get('theme', 'light')) ? store.get('theme') : 'light';
let checks = store.get('checks', {}) || {};
// the trip's own settings (data.js TRIP): group size, currency, the destination's clock, the name on the home screen
const PAX = TRIP.pax;
const CUR = TRIP.currency; // { sym: 'NT$', home: 'RM', rate: 7.8, rateNote: [zh, en] }: the destination's and the group's home currency
const TZ = TRIP.tz;
const BRAND = TRIP.brand;
// the city the trip is in, for "you're not in Taipei yet": the trip's own, else the region pack's
// what the city's metro and bike share are called ("MRT", "YouBike"); `Cap` for the start of a label
const METRO = Pack.metro || ['地铁', 'metro'];
const BIKES = (Pack.bikeShare && Pack.bikeShare.name) || ['共享单车', 'bike share'];
const Cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// the hotels (PLACES ids): one for the trip, or one per night (Plan.hotelsByDay). hotelOf(day) is where the group
// sleeps that night (on the airport evening: where the bags are); hotelNow() is today's, else the first night's
const HOTEL_OF = Plan.hotelsByDay(DAYS, TRIP.hotel);
const HOTELS = [...new Set(Object.values(HOTEL_OF))];
const hotelOf = (dayId) => HOTEL_OF[dayId] || HOTELS[0];
const isHotel = (pid) => HOTELS.includes(pid);
const hotelNow = () => {
	const d = DAYS.find((x) => x.date === tpNow().date);
	return hotelOf(d ? d.id : DAYS[0].id);
};
// the trip's themed shop lists (SHOPLISTS: snowboard gear, tea, anime…), each with its heading, ideas group, pin kind,
// icon and photo; a trip written with the older single SNOW list gets it as the list with id 'snow'
const SHOPLISTS_ = (typeof SHOPLISTS !== 'undefined' ? SHOPLISTS : typeof SNOW !== 'undefined' ? [{ id: 'snow', ...SNOW }] : []).map((l) => ({
	h: ['商店', 'Shops'],
	group: ['商店', 'Shops'],
	kind: ['商店', 'Shop'],
	icon: 'bag',
	photo: '',
	shops: [],
	checks: [],
	...l,
}));
const ALL_SHOPS = SHOPLISTS_.flatMap((l) => l.shops.map((s) => ({ ...s, list: l })));
const shopListOf = (pid) => (ALL_SHOPS.find((s) => s.place === pid) || {}).list;
// the build's output name (TRIP.fileName), for the My Maps download
const FILE_BASE = TRIP.fileName || 'trip';
const CITY = TRIP.city || Pack.city || ['目的地', 'the destination'];
let rate = Number(store.get('rate', CUR.rate)) || CUR.rate;

const GEO = window.GEO || null;
const EXTRA = window.EXTRA || { food: [], tickets: [], sites: {} };
const CREDITS = window.CREDITS || [];
const WISH = (window.WISH || []).filter((w) => w && w.branches && w.branches.length);
let IMG = window.IMG || null; // standalone: photos sit in #img-data at the very end, read after the plan is on screen
const IMG_LATE = document.body.dataset.imgLate === '1';
const SHARE_URL = window.SHARE_URL || '';
const credit = Object.fromEntries(CREDITS.map((c) => [c.id, c]));
