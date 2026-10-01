// Group sync's rules (ADR-20261001-group-sync). Pure; wrapped as `Sync` inside the page script.
//  - What a phone shares is a set of records: an added stop, a day's pushed-back times, a changed flight time, a tick in
//    a shared checklist group. Everything else (the language, the packing list, the rate…) stays on the phone.
//  - A change is one record's new value, or null when it's gone. Every phone keeps the newest version of each record:
//    the later edit, and on a tie the larger device id, so all phones pick the same one.
//  - What comes from another phone is checked like a pasted share link: the wrong shape is dropped, long text is cut.

/** the saved-state keys that hold shared records */
export const KEYS = ['mine', 'shift', 'fltArr', 'fltDep', 'checks'];

/**
 * The records a phone's state shares, by record id. state = { mine, shift, fltArr, fltDep, checks } as the page saves
 * them; shared(key) says whether a checklist key is in a shared group.
 */
export function recordsOf(state, shared) {
	const out = {};
	for (const s of Array.isArray(state.mine) ? state.mine : []) if (s && s.id) out[`stop:${s.id}`] = s;
	for (const [date, list] of Object.entries(state.shift || {})) if (Array.isArray(list) && list.length) out[`shift:${date}`] = list;
	if (state.fltArr) out['flt:arr'] = state.fltArr;
	if (state.fltDep) out['flt:dep'] = state.fltDep;
	for (const [k, on] of Object.entries(state.checks || {})) if (on && shared(k)) out[`tick:${k}`] = true;
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
const CLOCK = /^\d{1,2}:\d{2}$/;
const text = (s, n) => String(s ?? '').slice(0, n);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

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
		};
	}
	if (kind === 'shift') {
		if (!DATE.test(id) || !Array.isArray(v)) return undefined;
		const list = v.filter((x) => x && num(x.from) != null && num(x.min) > 0).map((x) => ({ from: x.from, min: x.min }));
		return list.length ? list.slice(0, 20) : null;
	}
	if (kind === 'flt') return (id === 'arr' || id === 'dep') && typeof v === 'string' && CLOCK.test(v) ? v : undefined;
	if (kind === 'tick') return v === true && /^[\w-]{1,80}$/.test(id) ? true : undefined;
	return undefined;
}

/**
 * The state with records put back where the page keeps them. recs = [[record id, value or null]], already cleaned;
 * a tick outside a shared group is left alone. Returns a new state; the input isn't changed.
 */
export function applyRecords(state, recs, shared) {
	const next = {
		mine: [...(Array.isArray(state.mine) ? state.mine : [])],
		shift: { ...(state.shift || {}) },
		fltArr: state.fltArr || '',
		fltDep: state.fltDep || '',
		checks: { ...(state.checks || {}) },
	};
	for (const [rid, v] of recs) {
		const [kind, ...rest] = String(rid).split(':');
		const id = rest.join(':');
		if (kind === 'stop') {
			next.mine = next.mine.filter((s) => s && s.id !== id);
			if (v) next.mine.push(v);
		} else if (kind === 'shift') {
			if (v) next.shift[id] = v;
			else delete next.shift[id];
		} else if (kind === 'flt') {
			next[id === 'arr' ? 'fltArr' : 'fltDep'] = v || '';
		} else if (kind === 'tick' && shared(id)) {
			if (v) next.checks[id] = true;
			else delete next.checks[id];
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
 * changes that lost and won't be sent }.
 */
export function merge(known, pending, remote) {
	const apply = [];
	const drop = [];
	for (const [rid, r] of Object.entries(remote)) {
		const mine = pending[rid] || known[rid];
		if (mine && mine.u === r.u && mine.d === r.d) continue; // this very version: ours coming back, or seen already
		if (!newer(r, mine)) continue;
		apply.push([rid, r.v, { u: r.u, d: r.d, n: r.n }]);
		if (pending[rid]) drop.push(rid);
	}
	return { apply, drop };
}
