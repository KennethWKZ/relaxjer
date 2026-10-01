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
		const fresh = {
			room: SYNC.trip,
			dev: toB64u(crypto.getRandomValues(new Uint8Array(9))),
			name: '',
			known: {},
			pending: {},
			seeded: false,
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
	});
	let prev = Sync.recordsOf(stateNow(), sharedTick);
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
		// a phone telling its name isn't news worth a toast
		const theirs = list.filter(([rid, , ver]) => ver.d !== meta.dev && !rid.startsWith('who:'));
		const note = theirs.length ? syncNote(theirs) : '';
		const next = Sync.applyRecords(
			stateNow(),
			list.map(([rid, v]) => [rid, v]),
			sharedTick,
		);
		const by = theirs.find(([rid, v]) => rid.startsWith('stop:') && v === null);
		remoteWho = { at: Date.now(), by: by ? by[2].n || '' : '', me: false };
		quiet = true;
		try {
			mineSet(next.mine);
			store.set('shift', next.shift);
			store.set('fltArr', next.fltArr);
			store.set('fltDep', next.fltDep);
			store.set('checks', next.checks);
			store.set('people', next.people);
			store.set('roles', next.roles);
			checks = next.checks;
		} finally {
			quiet = false;
			remoteWho = null;
		}
		for (const [rid, , ver] of list) meta.known[rid] = { u: ver.u, d: ver.d };
		prev = Sync.recordsOf(stateNow(), sharedTick);
		save();
		whenSettled(() => mineRerender(note));
		syncSheetRefresh();
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
	// the name: kept as it's typed (a phone that closes the sheet without a "change" still has it), and once it's
	// settled, put on the stops this phone added before it had one (or had another), so everyone sees who added them
	// the name: kept as it's typed, and once settled, shared as this phone's (`who:` record) and put on the stops it
	// added, so everyone sees who added them. A planner's name isn't for another phone to take
	const takenByPlanner = (v) => {
		const k = Sync.nameKey(v);
		const people = store.get('people', {}) || {};
		const roles = store.get('roles', {}) || {};
		return !!k && Object.keys(roles).some((dev) => dev !== meta.dev && roles[dev] === 'planner' && Sync.nameKey(people[dev]) === k);
	};
	document.addEventListener('input', (e) => {
		const inp = e.target.closest('[data-sync-name]');
		if (!inp) return;
		const v = inp.value.trim().slice(0, 24);
		if (takenByPlanner(v)) return;
		meta.name = v;
		save();
	});
	let namedAs = meta.name;
	function announce() {
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
		if (takenByPlanner(v)) {
			meta.name = namedAs;
			save();
			inp.value = namedAs;
			toast(Z(`「${v}」是一位规划人的名字，换一个吧`, `“${v}” is a planner’s name: pick another`));
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
	async function claim(code) {
		const p = SYNC.planner;
		if (!p || !code || !code.trim()) return false;
		const k = await crypto.subtle.importKey('raw', utf8(code.trim()), 'PBKDF2', false, ['deriveBits']);
		const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64u(p.salt), iterations: Sync.PLANNER_ROUNDS }, k, 256);
		if (toB64u(new Uint8Array(bits)) !== p.hash) return false;
		store.set('roles', { ...(store.get('roles', {}) || {}), [meta.dev]: 'planner' });
		whenSettled(() => mineRerender(Z('你现在是规划人', 'You’re a planner now')));
		syncSheetRefresh();
		return true;
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
		if (e.key === 'Enter' && e.target.closest('[data-planner-code]')) tryClaim();
	});

	function status(state) {
		const waiting = Object.keys(meta.pending).length;
		const s = state === 'ok' && waiting ? 'waiting' : state;
		syncStatus = { state: s, at: state === 'ok' ? Date.now() : syncStatus.at, waiting };
		syncPaint();
	}
	syncApi = { now: catchUp, name: () => meta.name };
	syncBarPaint();

	// a phone's first time on the group: what it already holds goes in as the oldest version, so anything synced wins
	if (!meta.seeded) {
		for (const [rid, v] of Object.entries(prev)) if (!meta.known[rid] && !meta.pending[rid]) meta.pending[rid] = { v, u: 1, d: meta.dev };
		meta.seeded = true;
		save();
	}
	catchUp();
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
      <p class="small">${Z('全组同步已开：你加的行程、改的时间会出现在大家的手机上。写上名字，大家就知道是谁改的。', 'Group sync is on: stops you add and times you change show on everyone’s phone. Your name tells them who changed what.')}</p>
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
	if (e.key === 'Enter' && e.target.closest('[data-welcome-name]')) {
		e.preventDefault();
		syncWelcomeSave();
	}
});

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
		!lead && SYNC.planner
			? `<details class="sync-code"><summary>${icon('users')}${Z('我是规划人（有规划人密码）', 'I’m a planner (I have the planner code)')}${icon('chev', 'chev')}</summary><label class="sync-name">${Z('规划人密码', 'Planner code')}<input type="password" data-planner-code autocomplete="current-password" enterkeyhint="go"></label><div class="links-row"><button type="button" class="go-btn" data-planner-ok>${icon('check')}${Z('确认', 'Confirm')}</button></div><p class="xsmall muted">${Z('密码是设置同步的人定的；其他规划人也可以直接把你设为规划人。', 'The person who set up sync chose it; a planner can also make you one from their phone.')}</p></details>`
			: '';
	return `<div data-sync-sheet><h3 class="spots-h">${icon('users')}${Z('全组同步', 'Group sync')}</h3>
      <p class="sync-state" data-sync-state role="status">${Cap(syncState())}</p>
      <p class="small">${Z(`加的行程、往后推的时间、改过的航班时间${lists ? `和${lists}的勾选` : ''}，会出现在全组每个人的手机上。语言、主题、其他勾选只留在这台手机。`, `Added stops, pushed-back times and changed flight times${lists ? `, and ticks in ${lists},` : ''} show up on everyone’s phone. Language, theme and other ticks stay on this one.`)}</p>
      <label class="sync-name">${Z('你的名字（别人收到你的改动时看到）', 'Your name (others see it on your changes)')}<input type="text" data-sync-name maxlength="24" value="${esc(m.name || '')}" autocomplete="nickname" enterkeyhint="done"></label>
      ${lead ? `<p class="sync-role">${icon('check')}${Z('你是规划人：可以改、删任何人加的行程，也可以把别人设为规划人', 'You’re a planner: you can change or remove anyone’s stops, and make others planners')}</p>` : claimBox}
      <div class="links-row"><button type="button" class="go-btn sync-now" data-sync-now>${icon('sync')}${Z('现在同步', 'Sync now')}</button></div>
      <p class="small muted">${Z('改动会自动同步；这个按钮只是马上再查一次。', 'Changes sync by themselves; this checks again right away.')}</p>
      ${syncGroupHTML(m, lead)}${syncGoneHTML()}${reset}</div>`;
}
// the group: each phone by its name, the stops it added and whether it's a planner. Everyone can clear their own
// stops; a planner can clear anyone's, and make a phone a planner or not
function syncGroupHTML(m, lead) {
	const people = store.get('people', {}) || {};
	const roles = syncRoles();
	const groups = Sync.byPhone(mineAll(), (id) => stopVer(m, id), m.dev || null, people);
	const devs = [
		...new Set([...(m.dev && people[m.dev] ? [m.dev] : []), ...groups.map((g) => g.dev), ...Object.keys(people), ...Object.keys(roles)]),
	].filter(Boolean);
	if (!devs.length) return '';
	const rows = devs.map((dev) => {
		const g = groups.find((x) => x.dev === dev) || { ids: [], by: '' };
		const n = g.ids.length;
		const name = people[dev] || g.by;
		const mine = dev === m.dev;
		const planner = roles[dev] === 'planner';
		const who = mine ? (name ? Z(`你（${name}）`, `You (${name})`) : Z('你', 'You')) : name || Z('没写名字的人', 'Someone with no name');
		const acts = [
			n && mine
				? `<button type="button" class="mlink danger" data-mine-clear-own>${icon('x')}${Z(`删除我的 ${n} 个`, `Remove my ${n}`)}</button>`
				: '',
			n && !mine && lead
				? `<button type="button" class="mlink danger" data-mine-clear-dev="${esc(dev)}">${icon('x')}${Z(`删除这 ${n} 个`, `Remove these ${n}`)}</button>`
				: '',
			lead && !planner
				? `<button type="button" class="mlink" data-role-set="${esc(dev)}">${icon('users')}${Z('设为规划人', 'Make planner')}</button>`
				: '',
			lead && planner && !mine ? `<button type="button" class="mlink" data-role-drop="${esc(dev)}">${Z('取消规划人', 'Not a planner')}</button>` : '',
		].join('');
		return `<li class="sync-row"><span><b>${esc(who)}</b>${planner ? `<span class="sync-badge">${Z('规划人', 'Planner')}</span>` : ''}<span class="xsmall muted sync-row-sub">${n ? Z(`加了 ${n} 个行程`, `${n} added stop${n > 1 ? 's' : ''}`) : Z('没有加行程', 'no added stops')}</span></span>${acts ? `<span class="sync-acts">${acts}</span>` : ''}</li>`;
	});
	return `<div class="sync-part"><p class="sub-h">${Z('全组', 'The group')}</p><ul class="sync-list">${rows.join('')}</ul></div>`;
}
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
	const on = !!SYNC && !['unsupported', 'ended', 'off'].includes(syncStatus.state) && !(m && m.name) && !later;
	const was = !el.hidden;
	el.hidden = !on;
	el.innerHTML = !on
		? ''
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
		return toast(Z('没有网络：改动先存在这台手机，有网络会自动同步', 'Offline: changes wait on this phone and sync by themselves once it’s back'));
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
	if (kind === 'role') {
		const name = (store.get('people', {}) || {})[id] || Z('一台手机', 'a phone');
		return v
			? Z(`${who}把${name}设为规划人`, `${who} made ${name} a planner`)
			: Z(`${who}取消了${name}的规划人`, `${who} made ${name} no longer a planner`);
	}
	if (kind === 'tick')
		return v
			? Z(`${who}勾了「${tickName(id)}」`, `${who} ticked “${tickName(id)}”`)
			: Z(`${who}取消了「${tickName(id)}」`, `${who} unticked “${tickName(id)}”`);
	return '';
}
