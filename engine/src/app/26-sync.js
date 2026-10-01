/* ───────── group sync (ADR-20261001-group-sync) ─────────
   On when the build put the trip's database in (SYNC, 01-storage.js). The page talks to the planner's own Firebase
   Realtime Database over its plain HTTPS API: fetch to read and write, EventSource for live changes, no library. Each
   record is encrypted on the phone (AES-GCM) under a name the database can't read (an HMAC of the record id), and the
   database's rules only take it with the trip's write token. This phone's saved state stays the source of truth: a change
   is saved here first, queued, and sent when there's a connection; what comes from the group is checked, merged newest
   wins per record (core/sync.mjs, `Sync`) and put back into the saved state, then the page redraws once it has settled. */
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
	const base = `${String(SYNC.url).replace(/\/$/, '')}/trips/${SYNC.trip}/r`;
	if (!(window.crypto && crypto.subtle)) {
		syncStatus = { state: 'unsupported', at: 0, waiting: 0 };
		return;
	}
	// what this phone knows about the group's records (versions) and its own changes not yet sent; a new database for
	// the trip (the planner set sync up again) starts over, keeping the device id and the name
	const meta = (() => {
		const m = store.get('sync', null);
		const fresh = { room: SYNC.trip, dev: toB64u(crypto.getRandomValues(new Uint8Array(9))), name: '', known: {}, pending: {}, seeded: false };
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
	});
	let prev = Sync.recordsOf(stateNow(), sharedTick);
	let quiet = false;
	const rawSet = store.set;
	store.set = (k, v) => {
		rawSet(k, v);
		if (!quiet && Sync.KEYS.includes(k)) noteLocal();
	};
	let soonT = 0;
	function noteLocal() {
		const next = Sync.recordsOf(stateNow(), sharedTick);
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
		const theirs = list.filter(([, , ver]) => ver.d !== meta.dev);
		const note = theirs.length ? syncNote(theirs) : '';
		const next = Sync.applyRecords(
			stateNow(),
			list.map(([rid, v]) => [rid, v]),
			sharedTick,
		);
		quiet = true;
		try {
			mineSet(next.mine);
			store.set('shift', next.shift);
			store.set('fltArr', next.fltArr);
			store.set('fltDep', next.fltDep);
			store.set('checks', next.checks);
			checks = next.checks;
		} finally {
			quiet = false;
		}
		for (const [rid, , ver] of list) meta.known[rid] = { u: ver.u, d: ver.d };
		prev = Sync.recordsOf(stateNow(), sharedTick);
		save();
		whenSettled(() => mineRerender(note));
	}
	async function takeIn(recs) {
		const remote = {};
		for (const [hid, rec] of Object.entries(recs && typeof recs === 'object' ? recs : {})) {
			const d = await decode(hid, rec);
			if (d) remote[d[0]] = d[1];
		}
		const { apply, drop } = Sync.merge(meta.known, meta.pending, remote);
		for (const rid of drop) delete meta.pending[rid];
		if (apply.length) applyRemote(apply);
		else if (drop.length) save();
	}

	const denied = (r) => r.status === 401 || r.status === 403;
	/** reads the whole trip: true when read, false when the database refuses (sync ended), null when offline */
	async function pull() {
		try {
			const r = await fetch(`${base}.json`, { cache: 'no-store' });
			if (denied(r)) {
				status('ended');
				return false;
			}
			if (!r.ok) throw new Error(`sync ${r.status}`);
			await takeIn(await r.json());
			status('ok');
			return true;
		} catch {
			status('waiting');
			return null;
		}
	}
	let pushing = false;
	async function push(retry = true) {
		const rids = Object.keys(meta.pending);
		if (pushing || !rids.length || navigator.onLine === false || syncStatus.state === 'ended') return;
		pushing = true;
		let refused = false;
		try {
			const body = {};
			const sent = {};
			for (const rid of rids) {
				const p = meta.pending[rid];
				const hid = await hidOf(rid);
				body[hid] = { c: await seal(hid, { r: rid, v: p.v, n: meta.name }), u: p.u, d: p.d, k: SYNC.token };
				sent[rid] = p.u;
			}
			const r = await fetch(`${base}.json?print=silent`, { method: 'PATCH', body: JSON.stringify(body) });
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
		}
	}

	let es = null;
	function listen() {
		if (es || typeof EventSource === 'undefined' || document.hidden || syncStatus.state === 'ended') return;
		es = new EventSource(`${base}.json`);
		const on = (e) => {
			let m;
			try {
				m = JSON.parse(e.data);
			} catch {
				return;
			}
			if (!m || typeof m.path !== 'string') return;
			const parts = m.path.split('/').filter(Boolean);
			if (!parts.length) takeIn(m.data);
			else if (parts.length === 1) takeIn({ [parts[0]]: m.data });
			else pull(); // a field inside a record: read the whole trip again
		};
		es.addEventListener('put', on);
		es.addEventListener('patch', on);
		es.addEventListener('cancel', () => {
			stop();
			pull(); // the database stopped letting this phone read: find out why
		});
		es.onerror = () => {
			if (es && es.readyState === 2) stop(); // closed for good: the next return to the page opens it again
		};
	}
	const stop = () => {
		if (es) es.close();
		es = null;
	};
	const catchUp = async () => {
		await pull();
		await push();
		listen();
	};
	document.addEventListener('visibilitychange', () => (document.hidden ? stop() : catchUp()));
	window.addEventListener('online', catchUp);
	window.addEventListener('offline', () => status('waiting'));
	setInterval(() => {
		if (!document.hidden && Object.keys(meta.pending).length) push();
		else syncPaint(); // "synced 2 min ago" keeps counting
	}, 30000);
	document.addEventListener('change', (e) => {
		const inp = e.target.closest('[data-sync-name]');
		if (!inp) return;
		meta.name = inp.value.trim().slice(0, 24);
		save();
		toast(Z('名字已保存', 'Name saved'));
	});

	function status(state) {
		const waiting = Object.keys(meta.pending).length;
		const s = state === 'ok' && waiting ? 'waiting' : state;
		syncStatus = { state: s, at: state === 'ok' ? Date.now() : syncStatus.at, waiting };
		syncPaint();
	}
	syncApi = { now: catchUp, name: () => meta.name };

	// a phone's first time on the group: what it already holds goes in as the oldest version, so anything synced wins
	if (!meta.seeded) {
		for (const [rid, v] of Object.entries(prev)) if (!meta.known[rid] && !meta.pending[rid]) meta.pending[rid] = { v, u: 1, d: meta.dev };
		meta.seeded = true;
		save();
	}
	catchUp();
}

/* what the page says about it: a row in the sections menu, and a sheet with the details and the name others see. These
   are function declarations: the menu's first draw runs before this file does */
function syncAgo(at) {
	const m = Math.round((Date.now() - at) / 60000);
	return m < 1 ? Z('刚刚', 'just now') : m < 60 ? Z(`${m} 分钟前`, `${m} min ago`) : Z(`${Math.round(m / 60)} 小时前`, `${Math.round(m / 60)} h ago`);
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
			unsupported: Z('这个浏览器用不了', 'not available in this browser'),
		}[s.state] || ''
	);
}
// the menu row's text; the sheet already has the heading, so it shows the state alone
function syncLabel() {
	return `${Z('全组同步', 'Group sync')}${Z('：', ': ')}${syncState()}`;
}
function syncRow() {
	return SYNC
		? `<button type="button" class="toc-sec toc-sync" data-sync-open>${icon('users')}<span data-sync-label>${syncLabel()}</span></button>`
		: '';
}
function syncSheet() {
	const name = syncApi ? syncApi.name() : '';
	const lists = SHARED_GROUPS.map((id) => (CHECKLIST.find((g) => g.id === id) || {}).h)
		.filter(Boolean)
		.map((h) => Z(`「${L(h)}」`, `“${L(h)}”`))
		.join(Z('、', ', '));
	return `<h3 class="spots-h">${icon('users')}${Z('全组同步', 'Group sync')}</h3>
      <p class="sync-state" data-sync-state role="status">${Cap(syncState())}</p>
      <p class="small">${Z(`加的行程、往后推的时间、改过的航班时间${lists ? `和${lists}的勾选` : ''}，会出现在全组每个人的手机上。语言、主题、其他勾选只留在这台手机。`, `Added stops, pushed-back times and changed flight times${lists ? `, and ticks in ${lists},` : ''} show up on everyone’s phone. Language, theme and other ticks stay on this one.`)}</p>
      <label class="sync-name">${Z('你的名字（别人收到你的改动时看到）', 'Your name (others see it on your changes)')}<input type="text" data-sync-name maxlength="24" value="${esc(name)}" autocomplete="nickname" enterkeyhint="done"></label>
      <div class="links-row"><button type="button" class="go-btn" data-sync-now>${icon('check')}${Z('现在同步', 'Sync now')}</button></div>`;
}
function syncPaint() {
	$$('[data-sync-label]').forEach((el) => {
		el.textContent = syncLabel();
	});
	$$('[data-sync-state]').forEach((el) => {
		el.textContent = Cap(syncState());
	});
}
function syncNow() {
	if (!syncApi) return toast(syncLabel());
	if (navigator.onLine === false) return toast(Z('没有网络：改动先存在这台手机', 'Offline: changes wait on this phone'));
	syncApi.now().then(() => toast(syncLabel()));
}
// "Ken added Night market · Day 3 19:30": what a change from someone else did, in a toast
const tickName = (key) => {
	for (const g of CHECKLIST) for (const it of g.items) if (`${g.id}-${it.id}` === key) return L(it.t);
	return key;
};
function syncNote(list) {
	const names = [...new Set(list.map(([, , v]) => v.n || ''))];
	const who = names.length === 1 && names[0] ? names[0] : Z('有人', 'Someone');
	if (list.length > 1) return Z(`${who}改了 ${list.length} 处行程`, `${who} made ${list.length} changes to the plan`);
	const [rid, v] = list[0];
	const id = rid.slice(rid.indexOf(':') + 1);
	const kind = rid.slice(0, rid.indexOf(':'));
	const dayN = (d) => (d ? `Day ${d.n}` : '');
	if (kind === 'stop') {
		const old = MINE[id];
		return v
			? Z(`${who}加了「${v.name}」· ${dayN(dayById[v.day])} ${v.t}`, `${who} added ${v.name} · ${dayN(dayById[v.day])} ${v.t}`)
			: Z(`${who}删了「${old ? old.name : '一个行程'}」`, `${who} removed ${old ? old.name : 'an added stop'}`);
	}
	if (kind === 'shift') {
		const d = dayN(DAYS.find((x) => x.date === id));
		return v ? Z(`${who}把 ${d} 往后推了`, `${who} pushed ${d} back`) : Z(`${who}把 ${d} 改回原定时间`, `${who} put ${d} back to the planned times`);
	}
	if (kind === 'flt')
		return id === 'arr' ? Z(`${who}改了到达时间`, `${who} changed the landing time`) : Z(`${who}改了回程起飞时间`, `${who} changed the flight home`);
	if (kind === 'tick')
		return v
			? Z(`${who}勾了「${tickName(id)}」`, `${who} ticked “${tickName(id)}”`)
			: Z(`${who}取消了「${tickName(id)}」`, `${who} unticked “${tickName(id)}”`);
	return '';
}
