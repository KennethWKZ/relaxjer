/* ───────── skipping a planned stop (ADR-20261128-skip-planned-stops) ─────────
   Plans change on the trip: a place turns out closed, the group is tired, it rains. Anyone can skip a planned stop,
   except a flight and the lodging (Plan.skippable); a fixed time asks once more. A skipped stop leaves the string, Now
   and Next, the running-late check, the day's route and its legs, and folds with the day's others into one line at the
   foot of the schedule ("2 skipped"), where Put back brings it back. The map keeps its pin, quieter; search still finds
   it, marked skipped. Right after a skip the page offers to move the next stops earlier: a suggestion only
   (Plan.pullEarlier), never a fixed time, never without a tap; putting the stop back moves them back.
   Kept per phone in `skips` ({ key: { by, dev, at, pull } }) under each stop's key (Plan.stopKeys, from the stop as the
   data writes it); with group sync a skip is a `skip:<key>` record, so it reaches every phone and goes on Recently
   removed with who skipped it (26-sync.js). */
const SKIP_KEYS = Object.fromEntries(DAYS.map((d) => [d.id, Plan.stopKeys(d)]));
DAYS.forEach((d) => d.schedule.forEach((it, i) => (it._key = SKIP_KEYS[d.id][i])));
// where each key's stop is: its day and its row
const SKIP_AT = Object.fromEntries(DAYS.flatMap((d) => d.schedule.map((it, i) => [it._key, { d, i }])));
const SKIP_TERMINALS = ((typeof AIRPORT !== 'undefined' && AIRPORT.terminals) || []).map((t) => t.place).filter(Boolean);
// the page-view state of the suggestion after a skip: { day, key } until it's taken, declined, or the stop is put back.
// Not stored: a reload doesn't ask again (the moved times are a tap away in the day's banner)
let skipAsk = null;
// which day's "N skipped" fold the reader opened, for this page view (a redraw keeps it)
const skipFoldOpen = new Map();

/** can the group skip this stop? (not a flight, not the lodging: Plan.skippable) */
function canSkip(d, it) {
	return !!(d && it) && Plan.skippable(it, { hotels: HOTELS, terminals: SKIP_TERMINALS, flightDay: d.id === ROLE.flight });
}
/** this phone's skips, { key: skip } */
function skipsAll() {
	const s = store.get('skips', {});
	return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
}
function skipSet(key, v) {
	const all = { ...skipsAll() };
	if (v) all[key] = v;
	else delete all[key];
	store.set('skips', all);
}
/** marks each planned stop with its skip (it._skip), before the push-backs are worked out: a skipped fixed time no
 *  longer holds a push back, since the group isn't going */
function applySkips() {
	const all = skipsAll();
	DAYS.forEach((d) =>
		d.schedule.forEach((it) => {
			const s = all[it._key];
			it._skip = s && canSkip(d, it) ? s : null;
		}),
	);
}
/** the places a day's skips take off its route: those where every stop of that day is skipped */
function skipPlaces(d) {
	const all = new Map();
	d.schedule.forEach((it) => {
		if (it.place) all.set(it.place, (all.has(it.place) ? all.get(it.place) : true) && !!it._skip);
	});
	return new Set([...all].filter(([, off]) => off).map(([p]) => p));
}
/** a day's route legs as the group now goes: the skipped places joined over (Plan.routeWithout) */
const dayLegs = (d) => Plan.routeWithout(LEGS[d.id], skipPlaces(d));
/** is the stop's place shut on its day? (the data refresh's closed_dates) */
const stopShut = (d, it) => !!(it && it.place) && Plan.closedOn(GEO && GEO.places && GEO.places[it.place], d.date);

/** the move earlier a skip suggests: { from: the next stop's planned start, min, next } or null (Plan.pullEarlier). Once
 *  taken, a skip suggests nothing more */
function skipSuggest(d, key) {
	const i = d.schedule.findIndex((it) => it._key === key);
	const it = d.schedule[i];
	if (!it || !it._skip || it._skip.pull || it.step) return null;
	const raw = d.schedule.map((x) => parseT(x.t || ''));
	const rows = Plan.onOneClock(raw).map((r, k) => {
		const x = d.schedule[k];
		return { ...r, fixed: !!x.fixed, skip: !!x._skip, still: !!x.rel || !!x.step };
	});
	const now = tpNow();
	const p = Plan.pullEarlier(rows, i, now.date === d.date ? Plan.minuteOn(raw, now.mins) : null);
	const next = p && d.schedule[p.at];
	return next && next._s0 != null ? { from: next._s0, min: p.min, next, at: p.at } : null;
}

/** Skip: a fixed time asks once more; then the stop folds away, the Undo toast stays 8 s, and the suggestion shows */
function skipStop(dayId, i) {
	const d = dayById[dayId];
	const it = d && d.schedule[i];
	if (!canSkip(d, it) || it._skip) return;
	const name = stopName(it);
	if (it.fixed && !confirm(`${Z(`「${name}」`, name)}\n${Z('这是已预订的，确定不去？', 'This one is booked. Skip it anyway?')}`)) return;
	skipSet(it._key, { at: Date.now(), ...addedBy() });
	stopOpen.delete(`${d.id}-s${i}`);
	skipAsk = { day: d.id, key: it._key };
	const all = SYNC ? Z('（大家的页面都会跳过）', ' · on everyone’s page') : '';
	whenSettled(() => mineRerender(`${Z(`已跳过「${name}」`, `Skipped ${name}`)}${all}`, { label: Z('撤销', 'Undo'), run: () => unskip(it._key) }));
}
/** Put back (the fold's button, Recently removed, or Undo): the stop is back, and the stops that moved earlier for it
 *  move back */
function unskip(key) {
	const s = skipsAll()[key];
	const at = SKIP_AT[key];
	if (!s || !at) return;
	const name = stopName(at.d.schedule[at.i]);
	if (s.pull) shiftNudge(at.d.date, s.pull.from, s.pull.min);
	skipSet(key, null);
	if (skipAsk && skipAsk.key === key) skipAsk = null;
	whenSettled(() =>
		mineRerender(
			s.pull
				? Z(`已放回「${name}」，后面的站改回原来的时间`, `Put back ${name}; the stops after it are back at their times`)
				: Z(`已放回「${name}」`, `Put back ${name}`),
		),
	);
	if (SYNC) syncSheetRefresh();
}
/** the suggestion taken: the next stops move earlier up to the next fixed time, and the skip remembers the move */
function skipPull(dayId, key) {
	const d = dayById[dayId];
	const s = skipsAll()[key];
	const sg = d && s && skipSuggest(d, key);
	skipAsk = null;
	if (!sg) return whenSettled(() => mineRerender());
	shiftNudge(d.date, sg.from, -sg.min);
	skipSet(key, { ...s, pull: { from: sg.from, min: sg.min } });
	const undo = {
		label: Z('撤销', 'Undo'),
		run: () => {
			const now = skipsAll()[key];
			if (!now || !now.pull) return;
			shiftNudge(d.date, sg.from, sg.min);
			const rest = { ...now };
			delete rest.pull;
			skipSet(key, rest);
			whenSettled(() => mineRerender(Z('已恢复原来的时间', 'Back to the planned times')));
		},
	};
	whenSettled(() => mineRerender(Z(`后面的站已提早 ${sg.min} 分钟`, `Moved the next stops ${sg.min} min earlier`), undo));
}

/* ── what it draws ── */
const skipTime = (it) => (it.step ? String(it.step) : tStart(L(it._base || it.t || '')));
/** the opened stop's Skip, a labelled icon like its other actions */
const skipAct = (d, i) => `<button type="button" class="ibtn stop-skip" data-skip="${d.id}|${i}">${ibtn('skip', Z('跳过', 'Skip'))}</button>`;
/** under a stop whose place is shut that day: the fact, and Skip right there */
function skipShutHTML(d, it, i, today) {
	if (!stopShut(d, it)) return '';
	const btn = canSkip(d, it)
		? `<button type="button" class="mlink" data-skip="${d.id}|${i}">${icon('skip')}<span>${Z('跳过这一站', 'Skip this stop')}</span></button>`
		: '';
	return `<p class="warn stop-shut">${icon('alert')}<span>${today ? Z('今天休息', 'Closed today') : Z('当天休息', 'Closed that day')}</span>${btn}</p>`;
}
/** right after a skip, where the stop was: the stop greyed, and "Move the next stops N min earlier?" */
function skipAskHTML(d, i) {
	const it = d.schedule[i];
	if (!skipAsk || skipAsk.day !== d.id || skipAsk.key !== it._key || !it._skip) return '';
	const sg = skipSuggest(d, it._key);
	if (!sg) return '';
	const fixed = d.schedule.find((x, k) => k > sg.at && x.fixed && !x._skip);
	const to = hm(parseT(sg.next.t).s - sg.min);
	const why = Z(
		`「${stopName(sg.next)}」可以 ${to} 开始${fixed ? `，到 ${L(fixed.t)}「${stopName(fixed)}」固定行程为止` : '，后面的也一起提早'}。`,
		`${stopName(sg.next)} could start at ${to}${fixed ? `, up to the fixed ${L(fixed.t)} ${stopName(fixed)}` : ', and the rest of the day with it'}.`,
	);
	return `<li class="stop skip-ask" id="${d.id}-s${i}-ask"><div class="stop-t"><s>${esc(skipTime(it))}</s></div><div class="stop-knot"><span class="knot-ic" aria-hidden="true">${icon('skip')}</span></div><div class="stop-b">
      <p class="skip-line"><span class="skip-n">${fmt(it.what)}</span><span class="skip-tag"> ${Z('已跳过', 'Skipped')}</span></p>
      <div class="skip-box"><p class="late-h">${icon('clock')}<span>${esc(Z(`后面的站提早 ${sg.min} 分钟？`, `Move the next stops ${sg.min} min earlier?`))}</span></p><p class="small">${esc(why)}</p>
      <div class="links-row"><button type="button" class="go-btn" data-skip-pull="${d.id}|${esc(it._key)}">${icon('clock')}${Z(`提早 ${sg.min} 分钟`, `${sg.min} min earlier`)}</button><button type="button" class="go-btn ghost" data-skip-keep>${Z('不用', 'No thanks')}</button></div></div></div></li>`;
}
/** the day's skipped stops, folded into one line on the string: "2 skipped", and opened, each greyed with Put back */
function skipFoldHTML(d) {
	const list = d.schedule.map((it, i) => ({ it, i })).filter((x) => x.it._skip);
	if (!list.length) return '';
	const n = list.length;
	const rows = list.map(({ it, i }) => {
		const by = SYNC && it._skip.by;
		return `<li class="skip-row" id="${d.id}-s${i}"><span class="skip-t">${esc(skipTime(it))}</span><span class="skip-m"><span class="stop-name"${alt(other(it.what))}>${fmt(it.what)}<span class="skip-tag"> ${Z('已跳过', 'Skipped')}</span></span>${by ? `<small class="skip-by">${esc(Z(`${by}跳过的`, `skipped by ${by}`))}</small>` : ''}</span><button type="button" class="mlink skip-back" data-unskip="${esc(it._key)}">${icon('undo')}<span>${Z('放回来', 'Put back')}</span></button></li>`;
	});
	return `<li class="stop skip-fold"><div class="stop-t"></div><div class="stop-knot"><span class="knot-ic" aria-hidden="true">${icon('skip')}</span></div><div class="stop-b"><details class="skip-x" data-skipfold="${d.id}"${skipFoldOpen.get(d.id) ? ' open' : ''}><summary class="skip-sum"><span>${Z(`已跳过 ${n} 站`, `${n} skipped`)}</span>${icon('chev', 'chev')}</summary><ul class="skip-list">${rows.join('')}</ul></details></div></li>`;
}
// the reader's own tap on the fold, kept for this page view (a jump or a search opens it too, without keeping it)
document.addEventListener('click', (e) => {
	const s = e.target.closest('details.skip-x > summary');
	if (s) skipFoldOpen.set(s.parentElement.dataset.skipfold, !s.parentElement.open);
});
