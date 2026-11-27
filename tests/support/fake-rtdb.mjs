// A stand-in for the planner's Firebase Realtime Database and for Firebase's anonymous sign-in, for the group-sync e2e
// tests. It answers the REST API the page uses (GET, PATCH with print=silent, multi-path PATCH, DELETE, and the
// EventSource stream with put/patch/cancel events) and enforces what scripts/sync/database.rules.json enforces, for both
// kinds of trip:
//  - a token trip (ADR-20261001-group-sync): readable only while its write token exists, a record needs that token and
//    the exact shape, deletes are refused, and an older version never replaces a newer one;
//  - an approval trip (ADR-20261127-sync-approval): a device signed in (`auth=` an ID token) asks to join under
//    devices/<uid> as pending, a planner approves or blocks it, the planner-code proof makes the first planner, and only
//    an approved device reads or writes records, each as its own sync id.
// scripts/sync/rules-test.mjs checks the real rules on Firebase's own emulator, with the same tokens (testIdToken).
// Sign-in: POST /__auth/v1/accounts:signUp?key=… and /__auth/v1/token?key=… answer like Identity Toolkit and Secure
// Token do, with unsigned tokens no Google service takes.
// Test-only admin routes (what the CLI does as the planner, past the rules):
//   POST/DELETE /__rtdb-admin/key?trip=…&ns=…     a token trip with this token (body) / end sync
//   POST /__rtdb-admin/gate?trip=…&ns=…           an approval trip; body { proof } when a planner code is set
//   PATCH /__rtdb-admin/set?trip=…&ns=…           a multi-path update past the rules (`pnpm sync approve`)
//   GET /__rtdb-admin/dump?trip=…&ns=…[&path=…]   the records as stored, or what's at path
// Tests run in parallel and every sync page holds the same trip id, so each test has its own space: the rtdb_ns cookie
// on its devices (the page itself never sees it), the ns parameter on admin calls.
import crypto from 'node:crypto';

const trips = new Map(); // `${trip}|${ns}` → { token, gate: { approval, proof } | null, tree }
const streams = new Map(); // same key → Set of { res, sub, uid }
const refresh = new Map(); // refresh token → user id

const DAY = 86_400_000;
const ID = /^[A-Za-z0-9_-]{22}$/;
const DEV = /^[A-Za-z0-9_-]{6,24}$/;
const KIND = /^[a-z]{2,12}\/[a-z]{2,12}$/;
const denied = (res) => res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"Permission denied"}');
const json = (res, status, body) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
const send = (res, event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
const readBody = (req) =>
	new Promise((ok) => {
		let b = '';
		req.on('data', (c) => (b += c));
		req.on('end', () => ok(b));
	});
const canon = (v) =>
	v && typeof v === 'object'
		? `{${Object.keys(v)
				.sort()
				.map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
				.join(',')}}`
		: JSON.stringify(v ?? null);

/** an ID token as Firebase's emulators take it: unsigned, for `uid`, valid for `ttl` seconds */
export function testIdToken(uid, project = 'demo-relaxjer', ttl = 3600) {
	const now = Math.floor(Date.now() / 1000);
	const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
	const claims = { iss: `https://securetoken.google.com/${project}`, aud: project, iat: now, exp: now + ttl, auth_time: now, sub: uid, user_id: uid };
	return `${part({ alg: 'none', typ: 'JWT' })}.${part({ ...claims, firebase: { sign_in_provider: 'anonymous', identities: {} } })}.`;
}
/** the user a test ID token is for; null when it's malformed or expired */
export function uidOf(token) {
	try {
		const p = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
		return typeof p.sub === 'string' && /^[A-Za-z0-9]{1,128}$/.test(p.sub) && p.exp * 1000 > Date.now() ? p.sub : null;
	} catch {
		return null;
	}
}

// ── the tree: values as the database keeps them (no nulls, no empty objects) ────────────────────────────────────────
const at = (tree, parts) => parts.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), tree) ?? null;
function clean(v) {
	if (v === null || typeof v !== 'object') return v;
	const out = {};
	for (const [k, x] of Object.entries(v)) {
		const c = clean(x);
		if (c !== null && c !== undefined) out[k] = c;
	}
	return Object.keys(out).length ? out : null;
}
function put(tree, parts, value) {
	const v = clean(value);
	if (!parts.length) return v ?? {};
	const root = tree && typeof tree === 'object' ? tree : {};
	const [k, ...rest] = parts;
	const child = put(root[k], rest, v);
	const next = { ...root };
	if (child === null || (typeof child === 'object' && !Object.keys(child).length)) delete next[k];
	else next[k] = child;
	return next;
}

// ── the rules, item by item, as scripts/sync/database.rules.json has them ───────────────────────────────────────────
const isGate = (t) => !!t.gate && t.gate.approval === true;
const isTokenTrip = (t) => t.token != null && !t.gate;
const meBefore = (c) => (c.uid ? (c.old.devices || {})[c.uid] || null : null);
const approvedBefore = (c) => !!c.uid && isGate(c.t) && meBefore(c)?.state === 'approved';
const plannerBefore = (c) => approvedBefore(c) && (c.old.planners || {})[c.uid] === true;
const proofOk = (c) => typeof c.t.gate?.proof === 'string' && (c.next.claims || {})[c.uid] === c.t.gate.proof;

/** why a change to one item would be refused, or null when the rules take it */
const RULES = {
	r(c, rid, old, rec) {
		if (!ID.test(rid)) return 'name';
		if (rec === null) return 'delete';
		if (typeof rec !== 'object') return 'shape';
		const fields = Object.keys(rec);
		if (fields.some((f) => !['c', 'u', 'd', 'k'].includes(f)) || !['c', 'u', 'd'].every((f) => f in rec)) return `fields ${fields.sort()}`;
		if ('k' in rec && (typeof rec.k !== 'string' || c.t.gate)) return 'k';
		const byToken = isTokenTrip(c.t) && rec.k === c.t.token;
		const byDevice = approvedBefore(c) && rec.d === meBefore(c).dev;
		if (!byToken && !byDevice) return 'who';
		if (typeof rec.c !== 'string' || rec.c.length > 4096) return 'c';
		if (typeof rec.u !== 'number' || !(rec.u > 0) || rec.u > Date.now() + DAY) return 'u';
		if (typeof rec.d !== 'string' || !DEV.test(rec.d)) return 'd';
		if (old && !(rec.u > old.u || (rec.u === old.u && rec.d > old.d))) return 'older';
		return null;
	},
	devices(c, uid, old, nw) {
		if (!c.uid || !isGate(c.t)) return 'auth';
		const self = c.uid === uid;
		const planner = plannerBefore(c) && old !== null;
		const create =
			self &&
			old === null &&
			nw?.state === 'pending' &&
			!('person' in nw) &&
			typeof nw.dev === 'string' &&
			nw.dev.length >= 20 &&
			uid.startsWith(nw.dev);
		const rename =
			self &&
			old?.state === 'pending' &&
			nw?.state === 'pending' &&
			!('person' in nw) &&
			nw.kind === old.kind &&
			nw.code === old.code &&
			nw.at === old.at;
		const selfApprove =
			self && old?.state === 'pending' && nw?.state === 'approved' && nw.kind === old.kind && (c.next.planners || {})[uid] === true && proofOk(c);
		if (!(planner || create || rename || selfApprove)) return 'device';
		if (nw === null) return null;
		if (typeof nw !== 'object' || !['name', 'kind', 'dev', 'code', 'state'].every((f) => f in nw)) return 'device fields';
		if (Object.keys(nw).some((f) => !['name', 'kind', 'dev', 'code', 'state', 'person', 'at'].includes(f))) return 'device extra';
		if (typeof nw.name !== 'string' || !nw.name.length || nw.name.length > 400) return 'device name';
		if (typeof nw.kind !== 'string' || !KIND.test(nw.kind)) return 'device kind';
		if (typeof nw.dev !== 'string' || !DEV.test(nw.dev) || (old && old.dev !== undefined && nw.dev !== old.dev)) return 'device dev';
		if (typeof nw.code !== 'string' || !/^[0-9]{4,8}$/.test(nw.code)) return 'device code';
		if (!['pending', 'approved', 'blocked'].includes(nw.state)) return 'device state';
		if ('person' in nw && (typeof nw.person !== 'string' || !DEV.test(nw.person))) return 'device person';
		if ('at' in nw && (typeof nw.at !== 'number' || !(nw.at > 0) || nw.at > Date.now() + DAY)) return 'device at';
		return null;
	},
	planners(c, uid, old, nw) {
		if (!c.uid || !isGate(c.t)) return 'auth';
		if (!(plannerBefore(c) || (c.uid === uid && nw === true && proofOk(c)))) return 'planner';
		if (nw === null) return null;
		return nw === true && (c.next.devices || {})[uid]?.state === 'approved' ? null : 'planner value';
	},
	claims(c, uid, old, nw) {
		return c.uid === uid && isGate(c.t) && typeof c.t.gate.proof === 'string' && nw === c.t.gate.proof ? null : 'claim';
	},
};

/** why this write would be refused: every item it changes must pass its rule */
function refusal(t, old, next, uid) {
	const c = { t, old, next, uid };
	for (const cat of new Set([...Object.keys(old), ...Object.keys(next)])) {
		const o = old[cat] || {};
		const n = next[cat] || {};
		if (!RULES[cat] || typeof n !== 'object') return `path ${cat}`;
		for (const id of new Set([...Object.keys(o), ...Object.keys(n)])) {
			if (canon(o[id]) === canon(n[id])) continue;
			const why = RULES[cat](c, id, o[id] ?? null, n[id] ?? null);
			if (why) return `${cat}/${id}: ${why}`;
		}
	}
	return null;
}

/** whether a device (uid, or null when signed out) may read `sub` of the trip */
function canRead(t, uid, sub) {
	if (isTokenTrip(t)) return true;
	if (!isGate(t) || !uid) return false;
	const approved = (t.tree.devices || {})[uid]?.state === 'approved';
	const [cat, id] = sub;
	if (cat === 'r') return approved;
	if (cat === 'devices' || cat === 'planners') return approved || id === uid;
	return false;
}

/** after a write: every open stream hears what changed under its path, or is cancelled when it may no longer read */
function notify(key, t, before) {
	for (const s of streams.get(key) || []) {
		if (!canRead(t, s.uid, s.sub)) {
			send(s.res, 'cancel', 'Permission denied');
			s.res.end();
			streams.get(key).delete(s);
			continue;
		}
		const was = at(before, s.sub);
		const now = at(t.tree, s.sub);
		if (canon(was) === canon(now)) continue;
		if (was && now && typeof was === 'object' && typeof now === 'object') {
			const data = {};
			for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) if (canon(was[k]) !== canon(now[k])) data[k] = now[k] ?? null;
			send(s.res, 'patch', { path: '/', data });
		} else send(s.res, 'put', { path: '/', data: now });
	}
}
function endTrip(key) {
	trips.delete(key);
	for (const s of streams.get(key) || []) {
		send(s.res, 'cancel', 'Permission denied');
		s.res.end();
	}
	streams.delete(key);
}

// a page's space comes in its cookie; a direct call (the rules' checks) names it as ?ns=, as the emulator wants it
const nsOf = (req, url) => (/(?:^|;\s*)rtdb_ns=([\w-]+)/.exec(req.headers.cookie || '') || [])[1] || url.searchParams.get('ns') || '';
const stateOf = (key) => {
	if (!trips.has(key)) trips.set(key, { token: null, gate: null, tree: {} });
	return trips.get(key);
};
const newUid = () =>
	crypto
		.randomBytes(21)
		.toString('base64')
		.replace(/[^A-Za-z0-9]/g, '')
		.padEnd(28, 'x')
		.slice(0, 28);

/** Identity Toolkit's anonymous sign-up and Secure Token's refresh, as the page calls them */
function fakeAuth(req, res, url) {
	if (req.method !== 'POST') return res.writeHead(405).end();
	if (!url.searchParams.get('key')) return json(res, 400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } });
	readBody(req).then((b) => {
		if (url.pathname === '/__auth/v1/accounts:signUp') {
			const uid = newUid();
			const rt = `stand-in-refresh.${crypto.randomBytes(18).toString('base64url')}`;
			refresh.set(rt, uid);
			return json(res, 200, {
				kind: 'identitytoolkit#SignupNewUserResponse',
				idToken: testIdToken(uid),
				refreshToken: rt,
				expiresIn: '3600',
				localId: uid,
			});
		}
		if (url.pathname === '/__auth/v1/token') {
			const p = new URLSearchParams(b);
			const uid = p.get('grant_type') === 'refresh_token' ? refresh.get(p.get('refresh_token') || '') : null;
			if (!uid) return json(res, 400, { error: { code: 400, message: 'INVALID_REFRESH_TOKEN' } });
			const rt = p.get('refresh_token');
			return json(res, 200, {
				expires_in: '3600',
				token_type: 'Bearer',
				refresh_token: rt,
				id_token: testIdToken(uid),
				user_id: uid,
				project_id: 'stand-in',
			});
		}
		res.writeHead(404).end();
	});
}

function admin(req, res, url) {
	const key = `${url.searchParams.get('trip') || ''}|${url.searchParams.get('ns') || ''}`;
	const route = `${req.method} ${url.pathname}`;
	if (route === 'POST /__rtdb-admin/key')
		readBody(req).then((token) => {
			endTrip(key);
			trips.set(key, { token, gate: null, tree: {} });
			res.end('ok');
		});
	// what `pnpm sync end` does: the token or gate and the trip's records go, and open streams are cancelled
	else if (route === 'DELETE /__rtdb-admin/key') {
		endTrip(key);
		res.end('ok');
	} else if (route === 'POST /__rtdb-admin/gate')
		readBody(req).then((b) => {
			const { proof } = b ? JSON.parse(b) : {};
			endTrip(key);
			trips.set(key, { token: null, gate: { approval: true, ...(proof ? { proof } : {}) }, tree: {} });
			res.end('ok');
		});
	else if (route === 'PATCH /__rtdb-admin/set')
		readBody(req).then((b) => {
			const t = trips.get(key);
			if (!t) return res.writeHead(404).end();
			const before = t.tree;
			for (const [p, v] of Object.entries(JSON.parse(b))) t.tree = put(t.tree, p.split('/').filter(Boolean), v);
			notify(key, t, before);
			res.end('ok');
		});
	else if (route === 'GET /__rtdb-admin/dump') {
		const t = trips.get(key);
		const p = url.searchParams.get('path');
		json(res, 200, !t ? null : p ? at(t.tree, p.split('/').filter(Boolean)) : t.tree.r || {});
	} else res.writeHead(404).end();
}

/** handles /__rtdb/…, /__auth/… and /__rtdb-admin/…; returns false for anything else */
export function fakeRtdb(req, res, url) {
	if (url.pathname.startsWith('/__auth/')) {
		fakeAuth(req, res, url);
		return true;
	}
	if (url.pathname.startsWith('/__rtdb-admin/')) {
		admin(req, res, url);
		return true;
	}
	if (!url.pathname.startsWith('/__rtdb')) return false;
	// the planner's own writes as the emulator's admin takes them (the rules' checks): a trip's token, its gate, the proof
	const o = /^\/__rtdb\/(keys|gates)\/([A-Za-z0-9_-]+)(\/proof)?\.json$/.exec(url.pathname);
	if (o && req.headers.authorization === 'Bearer owner' && (req.method === 'PUT' || req.method === 'DELETE')) {
		readBody(req).then((b) => {
			const key = `${o[2]}|${nsOf(req, url)}`;
			const t = stateOf(key);
			const v = req.method === 'PUT' ? JSON.parse(b) : null;
			if (o[1] === 'keys') t.token = v;
			else if (o[3]) t.gate = { ...(t.gate || {}), proof: v ?? undefined };
			else t.gate = v;
			notify(key, t, t.tree);
			json(res, 200, v);
		});
		return true;
	}
	const m = /^\/__rtdb\/trips\/([A-Za-z0-9_-]+)((?:\/[A-Za-z0-9_-]+)*)\.json$/.exec(url.pathname);
	if (!m) {
		denied(res); // the tokens, the gates, the list of trips: nobody reads or writes them here
		return true;
	}
	const key = `${m[1]}|${nsOf(req, url)}`;
	const sub = m[2].split('/').filter(Boolean);
	const t = stateOf(key);
	const token = url.searchParams.get('auth');
	const uid = token ? uidOf(token) : null;
	// a token that's malformed or expired is refused whatever the rules say, as the real database does
	if (token && !uid) {
		denied(res);
		return true;
	}
	if (req.method === 'GET') {
		if (!canRead(t, uid, sub)) {
			denied(res);
			return true;
		}
		const value = at(t.tree, sub);
		if (/text\/event-stream/.test(req.headers.accept || '')) {
			res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
			send(res, 'put', { path: '/', data: value });
			if (!streams.has(key)) streams.set(key, new Set());
			const s = { res, sub, uid };
			streams.get(key).add(s);
			const alive = setInterval(() => send(res, 'keep-alive', null), 15_000);
			req.on('close', () => {
				clearInterval(alive);
				streams.get(key)?.delete(s);
			});
		} else json(res, 200, value);
		return true;
	}
	if (req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE') {
		readBody(req).then((b) => {
			let body = null;
			if (req.method !== 'DELETE')
				try {
					body = JSON.parse(b);
				} catch {
					return json(res, 400, { error: "Invalid data; couldn't parse JSON object." });
				}
			if (req.method === 'PATCH' && (!body || typeof body !== 'object'))
				return json(res, 400, { error: 'Invalid data; couldn’t parse JSON object.' });
			// all or nothing, like a multi-path update
			let next = t.tree;
			if (req.method === 'PATCH') for (const [p, v] of Object.entries(body)) next = put(next, [...sub, ...p.split('/').filter(Boolean)], v);
			else next = put(next, sub, body);
			if (refusal(t, t.tree, next, uid)) return denied(res);
			const before = t.tree;
			t.tree = next;
			notify(key, t, before);
			if (url.searchParams.get('print') === 'silent') res.writeHead(204).end();
			else json(res, 200, body);
		});
		return true;
	}
	res.writeHead(405).end();
	return true;
}
