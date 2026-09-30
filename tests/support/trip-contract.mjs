// The rules a trip's data must follow before the engine can render it. Used by tests/contract on the demo trip, and
// meant for any trip (TRIP_DIR=… pnpm test) and later for the trip-intake skill's output. Shape: legacy data.js ("v0").
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const REQUIRED = [
	'TRIP',
	'PLACES',
	'SITES',
	'FACTS',
	'BACKUPS',
	'DAYS',
	'OPTIONAL',
	'SNOW',
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

/** Evaluates a trip's data.js the way the build does (no window) and returns its globals. */
export function loadTrip(dir) {
	const src = fs.readFileSync(path.join(dir, 'data.js'), 'utf8');
	const ctx = {};
	vm.createContext(ctx);
	vm.runInContext(`${src};this.__trip={${REQUIRED.map((k) => `${k}:typeof ${k}==='undefined'?undefined:${k}`).join(',')}}`, ctx);
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
		if (i && Date.parse(d.date) - Date.parse(DAYS[i - 1].date) !== 864e5) bad(`${d.id}: ${d.date} does not follow ${DAYS[i - 1].date}`);
		// planned (non-flight-tied) times never run backwards
		let last = -1;
		d.schedule.forEach((it, j) => {
			const where = `${d.id} stop ${j}`;
			if (!Array.isArray(it.what) || it.what.length !== 2) bad(`${where}: what must be [zh, en]`);
			if (it.place && !PLACES[it.place]) bad(`${where}: unknown place "${it.place}"`);
			// a link is a SITES key, an in-page anchor (#airport) or a URL
			if (it.link && !SITES[it.link] && !/^(#|https?:\/\/)/.test(it.link)) bad(`${where}: unknown site "${it.link}"`);
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
		for (const [k, leg] of (d.route || []).entries()) {
			if (!Array.isArray(leg) || !PLACES[leg[0]] || !PLACES[leg[1]] || !MODES.has(leg[2]))
				bad(`${d.id} route leg ${k}: needs [known place, known place, ${[...MODES].join('|')}], got ${JSON.stringify(leg)}`);
		}
		for (const b of d.blocks) {
			for (const p of [...(b.places || []), ...(b.opts || []).map((o) => o.place).filter(Boolean)])
				if (!PLACES[p]) bad(`${d.id} ${b.type} block: unknown place "${p}"`);
			if (b.type === 'budget' && !(b.min <= b.max)) bad(`${d.id} budget block: min ${b.min} > max ${b.max}`);
		}
	});
	if (!DAYS.some((d) => d.schedule.some((it) => it.fixed))) bad('no fixed times: flights at least are fixed');
	// places and sites the data points at must exist (the engine looks none up by a fixed name)
	const hotel = TRIP.hotel || 'hotel';
	if (!PLACES[hotel]) bad(`missing the hotel's place "${hotel}" (TRIP.hotel, default "hotel")`);
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
	];
	for (const [where, k] of siteRefs) if (!SITES[k]) bad(`${where}: no site "${k}" in SITES`);
	for (const [id, p] of Object.entries(PLACES)) if (!Array.isArray(p.name) || !p.maps) bad(`place ${id}: needs name [zh, en] and a maps query`);
	// other data that points at a day must point at one this trip has
	const dayIds = new Set(DAYS.map((d) => d.id));
	for (const [where, list] of [
		['SNOW.shops', trip.SNOW?.shops],
		['WEATHER.outfits', trip.WEATHER?.outfits],
	])
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
	if (!(BUDGET.totalMin <= BUDGET.totalMax)) bad(`BUDGET.totalMin ${BUDGET.totalMin} > totalMax ${BUDGET.totalMax}`);
	const rowsMin = BUDGET.rows.reduce((a, r) => a + r[2], 0);
	const rowsMax = BUDGET.rows.reduce((a, r) => a + r[3], 0);
	if (rowsMin !== BUDGET.totalMin || rowsMax !== BUDGET.totalMax)
		bad(`BUDGET rows add up to ${rowsMin}–${rowsMax}, totals say ${BUDGET.totalMin}–${BUDGET.totalMax}`);
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
