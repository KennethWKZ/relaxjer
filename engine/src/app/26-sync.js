/* ───────── group sync (ADR-20261001-group-sync) ─────────
   On when the build put the trip's database in (SYNC, 01-storage.js). The page talks to the planner's own Firebase
   Realtime Database over its plain HTTPS API: fetch to read and write, EventSource for live changes, no library. Each
   record is encrypted on the phone (AES-GCM) under a name the database can't read (an HMAC of the record id), and the
   database's rules only take it with the trip's write token. This phone's saved state stays the source of truth: a change
   is saved here first, queued, and sent when there's a connection; what comes from the group is checked, merged newest
   wins per record (core/sync.mjs, `Sync`) and put back into the saved state, then the page redraws once it has settled.
   On an approval trip (SYNC_GATE, ADR-20261127-sync-approval) there's no write token: the device signs in to Firebase
   anonymously over REST, asks to join with the name its person typed (sealed), and reads or writes records only once a
   planner approved it; until then its changes wait on it. Names, planners and blocks then come from the database's
   devices/ and planners/ entries, which the rules guard, not from records. */
let syncApi = null;
const toB64u = (u8) =>
	btoa(String.fromCharCode(...u8))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const utf8 = (s) => new TextEncoder().encode(s);

if (SYNC) groupSync();

function groupSync() {
	const root = `${String(SYNC.url).replace(/\/$/, '')}/trips/${SYNC.trip}`;
	const base = `${root}/r`;
	if (!(window.crypto && crypto.subtle)) {
		syncStatus = { state: 'unsupported', at: 0, waiting: 0 };
		return;
	}
	// what this phone knows about the group's records (versions) and its own changes not yet sent; a new database for
	// the trip (the planner set sync up again) starts over, keeping the device id and the name
	const meta = (() => {
		const m = store.get('sync', null);
		const fresh = {
			room: SYNC.trip,
			dev: toB64u(crypto.getRandomValues(new Uint8Array(9))),
			name: '',
			known: {},
			pending: {},
			seeded: false,
			code: '', // an approval trip's join code, shown while the device waits
		};
		if (!m || typeof m !== 'object') return fresh;
		if (m.room !== SYNC.trip) return { ...fresh, dev: m.dev || fresh.dev, name: m.name || '' };
		return { ...fresh, ...m, known: m.known || {}, pending: m.pending || {} };
	})();
	const save = () => store.set('sync', meta);

	// two keys from the trip's one: one encrypts records, one names them
	const keysP = (async () => {
		const raw = await crypto.subtle.importKey('raw', fromB64u(SYNC.key), 'HKDF', false, ['deriveKey']);
		const derive = (info, alg, use) =>
			crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: utf8(info) }, raw, alg, false, use);
		return {
			enc: await derive('relaxjer sync record', { name: 'AES-GCM', length: 256 }, ['encrypt', 'decrypt']),
			mac: await derive('relaxjer sync name', { name: 'HMAC', hash: 'SHA-256', length: 256 }, ['sign']),
		};
	})();
	const hids = new Map();
	async function hidOf(rid) {
		if (!hids.has(rid)) {
			const { mac } = await keysP;
			hids.set(rid, toB64u(new Uint8Array(await crypto.subtle.sign('HMAC', mac, utf8(rid)))).slice(0, 22));
		}
		return hids.get(rid);
	}
	// the record's name is bound in, so a record copied under another name doesn't open
	const aad = (hid) => utf8(`${SYNC.trip}/${hid}`);
	async function seal(hid, payload) {
		const { enc } = await keysP;
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(hid) }, enc, utf8(JSON.stringify(payload)));
		return `${toB64u(iv)}.${toB64u(new Uint8Array(ct))}`;
	}
	async function decode(hid, rec) {
		try {
			if (!rec || typeof rec.c !== 'string' || typeof rec.u !== 'number' || typeof rec.d !== 'string') return null;
			const [iv, ct] = rec.c.split('.');
			const { enc } = await keysP;
			const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(iv), additionalData: aad(hid) }, enc, fromB64u(ct));
			const p = JSON.parse(new TextDecoder().decode(pt));
			if (!p || typeof p.r !== 'string' || (await hidOf(p.r)) !== hid) return null;
			const v = Sync.cleanRecord(p.r, p.v);
			return v === undefined ? null : [p.r, { v, u: rec.u, d: rec.d, n: String(p.n || '').slice(0, 24) }];
		} catch {
			return null; // not this trip's, or damaged: ignored
		}
	}

	// the state as saved, and every change to it noted as records to send
	const stateNow = () => ({
		mine: mineAll(),
		shift: store.get('shift', {}) || {},
		fltArr: store.get('fltArr', '') || '',
		fltDep: store.get('fltDep', '') || '',
		checks: store.get('checks', {}) || {},
		people: store.get('people', {}) || {},
		roles: store.get('roles', {}) || {},
		blocks: store.get('blocks', {}) || {},
		kits: store.get('kits', {}) || {},
	});
	// what kind of device this is (iPhone · home-screen app, Mac · Chrome), so the group can tell one person's devices
	// apart. Told with this device's name or its changes, never on its own: a device that only reads stays unlisted
	const KIND = Sync.deviceKind({ ua: navigator.userAgent, standalone: isStandalone(), touch: navigator.maxTouchPoints || 0 });
	const kitOff = () => !SYNC_GATE && ((store.get('kits', {}) || {})[meta.dev] || '') !== KIND;
	// the records this device shares; on an approval trip names, roles, blocks and kinds live in the database's entries
	const recsNow = () => (SYNC_GATE ? Sync.ungated : (r) => r)(Sync.recordsOf(stateNow(), sharedTick));
	let prev = recsNow();
	let quiet = false;
	let remoteWho = null;
	const rawSet = store.set;
	// every stop that leaves the plan, here or from the group, goes on this phone's "recently removed" list
	store.set = (k, v) => {
		const before = k === 'mine' ? mineAll() : null;
		rawSet(k, v);
		if (before) {
			const who = quiet && remoteWho ? remoteWho : { at: Date.now(), by: meta.name, me: true };
			rawSet('syncGone', Sync.goneLog(store.get('syncGone', []), before, Array.isArray(v) ? v : [], who));
		}
		if (!quiet && Sync.KEYS.includes(k)) noteLocal();
	};
	let soonT = 0;
	function noteLocal() {
		let next = recsNow();
		if (Sync.changes(prev, next).length && kitOff()) {
			rawSet('kits', { ...(store.get('kits', {}) || {}), [meta.dev]: KIND });
			next = recsNow();
		}
		const u = Date.now();
		for (const [rid, v] of Sync.changes(prev, next)) meta.pending[rid] = { v, u, d: meta.dev };
		prev = next;
		save();
		status(syncStatus.state === 'ok' ? 'ok' : syncStatus.state);
		clearTimeout(soonT);
		soonT = setTimeout(push, 400);
	}

	// what came from the group goes into the saved state in one go, quietly (it isn't sent back), then one redraw
	function applyRemote(list) {
		// a phone telling its name or what kind of device it is isn't news worth a toast
		const theirs = list.filter(([rid, , ver]) => ver.d !== meta.dev && !rid.startsWith('who:') && !rid.startsWith('kit:'));
		let note = theirs.length ? syncNote(theirs) : '';
		let act;
		// read on opening the page or coming back to it: news the reader wasn't there for, kept in a card on Today until they
		// say they've seen it (ADR-20261127-while-away). Worded now, while the plan still holds what a removal took away
		if (awayOpen && theirs.length) {
			const adds = theirs
				.map((it) => {
					const t = syncPair(it);
					return t && { r: it[0], u: it[2].u, d: it[2].d, n: it[2].n || '', t, day: syncDayOf(it) };
				})
				.filter(Boolean);
			if (adds.length) {
				rawSet('syncAway', Sync.awayLog(store.get('syncAway', []), adds));
				const n = adds.length;
				note = Z(`你不在时有 ${n} 处改动`, `${n} change${n > 1 ? 's' : ''} while you were away`);
				act = { label: Z('看看', 'See'), run: () => landOn($('#syncAway'), true) };
			}
		}
		const next = Sync.applyRecords(
			stateNow(),
			list.map(([rid, v]) => [rid, v]),
			sharedTick,
		);
		const by = theirs.find(([rid, v]) => rid.startsWith('stop:') && v === null);
		remoteWho = { at: Date.now(), by: by ? by[2].n || '' : '', me: false };
		const wasBlocked = blockedHere();
		quiet = true;
		try {
			mineSet(next.mine);
			store.set('shift', next.shift);
			store.set('fltArr', next.fltArr);
			store.set('fltDep', next.fltDep);
			store.set('checks', next.checks);
			store.set('people', next.people);
			store.set('roles', next.roles);
			store.set('blocks', next.blocks);
			store.set('kits', next.kits);
			checks = next.checks;
		} finally {
			quiet = false;
			remoteWho = null;
		}
		for (const [rid, , ver] of list) meta.known[rid] = { u: ver.u, d: ver.d };
		prev = recsNow();
		save();
		whenSettled(() => mineRerender(note, act));
		syncSheetRefresh();
		if (wasBlocked && !blockedHere())
			setTimeout(push, 0); // unblocked: what waited here goes now
		else if (blockedHere()) status('blocked');
	}
	async function takeIn(recs) {
		let all = {};
		for (const [hid, rec] of Object.entries(recs && typeof recs === 'object' ? recs : {})) {
			const d = await decode(hid, rec);
			if (d) all[d[0]] = d[1];
		}
		if (SYNC_GATE) all = Sync.ungated(all); // names, planners and blocks come from the database's entries there
		// what a blocked phone wrote doesn't count here, whatever it is
		const { remote } = Sync.dropBlocked(all, store.get('blocks', {}) || {});
		const { apply, drop } = Sync.merge(meta.known, meta.pending, remote);
		for (const rid of drop) {
			delete meta.pending[rid];
			meta.known[rid] = { u: remote[rid].u, d: remote[rid].d };
		}
		if (apply.length) applyRemote(apply);
		else if (drop.length) save();
	}

	const denied = (r) => r.status === 401 || r.status === 403;

	/* ── an approval trip: signing in, the join request, the group's entries (ADR-20261127-sync-approval) ── */
	const A = SYNC.approval || null;
	// the device's anonymous account: its user id, the refresh token that keeps it, the ID token the database takes
	let auth = (() => {
		const a = store.get('syncAuth', null);
		return a && typeof a === 'object' && a.room === SYNC.trip && a.uid && a.refresh ? a : null;
	})();
	let signing = null;
	/** an ID token for the database's `auth=`: the saved one while it lasts, else a refreshed one, else a new account */
	function idToken() {
		if (auth && auth.id && auth.exp > Date.now() + 60000) return Promise.resolve(auth.id);
		if (!signing) signing = signIn().finally(() => (signing = null));
		return signing;
	}
	async function signIn() {
		const key = `?key=${encodeURIComponent(A.apiKey)}`;
		if (auth) {
			const r = await fetch(`${A.token}${key}`, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refresh)}`,
			});
			if (r.ok) {
				const j = await r.json();
				auth = { ...auth, id: j.id_token, refresh: j.refresh_token || auth.refresh, exp: Date.now() + Number(j.expires_in || 3600) * 1000 };
				store.set('syncAuth', auth);
				return auth.id;
			}
			if (r.status !== 400) throw new Error(`sign-in ${r.status}`); // the line or the server: try again later
			auth = null; // the account is gone: this device starts again as a new one, and asks again
		}
		const r = await fetch(`${A.signUp}${key}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{"returnSecureToken":true}',
		});
		if (!r.ok) throw new Error(`sign-in ${r.status}`);
		const j = await r.json();
		auth = { room: SYNC.trip, uid: j.localId, refresh: j.refreshToken, id: j.idToken, exp: Date.now() + Number(j.expiresIn || 3600) * 1000 };
		store.set('syncAuth', auth);
		adoptUid();
		return auth.id;
	}
	// a device's sync id is the start of its user id, so the rules can check a record is its own. What it changed before
	// it signed in (its first open offline) moves to the new id
	function adoptUid() {
		const dev = auth && Sync.devOfUid(auth.uid);
		if (!dev || dev === meta.dev) return;
		const old = meta.dev;
		meta.dev = dev;
		meta.code = Sync.joinCode(crypto.getRandomValues(new Uint8Array(2)));
		meta.joined = 'none';
		syncGate = { ...syncGate, state: 'none', code: meta.code };
		for (const p of Object.values(meta.pending)) if (p.d === old) p.d = dev;
		save();
		const mine = mineAll();
		if (mine.some((x) => x.dev === old)) mineSet(mine.map((x) => (x.dev === old ? { ...x, dev } : x)));
	}
	/** a call to the trip's database as this device (path under trips/<trip>) */
	async function api(path, init = {}, silent = false) {
		const tok = await idToken();
		return fetch(`${root}${path ? `/${path}` : ''}.json?${silent ? 'print=silent&' : ''}auth=${encodeURIComponent(tok)}`, {
			cache: 'no-store',
			...init,
		});
	}
	const quietSet = (k, v) => {
		quiet = true;
		try {
			store.set(k, v);
		} finally {
			quiet = false;
		}
	};
	/** where this device stands: none (hasn't asked), pending, approved or blocked */
	function setGate(st) {
		const was = syncGate.state;
		syncGate = { ...syncGate, state: st, code: meta.code };
		if (meta.joined !== st) {
			meta.joined = st;
			save();
		}
		// a blocked device reads only its own entry: it marks itself, so its bar and its sends stop as on a token trip
		const b = store.get('blocks', {}) || {};
		if ((st === 'blocked') !== !!b[meta.dev]) {
			const nb = { ...b };
			if (st === 'blocked') nb[meta.dev] = true;
			else delete nb[meta.dev];
			quietSet('blocks', nb);
		}
		if (was !== st) {
			syncSheetRefresh();
			syncBarPaint();
		}
	}
	// its own entry as the database has it: its state, and once in, the name a planner confirmed
	async function ownEntry(e) {
		const st = e && ['pending', 'approved', 'blocked'].includes(e.state) ? e.state : 'none';
		if (e && st !== 'pending') {
			const n = await Sync.openName((await keysP).enc, SYNC.trip, auth.uid, e.name);
			if (n && n !== meta.name) {
				const first = !meta.name;
				meta.name = n;
				save();
				named(first ? Z('名字已保存', 'Name saved') : Z(`规划人把你的名字设为「${n}」`, `A planner set your name to ${n}`));
			}
		}
		if (e && e.code && e.code !== meta.code) {
			meta.code = e.code;
			save();
		}
		setGate(st);
	}
	/**
	 * Its own entry, read: the state, or 'ended' when the database won't say (the planner ended sync), or null offline. A
	 * device with a name and no entry asks to join here.
	 */
	async function gateCheck() {
		try {
			await idToken();
			const r = await api(`devices/${auth.uid}`);
			if (denied(r)) {
				status('ended');
				return 'ended';
			}
			if (!r.ok) throw new Error(`sync ${r.status}`);
			const e = await r.json();
			if (e) await ownEntry(e);
			else {
				setGate('none');
				if (meta.name) await askToJoin();
			}
			if (syncGate.state !== 'approved') status(syncGate.state);
			return syncGate.state;
		} catch {
			status('waiting');
			return null;
		}
	}
	/**
	 * The join request: the name its person typed (sealed), its kind, its sync id and the join code it shows, as pending.
	 * While it waits, a new name changes the request. True when the database took it.
	 */
	async function askToJoin() {
		if (!meta.name) return false;
		await idToken();
		const sealed = await Sync.sealName((await keysP).enc, SYNC.trip, auth.uid, meta.name);
		if (!meta.code) {
			meta.code = Sync.joinCode(crypto.getRandomValues(new Uint8Array(2)));
			save();
		}
		const entry = { name: sealed, kind: KIND, dev: meta.dev, code: meta.code, state: 'pending', at: Date.now() };
		let r = syncGate.state === 'pending' ? await api(`devices/${auth.uid}/name`, { method: 'PUT', body: JSON.stringify(sealed) }, true) : null;
		if (!r || denied(r)) r = await api(`devices/${auth.uid}`, { method: 'PUT', body: JSON.stringify(entry) }, true);
		if (!r.ok) return false;
		setGate('pending');
		status('pending');
		return true;
	}
	/** who's in the group, who's a planner and blocked, and the join requests: read by an approved device */
	async function readGroup() {
		const [d, p] = await Promise.all([api('devices'), api('planners')]);
		if (denied(d) || denied(p)) return false;
		if (!d.ok || !p.ok) throw new Error('sync group');
		const devices = await d.json();
		const planners = await p.json();
		const { enc } = await keysP;
		const names = {};
		for (const [uid, e] of Object.entries(devices && typeof devices === 'object' ? devices : {}))
			names[uid] = await Sync.openName(enc, SYNC.trip, uid, e && e.name);
		const g = Sync.groupOf(devices, planners, names);
		syncGate = { ...syncGate, requests: g.requests, persons: g.persons, uidOf: g.uidOf };
		quiet = true;
		try {
			store.set('people', g.people);
			store.set('roles', g.roles);
			store.set('blocks', g.blocks);
			store.set('kits', g.kits);
		} finally {
			quiet = false;
		}
		if (devices && devices[auth.uid]) await ownEntry(devices[auth.uid]);
		syncSheetRefresh();
		return true;
	}
	/**
	 * A planner's choices on devices, as one write the rules take from a planner, then the group read again. steps = [[act,
	 * { dev, name, person, planner, on }]] (Sync.approvalWrites); a name is sealed for its device here.
	 */
	async function gate(steps) {
		try {
			const { enc } = await keysP;
			const writes = {};
			for (const [act, o] of steps) {
				const uid = o.uid || syncGate.uidOf[o.dev];
				if (!uid) throw new Error('no such device');
				const sealed = o.name ? await Sync.sealName(enc, SYNC.trip, uid, o.name) : undefined;
				Object.assign(writes, Sync.approvalWrites(act, { ...o, uid, dev: o.dev || Sync.devOfUid(uid), sealed }));
			}
			const r = await api('', { method: 'PATCH', body: JSON.stringify(writes) }, true);
			if (!r.ok) throw new Error(`sync ${r.status}`);
			await readGroup();
			return true;
		} catch {
			toast(
				navigator.onLine === false
					? Z('没有网络：有网络时再试', 'Offline: try again once you’re online')
					: Z('数据库没收下这个改动，再试一次', 'The database didn’t take that: try again'),
			);
			await readGroup().catch(() => {});
			return false;
		}
	}

	/** reads the whole trip: true when read, false when the database refuses (sync ended), null when offline */
	async function pull() {
		try {
			const r = SYNC_GATE ? await api('r') : await fetch(`${base}.json`, { cache: 'no-store' });
			if (denied(r)) {
				// an approval trip: not let in (yet), blocked, or ended; its own entry says which
				if (SYNC_GATE) await gateCheck();
				else status('ended');
				return false;
			}
			if (!r.ok) throw new Error(`sync ${r.status}`);
			await takeIn(await r.json());
			if (!meta.read) {
				meta.read = true; // this phone has read the group once: from now on, what changed since is news
				save();
			}
			status('ok');
			return true;
		} catch {
			status('waiting');
			return null;
		}
	}
	let pushing = false;
	let pushAgain = false;
	const blockedHere = () => !!(store.get('blocks', {}) || {})[meta.dev];
	async function push(retry = true) {
		// a change made while a send is on its way goes right after it, not at the next 30 s tick
		if (pushing) {
			pushAgain = true;
			return;
		}
		const rids = Object.keys(meta.pending);
		if (!rids.length || navigator.onLine === false || syncStatus.state === 'ended') return;
		if (blockedHere()) return status('blocked'); // a planner blocked this phone: its changes stay here
		if (SYNC_GATE && syncGate.state !== 'approved') return; // not let in yet: its changes wait here until it is
		pushing = true;
		pushAgain = false;
		let refused = false;
		let took = false;
		try {
			const body = {};
			const sent = {};
			for (const rid of rids) {
				const p = meta.pending[rid];
				const hid = await hidOf(rid);
				// an approval trip's rules know the device by its sign-in, so no token goes with a record there
				body[hid] = { c: await seal(hid, { r: rid, v: p.v, n: meta.name }), u: p.u, d: p.d, ...(SYNC_GATE ? {} : { k: SYNC.token }) };
				sent[rid] = p.u;
			}
			const init = { method: 'PATCH', body: JSON.stringify(body) };
			const r = SYNC_GATE ? await api('r', init, true) : await fetch(`${base}.json?print=silent`, init);
			if (denied(r)) refused = true;
			else if (!r.ok) throw new Error(`sync ${r.status}`);
			else {
				for (const [rid, u] of Object.entries(sent)) {
					const p = meta.pending[rid];
					if (p && p.u === u) {
						meta.known[rid] = { u, d: p.d };
						delete meta.pending[rid];
					}
				}
				save();
				status('ok');
				took = true;
			}
		} catch {
			status('waiting');
		} finally {
			pushing = false;
		}
		// refused: someone's newer version won (the rules keep the newest), or the trip's sync was ended. Read the group's
		// state, which drops what lost, and try once more; refused again means the database won't take it
		if (refused) {
			const read = await pull();
			if (read && retry) return push(false);
			if (read) status('refused');
		} else if (took && pushAgain) setTimeout(push, 0); // a send that failed waits for 'online' or the next tick, as before
	}

	// live changes: the records; on an approval trip also the group's entries once in, or its own entry while it waits
	let streams = [];
	let listening = false;
	async function listen() {
		if (listening || streams.length || typeof EventSource === 'undefined' || document.hidden || syncStatus.state === 'ended') return;
		if (!SYNC_GATE) return watch(`${base}.json`, records);
		listening = true;
		try {
			const q = `?auth=${encodeURIComponent(await idToken())}`;
			if (streams.length || document.hidden) return;
			if (syncGate.state === 'approved') {
				watch(`${base}.json${q}`, records);
				watch(`${root}/devices.json${q}`, groupSoon);
				watch(`${root}/planners.json${q}`, groupSoon);
			} else watch(`${root}/devices/${auth.uid}.json${q}`, selfChanged);
		} catch {
			/* offline: the next return to the page or the line coming back opens it */
		} finally {
			listening = false;
		}
	}
	function watch(url, onMsg) {
		const es = new EventSource(url);
		const on = (e) => {
			let m;
			try {
				m = JSON.parse(e.data);
			} catch {
				return;
			}
			if (m && typeof m.path === 'string') onMsg(m);
		};
		es.addEventListener('put', on);
		es.addEventListener('patch', on);
		es.addEventListener('cancel', () => {
			stop();
			// the database stopped letting this phone read: find out why (on an approval trip, a block or the end)
			if (SYNC_GATE) pull().then(listen);
			else pull();
		});
		// the ID token in its address ran out: open it again with a fresh one
		es.addEventListener('auth_revoked', () => {
			stop();
			listen();
		});
		es.onerror = () => {
			if (es.readyState === 2) stop(); // closed for good: the next return to the page opens it again
		};
		streams.push(es);
	}
	function records(m) {
		const parts = m.path.split('/').filter(Boolean);
		if (!parts.length) takeIn(m.data);
		else if (parts.length === 1) takeIn({ [parts[0]]: m.data });
		else pull(); // a field inside a record: read the whole trip again
	}
	let groupT = 0;
	const groupSoon = () => {
		clearTimeout(groupT);
		groupT = setTimeout(() => readGroup().catch(() => {}), 250);
	};
	// waiting for a planner: its entry changed (approved, blocked, renamed). In: catch up with the group
	const selfChanged = () =>
		gateCheck().then((st) => {
			if (st === 'approved') {
				stop();
				catchUp();
			}
		});
	const stop = () => {
		for (const es of streams) es.close();
		streams = [];
	};
	// away: this read follows an absence (the page opening, or coming back to it), so what it brings is news the reader
	// missed; a read while they're looking (Sync now, back online) isn't
	let awayOpen = false;
	const catchUp = async (away = false) => {
		if (SYNC_GATE) {
			// not let in yet (or blocked, or ended): its changes wait here, and it listens for a planner's answer
			if ((await gateCheck()) !== 'approved') return listen();
			try {
				await readGroup(); // first, so a block in the group counts before the records do
			} catch {
				/* offline: the read below says so */
			}
		}
		awayOpen = away === true;
		try {
			await pull();
		} finally {
			awayOpen = false;
		}
		await push();
		listen();
	};
	document.addEventListener('visibilitychange', () => (document.hidden ? stop() : catchUp(true)));
	window.addEventListener('online', () => catchUp());
	window.addEventListener('offline', () => status('waiting'));
	setInterval(() => {
		if (!document.hidden && Object.keys(meta.pending).length) push();
		else syncPaint(); // "synced 2 min ago" keeps counting
	}, 30000);
	// the name: kept as it's typed, and once settled, shared as this phone's (`who:` record) and put on the stops it
	// added, so everyone sees who added them. A planner's name isn't for another phone to take, unless that phone is a
	// planner too: one planner's phone, tablet and laptop go by one name
	// (on an approval trip a planner confirms each name, so there's nothing to guard here)
	const takenByPlanner = (v) => {
		if (SYNC_GATE || syncIsPlanner()) return false;
		const k = Sync.nameKey(v);
		const people = store.get('people', {}) || {};
		const roles = store.get('roles', {}) || {};
		return !!k && Object.keys(roles).some((dev) => dev !== meta.dev && roles[dev] === 'planner' && Sync.nameKey(people[dev]) === k);
	};
	document.addEventListener('input', (e) => {
		const inp = e.target.closest('[data-sync-name]');
		if (!inp) return;
		const v = inp.value.trim().slice(0, 24);
		if (takenByPlanner(v) || (SYNC_GATE && !['none', 'pending'].includes(syncGate.state))) return; // in the group: a planner renames
		meta.name = v;
		save();
	});
	let namedAs = meta.name;
	function announce() {
		if (SYNC_GATE) return; // an approval trip's names are in the join requests, confirmed by a planner
		if (meta.name && kitOff()) store.set('kits', { ...(store.get('kits', {}) || {}), [meta.dev]: KIND });
		const people = { ...(store.get('people', {}) || {}) };
		if ((people[meta.dev] || '') === meta.name) return;
		if (meta.name) people[meta.dev] = meta.name;
		else delete people[meta.dev];
		store.set('people', people);
	}
	function named(msg) {
		announce();
		const own = (x) => Sync.ownerOf(x, meta.pending[`stop:${x.id}`] || meta.known[`stop:${x.id}`], meta.dev) === meta.dev;
		let n = 0;
		const list = mineAll().map((x) =>
			meta.name && own(x) && (!x.by || x.by === namedAs) && x.by !== meta.name ? (n++, { ...x, by: meta.name }) : x,
		);
		namedAs = meta.name;
		if (n) mineSet(list);
		whenSettled(() =>
			mineRerender(n ? `${msg}${Z(`，也写到你加的 ${n} 个行程上`, `, and put on the ${n} stop${n > 1 ? 's' : ''} you added`)}` : msg),
		);
		syncSheetRefresh();
		syncBarPaint();
	}
	document.addEventListener('change', (e) => {
		const inp = e.target.closest('[data-sync-name]');
		if (!inp) return;
		const v = inp.value.trim().slice(0, 24);
		if (SYNC_GATE) {
			// an approval trip: the name is the join request's. Once in the group, only a planner changes it
			if (!['none', 'pending'].includes(syncGate.state)) {
				meta.name = namedAs;
				save();
				inp.value = namedAs;
				return;
			}
			if (!v || (v === namedAs && syncGate.state === 'pending')) return;
			meta.name = v;
			save();
			named(Z('名字已保存', 'Name saved'));
			askToJoin()
				.then((ok) => {
					if (!ok) throw new Error('refused');
					stop();
					listen();
				})
				.catch(() => status(navigator.onLine === false ? 'waiting' : syncGate.state));
			return;
		}
		if (takenByPlanner(v)) {
			meta.name = namedAs;
			save();
			inp.value = namedAs;
			toast(
				Z(
					`「${v}」是一位规划人的名字。是你的话，先在「我是规划人」输入规划人密码；不是的话换一个吧`,
					`“${v}” is a planner’s name. If it’s yours, give the planner code under “I’m a planner” first; if not, pick another`,
				),
			);
			return;
		}
		if (v === namedAs) return; // nothing new (a redrawn sheet's field can fire change again)
		meta.name = v;
		save();
		named(Z('名字已保存', 'Name saved'));
	});
	// a phone from before names were shared tells the group its name now
	if (meta.name) announce();

	// the trip's planner code (`pnpm sync planner`), checked on the phone against the hash the build put in: the phone
	// that gives it becomes a planner, for everyone
	const pbkdf = async (code, salt) => {
		const k = await crypto.subtle.importKey('raw', utf8(code.trim()), 'PBKDF2', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64u(salt), iterations: Sync.PLANNER_ROUNDS }, k, 256);
		return toB64u(new Uint8Array(bits));
	};
	async function claim(code) {
		const p = SYNC.planner;
		if (!p || !code || !code.trim()) return false;
		if ((await pbkdf(code, p.salt)) !== p.hash) return false;
		if (SYNC_GATE) {
			await claimGate(code);
			return true;
		}
		store.set('roles', { ...(store.get('roles', {}) || {}), [meta.dev]: 'planner' });
		whenSettled(() => mineRerender(Z('你现在是规划人', 'You’re a planner now')));
		syncSheetRefresh();
		return true;
	}
	// an approval trip: the code's second hash (under the proof salt the build put in) is the proof the database checks.
	// A device that hasn't asked yet asks first; a pending one approves itself in the same write, as its own person
	async function claimGate(code) {
		if (!meta.name) {
			const inp = $('#placeSheet [data-sync-name]');
			if (inp) inp.focus();
			return toast(Z('先写上名字，再输入规划人密码', 'Type your name first, then the planner code'));
		}
		try {
			if (syncGate.state === 'none' && !(await askToJoin())) throw new Error('ask');
			const proof = await pbkdf(code, SYNC.planner.proofSalt);
			const uid = auth.uid;
			const writes = {
				[`claims/${uid}`]: proof,
				[`planners/${uid}`]: true,
				...(syncGate.state === 'pending' ? { [`devices/${uid}/state`]: 'approved', [`devices/${uid}/person`]: meta.dev } : {}),
			};
			const r = await api('', { method: 'PATCH', body: JSON.stringify(writes) }, true);
			if (!r.ok) throw new Error(`sync ${r.status}`);
			stop();
			await catchUp();
			whenSettled(() => mineRerender(Z('你现在是规划人', 'You’re a planner now')));
			syncSheetRefresh();
		} catch {
			toast(
				navigator.onLine === false
					? Z('没有网络：有网络时再输入规划人密码', 'Offline: give the planner code again once you’re online')
					: Z(
							'数据库没收下规划人密码：请设置同步的人再运行一次 pnpm sync planner',
							'The database didn’t take the planner code: whoever set up sync can run pnpm sync planner again',
						),
			);
		}
	}
	let claiming = false;
	const tryClaim = async () => {
		const inp = $('[data-planner-code]');
		if (claiming || !inp) return;
		claiming = true;
		try {
			if (!(await claim(inp.value))) {
				inp.value = '';
				toast(Z('规划人密码不对', 'That isn’t the planner code'));
			}
		} finally {
			claiming = false;
		}
	};
	document.addEventListener('click', (e) => {
		if (e.target.closest('[data-planner-ok]')) tryClaim();
	});
	document.addEventListener('keydown', (e) => {
		if (enterKey(e) && e.target.closest('[data-planner-code]')) tryClaim();
	});

	function status(state) {
		const waiting = Object.keys(meta.pending).length;
		const s = blockedHere() && state !== 'ended' ? 'blocked' : state === 'ok' && waiting ? 'waiting' : state;
		syncStatus = { state: s, at: state === 'ok' ? Date.now() : syncStatus.at, waiting };
		syncPaint();
	}
	syncApi = { now: () => catchUp(), name: () => meta.name, gate };
	// an approval trip: where this device stood last time, so the bar is right before the database answers
	if (SYNC_GATE)
		syncGate = { ...syncGate, state: auth && ['pending', 'approved', 'blocked'].includes(meta.joined) ? meta.joined : 'none', code: meta.code };
	syncBarPaint();

	// a phone that has read the group before gets what changed since as news; on its first read everything is new, so none
	const readBefore = !!meta.read || Object.keys(meta.known).length > 0;
	// a phone's first time on the group: what it already holds goes in as the oldest version, so anything synced wins
	if (!meta.seeded) {
		for (const [rid, v] of Object.entries(prev)) if (!meta.known[rid] && !meta.pending[rid]) meta.pending[rid] = { v, u: 1, d: meta.dev };
		meta.seeded = true;
		save();
	}
	catchUp(readBefore);
	syncWelcomeSoon();
}

/* a phone's first open with sync on and no name: a welcome sheet asks for it once, after the page has shown (a second,
   or the first scroll), never over another sheet. "Not now" leaves the bar under the header as the reminder */
function syncWelcomeSoon() {
	const m = syncMeta();
	if (!m || m.name || store.get('syncWelcomed', false)) return;
	let done = false;
	const show = () => {
		if (done) return;
		done = true;
		window.removeEventListener('scroll', show);
		const n = syncMeta();
		if (!n || n.name || $('dialog[open]')) return; // named meanwhile, or busy with another sheet: next time
		store.set('syncWelcomed', true);
		openSheet(syncWelcomeHTML());
	};
	setTimeout(show, 1200);
	window.addEventListener('scroll', show, { passive: true, once: true });
}
function syncWelcomeHTML() {
	return `<div data-sync-welcome><h3 class="spots-h">${icon('users')}${Z('欢迎！大家怎么称呼你？', 'Welcome! What should the group call you?')}</h3>
      <p class="small">${
				SYNC_GATE
					? Z(
							'全组同步已开：写上名字，规划人让这台设备加入后，你加的行程、改的时间就会出现在大家的设备上。在那之前，改动先留在这台设备。',
							'Group sync is on: give your name, and once a planner lets this device in, stops you add and times you change show on everyone’s devices. Until then they wait on this one.',
						)
					: Z(
							'全组同步已开：你加的行程、改的时间会出现在大家的页面上。写上名字，大家就知道是谁改的。',
							'Group sync is on: stops you add and times you change show on everyone’s page. Your name tells them who changed what.',
						)
			}</p>
      <label class="sync-name">${Z('你的名字', 'Your name')}<input type="text" data-sync-name data-welcome-name maxlength="24" autocomplete="nickname" enterkeyhint="done"></label>
      <div class="links-row"><button type="button" class="go-btn" data-welcome-save>${icon('check')}${Z('保存', 'Save')}</button><button type="button" class="mlink" data-close>${Z('先不用', 'Not now')}</button></div>
      <p class="xsmall muted">${Z('以后可以在「目录 → 全组同步」改。', 'You can change it later: Sections → Group sync.')}</p></div>`;
}
// Save (or Enter): the field's own change does the saving; the sheet closes once the name took
function syncWelcomeSave() {
	const inp = $('#placeSheet [data-welcome-name]');
	if (!inp) return;
	if (!inp.value.trim()) {
		inp.focus();
		return toast(Z('先写上名字', 'Type a name first'));
	}
	inp.dispatchEvent(new Event('change', { bubbles: true }));
	const m = syncMeta();
	if (m && m.name === inp.value.trim().slice(0, 24)) closeDialog($('#placeSheet'));
}
document.addEventListener('keydown', (e) => {
	if (enterKey(e) && e.target.closest('[data-welcome-name]')) {
		e.preventDefault();
		syncWelcomeSave();
	}
});

/* what the page says about it: a row in the sections menu, and a sheet with the details and the name others see. These
   are function declarations: the menu's first draw runs before this file does */
function syncAgo(at) {
	const m = Math.round((Date.now() - at) / 60000);
	if (m < 1) return Z('刚刚', 'just now');
	if (m < 60) return Z(`${m} 分钟前`, `${m} min ago`);
	if (m < 1440) return Z(`${Math.round(m / 60)} 小时前`, `${Math.round(m / 60)} h ago`);
	const d = Math.round(m / 1440);
	return Z(`${d} 天前`, `${d} day${d > 1 ? 's' : ''} ago`);
}
// how it stands, as a phrase: "synced 2 min ago", "3 changes waiting for a connection"
function syncState() {
	const s = syncStatus;
	const n = s.waiting;
	return (
		{
			starting: Z('连接中…', 'connecting…'),
			ok: s.at ? Z(`已同步 · ${syncAgo(s.at)}`, `synced ${syncAgo(s.at)}`) : Z('已同步', 'synced'),
			waiting: n ? Z(`${n} 个改动等网络`, `${n} change${n > 1 ? 's' : ''} waiting for a connection`) : Z('等网络', 'waiting for a connection'),
			refused: Z('数据库不收这个改动', 'the database refused a change'),
			ended: Z('已停止（规划人结束了同步）', 'stopped: the planner ended it'),
			blocked: Z('规划人停用了这台设备：改动只留在这里', 'a planner blocked this device: its changes stay on it'),
			unsupported: Z('这个浏览器用不了', 'not available in this browser'),
			// an approval trip, before a planner let this device in
			none: Z('写上名字，请规划人让这台设备加入', 'add your name to ask a planner to let this device in'),
			pending: Z('等规划人让这台设备加入全组的改动', 'waiting for a planner to let this device into the group’s changes'),
		}[s.state] || ''
	);
}
// the menu row's line under its name: how it stands
function syncLabel() {
	return Cap(syncState());
}
// a row of the settings that opens the Group sync sheet, so it ends in › like a row that goes somewhere
function syncRow() {
	return SYNC
		? `<button type="button" class="rl toc-sync" data-sync-open>${rlTile('users')}<span class="rl-t"><b>${Z('全组同步', 'Group sync')}</b><small data-sync-label>${syncLabel()}</small></span>${icon('chev-r', 'rl-ch')}</button>`
		: '';
}
/* who may do what (ADR-20261002-sync-planners). Function declarations reading the saved state, so the first draw (before
   this file runs) can ask too. Anyone changes or removes the stops their own phone added. A planner (the phone that gave
   the trip's planner code, or one a planner made planner) changes any stop, clears one person's, makes other phones
   planners, or puts the whole plan back. The page enforces it, not the database: it guards against mistakes */
function syncMeta() {
	const m = SYNC ? store.get('sync', null) : null;
	return m && typeof m === 'object' && m.room === SYNC.trip ? m : null;
}
function syncRoles() {
	return (SYNC && store.get('roles', {})) || {};
}
function syncIsBlocked(dev) {
	const m = syncMeta();
	const d = dev || (m && m.dev);
	return !!d && !!((SYNC && store.get('blocks', {})) || {})[d];
}
function syncIsPlanner(dev) {
	const m = syncMeta();
	const d = dev || (m && m.dev);
	return !!d && syncRoles()[d] === 'planner';
}
function stopVer(m, id) {
	return m && ((m.pending || {})[`stop:${id}`] || (m.known || {})[`stop:${id}`]);
}
function stopOwner(x) {
	const m = syncMeta();
	return Sync.ownerOf(x, stopVer(m, x.id), m ? m.dev : null);
}
function ownsStop(x) {
	const m = syncMeta();
	return !m || stopOwner(x) === m.dev;
}
function canEditStop(x) {
	return !SYNC || ownsStop(x) || syncIsPlanner();
}
function syncSheet() {
	const m = syncMeta() || {};
	const lead = syncIsPlanner();
	const lists = SHARED_GROUPS.map((id) => (CHECKLIST.find((g) => g.id === id) || {}).h)
		.filter(Boolean)
		.map((h) => Z(`「${L(h)}」`, `“${L(h)}”`))
		.join(Z('、', ', '));
	const reset =
		lead && (mineAll().length || store.get('fltArr', '') || store.get('fltDep', '') || Object.keys(store.get('shift', {}) || {}).length)
			? `<div class="sync-part"><p class="sub-h">${Z('规划人', 'Planner')}</p><button type="button" class="mlink danger" data-reset-all>${icon('x')}${Z('全组恢复原计划', 'Back to the original plan, for everyone')}</button><p class="xsmall muted">${Z('删掉所有人加的行程、改过的航班和往后推的时间。名字、规划人和清单勾选都会保留，删掉的行程在上面可以放回去。', 'Removes everyone’s added stops, flight changes and pushed-back times. Names, planners and ticks stay; removed stops can be put back above.')}</p></div>`
			: '';
	const claimBox =
		!lead && SYNC.planner && !syncIsBlocked()
			? `<details class="sync-code"><summary>${icon('users')}${Z('我是规划人（有规划人密码）', 'I’m a planner (I have the planner code)')}${icon('chev', 'chev')}</summary><label class="sync-name">${Z('规划人密码', 'Planner code')}<input type="password" data-planner-code autocomplete="current-password" enterkeyhint="go"></label><div class="links-row"><button type="button" class="go-btn" data-planner-ok>${icon('check')}${Z('确认', 'Confirm')}</button></div><p class="xsmall muted">${
					SYNC_GATE
						? Z(
								'密码是设置同步的人定的：输入后这台设备直接以规划人身份加入。其他规划人也可以把你设为规划人。',
								'The person who set up sync chose it: with it, this device lets itself in as a planner. A planner can also make you one.',
							)
						: Z(
								'密码是设置同步的人定的；其他规划人也可以直接把你设为规划人。',
								'The person who set up sync chose it; a planner can also make you one from their device.',
							)
				}</p></details>`
			: '';
	// an approval trip: the name is the join request's until a planner lets the device in; after that only a planner
	// renames it. While it waits, the join code it shows lets a planner tell its request from the others
	const gated = SYNC_GATE && !['none', 'pending'].includes(syncGate.state);
	const nameBox = gated
		? `<p class="sync-name sync-name-set"><span>${Z('你在全组的名字', 'Your name in the group')}</span><b>${esc(m.name || Z('（没有名字）', '(no name)'))}</b><span class="xsmall muted">${lead ? Z('在下面「全组」你那一行可以改', 'Change it under your row in The group below') : Z('只有规划人能改', 'Only a planner can change it')}</span></p>`
		: `<label class="sync-name">${SYNC_GATE ? Z('你的名字（规划人凭它让你加入）', 'Your name (a planner lets you in by it)') : Z('你的名字（别人收到你的改动时看到）', 'Your name (others see it on your changes)')}<input type="text" data-sync-name maxlength="24" value="${esc(m.name || '')}" autocomplete="nickname" enterkeyhint="done"></label>`;
	const waitBox =
		SYNC_GATE && syncGate.state === 'pending' && syncGate.code
			? `<p class="sync-join" data-sync-join>${icon('clock')}<span>${Z('加入码', 'Join code')} <b class="sync-join-code">${esc(syncGate.code)}</b><span class="xsmall muted">${Z('规划人在「全组同步」的「加入请求」里看到同一个码，就是这台设备。', 'A planner sees the same code under Join requests in their Group sync: that’s this device.')}</span></span></p>`
			: '';
	return `<div data-sync-sheet><h3 class="spots-h">${icon('users')}${Z('全组同步', 'Group sync')}</h3>
      <p class="sync-state" data-sync-state role="status">${Cap(syncState())}</p>
      <p class="small">${Z(`加的行程、往后推的时间、改过的航班时间${lists ? `和${lists}的勾选` : ''}，会出现在全组每个人的页面上。语言、主题、其他勾选只留在这台设备。`, `Added stops, pushed-back times and changed flight times${lists ? `, and ticks in ${lists},` : ''} show up on everyone’s page. Language, theme and other ticks stay on this one.`)}</p>
      ${nameBox}${waitBox}
      ${lead ? `<p class="sync-role">${icon('check')}${Z('你是规划人：可以改、删任何人加的行程，也可以把别人设为规划人', 'You’re a planner: you can change or remove anyone’s stops, and make others planners')}</p>` : claimBox}
      <div class="links-row"><button type="button" class="go-btn sync-now" data-sync-now>${icon('sync')}${Z('现在同步', 'Sync now')}</button></div>
      <p class="small muted">${Z('改动会自动同步；这个按钮只是马上再查一次。', 'Changes sync by themselves; this checks again right away.')}</p>
      ${SYNC_GATE && lead ? syncAsksHTML() : ''}${syncGroupHTML(m, lead)}${syncGoneHTML()}${reset}</div>`;
}
/* an approval trip's join requests, for a planner: each as "Mei · iPad · Safari" with its join code. Approve takes the
   typed name as a new person; "Same person as Mei (iPhone)" puts it under a person whose name matches; the fold edits
   the name or picks any person first; Block refuses it (ADR-20261127-sync-approval) */
function syncAsksHTML() {
	const asks = syncGate.requests || [];
	if (!asks.length) return '';
	const people = store.get('people', {}) || {};
	const kits = store.get('kits', {}) || {};
	const blocks = store.get('blocks', {}) || {};
	const group = { people, persons: syncGate.persons || {}, blocks };
	// every person in the group once, by the name and kind of their first device: "Mei (iPhone · Safari)"
	const persons = [];
	for (const dev of Object.keys(group.persons)) {
		if (blocks[dev] || persons.some((p) => p.person === group.persons[dev])) continue;
		persons.push({ dev, person: group.persons[dev], name: people[dev] || '' });
	}
	const who = (p) => `${p.name || Z('没写名字的人', 'Someone with no name')}${kits[p.dev] ? ` (${kitLabel(kits[p.dev])})` : ''}`;
	const rows = asks.map((a) => {
		const same = Sync.samePerson(a.name, group);
		const title = [a.name || Z('没写名字', 'No name'), kitLabel(a.kind)].filter(Boolean).join(' · ');
		// the join code is what the planner compares with the device's screen, so it stands out: big bold figures, as the
		// waiting device shows them; no fill, so it never looks like the tappable fold below (affordances rule 8)
		const chip = a.code
			? `<span class="join-chip"><span class="join-chip-l">${Z('加入码', 'join code')}</span> <b class="sync-join-code">${esc(a.code)}</b></span>`
			: '';
		const sub = a.at ? Z(`${syncAgo(a.at)}请求`, `asked ${syncAgo(a.at)}`) : '';
		const sameBtns = same
			.map(
				(p) =>
					`<button type="button" class="mlink" data-ask-person="${esc(a.uid)}" data-person="${esc(p.person)}" data-person-name="${esc(p.name)}">${icon('users')}${esc(Z(`和${who(p)}是同一个人`, `Same person as ${who(p)}`))}</button>`,
			)
			.join('');
		const pick = persons
			.map(
				(p) =>
					`<button type="button" class="mlink" data-ask-person="${esc(a.uid)}" data-person="${esc(p.person)}" data-person-name="${esc(p.name)}">${icon('users')}${esc(who(p))}</button>`,
			)
			.join('');
		return `<li class="sync-row sync-ask" data-sync-ask="${esc(a.uid)}"><span><b>${esc(title)}</b>${chip}${sub ? `<span class="xsmall muted sync-row-sub">${esc(sub)}</span>` : ''}</span>
        <span class="sync-acts">${sameBtns}<button type="button" class="mlink" data-ask-ok="${esc(a.uid)}">${icon('check')}${same.length ? Z('作为新的一个人同意', 'Approve as someone new') : Z('同意', 'Approve')}</button><button type="button" class="mlink danger" data-ask-block="${esc(a.uid)}">${icon('x')}${Z('停用', 'Block')}</button></span>
        <details class="sync-code sync-ask-more" data-fold="ask-${esc(a.uid)}"><summary>${icon('users')}${Z('改名字或选一个人', 'Edit the name or pick a person')}${icon('chev', 'chev')}</summary>
          <label class="sync-name">${Z('名字', 'Name')}<input type="text" data-ask-name="${esc(a.uid)}" maxlength="24" value="${esc(a.name)}" autocomplete="off" enterkeyhint="done"></label>
          <div class="links-row"><button type="button" class="go-btn" data-ask-named="${esc(a.uid)}">${icon('check')}${Z('用这个名字同意', 'Approve with this name')}</button></div>
          ${pick ? `<p class="sub-h">${Z('或者，是这个人的另一台设备', 'Or, another device of')}</p><div class="sync-acts sync-pick">${pick}</div>` : ''}
        </details></li>`;
	});
	return `<div class="sync-part sync-asks"><p class="sub-h">${Z(`加入请求（${asks.length}）`, `Join requests (${asks.length})`)}</p><ul class="sync-list">${rows.join('')}</ul></div>`;
}
// what kind of device a phone said it is, as the group reads it: "iPhone · home-screen app", "Mac · Chrome"
function kitLabel(kit) {
	const [os, app] = String(kit || '').split('/');
	const OS = {
		iphone: 'iPhone',
		ipad: 'iPad',
		android: Z('安卓', 'Android'),
		huawei: Z('华为', 'Huawei'),
		mac: 'Mac',
		windows: 'Windows',
		chromebook: 'Chromebook',
		linux: 'Linux',
	};
	const APP = {
		app: Z('主画面 App', 'home-screen app'),
		safari: 'Safari',
		chrome: 'Chrome',
		firefox: 'Firefox',
		edge: 'Edge',
		samsung: Z('三星浏览器', 'Samsung Internet'),
		huawei: Z('华为浏览器', 'Huawei Browser'),
		oppo: Z('OPPO 浏览器', 'OPPO Browser'),
		xiaomi: Z('小米浏览器', 'Xiaomi Browser'),
		vivo: Z('vivo 浏览器', 'vivo Browser'),
		wechat: Z('微信', 'WeChat'),
	};
	const o = OS[os] || '';
	const a = APP[app] || '';
	return o && a.startsWith(o) ? a : [o, a].filter(Boolean).join(' · '); // "Huawei Browser", not "Huawei · Huawei Browser"
}
// the group, one entry per person (Sync.byPerson): a name on a phone, a tablet and a laptop is one person, with each
// device under it by its kind and when it last changed something. Roles, blocks and stops stay per device: everyone can
// clear their own stops; a planner can clear anyone's, make a device a planner or not, and block one. Blocked devices
// fold away at the end, out of the way
function syncGroupHTML(m, lead) {
	const people = store.get('people', {}) || {};
	const roles = syncRoles();
	const blocks = store.get('blocks', {}) || {};
	const kits = store.get('kits', {}) || {};
	const groups = Sync.byPhone(mineAll(), (id) => stopVer(m, id), m.dev || null, people);
	// every device heard from, named or not, so a planner can block one that never gave a name; and when it last wrote
	const last = {};
	const heard = new Set();
	for (const v of [...Object.values(m.known || {}), ...Object.values(m.pending || {})]) {
		if (!v || !v.d) continue;
		heard.add(v.d);
		if (v.u > 1 && !(last[v.d] >= v.u)) last[v.d] = v.u; // 1: what a phone held before it joined, not a change
	}
	const devs = [
		...new Set([
			...(m.dev && people[m.dev] ? [m.dev] : []),
			...groups.map((g) => g.dev),
			...Object.keys(people),
			...Object.keys(roles),
			...Object.keys(blocks),
			...heard,
		]),
	].filter((d) => d && /^[A-Za-z0-9_-]{6,24}$/.test(d));
	if (!devs.length) return '';
	// an approval trip groups devices by the person a planner put them under, not by the name they typed
	const persons = SYNC_GATE ? syncGate.persons || {} : null;
	const { people: list, blocked } = Sync.byPerson(devs, people, blocks, m.dev || null, persons);
	// a planner on an approval trip renames a person, or moves a device to another person or onto its own
	const fix = (dev) => {
		if (!SYNC_GATE || !lead || !syncGate.uidOf[dev] || blocks[dev]) return '';
		const mineP = persons[dev] || dev;
		const others = list.filter((p) => !p.devs.some((d) => (persons[d] || d) === mineP));
		const alone = list.find((p) => p.devs.includes(dev));
		const moves = [
			...others.map(
				(p) =>
					`<button type="button" class="mlink" data-dev-move="${esc(dev)}" data-person="${esc(persons[p.devs[0]] || p.devs[0])}" data-person-name="${esc(p.name)}">${icon('users')}${esc(Z(`移到${p.name || '没写名字的人'}下`, `Move to ${p.name || 'someone with no name'}`))}</button>`,
			),
			alone && alone.devs.length > 1
				? `<button type="button" class="mlink" data-dev-move="${esc(dev)}" data-person="${esc(dev)}" data-person-name="${esc(people[dev] || '')}">${Z('单独作为一个人', 'Make it a person of its own')}</button>`
				: '',
		].join('');
		return `<details class="sync-code sync-fix" data-fold="fix-${esc(dev)}"><summary>${icon('users')}${Z('改名字或换人', 'Change the name or person')}${icon('chev', 'chev')}</summary>
        <label class="sync-name">${Z('这个人的名字（他所有的设备都改）', 'This person’s name (on all their devices)')}<input type="text" data-dev-name="${esc(dev)}" maxlength="24" value="${esc(people[dev] || '')}" autocomplete="off" enterkeyhint="done"></label>
        <div class="links-row"><button type="button" class="go-btn" data-dev-rename="${esc(dev)}">${icon('check')}${Z('改名字', 'Rename')}</button></div>
        ${moves ? `<div class="sync-acts sync-pick">${moves}</div>` : ''}</details>`;
	};
	const nameOf = (dev) => {
		const g = groups.find((x) => x.dev === dev);
		const name = people[dev] || (g && g.by) || '';
		return dev === m.dev ? (name ? Z(`你（${name}）`, `You (${name})`) : Z('你', 'You')) : name || Z('没写名字的人', 'Someone with no name');
	};
	// one device: its stops, its kind and last change under the label, and what can be done with it here
	const row = (dev, label) => {
		const g = groups.find((x) => x.dev === dev) || { ids: [] };
		const n = g.ids.length;
		const mine = dev === m.dev;
		const planner = roles[dev] === 'planner';
		const isBlocked = !!blocks[dev];
		const sub = [
			label.kit ? kitLabel(kits[dev]) : '',
			n ? Z(`加了 ${n} 个行程`, `${n} added stop${n > 1 ? 's' : ''}`) : Z('没有加行程', 'no added stops'),
			last[dev] ? Z(`上次改动 ${syncAgo(last[dev])}`, `last change ${syncAgo(last[dev])}`) : '',
		].filter(Boolean);
		const acts = [
			n && mine
				? `<button type="button" class="mlink danger" data-mine-clear-own>${icon('x')}${Z(`删除我的 ${n} 个`, `Remove my ${n}`)}</button>`
				: '',
			n && !mine && lead
				? `<button type="button" class="mlink danger" data-mine-clear-dev="${esc(dev)}">${icon('x')}${Z(`删除这 ${n} 个`, `Remove these ${n}`)}</button>`
				: '',
			lead && !planner && !isBlocked
				? `<button type="button" class="mlink" data-role-set="${esc(dev)}">${icon('users')}${Z('设为规划人', 'Make planner')}</button>`
				: '',
			lead && planner && !mine ? `<button type="button" class="mlink" data-role-drop="${esc(dev)}">${Z('取消规划人', 'Not a planner')}</button>` : '',
			lead && !mine && !isBlocked
				? `<button type="button" class="mlink danger" data-block-set="${esc(dev)}">${icon('x')}${Z('停用这台设备', 'Block this device')}</button>`
				: '',
			lead && isBlocked ? `<button type="button" class="mlink" data-block-drop="${esc(dev)}">${Z('恢复这台设备', 'Unblock')}</button>` : '',
		].join('');
		return `<li class="sync-row" data-sync-dev="${esc(dev)}"><span><b>${esc(label.text)}</b>${label.me ? `<span class="sync-badge is-me">${Z('这台', 'This one')}</span>` : ''}${planner ? `<span class="sync-badge">${Z('规划人', 'Planner')}</span>` : ''}${isBlocked ? `<span class="sync-badge is-blocked">${Z('已停用', 'Blocked')}</span>` : ''}<span class="xsmall muted sync-row-sub">${esc(sub.join(' · '))}</span></span>${acts ? `<span class="sync-acts">${acts}</span>` : ''}${fix(dev)}</li>`;
	};
	const items = list.map((p) => {
		if (p.devs.length === 1) return row(p.devs[0], { text: nameOf(p.devs[0]), kit: true });
		const devRows = p.devs.map((dev) => row(dev, { text: kitLabel(kits[dev]) || Z('一台设备', 'A device'), me: dev === m.dev })).join('');
		const k = p.devs.length;
		return `<li class="sync-person"><p class="sync-person-h"><b>${esc(nameOf(p.devs[0]))}</b><span class="xsmall muted"> · ${Z(`${k} 台设备`, `${k} devices`)}</span></p><ul class="sync-list sync-devs">${devRows}</ul></li>`;
	});
	const fold = blocked.length
		? `<details class="sync-code sync-blocked" data-fold="blocked"><summary>${icon('x')}${Z(`已停用的设备（${blocked.length}）`, `Blocked devices (${blocked.length})`)}${icon('chev', 'chev')}</summary><ul class="sync-list">${blocked.map((dev) => row(dev, { text: nameOf(dev), kit: true })).join('')}</ul></details>`
		: '';
	return `<div class="sync-part"><p class="sub-h">${Z('全组', 'The group')}</p><ul class="sync-list">${items.join('')}</ul>${fold}</div>`;
}
// an approval trip: a planner's answer to a join request, and a device's name or person in the group, written to the
// database (syncApi.gate); the sheet redraws from what the database then says
document.addEventListener('click', (e) => {
	const t = e.target.closest('[data-ask-ok], [data-ask-named], [data-ask-person], [data-ask-block], [data-dev-rename], [data-dev-move]');
	if (!t || !SYNC_GATE || !syncApi) return;
	if (!syncIsPlanner()) return toast(Z('只有规划人能这样做', 'Only a planner can do that'));
	const d = t.dataset;
	const ask = (syncGate.requests || []).find((a) => a.uid === (d.askOk || d.askNamed || d.askPerson || d.askBlock));
	const run = (steps, msg) => {
		t.disabled = true;
		syncApi.gate(steps).then((ok) => {
			t.disabled = false;
			if (ok) toast(msg);
		});
	};
	const nameOf = (a) => a.name || Z('这台设备', 'The device');
	if (d.askOk && ask) return run([['approve', { uid: ask.uid }]], Z(`${nameOf(ask)}加入了全组`, `${nameOf(ask)} is in the group now`));
	if (d.askNamed && ask) {
		const inp = t.closest('details')?.querySelector('[data-ask-name]');
		const v = inp ? inp.value.trim().slice(0, 24) : '';
		if (!v) {
			if (inp) inp.focus();
			return toast(Z('先写上名字', 'Type a name first'));
		}
		return run([['approve', { uid: ask.uid, name: v }]], Z(`${v}加入了全组`, `${v} is in the group now`));
	}
	if (d.askPerson && ask) {
		const name = d.personName || '';
		return run(
			[['approve', { uid: ask.uid, person: d.person, name: name || undefined }]],
			Z(`${name || '这台设备'}的另一台设备加入了全组`, `Another device of ${name || 'that person'} is in the group now`),
		);
	}
	if (d.askBlock && ask) {
		if (
			!confirm(
				Z(
					`停用${nameOf(ask)}的加入请求？这台设备看不到也改不了全组的改动。之后可以在「已停用的设备」里恢复。`,
					`Block ${nameOf(ask)}’s join request? That device won’t see or change the group’s changes. You can unblock it later.`,
				),
			)
		)
			return;
		return run([['block', { uid: ask.uid }]], Z(`已停用${nameOf(ask)}`, `Blocked ${nameOf(ask)}`));
	}
	const persons = syncGate.persons || {};
	if (d.devRename) {
		const inp = t.closest('details')?.querySelector('[data-dev-name]');
		const v = inp ? inp.value.trim().slice(0, 24) : '';
		if (!v) {
			if (inp) inp.focus();
			return toast(Z('先写上名字', 'Type a name first'));
		}
		const p = persons[d.devRename] || d.devRename;
		const devs = Object.keys(persons).filter((x) => (persons[x] || x) === p);
		return run(
			devs.map((dev) => ['rename', { dev, name: v }]),
			Z(`名字改成了「${v}」`, `Renamed to ${v}`),
		);
	}
	if (d.devMove)
		return run([['move', { dev: d.devMove, person: d.person, name: d.personName || undefined }]], Z('已换到另一个人下', 'Moved to the other person'));
});
// "recently removed": kept on this phone, from anyone, so a stop removed by mistake can be put back
function syncGoneHTML() {
	const log = (store.get('syncGone', []) || []).filter((e) => e && e.x && dayById[e.x.day] && !MINE[e.x.id]).slice(0, 10);
	if (!log.length) return '';
	const rows = log.map((e) => {
		const who = e.me ? Z('你', 'you') : e.by || Z('有人', 'someone');
		const back = canEditStop(e.x)
			? `<button type="button" class="mlink" data-gone-back="${esc(e.x.id)}">${icon('plus')}${Z('放回去', 'Put back')}</button>`
			: '';
		return `<li class="sync-row"><span><b>${esc(e.x.name)}</b> · Day ${dayById[e.x.day].n} ${esc(e.x.t)}<span class="xsmall muted sync-row-sub">${esc(Z(`${who}删的 · ${syncAgo(e.at)}`, `removed by ${who} · ${syncAgo(e.at)}`))}</span></span>${back}</li>`;
	});
	return `<div class="sync-part"><p class="sub-h">${Z('最近删掉的', 'Recently removed')}</p><ul class="sync-list">${rows.join('')}</ul></div>`;
}
// the sheet, drawn again in place when what it shows changed (it may not be open)
// (on the next frame: it's often asked from inside a change or blur on the sheet's own field)
function syncSheetRefresh() {
	requestAnimationFrame(() => {
		const box = $('#placeSheet [data-sync-sheet]');
		if (!box || !box.isConnected || !box.closest('dialog').open) return;
		if (box.contains(document.activeElement) && document.activeElement.matches('input')) return; // mid-typing: keep it
		const next = document.createElement('div');
		next.innerHTML = syncSheet();
		// a fold the reader opened (the blocked phones) stays open across the redraw
		const open = [...box.querySelectorAll('details[data-fold][open]')].map((d) => d.dataset.fold);
		for (const f of open) next.querySelector(`details[data-fold="${f}"]`)?.setAttribute('open', '');
		box.replaceWith(next.firstElementChild);
	});
}
// a bar under the header while this phone has no name in the group: sync isn't hidden
// in the sections menu then. "Later" puts it away for a day
function syncBarPaint() {
	const el = $('#syncBar');
	if (!el) return;
	const m = syncMeta();
	const later = +store.get('syncBarLater', 0) > Date.now();
	const blocked = !!SYNC && syncIsBlocked();
	// an approval trip's device waiting for a planner: the bar stays until it's let in, with the code a planner checks
	const waiting = SYNC_GATE && syncGate.state === 'pending' && !blocked;
	const on = !!SYNC && !['unsupported', 'ended', 'off'].includes(syncStatus.state) && (blocked || waiting || (!(m && m.name) && !later));
	const was = !el.hidden;
	el.hidden = !on;
	el.innerHTML = !on
		? ''
		: blocked
			? `${icon('alert')}<span><b>${Z('这台设备已停用', 'This device is blocked')}</b> · ${Z('规划人停用了它：你的改动只留在这台设备', 'a planner blocked it: your changes stay on this device')}</span>`
			: waiting
				? `${icon('clock')}<span data-sync-wait><b>${Z('等规划人', 'Waiting for a planner')}</b>${Z('', ' ')}${Z('让这台设备加入全组的改动', 'to let this device into the group’s changes')}${syncGate.code ? ` · ${Z('加入码', 'join code')} <b>${esc(syncGate.code)}</b>` : ''}</span><button type="button" class="text-btn" data-sync-open>${Z('详情', 'Details')}</button>`
				: SYNC_GATE
					? `${icon('users')}<span><b>${Z('全组同步已开', 'Group sync is on')}</b> · ${Z('写上名字，请规划人让这台设备加入', 'add your name to ask a planner to let this device in')}</span><button type="button" class="text-btn" data-sync-open>${Z('写名字', 'Add name')}</button><button type="button" class="text-btn" data-sync-later>${Z('以后', 'Later')}</button>`
					: `${icon('users')}<span><b>${Z('全组同步已开', 'Group sync is on')}</b> · ${Z('写上名字，大家才知道是谁改的', 'add your name so the group sees who changed what')}</span><button type="button" class="text-btn" data-sync-open>${Z('写名字', 'Add name')}</button><button type="button" class="text-btn" data-sync-later>${Z('以后', 'Later')}</button>`;
	if (was !== on) measureBar();
}
function syncPaint() {
	$$('[data-sync-label]').forEach((el) => {
		el.textContent = syncLabel();
	});
	$$('[data-sync-state]').forEach((el) => {
		el.textContent = Cap(syncState());
	});
	syncBarPaint();
}
// "Sync now": busy while it asks (disabled, aria-busy, its label says so), then for a moment how it went (a tick and
// "Up to date", or why not), during which another press does nothing; then back to "Sync now"
let syncNowBusy = false;
function syncNow(b) {
	if (!syncApi) return toast(syncLabel());
	if (syncNowBusy) return;
	if (navigator.onLine === false)
		return toast(Z('没有网络：改动先存在这台设备，有网络会自动同步', 'Offline: changes wait on this device and sync by themselves once it’s back'));
	const show = (ic, text, state) => {
		if (!b || !b.isConnected) return;
		b.innerHTML = `${icon(ic)}${text}`;
		if (state) b.dataset.state = state;
		else delete b.dataset.state;
	};
	syncNowBusy = true;
	if (b) {
		b.disabled = true;
		b.setAttribute('aria-busy', 'true');
	}
	show('sync', Z('正在同步…', 'Syncing…'), 'busy');
	const t0 = Date.now();
	Promise.resolve()
		.then(() => syncApi.now())
		.catch(() => {})
		.then(() => new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - t0))))) // long enough to be seen
		.then(() => {
			const ok = syncStatus.state === 'ok';
			if (b) {
				b.removeAttribute('aria-busy');
				b.disabled = false;
				b.setAttribute('aria-disabled', 'true');
			}
			show(ok ? 'check' : 'alert', ok ? Z('已是最新', 'Up to date') : Cap(syncState()), ok ? 'done' : 'fail');
			setTimeout(() => {
				syncNowBusy = false;
				if (b) b.removeAttribute('aria-disabled');
				show('sync', Z('现在同步', 'Sync now'));
			}, 2500);
		});
}
// "Ken added Night market · Day 3 19:30": what a change from someone else did, in a toast, and in the card of what
// changed while the reader was away. z words it: Z in the reader's language, or one language for the card's two
const tickName = (key, z = Z) => {
	for (const g of CHECKLIST)
		for (const it of g.items) if (`${g.id}-${it.id}` === key) return Array.isArray(it.t) ? z(it.t[0], it.t[1]) : String(it.t);
	return key;
};
function syncNote(list) {
	const names = [...new Set(list.map(([, , v]) => v.n || ''))];
	const who = names.length === 1 && names[0] ? names[0] : Z('有人', 'Someone');
	if (list.length > 1) return Z(`${who}改了 ${list.length} 处行程`, `${who} made ${list.length} changes to the plan`);
	return syncLine(list[0]);
}
/** one change, [record id, value, version], in words; '' for a kind the group doesn't need told */
function syncLine([rid, v, ver], z = Z) {
	const who = (ver && ver.n) || z('有人', 'Someone');
	const id = rid.slice(rid.indexOf(':') + 1);
	const kind = rid.slice(0, rid.indexOf(':'));
	const dayN = (d) => (d ? `Day ${d.n}` : '');
	const nameOf = (dev) => (store.get('people', {}) || {})[dev] || z('一台设备', 'a device');
	if (kind === 'stop') {
		const old = MINE[id];
		return v
			? z(`${who}加了「${v.name}」· ${dayN(dayById[v.day])} ${v.t}`, `${who} added ${v.name} · ${dayN(dayById[v.day])} ${v.t}`)
			: z(`${who}删了「${old ? old.name : '一个行程'}」`, `${who} removed ${old ? old.name : 'an added stop'}`);
	}
	if (kind === 'shift') {
		const d = dayN(DAYS.find((x) => x.date === id));
		return v ? z(`${who}把 ${d} 往后推了`, `${who} pushed ${d} back`) : z(`${who}把 ${d} 改回原定时间`, `${who} put ${d} back to the planned times`);
	}
	if (kind === 'flt')
		return id === 'arr' ? z(`${who}改了到达时间`, `${who} changed the landing time`) : z(`${who}改了回程起飞时间`, `${who} changed the flight home`);
	if (kind === 'block') {
		const name = nameOf(id);
		return v ? z(`${who}停用了${name}`, `${who} blocked ${name}`) : z(`${who}恢复了${name}`, `${who} unblocked ${name}`);
	}
	if (kind === 'role') {
		const name = nameOf(id);
		if (v && ver && ver.d === id) return z(`${name}现在是规划人`, `${name} is a planner now`); // gave the code
		return v
			? z(`${who}把${name}设为规划人`, `${who} made ${name} a planner`)
			: z(`${who}取消了${name}的规划人`, `${who} made ${name} no longer a planner`);
	}
	if (kind === 'tick')
		return v
			? z(`${who}勾了「${tickName(id, z)}」`, `${who} ticked “${tickName(id, z)}”`)
			: z(`${who}取消了「${tickName(id, z)}」`, `${who} unticked “${tickName(id, z)}”`);
	return '';
}
/** the same change in both languages, [zh, en], for the card that outlives a language switch; null when not news */
function syncPair(item) {
	const zh = syncLine(item, (a) => a);
	return zh ? [zh, syncLine(item, (a, b) => b)] : null;
}
/** the day a change is on (an added or removed stop, a pushed-back day), so the card can go there; null for the rest */
function syncDayOf([rid, v]) {
	const id = rid.slice(rid.indexOf(':') + 1);
	if (rid.startsWith('stop:')) return (v && dayById[v.day] ? v.day : MINE[id] && MINE[id].day) || null;
	if (rid.startsWith('shift:')) return (DAYS.find((x) => x.date === id) || {}).id || null;
	return null;
}
/* "While you were away" (ADR-20261127-while-away): the group's changes this phone took in when the page opened or came
   back, on Today until the reader taps Got it. Kept on this phone only (it's news for this reader), never sent */
function syncAwayHTML() {
	const shown = 5; // in the function: the first draw runs before this file's own constants are set
	const log = (store.get('syncAway', []) || []).filter((e) => e && Array.isArray(e.t));
	if (!SYNC || !log.length) return '';
	const row = (e) => {
		const d = e.day && dayById[e.day];
		const go = d ? `<a class="mlink" href="#${esc(d.id)}">${icon('arrow')}Day ${d.n}</a>` : '';
		return `<li class="sync-row"><span>${esc(L(e.t))}<span class="xsmall muted sync-row-sub">${esc(syncAgo(e.u))}</span></span>${go}</li>`;
	};
	const n = log.length;
	const more = log.slice(shown);
	return `<div class="away-card" id="syncAway" role="region" aria-labelledby="syncAway-h">
      <h2 class="sub" id="syncAway-h">${icon('users')}<span>${Z('你不在时的改动', 'While you were away')}</span><span class="wg-n">${n}</span></h2>
      <ul class="sync-list">${log.slice(0, shown).map(row).join('')}</ul>
      ${more.length ? `<details class="more away-more"><summary>${icon('list')}<span>${Z(`再看 ${more.length} 处`, `${more.length} more`)}</span>${icon('chev', 'chev')}</summary><ul class="sync-list more-body">${more.map(row).join('')}</ul></details>` : ''}
      <div class="links-row"><button type="button" class="mlink" data-sync-away-ok>${icon('check')}${Z('知道了', 'Got it')}</button></div>
    </div>`;
}
// Got it: the card goes, here only; the focus moves to the view's heading so a screen reader isn't left nowhere
document.addEventListener('click', (e) => {
	if (!e.target.closest('[data-sync-away-ok]')) return;
	store.set('syncAway', []);
	const el = $('#syncAway');
	if (el) el.remove();
	focusView('top');
});
