// A stand-in for the planner's Firebase Realtime Database, for the group-sync e2e tests (ADR-20261001-group-sync). It
// answers the REST API the page uses (GET, PATCH with print=silent, and the EventSource stream with put/patch/cancel
// events) and enforces what scripts/sync/database.rules.json enforces: a trip is readable only while its write token
// exists, a record needs that token and the exact shape, deletes are refused, and an older version never replaces a
// newer one. scripts/sync/rules-test.mjs checks the real rules on Firebase's own emulator.
// Test-only admin routes: POST/DELETE /__rtdb-admin/key?trip=…&ns=…, GET /__rtdb-admin/dump?trip=…&ns=…
// Tests run in parallel and every sync page holds the same trip id, so each test has its own space: the rtdb_ns cookie
// on its phones (the page itself never sees it), the ns parameter on admin calls.
const keys = new Map(); // trip → write token
const data = new Map(); // trip → { record name: record }
const streams = new Map(); // trip → Set of open responses

const DAY = 86_400_000;
const denied = (res) => res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"Permission denied"}');
const send = (res, event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
const readBody = (req) =>
	new Promise((ok) => {
		let b = '';
		req.on('data', (c) => (b += c));
		req.on('end', () => ok(b));
	});

/** why a record write would be refused, or null when the rules take it */
function refusal(trip, name, rec, old) {
	if (!/^[A-Za-z0-9_-]{22}$/.test(name)) return 'name';
	if (!rec || typeof rec !== 'object') return 'delete';
	const fields = Object.keys(rec).sort().join(',');
	if (fields !== 'c,d,k,u') return `fields ${fields}`;
	if (rec.k !== keys.get(trip)) return 'token';
	if (typeof rec.c !== 'string' || rec.c.length > 4096) return 'c';
	if (typeof rec.u !== 'number' || !(rec.u > 0) || rec.u > Date.now() + DAY) return 'u';
	if (typeof rec.d !== 'string' || !/^[A-Za-z0-9_-]{6,24}$/.test(rec.d)) return 'd';
	if (old && !(rec.u > old.u || (rec.u === old.u && rec.d > old.d))) return 'older';
	return null;
}

const nsOf = (req) => (/(?:^|;\s*)rtdb_ns=([\w-]+)/.exec(req.headers.cookie || '') || [])[1] || '';

/** handles /__rtdb/… and /__rtdb-admin/…; returns false for anything else */
export function fakeRtdb(req, res, url) {
	if (url.pathname.startsWith('/__rtdb-admin/')) {
		const trip = `${url.searchParams.get('trip') || ''}|${url.searchParams.get('ns') || ''}`;
		if (url.pathname === '/__rtdb-admin/key' && req.method === 'POST') {
			readBody(req).then((token) => {
				keys.set(trip, token);
				data.set(trip, {});
				res.end('ok');
			});
		} else if (url.pathname === '/__rtdb-admin/key' && req.method === 'DELETE') {
			// what `pnpm sync end` does: the token and the trip's records go, and open streams are cancelled
			keys.delete(trip);
			data.delete(trip);
			for (const s of streams.get(trip) || []) {
				send(s, 'cancel', 'Permission denied');
				s.end();
			}
			streams.delete(trip);
			res.end('ok');
		} else if (url.pathname === '/__rtdb-admin/dump') {
			res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(data.get(trip) || null));
		} else res.writeHead(404).end();
		return true;
	}
	const m = /^\/__rtdb\/trips\/([A-Za-z0-9_-]+)\/r\.json$/.exec(url.pathname);
	if (!m) {
		if (!url.pathname.startsWith('/__rtdb')) return false;
		res.writeHead(404).end();
		return true;
	}
	const trip = `${m[1]}|${nsOf(req)}`;
	if (!keys.has(trip)) {
		denied(res);
		return true;
	}
	const recs = data.get(trip);
	if (req.method === 'GET' && /text\/event-stream/.test(req.headers.accept || '')) {
		res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
		send(res, 'put', { path: '/', data: Object.keys(recs).length ? recs : null });
		if (!streams.has(trip)) streams.set(trip, new Set());
		streams.get(trip).add(res);
		const alive = setInterval(() => send(res, 'keep-alive', null), 15_000);
		req.on('close', () => {
			clearInterval(alive);
			streams.get(trip)?.delete(res);
		});
		return true;
	}
	if (req.method === 'GET') {
		res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(Object.keys(recs).length ? recs : null));
		return true;
	}
	if (req.method === 'PATCH') {
		readBody(req).then((b) => {
			let body;
			try {
				body = JSON.parse(b);
			} catch {
				return res.writeHead(400).end('{"error":"Invalid data; couldn\'t parse JSON object."}');
			}
			// all or nothing, like a multi-path update
			if (!body || typeof body !== 'object' || Object.entries(body).some(([name, rec]) => refusal(trip, name, rec, recs[name]))) return denied(res);
			Object.assign(recs, body);
			for (const s of streams.get(trip) || []) send(s, 'patch', { path: '/', data: body });
			if (url.searchParams.get('print') === 'silent') res.writeHead(204).end();
			else res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
		});
		return true;
	}
	res.writeHead(405).end();
	return true;
}
