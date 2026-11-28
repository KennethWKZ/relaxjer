// The rules a trip's data must follow before the engine can render it. Used by tests/contract on the demo trip, and
// meant for any trip (TRIP_DIR=… pnpm test) and later for the trip-intake skill's output. Shape: legacy data.js ("v0").
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { names as MOTIFS } from '../../engine/src/core/motif.mjs';
import { stopKinds as STOP_ICONS } from '../../engine/src/core/plan.mjs';
import { MODES as SKIES } from '../../engine/src/core/sky.mjs';
import { paceProblem } from '../../engine/src/core/way.mjs';
import { fitMealProblems } from '../../engine/src/core/wish.mjs';

// read when present: the themed shop lists (SNOW is the older single-list form)
export const OPTIONAL_GLOBALS = ['SHOPLISTS', 'SNOW', 'INSURANCE'];
export const REQUIRED = [
	'TRIP',
	'PLACES',
	'SITES',
	'FACTS',
	'BACKUPS',
	'DAYS',
	'OPTIONAL',
	'BUDGET',
	'MONEY',
	'WEATHER',
	'TAX',
	'FLIGHTS',
	'CHECKLIST',
	'PRIORITIES',
	'PRINCIPLE',
	'AIRPORT',
	'ENTRY',
	'ENTRY_CHECKS',
];
// the trip's own settings the engine reads (it used to hard-code them)
export const TRIP_FIELDS = ['brand', 'description', 'pax', 'tz', 'currency', 'checked', 'arriveCity', 'searchHint', 'footer'];
const MODES = new Set(['transit', 'walking', 'driving', 'bicycling']);
// what may follow a route leg's mode: its own 'HH:MM', then the trip's own whole minutes (1–600) for a leg Google can't time
const routeTail = (rest) => {
	const [a, b] = rest;
	const isMin = (x) => Number.isInteger(x) && x > 0 && x <= 600;
	if (rest.length === 0) return true;
	if (rest.length === 1) return /^\d{2}:\d{2}$/.test(a) || isMin(a);
	return rest.length === 2 && /^\d{2}:\d{2}$/.test(a) && isMin(b);
};

/** Evaluates a trip's data.js the way the build does (no window) and returns its globals. */
export function loadTrip(dir) {
	const src = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
	const ctx = {};
	vm.createContext(ctx);
	vm.runInContext(
		`${src};this.__trip={${[...REQUIRED, ...OPTIONAL_GLOBALS].map((k) => `${k}:typeof ${k}==='undefined'?undefined:${k}`).join(',')}}`,
		ctx,
	);
	return ctx.__trip;
}

export const readJSON = (dir, f, fallback = null) => {
	const p = path.join(dir, f);
	return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
};

// a stop's time: "HH:MM", "~HH:MM–HH:MM", or a [zh, en] label that may hold no clock time ("Evening", "After the show")
const minutes = (t) => {
	const s = Array.isArray(t) ? t[1] : String(t);
	const m = /(\d{1,2}):(\d{2})/.exec(s);
	return m ? +m[1] * 60 + +m[2] : null;
};
const isLabel = (t) => Array.isArray(t) && t.length === 2 && t.every((x) => typeof x === 'string' && x.trim());

/** Every [zh, en] pair in the trip, with its path; a UI string pair is an array of exactly two strings. */
export function bilingualPairs(value, at = '') {
	const out = [];
	const walk = (v, p) => {
		if (Array.isArray(v)) {
			if (v.length === 2 && v.every((x) => typeof x === 'string')) out.push({ path: p, pair: v });
			else v.forEach((x, i) => walk(x, `${p}[${i}]`));
		} else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k);
	};
	walk(value, at);
	return out;
}

/** Returns a list of human-readable problems; empty means the trip passes. */
export function checkTrip(trip) {
	const problems = [];
	const bad = (msg) => problems.push(msg);
	for (const k of REQUIRED) if (trip[k] === undefined) bad(`missing ${k}`);
	if (problems.length) return problems;

	const { TRIP, DAYS, PLACES, SITES, FLIGHTS, BUDGET } = trip;
	for (const k of TRIP_FIELDS) if (TRIP[k] == null) bad(`TRIP.${k} missing`);
	if (TRIP.pax != null && !(Number.isInteger(TRIP.pax) && TRIP.pax > 0)) bad(`TRIP.pax must be a whole number, got ${TRIP.pax}`);
	if (TRIP.currency && !(TRIP.currency.sym && TRIP.currency.home && TRIP.currency.rate > 0)) bad('TRIP.currency needs sym, home and rate');
	if (TRIP.tz) {
		try {
			new Intl.DateTimeFormat('en', { timeZone: TRIP.tz });
		} catch {
			bad(`TRIP.tz "${TRIP.tz}" is not a time zone`);
		}
	}
	// the live sky (ADR-20261122-day-views): one of the engine's skies; a world without one ignores it
	if (
		TRIP.brandShort != null &&
		!(typeof TRIP.brandShort === 'string' && TRIP.brandShort.trim() && TRIP.brandShort.length < String(TRIP.brand).length)
	)
		bad(`TRIP.brandShort must be a shorter name than TRIP.brand`);
	if (TRIP.sky != null && !SKIES.includes(TRIP.sky)) bad(`TRIP.sky ${JSON.stringify(TRIP.sky)} must be one of ${SKIES.join('|')}`);
	// the group's walking pace (ADR-20261127-trip-walk-pace): left out for the seniors' pace, else a number in range
	if (paceProblem(TRIP.walkPace)) bad(paceProblem(TRIP.walkPace));
	for (const v of TRIP.mapViews || [])
		if (!v.id || !Array.isArray(v.name) || !(Array.isArray(v.bbox) && v.bbox.length === 4))
			bad(`TRIP.mapViews ${v.id}: needs id, name [zh, en] and bbox [w, s, e, n]`);
	// days: any number, ids d1…dN in order, consecutive dates from TRIP.start to TRIP.end. The engine reads each day's
	// role from the data (first day = arrival, the airport evening from the return flight), never from a fixed id.
	const ids = DAYS.map((d) => d.id);
	if (!ids.length) bad('DAYS is empty');
	if (ids.some((id, i) => id !== `d${i + 1}`)) bad(`day ids must run d1…d${ids.length} in order, got ${ids.join(',')}`);
	if (DAYS.filter((d) => d.freeFrom).length > 1) bad('only one day can be the free-time day (freeFrom)');
	if (DAYS[0]?.date !== TRIP.start) bad(`first day ${DAYS[0]?.date} is not TRIP.start ${TRIP.start}`);
	if (DAYS.at(-1)?.date !== TRIP.end) bad(`last day ${DAYS.at(-1)?.date} is not TRIP.end ${TRIP.end}`);
	DAYS.forEach((d, i) => {
		if (d.n !== i + 1) bad(`${d.id}: n is ${d.n}, expected ${i + 1}`);
		// the day's lantern colour: the page has seven (--l1…--l7), and the My Maps export one per colour
		if (!(Number.isInteger(d.c) && d.c >= 1 && d.c <= 7)) bad(`${d.id}: c (its lantern colour) must be 1–7, got ${JSON.stringify(d.c)}`);
		// the day's short name on its row (ADR-20261128-progressive-disclosure): a few words, [zh, en]
		if (d.short != null && !(isLabel(d.short) && [...d.short[0]].length <= 10 && d.short[1].length <= 24))
			bad(`${d.id}: short must be [zh, en], at most 10 characters in Chinese and 24 in English, got ${JSON.stringify(d.short)}`);
		// the day's activity mark: one the engine draws (engine/src/core/motif.mjs), named by the planner, never free text
		if (d.motif != null && !MOTIFS.includes(d.motif)) bad(`${d.id}: motif ${JSON.stringify(d.motif)} must be one of ${MOTIFS.join('|')}`);
		// photos are optional; when set, a list of photo ids (img/credits.json)
		if (d.photos != null && !(Array.isArray(d.photos) && d.photos.every((p) => typeof p === 'string')))
			bad(`${d.id}: photos must be a list of photo ids, got ${JSON.stringify(d.photos)}`);
		if (i && Date.parse(d.date) - Date.parse(DAYS[i - 1].date) !== 864e5) bad(`${d.id}: ${d.date} does not follow ${DAYS[i - 1].date}`);
		// planned (non-flight-tied) times never run backwards
		let last = -1;
		d.schedule.forEach((it, j) => {
			const where = `${d.id} stop ${j}`;
			if (!Array.isArray(it.what) || it.what.length !== 2) bad(`${where}: what must be [zh, en]`);
			if (it.place && !PLACES[it.place]) bad(`${where}: unknown place "${it.place}"`);
			// a link is a SITES key, an in-page anchor (#airport) or a URL
			if (it.link && !SITES[it.link] && !/^(#|https?:\/\/)/.test(it.link)) bad(`${where}: unknown site "${it.link}"`);
			// a longer note, shown under the note when the stop is opened (ADR-20261128-progressive-disclosure)
			if (it.detail != null && !isLabel(it.detail)) bad(`${where}: detail must be [zh, en]`);
			if (it.detail != null && !it.note) bad(`${where}: detail goes under the note, so the stop needs a note too`);
			// a note the group must act on stays visible under the stop's one line, so it needs a note to show
			if (it.todo != null && typeof it.todo !== 'boolean') bad(`${where}: todo must be true or false`);
			if (it.todo && !it.note) bad(`${where}: todo keeps the note in sight, so the stop needs a note`);
			// the stop's kind on the string, when the page shouldn't read it from the stop: one the engine draws
			if (it.icon != null && !STOP_ICONS.includes(it.icon)) bad(`${where}: icon ${JSON.stringify(it.icon)} must be one of ${STOP_ICONS.join('|')}`);
			if (it.rel) {
				const o = it.rel.arr || it.rel.dep;
				if (!Array.isArray(o)) bad(`${where}: rel needs arr or dep offsets`);
				return;
			}
			const m = minutes(it.t);
			if (m == null) {
				if (!isLabel(it.t)) bad(`${where}: time ${JSON.stringify(it.t)} is neither HH:MM nor a [zh, en] label`);
				return;
			}
			if (m < last) bad(`${where}: ${JSON.stringify(it.t)} is earlier than the stop before`);
			last = m;
		});
		if (d.foodSlots && !(Array.isArray(d.foodSlots) && d.foodSlots.every((x) => typeof x === 'string'))) bad(`${d.id}: foodSlots must be slot names`);
		if (d.freeEvening != null && typeof d.freeEvening !== 'boolean') bad(`${d.id}: freeEvening must be true or false`);
		if (d.freeFrom != null && minutes(d.freeFrom) == null) bad(`${d.id}: freeFrom must be HH:MM`);
		const routeChecks = (route, where) => {
			if (!Array.isArray(route)) return bad(`${where}: must be a list of legs`);
			for (const [k, leg] of route.entries())
				if (!Array.isArray(leg) || !PLACES[leg[0]] || !PLACES[leg[1]] || !MODES.has(leg[2]) || !routeTail(leg.slice(3)))
					bad(
						`${where} leg ${k}: needs [known place, known place, ${[...MODES].join('|')}, optional 'HH:MM', optional minutes], got ${JSON.stringify(leg)}`,
					);
		};
		if (d.route) routeChecks(d.route, `${d.id} route`);
		// a decide option's own route (ADR-20261127-decide-option-route): its legs are stored under `<day>:<k>:<i>`, so its
		// k is a plain word and no other routed option of the day has it
		const optKeys = new Set();
		for (const b of d.blocks)
			for (const o of b.type === 'decide' ? b.opts || [] : []) {
				if (o.route == null) continue;
				const where = `${d.id} decide option ${JSON.stringify(o.k)} route`;
				if (typeof o.k !== 'string' || !/^[A-Za-z0-9_-]+$/.test(o.k)) bad(`${where}: an option with a route needs a k of letters, digits, _ or -`);
				else if (optKeys.has(o.k)) bad(`${where}: another option of ${d.id} with a route has the same k`);
				optKeys.add(o.k);
				if (Array.isArray(o.route) && !o.route.length) bad(`${where}: needs at least one leg`);
				routeChecks(o.route, where);
			}
		for (const b of d.blocks) {
			for (const p of [...(b.places || []), ...(b.opts || []).map((o) => o.place).filter(Boolean)])
				if (!PLACES[p]) bad(`${d.id} ${b.type} block: unknown place "${p}"`);
			if (b.type === 'budget' && !(b.min <= b.max)) bad(`${d.id} budget block: min ${b.min} > max ${b.max}`);
			// a block's summary button (ADR-20261122-day-views): its own line, and the option a decision has settled on
			if (b.sum != null && !isLabel(b.sum)) bad(`${d.id} ${b.type} block: sum must be [zh, en]`);
			// its tile's word (ADR-20261128-progressive-disclosure): short, so it fits under the icon in both languages
			if (b.tile != null && !(isLabel(b.tile) && [...b.tile[0]].length <= 6 && b.tile[1].length <= 16))
				bad(`${d.id} ${b.type} block: tile must be [zh, en], at most 6 characters in Chinese and 16 in English`);
			if (b.pick != null && !(b.type === 'decide' && (b.opts || []).some((o) => o.k === b.pick)))
				bad(`${d.id} ${b.type} block: pick ${JSON.stringify(b.pick)} must be the k of one of its options (decide blocks only)`);
		}
		if (d.split) splitChecks(d);
	});
	// a day that splits (DAYS[].split, trip-format.md): part of the group takes its own plan for a few hours, forking
	// off the string at `at` and coming back at a stop of the day
	function splitChecks(d) {
		const sp = d.split;
		const w = `${d.id} split`;
		const starts = new Set(d.schedule.map((it) => minutes(it.t)).filter((m) => m != null));
		const ll = (p) => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;
		const spot = (p) => p && isLabel(p.name) && Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.yb == null || /^\w{1,20}$/.test(p.yb));
		if (minutes(sp.at) == null) bad(`${w}: at must be HH:MM, where it forks off the string`);
		for (const k of ['who', 'h']) if (!isLabel(sp[k])) bad(`${w}: ${k} must be [zh, en]`);
		if (!Array.isArray(sp.go) || !sp.go.every((o) => ['go', 'wait', 'stop'].includes(o.k) && isLabel(o.name)))
			bad(`${w}: go must be rows of { k: go|wait|stop, name: [zh, en] }`);
		const opts = Array.isArray(sp.options) ? sp.options : [];
		if (!opts.length || opts.length > 4) bad(`${w}: options must hold 1–4 plans`);
		if (new Set(opts.map((o) => o.id)).size !== opts.length) bad(`${w}: option ids must be unique`);
		if (opts.filter((o) => o.default).length > 1) bad(`${w}: at most one option is the default`);
		for (const o of opts) {
			const wo = `${w} option ${o.id}`;
			if (!/^[\w-]{1,20}$/.test(o.id || '') || !isLabel(o.name)) bad(`${wo}: needs an id and a [zh, en] name`);
			if (!starts.has(minutes(o.join))) bad(`${wo}: join ${JSON.stringify(o.join)} must be the start time of a stop that day`);
			if (minutes(o.join) <= minutes(sp.at)) bad(`${wo}: it rejoins (${o.join}) before it forks (${sp.at})`);
			for (const k of ['leave', 'back']) if (o[k] != null && minutes(o[k]) == null) bad(`${wo}: ${k} must be HH:MM`);
			for (const k of ['km', 'ride', 'stops']) if (o[k] != null && !(o[k] > 0)) bad(`${wo}: ${k} must be a positive number`);
			for (const k of ['start', 'end', 'alt'])
				if (o[k] != null && !spot(o[k])) bad(`${wo}: ${k} needs a [zh, en] name, lat, lng (and a station number)`);
			if (o.line != null && !(Array.isArray(o.line) && o.line.length >= 2 && o.line.every(ll))) bad(`${wo}: line must be [lat, lng] points`);
			if (o.via != null && !(Array.isArray(o.via) && o.via.length <= 3 && o.via.every(ll))) bad(`${wo}: via holds at most 3 [lat, lng] points`);
			if (o.place && !PLACES[o.place]) bad(`${wo}: unknown place "${o.place}"`);
			for (const r of o.rows || [])
				if (!(Array.isArray(r) && r.length === 2 && isLabel(r[0]) && isLabel(r[1]))) bad(`${wo}: rows are [[zh, en], [zh, en]] pairs`);
		}
	}
	if (!DAYS.some((d) => d.schedule.some((it) => it.fixed))) bad('no fixed times: flights at least are fixed');
	// places and sites the data points at must exist (the engine looks none up by a fixed name)
	// one hotel for the trip (TRIP.hotel, default "hotel") or one per night (DAYS[i].hotel from the night it changes)
	const hotel = TRIP.hotel || 'hotel';
	if (!DAYS[0]?.hotel && !PLACES[hotel]) bad(`missing the hotel's place "${hotel}" (TRIP.hotel, default "hotel")`);
	for (const d of DAYS) if (d.hotel && !PLACES[d.hotel]) bad(`${d.id}: hotel "${d.hotel}" is not a known place`);
	const { AIRPORT, ENTRY, WEATHER } = trip;
	for (const [k, t] of (AIRPORT?.terminals || []).entries())
		if (!PLACES[t.place] || !t.code) bad(`AIRPORT.terminals[${k}]: needs a known place and a code, got ${JSON.stringify(t)}`);
	const siteRefs = [
		...(AIRPORT?.sites || []).map((k) => ['AIRPORT.sites', k]),
		...(AIRPORT?.departSites || []).map((x) => ['AIRPORT.departSites', typeof x === 'string' ? x : x.site]),
		...(AIRPORT?.transitCardSite ? [['AIRPORT.transitCardSite', AIRPORT.transitCardSite]] : []),
		...(WEATHER?.sites || []).map((k) => ['WEATHER.sites', k]),
		...(ENTRY?.sites || []).map((k) => ['ENTRY.sites', k]),
		...(ENTRY?.lucky?.sites || []).map((k) => ['ENTRY.lucky.sites', k]),
		...(ENTRY?.rules || []).filter((r) => r.site).map((r) => ['ENTRY.rules[].site', r.site]),
		...DAYS.flatMap((d) =>
			(d.blocks || []).flatMap((b, i) => [
				...(b.sites || []).map((k) => [`${d.id}.blocks[${i}].sites`, k]),
				...(b.opts || []).filter((o) => o.site).map((o) => [`${d.id}.blocks[${i}].opts[].site`, o.site]),
			]),
		),
	];
	for (const [where, k] of siteRefs) if (!SITES[k]) bad(`${where}: no site "${k}" in SITES`);
	for (const [id, p] of Object.entries(PLACES)) if (!Array.isArray(p.name) || !p.maps) bad(`place ${id}: needs name [zh, en] and a maps query`);
	// other data that points at a day must point at one this trip has
	const dayIds = new Set(DAYS.map((d) => d.id));
	// shop lists: any number, each with a unique id (its section anchor and checklist keys) and known places
	const lists = trip.SHOPLISTS || (trip.SNOW ? [{ id: 'snow', ...trip.SNOW }] : []);
	if (trip.SHOPLISTS && trip.SNOW) bad('SHOPLISTS and SNOW both set: SNOW is the older single-list form, keep one');
	const listIds = new Set();
	for (const [k, l] of lists.entries()) {
		if (!/^[a-z][a-z0-9-]*$/.test(l.id || '')) bad(`shop list ${k}: id must be lower-case letters, digits and dashes, got ${JSON.stringify(l.id)}`);
		if (listIds.has(l.id)) bad(`shop list ${l.id}: id used twice`);
		listIds.add(l.id);
		for (const f of ['h', 'kind']) if (l[f] != null && !isLabel(l[f])) bad(`shop list ${l.id}: ${f} must be [zh, en]`);
		for (const [j, x] of (l.shops || []).entries()) if (!PLACES[x.place]) bad(`shop list ${l.id} shop ${j}: unknown place "${x.place}"`);
	}
	// optional plans: each card's anchor and place, and the stops it's suggested at (OPTIONAL[].near, trip-format.md)
	const optIds = new Set();
	for (const [k, o] of (Array.isArray(trip.OPTIONAL) ? trip.OPTIONAL : []).entries()) {
		const w = `OPTIONAL ${o.id || k}`;
		if (!/^[\w-]{1,40}$/.test(o.id || '') || optIds.has(o.id)) bad(`${w}: needs a unique id (its anchor), letters, digits and dashes`);
		optIds.add(o.id);
		if (o.place && !PLACES[o.place]) bad(`${w}: unknown place "${o.place}"`);
		if (o.short != null && !isLabel(o.short)) bad(`${w}: short must be [zh, en]`);
		if (o.near != null && !Array.isArray(o.near)) bad(`${w}: near must be a list of { day, place }`);
		for (const n of Array.isArray(o.near) ? o.near : []) {
			const d = DAYS.find((x) => x.id === n?.day);
			if (!d) bad(`${w} near: no day "${n?.day}" in this trip`);
			else if (!d.schedule.some((it) => it.place && it.place === n.place)) bad(`${w} near: ${d.id} has no stop at "${n.place}"`);
		}
	}
	// checklist groups: `shared: true` sends a group's ticks to everyone's phone when the page has group sync. A tick's key
	// is `<group id>-<item id>`, so one group's id followed by a dash must not start another's
	const groups = Array.isArray(trip.CHECKLIST) ? trip.CHECKLIST : [];
	for (const g of groups) {
		if (g.shared != null && typeof g.shared !== 'boolean') bad(`CHECKLIST ${g.id}: shared must be true or false`);
		for (const o of groups) if (o !== g && String(o.id).startsWith(`${g.id}-`)) bad(`CHECKLIST ${o.id}: starts with another group's id "${g.id}-"`);
	}
	for (const [where, list] of [...lists.map((l) => [`shop list ${l.id}`, l.shops]), ['WEATHER.outfits', trip.WEATHER?.outfits]])
		for (const [k, x] of (list || []).entries()) if (x.day && !dayIds.has(x.day)) bad(`${where}[${k}].day: no day "${x.day}" in this trip`);
	const plan = FLIGHTS?.ret?.plan;
	if (plan) {
		for (const k of ['back', 'leave', 'airport', 'latest', 'road'])
			if (plan[k] != null && !(plan[k] >= 0)) bad(`FLIGHTS.ret.plan.${k}: minutes, 0 or more`);
		if (plan.route && !isLabel(plan.route)) bad('FLIGHTS.ret.plan.route must be [zh, en]');
		for (const [k, x] of (plan.steps || []).entries()) {
			if (!Array.isArray(x.at) || !x.at.length || x.at.some((a) => !(typeof a === 'number' ? a >= 0 : minutes(a) != null)))
				bad(`FLIGHTS.ret.plan.steps[${k}].at: one or two times, each HH:MM or minutes before take-off`);
			if (!isLabel(x.what)) bad(`FLIGHTS.ret.plan.steps[${k}].what must be [zh, en]`);
		}
	}
	for (const k of ['out', 'ret']) {
		const f = FLIGHTS[k];
		if (!f || minutes(f.dep) == null || minutes(f.arr) == null || !/^\d{4}-\d\d-\d\d$/.test(f.date || ''))
			bad(`FLIGHTS.${k} needs dep, arr (HH:MM) and date`);
	}
	// the budget (ADR-20261128-budget-paid-insurance): an estimate row [label, text, min, max, anchor?] in the trip's
	// currency, or an object row: one payment { label, min, max, cur, paid, via, ref, est, anchor }, a payment in parts
	// { label, parts: [{ amt, cur, paid, via, label }] }, or one with no price yet { label, tbd: true, via }
	const homeCode = TRIP.currency && TRIP.currency.home;
	const curOK = (c) => c == null || ((c === 'home' || c === homeCode) && homeCode);
	const isoDay = (d) => /^\d{4}-\d\d-\d\d$/.test(d || '');
	const viaOK = (v) => v == null || isLabel(v) || (typeof v === 'string' && !!v.trim());
	const legacy = BUDGET.rows.every(Array.isArray);
	BUDGET.rows.forEach((r, i) => {
		const w = `BUDGET.rows[${i}]`;
		if (Array.isArray(r)) {
			if (!(isLabel(r[0]) && typeof r[1] === 'string' && Number.isFinite(r[2]) && r[2] <= r[3])) bad(`${w}: [label, text, min, max] with min ≤ max`);
			return;
		}
		if (!r || typeof r !== 'object' || !isLabel(r.label)) return bad(`${w}: label must be [zh, en]`);
		if (!curOK(r.cur)) bad(`${w}: cur must be 'home' or ${JSON.stringify(homeCode)} (a trip with a home currency), or left out for the trip's`);
		if (!viaOK(r.via)) bad(`${w}: via must be [zh, en] or a name`);
		if (r.ref != null && !(typeof r.ref === 'string' && r.ref.trim())) bad(`${w}: ref must be the booking number as text`);
		if (r.tbd) {
			if (r.min != null || r.max != null || r.parts || r.paid) bad(`${w}: a row with no price yet (tbd) has no amount, parts or payment date`);
			return;
		}
		if (r.parts != null) {
			if (!(Array.isArray(r.parts) && r.parts.length)) return bad(`${w}: parts must be a list of payments`);
			if (r.min != null || r.max != null || r.paid != null) bad(`${w}: a row paid in parts takes its amounts and dates from them`);
			r.parts.forEach((pt, j) => {
				if (!(Number.isFinite(pt.amt) && pt.amt > 0)) bad(`${w}.parts[${j}]: amt must be a number above 0`);
				if (!curOK(pt.cur)) bad(`${w}.parts[${j}]: cur must be 'home' or ${JSON.stringify(homeCode)}, or left out`);
				if (pt.paid != null && !isoDay(pt.paid)) bad(`${w}.parts[${j}]: paid must be a date (YYYY-MM-DD)`);
				if (!viaOK(pt.via)) bad(`${w}.parts[${j}]: via must be [zh, en] or a name`);
				if (pt.label != null && !isLabel(pt.label)) bad(`${w}.parts[${j}]: label must be [zh, en]`);
			});
			return;
		}
		if (!(Number.isFinite(r.min) && Number.isFinite(r.max) && r.min >= 0 && r.min <= r.max)) bad(`${w}: needs min ≤ max (or parts, or tbd)`);
		if (r.paid != null) {
			if (!isoDay(r.paid)) bad(`${w}: paid must be a date (YYYY-MM-DD)`);
			if (r.min !== r.max) bad(`${w}: a paid row has its exact amount (min = max), never a range`);
		}
	});
	// travel insurance (optional): a closed list of fields, and never an ID number, an address or a birth date, since the
	// page is shared with the whole group (ADR-20261128-budget-paid-insurance)
	const { INSURANCE } = trip;
	if (INSURANCE != null) {
		const PERSONAL = /^(ic|nric|mykad|id|idno|id_?number|passport\w*|dob|birth\w*|address\w*|addr|ssn|national_?id)$/i;
		const personal = (o, at) => {
			if (Array.isArray(o)) return o.forEach((x, i) => personal(x, `${at}[${i}]`));
			if (o && typeof o === 'object')
				for (const [k, v] of Object.entries(o)) {
					if (PERSONAL.test(k)) bad(`${at}.${k}: no ID numbers, addresses or birth dates in INSURANCE (the page is shared with the group)`);
					personal(v, `${at}.${k}`);
				}
		};
		personal(INSURANCE, 'INSURANCE');
		const only = (o, keys, at) => Object.keys(o || {}).forEach((k) => keys.includes(k) || PERSONAL.test(k) || bad(`${at}: unknown field ${k}`));
		const tel = (t) => typeof t === 'string' && /^\+?\d[\d ()-]{5,}$/.test(t.trim());
		only(INSURANCE, ['policies', 'claims'], 'INSURANCE');
		if (!(Array.isArray(INSURANCE.policies) && INSURANCE.policies.length)) bad('INSURANCE.policies must list at least one policy');
		(INSURANCE.policies || []).forEach((p, i) => {
			const w = `INSURANCE.policies[${i}]`;
			only(p, ['name', 'insurer', 'plan', 'who', 'from', 'to', 'covers', 'note', 'site', 'app', 'contacts'], w);
			if (!isLabel(p.name)) bad(`${w}: name must be [zh, en]`);
			if (!(typeof p.insurer === 'string' && p.insurer.trim())) bad(`${w}: insurer is the company's name`);
			for (const k of ['plan', 'who', 'note']) if (p[k] != null && !isLabel(p[k])) bad(`${w}: ${k} must be [zh, en]`);
			for (const k of ['from', 'to']) if (p[k] != null && !/^\d{4}-\d\d-\d\d$/.test(p[k])) bad(`${w}: ${k} must be a date (YYYY-MM-DD)`);
			if (p.from && p.to && p.to < p.from) bad(`${w}: to is before from`);
			if (p.covers != null && !(Array.isArray(p.covers) && p.covers.every(isLabel))) bad(`${w}: covers must be a list of [zh, en]`);
			if (p.site != null && !(SITES[p.site] || /^https:\/\//.test(p.site))) bad(`${w}: site must be a SITES key or an https link`);
			if (p.app != null) {
				only(p.app, ['name', 'note'], `${w}.app`);
				if (!(typeof p.app.name === 'string' && p.app.name.trim()) || (p.app.note != null && !isLabel(p.app.note)))
					bad(`${w}.app: a name, and a [zh, en] note`);
			}
			(p.contacts || []).forEach((c, j) => {
				only(c, ['label', 'tel', 'wa', 'when'], `${w}.contacts[${j}]`);
				if (!isLabel(c.label) || !tel(c.tel) || (c.wa != null && !tel(c.wa)) || (c.when != null && !isLabel(c.when)))
					bad(`${w}.contacts[${j}]: a [zh, en] label, a phone number (tel, and wa for WhatsApp) and a [zh, en] when`);
			});
		});
		(INSURANCE.claims || []).forEach((g, i) => {
			only(g, ['h', 'items'], `INSURANCE.claims[${i}]`);
			if (!isLabel(g.h) || !(Array.isArray(g.items) && g.items.length && g.items.every(isLabel)))
				bad(`INSURANCE.claims[${i}]: an h and its items, each [zh, en]`);
		});
	}
	// an estimate-only budget keeps its hand-written totals, and they add up
	if (legacy) {
		if (!(BUDGET.totalMin <= BUDGET.totalMax)) bad(`BUDGET.totalMin ${BUDGET.totalMin} > totalMax ${BUDGET.totalMax}`);
		const rowsMin = BUDGET.rows.reduce((a, r) => a + r[2], 0);
		const rowsMax = BUDGET.rows.reduce((a, r) => a + r[3], 0);
		if (rowsMin !== BUDGET.totalMin || rowsMax !== BUDGET.totalMax)
			bad(`BUDGET rows add up to ${rowsMin}–${rowsMax}, totals say ${BUDGET.totalMin}–${BUDGET.totalMax}`);
	}
	// both UI languages present everywhere (an empty zh gloss is allowed: the brush lettering carries it)
	for (const { path: p, pair } of bilingualPairs(trip))
		if (!pair[1].trim() || (!pair[0].trim() && !/gloss$/.test(p))) bad(`${p}: both languages needed, got ${JSON.stringify(pair)}`);
	return problems;
}

/** Every [lat, lng] point in the trip's side files that falls outside the map's bounding box. */
export function pointsOutside(dir) {
	const geo = readJSON(dir, 'geo.json');
	if (!geo) return [];
	const [w, s, e, n] = geo.bbox;
	const out = [];
	const check = (label, lat, lng) => {
		if (!(lng >= w && lng <= e && lat >= s && lat <= n)) out.push(`${label} (${lat}, ${lng})`);
	};
	for (const [id, p] of Object.entries(geo.places)) check(`geo ${id}`, p.lat, p.lng);
	for (const f of readJSON(dir, 'extra.json', { food: [] }).food) check(`food ${f.name_en}`, f.lat, f.lng);
	return out;
}

/** The wishlist's side files (wish-a.json, wish-b.json): a fits entry that names its meal names a known one. */
export function wishProblems(dir) {
	return ['wish-a.json', 'wish-b.json'].flatMap((f) => (readJSON(dir, f, { items: [] }).items || []).flatMap((w) => fitMealProblems(w.id, w.fits)));
}

const REFILL_KINDS = ['tap', 'shop', 'shelter'];
const CLOCK = /^([01]?\d|2\d|3[0-5]):[0-5]\d$/; // up to 35:59: a range that runs past midnight
/** refill.json (pipeline/steps/refill.py, ADR-20261128-water-refill): the spot shape the page reads. Returns problems,
 *  [] for a trip without the file. */
export function checkRefill(data) {
	if (data == null) return [];
	const bad = [];
	if (typeof data !== 'object' || !Array.isArray(data.spots)) return ['refill.json: needs a "spots" list'];
	if (data.checked != null && !/^\d{4}-\d{2}-\d{2}$/.test(data.checked)) bad.push('refill.json checked: YYYY-MM-DD');
	const ids = new Set();
	data.spots.forEach((s, i) => {
		const at = `refill.json spot ${s && s.id ? s.id : i}`;
		if (!s || typeof s !== 'object') return bad.push(`${at}: not an object`);
		if (typeof s.id !== 'string' || !s.id) bad.push(`${at}: id must be text`);
		else if (ids.has(s.id)) bad.push(`${at}: the same id twice`);
		ids.add(s.id);
		if (!(typeof s.lat === 'number' && typeof s.lng === 'number' && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180)) bad.push(`${at}: lat and lng`);
		if (!REFILL_KINDS.includes(s.kind)) bad.push(`${at}: kind must be one of ${REFILL_KINDS.join('|')}`);
		for (const k of ['indoor', 'seasonal']) if (s[k] != null && typeof s[k] !== 'boolean') bad.push(`${at}: ${k} is true, false or null`);
		for (const k of ['name', 'address', 'hours_note', 'how', 'added', 'src'])
			if (s[k] != null && typeof s[k] !== 'string') bad.push(`${at}: ${k} is text or null`);
		if (typeof s.credit !== 'string' || !s.credit.trim()) bad.push(`${at}: credit (who the data is from) is needed`);
		if (s.site != null && !/^https?:\/\//.test(s.site)) bad.push(`${at}: site is an http(s) link`);
		if (s.water != null && !(Array.isArray(s.water) && s.water.every((w) => typeof w === 'string'))) bad.push(`${at}: water is a list of words`);
		if (s.hours != null) {
			const h = s.hours;
			const ok =
				typeof h === 'object' &&
				typeof h.known === 'boolean' &&
				h.days &&
				typeof h.days === 'object' &&
				Object.entries(h.days).every(
					([d, rs]) => /^[1-7]$/.test(d) && Array.isArray(rs) && rs.every((r) => Array.isArray(r) && r.length === 2 && r.every((x) => CLOCK.test(x))),
				);
			if (!ok) bad.push(`${at}: hours are { days: { "1".."7": [["HH:MM", "HH:MM"]] }, known } ("1" is Monday) or null`);
		}
	});
	return bad;
}
