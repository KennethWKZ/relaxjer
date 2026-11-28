// Group sync's rules (ADR-20261001-group-sync). Pure; wrapped as `Sync` inside the page script.
//  - What a phone shares is a set of records: an added stop, a skipped planned stop (ADR-20261128-skip-planned-stops), a
//    day's moved times, a changed flight time, a tick in a shared checklist group, the name a phone goes by, what kind of
//    device it is, and who the planners are (ADR-20261002-sync-planners).
//    Everything else (the language, the packing list, the rate…) stays on the phone.
//  - A change is one record's new value, or null when it's gone. Every phone keeps the newest version of each record:
//    the later edit, and on a tie the larger device id, so all phones pick the same one.
//  - What comes from another phone is checked like a pasted share link: the wrong shape is dropped, long text is cut.

/** the saved-state keys that hold shared records */
export const KEYS = ['mine', 'skips', 'shift', 'fltArr', 'fltDep', 'checks', 'people', 'roles', 'blocks', 'kits'];

/**
 * The records a phone's state shares, by record id. state = { mine, shift, fltArr, fltDep, checks, people, roles } as
 * the page saves them (people = { device id: name }, roles = { device id: 'planner' }, blocks = { device id: true },
 * kits = { device id: 'iphone/app' }, see deviceKind; skips = { stop key: { by, dev, at, pull } }, see cleanSkip);
 * shared(key) says whether a
 * checklist key is in a shared group.
 */
export function recordsOf(state, shared) {
	const out = {};
	for (const s of Array.isArray(state.mine) ? state.mine : []) if (s && s.id) out[`stop:${s.id}`] = s;
	for (const [k, s] of Object.entries(state.skips || {})) if (s && SKIP_ID.test(k)) out[`skip:${k}`] = cleanSkip(s);
	for (const [date, list] of Object.entries(state.shift || {})) if (Array.isArray(list) && list.length) out[`shift:${date}`] = list;
	if (state.fltArr) out['flt:arr'] = state.fltArr;
	if (state.fltDep) out['flt:dep'] = state.fltDep;
	for (const [k, on] of Object.entries(state.checks || {})) if (on && shared(k)) out[`tick:${k}`] = true;
	for (const [dev, name] of Object.entries(state.people || {})) if (name) out[`who:${dev}`] = name;
	for (const [dev, role] of Object.entries(state.roles || {})) if (role === 'planner') out[`role:${dev}`] = role;
	for (const [dev, on] of Object.entries(state.blocks || {})) if (on === true) out[`block:${dev}`] = true;
	for (const [dev, kit] of Object.entries(state.kits || {})) if (KIT.test(String(kit))) out[`kit:${dev}`] = kit;
	return out;
}

/** a value as text with its keys sorted, so two copies of the same record compare equal however they were built */
export const canon = (v) =>
	v && typeof v === 'object'
		? Array.isArray(v)
			? `[${v.map(canon).join(',')}]`
			: `{${Object.keys(v)
					.sort()
					.map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
					.join(',')}}`
		: JSON.stringify(v ?? null);

/** [record id, new value or null] for every record that differs between two record sets */
export function changes(before, after) {
	const out = [];
	for (const [rid, v] of Object.entries(after)) if (!(rid in before) || canon(before[rid]) !== canon(v)) out.push([rid, v]);
	for (const rid of Object.keys(before)) if (!(rid in after)) out.push([rid, null]);
	return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEV = /^[A-Za-z0-9_-]{6,24}$/;
/** the kinds of device a phone can say it is: the system, then how the page is open (deviceKind) */
export const KIT_OS = ['iphone', 'ipad', 'android', 'huawei', 'mac', 'windows', 'chromebook', 'linux', 'other'];
export const KIT_APP = ['app', 'safari', 'chrome', 'firefox', 'edge', 'samsung', 'huawei', 'oppo', 'xiaomi', 'vivo', 'wechat', 'other'];
const KIT = new RegExp(`^(${KIT_OS.join('|')})/(${KIT_APP.join('|')})$`);
const CLOCK = /^\d{1,2}:\d{2}$/;
const text = (s, n) => String(s ?? '').slice(0, n);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
// a skipped planned stop's key (Plan.SKIP_KEY): its day, its fingerprint, the -N of a repeated stop
const SKIP_ID = /^d\d{1,3}-[a-z0-9]{1,8}(?:-\d{1,2})?$/;
/**
 * A skip as it travels: who skipped it (by: the name, dev: the phone), when (at), and the move earlier the group took
 * for it (pull: { from: the planned start the move begins at, min }), so putting it back moves those stops back too.
 * Anything else is dropped; a skip with nothing known is still a skip ({}).
 */
export function cleanSkip(v) {
	const o = v && typeof v === 'object' ? v : {};
	const from = num(o.pull && o.pull.from);
	const min = num(o.pull && o.pull.min);
	return {
		...(typeof o.by === 'string' && o.by.trim() ? { by: text(o.by.trim(), 24) } : {}),
		...(typeof o.dev === 'string' && DEV.test(o.dev) ? { dev: o.dev } : {}),
		...(num(o.at) > 0 ? { at: o.at } : {}),
		...(from != null && from >= 0 && from < 2880 && min > 0 && min <= 600 ? { pull: { from, min } } : {}),
	};
}

/** A record from another phone in the shape the page saves, or undefined when it doesn't fit (it's then ignored). */
export function cleanRecord(rid, v) {
	if (v === null) return null; // removed
	const [kind, ...rest] = String(rid).split(':');
	const id = rest.join(':');
	if (kind === 'stop') {
		if (!v || typeof v !== 'object' || v.id !== id || !/^[\w-]{1,40}$/.test(id) || !/^d\d{1,2}$/.test(v.day) || !CLOCK.test(v.t)) return undefined;
		const lat = num(v.lat);
		const lng = num(v.lng);
		if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
		return {
			id,
			day: v.day,
			t: v.t,
			name: text(v.name, 80),
			q: text(v.q || v.name, 120),
			lat,
			lng,
			gpid: v.gpid ? text(v.gpid, 120) : null,
			addr: text(v.addr, 120),
			...(typeof v.by === 'string' && v.by.trim() ? { by: text(v.by.trim(), 24) } : {}), // who added it
			...(typeof v.dev === 'string' && DEV.test(v.dev) ? { dev: v.dev } : {}), // the phone that added it
		};
	}
	if (kind === 'skip') return SKIP_ID.test(id) && v && typeof v === 'object' && !Array.isArray(v) ? cleanSkip(v) : undefined;
	if (kind === 'shift') {
		if (!DATE.test(id) || !Array.isArray(v)) return undefined;
		// a push back (min > 0) or, after a skipped stop, a pull earlier (min < 0); a phone on an older build keeps only the pushes
		const ok = (m) => m != null && m !== 0 && Math.abs(m) <= 1440;
		const list = v.filter((x) => x && num(x.from) != null && ok(num(x.min))).map((x) => ({ from: x.from, min: x.min }));
		return list.length ? list.slice(0, 20) : null;
	}
	if (kind === 'flt') return (id === 'arr' || id === 'dep') && typeof v === 'string' && CLOCK.test(v) ? v : undefined;
	if (kind === 'tick') return v === true && /^[\w-]{1,80}$/.test(id) ? true : undefined;
	if (kind === 'who') return DEV.test(id) && typeof v === 'string' && v.trim() ? text(v.trim(), 24) : undefined;
	if (kind === 'role') return DEV.test(id) && v === 'planner' ? v : undefined;
	if (kind === 'block') return DEV.test(id) && v === true ? true : undefined;
	if (kind === 'kit') return DEV.test(id) && typeof v === 'string' && KIT.test(v) ? v : undefined;
	return undefined;
}

/**
 * The state with records put back where the page keeps them. recs = [[record id, value or null]], already cleaned;
 * a tick outside a shared group is left alone. Returns a new state; the input isn't changed.
 */
export function applyRecords(state, recs, shared) {
	const next = {
		mine: [...(Array.isArray(state.mine) ? state.mine : [])],
		skips: { ...(state.skips || {}) },
		shift: { ...(state.shift || {}) },
		fltArr: state.fltArr || '',
		fltDep: state.fltDep || '',
		checks: { ...(state.checks || {}) },
		people: { ...(state.people || {}) },
		roles: { ...(state.roles || {}) },
		blocks: { ...(state.blocks || {}) },
		kits: { ...(state.kits || {}) },
	};
	for (const [rid, v] of recs) {
		const [kind, ...rest] = String(rid).split(':');
		const id = rest.join(':');
		if (kind === 'stop') {
			next.mine = next.mine.filter((s) => s && s.id !== id);
			if (v) next.mine.push(v);
		} else if (kind === 'skip') {
			if (v) next.skips[id] = v;
			else delete next.skips[id];
		} else if (kind === 'shift') {
			if (v) next.shift[id] = v;
			else delete next.shift[id];
		} else if (kind === 'flt') {
			next[id === 'arr' ? 'fltArr' : 'fltDep'] = v || '';
		} else if (kind === 'tick' && shared(id)) {
			if (v) next.checks[id] = true;
			else delete next.checks[id];
		} else if (kind === 'who' || kind === 'role' || kind === 'block' || kind === 'kit') {
			const box = { who: next.people, role: next.roles, block: next.blocks, kit: next.kits }[kind];
			if (v) box[id] = v;
			else delete box[id];
		}
	}
	// stops in the order they were added (their ids start with the time they were made), whichever phone sent them
	next.mine.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return next;
}

/** does version a ({ u: edit time, d: device id }) beat version b? A missing b always loses */
export const newer = (a, b) => !b || a.u > b.u || (a.u === b.u && a.d > b.d);

/**
 * What to do with records that came from the group. known = { record id: { u, d } } (versions this phone has),
 * pending = { record id: { v, u, d } } (its own changes not yet sent), remote = { record id: { v, u, d, n } }.
 * Returns { apply: [[record id, value, version]] the newer ones to put into the state, drop: [record id] its own pending
 * changes that lost, or that are in the database already, and won't be sent }.
 */
export function merge(known, pending, remote) {
	const apply = [];
	const drop = [];
	for (const [rid, r] of Object.entries(remote)) {
		const mine = pending[rid] || known[rid];
		if (mine && mine.u === r.u && mine.d === r.d) {
			// this very version: seen already, or ours in the database. A send that landed while the phone never heard back
			// (the page closed, the line dropped) is sent no more: the rules refuse the same version twice, and a send is all
			// or nothing, so it took every change after it down too
			if (pending[rid]) drop.push(rid);
			continue;
		}
		if (!newer(r, mine)) continue;
		apply.push([rid, r.v, { u: r.u, d: r.d, n: r.n }]);
		if (pending[rid]) drop.push(rid);
	}
	return { apply, drop };
}

/** a person's name as the page compares it: "  Ken  Lee " and "ken lee" are the same name */
export const nameKey = (s) =>
	String(s ?? '')
		.normalize('NFKC')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();

/** PBKDF2-SHA-256 rounds for the trip's planner code: the CLI hashes with it, the page checks with it */
export const PLANNER_ROUNDS = 210000;

/**
 * Which phone added a stop: the one the stop names (`dev`), else the one that wrote its newest version (stops from
 * before the field), else this phone (no version yet means it was made here, before sync heard of it).
 */
export const ownerOf = (stop, ver, me) => (stop && stop.dev) || (ver && ver.d) || me || null;

/**
 * The phone's list of stops that went from the plan, newest first, so one removed by mistake can be put back.
 * log = [{ x: stop, at, by, me }]; before/after = the added stops either side of a change; who = { at, by, me }.
 * A stop back in the plan leaves the list; the list keeps `cap` entries. Skipped planned stops share the list (skipLog);
 * their entries ({ s: key, … }) pass through untouched.
 */
export function goneLog(log, before, after, who, cap = 30) {
	const now = new Set((after || []).map((s) => s && s.id));
	const gone = (before || []).filter((s) => s && s.id && !now.has(s.id));
	const kept = (Array.isArray(log) ? log : []).filter((e) => e && ((e.s && !e.x) || (e.x && !now.has(e.x.id) && !gone.some((s) => s.id === e.x.id))));
	return [...gone.map((x) => ({ x, ...who })), ...kept].slice(0, cap);
}

/**
 * The same list for skipped planned stops (ADR-20261128-skip-planned-stops): each stop skipped in a change goes on it
 * as { s: its key, at, by, me }, newest first, named by who the skip says skipped it (else who); a stop put back leaves
 * it. before/after = the skips either side of a change ({ key: skip }); a skip rewritten (a move earlier added to it)
 * isn't new. Added stops' entries pass through untouched.
 */
export function skipLog(log, before, after, who, cap = 30) {
	const b = before || {};
	const a = after || {};
	const fresh = Object.keys(a).filter((k) => a[k] && !b[k]);
	const kept = (Array.isArray(log) ? log : []).filter((e) => e && (e.x || (e.s && a[e.s] && !fresh.includes(e.s))));
	const add = fresh.map((s) => ({ s, ...who, ...(a[s].by ? { by: a[s].by } : {}) }));
	return [...add, ...kept].slice(0, cap);
}

/**
 * The added stops grouped by the phone that added them, for "who added what": [{ dev, by, ids }], the most first.
 * by = the newest name on that phone's stops ('' when none gave one), unless people (device id → name) knows the
 * phone; verOf(id) = the stop's newest version.
 */
export function byPhone(stops, verOf, me, people = {}) {
	const m = new Map();
	for (const s of stops || []) {
		if (!s || !s.id) continue;
		const dev = ownerOf(s, verOf(s.id), me);
		const g = m.get(dev) || { dev, by: '', ids: [] };
		g.ids.push(s.id);
		if (s.by) g.by = s.by;
		m.set(dev, g);
	}
	for (const g of m.values()) if (people[g.dev]) g.by = people[g.dev];
	return [...m.values()].sort((a, b) => b.ids.length - a.ids.length || (a.by < b.by ? -1 : 1));
}

/**
 * What came from the group, without what blocked phones wrote (ADR-20261002-sync-planners): a planner's block (or
 * unblock) in the same read counts first, and a blocked phone's own records, its blocks included, are dropped.
 * remote = { record id: { v, u, d, n } }, blocks = { device id: true }. Returns { remote, blocks }, both new.
 */
export function dropBlocked(remote, blocks) {
	const b = { ...(blocks || {}) };
	for (const [rid, r] of Object.entries(remote || {}))
		if (rid.startsWith('block:') && r && !b[r.d]) {
			const id = rid.slice(6);
			if (r.v === true) b[id] = true;
			else delete b[id];
		}
	const kept = {};
	for (const [rid, r] of Object.entries(remote || {})) if (r && !b[r.d]) kept[rid] = r;
	return { remote: kept, blocks: b };
}

/**
 * What kind of device the page runs on, as 'system/how it is open' (KIT_OS/KIT_APP), so the group can tell one
 * person's phone, tablet and laptop apart. Only the kind, never the browser's full description. nav = { ua, standalone
 * (opened from the home screen), touch (navigator.maxTouchPoints) }.
 */
export function deviceKind({ ua = '', standalone = false, touch = 0 } = {}) {
	const u = String(ua);
	const os =
		/iPad/.test(u) || (/Macintosh/.test(u) && touch > 1)
			? 'ipad'
			: /iPhone|iPod/.test(u)
				? 'iphone'
				: /OpenHarmony|HarmonyOS|HUAWEI|Huawei/.test(u) // HarmonyOS NEXT says OpenHarmony; older Huawei phones say Android too
					? 'huawei'
					: /Android/.test(u)
						? 'android'
						: /CrOS/.test(u)
							? 'chromebook'
							: /Macintosh|Mac OS X/.test(u)
								? 'mac'
								: /Windows/.test(u)
									? 'windows'
									: /Linux/.test(u)
										? 'linux'
										: 'other';
	const ios = os === 'iphone' || os === 'ipad';
	// the first that matches: an app inside another (WeChat) or the home screen, then browsers that also say Chrome or
	// Safari (a phone maker's own, Edge, Firefox), then Chrome, then Safari
	const APPS = [
		[/MicroMessenger/, 'wechat'],
		[() => standalone, 'app'],
		[/SamsungBrowser/, 'samsung'],
		[/HuaweiBrowser/, 'huawei'],
		[/HeyTapBrowser|OppoBrowser/, 'oppo'],
		[/MiuiBrowser|XiaoMi\//, 'xiaomi'],
		[/VivoBrowser/, 'vivo'],
		[/EdgiOS|EdgA|Edg\//, 'edge'],
		[/FxiOS|Firefox\//, 'firefox'],
		[/CriOS/, 'chrome'],
		[() => !ios && /Chrome\//.test(u) && !/OPR\//.test(u), 'chrome'],
		[() => (ios || os === 'mac') && /Safari\//.test(u), 'safari'],
	];
	const hit = APPS.find(([t]) => (typeof t === 'function' ? t() : t.test(u)));
	const app = hit ? hit[1] : 'other';
	return `${os}/${app}`;
}

/**
 * "The group", one entry per person: devices that go by the same name (nameKey) are one person's, the way the group
 * reads it; devices with no name stay one each. A blocked device leaves its person and goes on the blocked list.
 * Roles and blocks stay per device (a name proves nothing). devs = device ids in the order to show; people = { device
 * id: name }; me = this device. Returns { people: [{ key, name, devs }], blocked: [device id] }; this device's person
 * comes first, this device first among its person's, and a person goes by the name on their first device. On an
 * approval trip, persons = { device id: person id } groups them instead of the names (ADR-20261127-sync-approval).
 */
export function byPerson(devs, people = {}, blocks = {}, me = null, persons = null) {
	const out = new Map();
	const blocked = [];
	for (const dev of devs || []) {
		if (blocks[dev]) {
			blocked.push(dev);
			continue;
		}
		const name = people[dev] || '';
		// on an approval trip a planner set each device's person (persons = { device id: person id }); a name proves nothing
		const key = persons ? `person:${persons[dev] || dev}` : nameKey(name) || `dev:${dev}`;
		const p = out.get(key) || { key, name, devs: [] };
		p.devs.push(dev);
		if (dev === me) p.devs.unshift(p.devs.pop()); // this device first among its person's
		out.set(key, p);
	}
	const list = [...out.values()].map((p) => ({ ...p, name: String(people[p.devs[0]] || '').trim() }));
	const mine = list.findIndex((p) => p.devs.includes(me));
	if (mine > 0) list.unshift(...list.splice(mine, 1));
	return { people: list, blocked };
}

/**
 * "While you were away" (ADR-20261127-while-away): the group's changes a phone took in when it opened the page or came
 * back to it, kept until the reader says they've seen them. log and adds are [{ r: record id, u: edit time, d: device,
 * n: name, t: [zh, en] what it did, day }]. One entry per record, the newest version winning as in `merge`; newest
 * first; at most `cap`. An entry without a record id, a time or the words to show is dropped.
 */
export function awayLog(log, adds, cap = 30) {
	const ok = (e) => e && typeof e.r === 'string' && typeof e.u === 'number' && Array.isArray(e.t) && e.t.length === 2;
	const m = new Map();
	for (const e of [...(Array.isArray(log) ? log : []), ...(Array.isArray(adds) ? adds : [])].filter(ok)) {
		const o = m.get(e.r);
		if (!o || newer(e, o)) m.set(e.r, e);
	}
	return [...m.values()].sort((a, b) => b.u - a.u || (a.d < b.d ? 1 : -1)).slice(0, cap);
}

/* ───────── approval trips (ADR-20261127-sync-approval) ─────────
   Each device signs in to Firebase anonymously and asks to join under devices/<uid>: its name (sealed with the trip's
   key, so the database never reads it), its kind, its sync id and a join code it shows. A planner approves it, as a
   person of the group, or blocks it; the database rules refuse records from anything else. Who is in the group, who
   is a planner and who is blocked come from those entries, so the page no longer sends who:, role:, block: or kit:
   records there (the CLI reads the same entries: scripts/sync/sync.mjs). */

/** the record kinds a token trip shares and an approval trip keeps in devices/ and planners/ instead */
export const GATED_KINDS = ['who', 'role', 'block', 'kit'];
/** records without the gated kinds (an approval trip neither sends nor takes them) */
export function ungated(recs) {
	const out = {};
	for (const [rid, v] of Object.entries(recs || {})) if (!GATED_KINDS.includes(String(rid).split(':')[0])) out[rid] = v;
	return out;
}
/** a device's sync id on an approval trip: its user id's first 24 characters, so no device can take another's */
export const devOfUid = (uid) => (typeof uid === 'string' && /^[A-Za-z0-9]{20,128}$/.test(uid) ? uid.slice(0, 24) : null);
/** the join code a device shows while it waits: 4 digits from 2 random bytes */
export const joinCode = (bytes) => String((((bytes && bytes[0]) || 0) * 256 + ((bytes && bytes[1]) || 0)) % 10000).padStart(4, '0');

const b64u = (u8) =>
	btoa(String.fromCharCode(...u8))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
/** the AES-GCM key records and names are sealed with, from the trip's sync key, as the page has always derived it */
export const recordKey = async (syncKey) => {
	const raw = await crypto.subtle.importKey('raw', unb64u(syncKey), 'HKDF', false, ['deriveKey']);
	const info = new TextEncoder().encode('relaxjer sync record');
	return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info }, raw, { name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt',
	]);
};
// a name is bound to its trip and device, so a sealed name copied to another entry doesn't open
const nameAad = (trip, uid) => new TextEncoder().encode(`${trip}/dev/${uid}`);
/** a device's name sealed for its entry: "iv.ciphertext", base64url */
export const sealName = async (key, trip, uid, name) => {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: nameAad(trip, uid) }, key, new TextEncoder().encode(text(name, 24)));
	return `${b64u(iv)}.${b64u(new Uint8Array(ct))}`;
};
/** the name in a device's entry; '' when it doesn't open (another trip's, or damaged) */
export const openName = async (key, trip, uid, sealed) => {
	try {
		const [iv, ct] = String(sealed).split('.');
		const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv), additionalData: nameAad(trip, uid) }, key, unb64u(ct));
		return text(new TextDecoder().decode(pt).trim(), 24);
	} catch {
		return '';
	}
};

/**
 * The group as an approval trip's database holds it. devices = { uid: entry }, planners = { uid: true }, names = { uid:
 * opened name }. Returns the page's own maps by sync id (people, roles, blocks, kits, persons), uidOf (sync id → uid),
 * and the join requests waiting for a planner, oldest first: [{ uid, dev, name, kind, code, at }]. An entry that
 * doesn't fit is left out.
 */
export function groupOf(devices, planners, names = {}) {
	const out = { people: {}, roles: {}, blocks: {}, kits: {}, persons: {}, uidOf: {}, requests: [] };
	for (const [uid, e] of Object.entries(devices && typeof devices === 'object' ? devices : {})) {
		if (!e || typeof e !== 'object' || typeof e.dev !== 'string' || devOfUid(uid) !== e.dev) continue;
		const kind = KIT.test(String(e.kind)) ? e.kind : '';
		const name = text(names[uid], 24);
		if (e.state === 'pending') {
			out.requests.push({ uid, dev: e.dev, name, kind, code: /^[0-9]{4,8}$/.test(String(e.code)) ? e.code : '', at: num(e.at) || 0 });
			continue;
		}
		if (e.state !== 'approved' && e.state !== 'blocked') continue;
		out.uidOf[e.dev] = uid;
		if (name) out.people[e.dev] = name;
		if (kind) out.kits[e.dev] = kind;
		out.persons[e.dev] = typeof e.person === 'string' && DEV.test(e.person) ? e.person : e.dev;
		if (e.state === 'blocked') out.blocks[e.dev] = true;
		else if (planners && planners[uid] === true) out.roles[e.dev] = 'planner';
	}
	out.requests.sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1));
	return out;
}

/**
 * The approved, unblocked devices whose name matches a join request's, so the planner sees "Same person as Mei
 * (iPhone)": [{ dev, person, name }], one per person, in the order of devs. group = groupOf's result.
 */
export function samePerson(name, group, devs = Object.keys(group.people || {})) {
	const k = nameKey(name);
	const seen = new Set();
	const out = [];
	if (!k) return out;
	for (const dev of devs) {
		const p = group.persons[dev];
		if (!p || group.blocks[dev] || seen.has(p) || nameKey(group.people[dev]) !== k) continue;
		seen.add(p);
		out.push({ dev, person: p, name: group.people[dev] });
	}
	return out;
}

/**
 * The database writes for a planner's choice on a device (paths under trips/<trip>), so the page and the CLI write the
 * same thing. uid = the device's user id, dev = its sync id. act:
 *  - 'approve': person = an existing person's id (else its own), sealed = a new sealed name, planner = make it one too;
 *  - 'block' (its planner role goes with it), 'unblock';
 *  - 'planner': on = true or false;
 *  - 'rename': sealed; 'move': person, and sealed when the name changes with it.
 */
export function approvalWrites(act, { uid, dev, person, sealed, planner, on } = {}) {
	const at = (f) => `devices/${uid}/${f}`;
	if (act === 'approve')
		return {
			[at('state')]: 'approved',
			[at('person')]: person || dev,
			...(sealed ? { [at('name')]: sealed } : {}),
			...(planner ? { [`planners/${uid}`]: true } : {}),
		};
	if (act === 'block') return { [at('state')]: 'blocked', [`planners/${uid}`]: null };
	if (act === 'unblock') return { [at('state')]: 'approved' };
	if (act === 'planner') return { [`planners/${uid}`]: on ? true : null };
	if (act === 'rename') return { [at('name')]: sealed };
	if (act === 'move') return { [at('person')]: person, ...(sealed ? { [at('name')]: sealed } : {}) };
	throw new Error(`unknown act ${act}`);
}
