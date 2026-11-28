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
	del(k) {
		try {
			localStorage.removeItem(KEY + k);
		} catch {
			/* storage blocked */
		}
	},
};

// repeated hints (Plan.hintForm): what this phone has seen of each, in store 'hints' ({ id: 'seen' | 'gone' }), never
// synced. hint(id) says how to draw it now and records the first showing; hintGone(id) is its ✕
const HINT_FULL = new Set();
function hint(id) {
	const all = store.get('hints', {}) || {};
	const form = Plan.hintForm(all[id], HINT_FULL.has(id));
	if (form === 'full' && !HINT_FULL.has(id)) {
		HINT_FULL.add(id);
		if (!all[id]) store.set('hints', { ...all, [id]: 'seen' });
	}
	return form;
}
const hintState = (id) => (store.get('hints', {}) || {})[id] || 'new';
const hintGone = (id) => store.set('hints', { ...(store.get('hints', {}) || {}), [id]: 'gone' });

try {
	// WebKit (every iPhone browser, and Safari) answers yes to overflow-anchor but doesn't hold the scroll position, so
	// sections drawing late there make the page jump; only Chromium-family browsers get section skipping
	const ua = navigator.userAgent;
	const webkit = /iP(hone|ad|od)/.test(ua) || (/AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua));
	if (!webkit && CSS.supports('overflow-anchor', 'auto')) document.documentElement.classList.add('cv-ok');
} catch {
	/* old browser: no section skipping */
} // see style.css: content-visibility needs scroll anchoring
// what a page built with --preview looks at instead (its planner's panel, engine/src/preview/): another sky, weather,
// snow on or off, a clock. Never saved, never synced, and nothing sets it in a page built without the flag
const LOOK = { sky: null, wx: null, snow: null, clock: null };
// the live demo (build --demo-clock) greets its visitors, who come from an English landing page, in English
let lang = store.get('lang', window.DEMO_CLOCK ? 'en' : 'zh') === 'en' ? 'en' : 'zh';
// the page follows the phone's light or dark setting until the reader picks one (the theme button, or Theme in the Sections
// menu on a phone); a choice made before this default stays as it was
let themePref = ['light', 'dark'].includes(store.get('theme', 'system')) ? store.get('theme') : 'system';
// which app a Map or Directions link opens, chosen per phone in the Sections menu (Google unless the phone picked Apple)
let mapsApp = store.get('maps', 'google') === 'apple' ? 'apple' : 'google';
let checks = store.get('checks', {}) || {};
// group sync (ADR-20261001-group-sync): on when the build put the trip's database in (pnpm build --sync). Then added
// stops, pushed-back times, flight changes and the ticks of checklist groups marked `shared` reach everyone's phone
// (26-sync.js); everything else stays on this one. syncStatus is what the page says about it, set by 26-sync.js
const SYNC = window.SYNC || null;
const SHARED_GROUPS = SYNC ? (typeof CHECKLIST !== 'undefined' ? CHECKLIST : []).filter((g) => g && g.shared).map((g) => g.id) : [];
const sharedTick = (key) => SHARED_GROUPS.some((g) => String(key).startsWith(`${g}-`));
let syncStatus = { state: SYNC ? 'starting' : 'off', at: 0, waiting: 0 };
// an approval trip (ADR-20261127-sync-approval): each device signs in, asks to join, and syncs only once a planner let it
// in. syncGate is what 26-sync.js last read: this device's state (none: hasn't asked, pending, approved, blocked), the
// join code it shows, and for a planner the join requests, each device's person and its user id
const SYNC_GATE = !!(SYNC && SYNC.approval);
let syncGate = { state: 'none', code: '', requests: [], persons: {}, uidOf: {} };
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
// the rate (one home unit in the trip's currency): the trip's, until this phone sets its own (the budget or the Sections
// menu; "use the trip's rate" forgets it again, so a republished rate reaches the phone)
let rate = Number(store.get('rate', CUR.rate)) || CUR.rate;
// which currency the figures lead with, kept on this phone and never synced: the trip's (¥, NT$…) or the group's home
// currency (the header's currency button and the Sections menu). Only when the trip has a home currency of its own
const CUR_SWITCH = Money.canSwitch(CUR);
let homeFirst = CUR_SWITCH && store.get('amounts', 'trip') === 'home';

const GEO = window.GEO || null;
const EXTRA = window.EXTRA || { food: [], tickets: [], sites: {} };
const CREDITS = window.CREDITS || [];
const WORLD_ART = window.WORLD_ART || {}; // a destination world's illustrations, by DAYS[i].motif and 'hero' (build.mjs)
const WORLD_ACTORS = window.WORLD_ACTORS || {}; // their moving parts, each { part, src, box: [left, top, width, height] % }
const WISH = (window.WISH || []).filter((w) => w && w.branches && w.branches.length);
let IMG = window.IMG || null; // standalone: photos sit in #img-data at the very end, read after the plan is on screen
const IMG_LATE = document.body.dataset.imgLate === '1';
const SHARE_URL = window.SHARE_URL || '';
const credit = Object.fromEntries(CREDITS.map((c) => [c.id, c]));
