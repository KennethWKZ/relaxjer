/* ───────── events ───────── */
document.addEventListener('click', (e) => {
	const t = e.target.closest('button, a');
	if (!t) return;
	if (t.matches('[data-wc]')) {
		openSheet(wcSheet(t.dataset.wc));
		return;
	}
	if (t.matches('[data-spots]')) {
		// the list of drink stands / rest spots near a stop, in the bottom sheet
		const [pk, k, date] = t.dataset.spots.split('|');
		const sh = $('#placeSheet');
		if (sh.open) {
			sh.querySelector('.psheet-body').innerHTML = spotsSheet(pk, k === 'rest', date);
			sh.scrollTop = 0;
		} else openSheet(spotsSheet(pk, k === 'rest', date));
		sh.dataset.spots = t.dataset.spots;
		return;
	}
	if (t.matches('[data-spot]')) {
		// one shop from that list: its card, with a way back to the list
		const x = DRINKS.find((y) => y.id === t.dataset.spot);
		const sh = $('#placeSheet');
		if (!x) return;
		sh.querySelector('.psheet-body').innerHTML =
			`<button type="button" class="mlink spots-back" data-spots="${esc(sh.dataset.spots || '')}">${icon('arrow', 'flip')}${Z('回到列表', 'Back to the list')}</button>${drinkCard(x)}`;
		sh.querySelectorAll('.psheet-body [id]').forEach((y) => y.removeAttribute('id'));
		sh.scrollTop = 0;
		return;
	}
	if (t.matches('[data-near]')) {
		closeDialog(t.closest('dialog'));
		openNear(t.dataset.near || null);
		return;
	}
	if (t.matches('[data-near-meal]')) {
		near.meal = t.dataset.nearMeal;
		renderNear();
		return;
	}
	if (t.matches('[data-near-from]')) {
		nearFrom(t.dataset.nearFrom);
		return;
	}
	if (t.matches('[data-near-gps]')) {
		nearLocate();
		return;
	}
	if (t.matches('[data-fold]')) {
		const k = t.dataset.fold;
		if (unfolded.has(k)) unfolded.delete(k);
		else unfolded.add(k);
		markToday();
		return;
	}
	if (t.matches('[data-more-chips]')) {
		t.parentElement.classList.add('all');
		t.remove();
		return;
	}
	if (t.matches('[data-gplace]')) {
		const card = t.closest('article');
		const box = card && card.querySelector('.gplace');
		if (box) {
			box.hidden = false;
			t.hidden = true;
			loadPlace(t.dataset.gplace, box);
		}
		return;
	}
	if (t.matches('[data-mapfull]')) {
		mapFull(t.dataset.mapfull === '1');
		return;
	}
	if (t.id === 'tocBtn') {
		renderToc();
		openDialog($('#toc'));
		return;
	}
	if (t.id === 'backPill') {
		history.back();
		return;
	}
	if (t.id === 'themeBtn') {
		themePref = THEME_NEXT[themePref];
		store.set('theme', themePref);
		applyTheme();
		toast(`${Z('主题', 'Theme')}：${themeName(themePref)}`);
		return;
	}
	if (t.matches('[data-lang]')) {
		if (t.dataset.lang !== lang) {
			const sp = spotNow();
			lang = t.dataset.lang;
			store.set('lang', lang);
			render();
			spotRestore(sp);
		}
		return;
	}
	if (t.id === 'searchBtn') return openSearch();
	if (t.id === 'searchClose') return closeSearch();
	if (t.matches('[data-hit]')) return jumpTo(+t.dataset.hit);
	if (t.id === 'search-prev' || t.id === 'search-next') {
		const n = searchState.hits.length;
		if (!n) return;
		jumpTo(((searchState.idx < 0 ? 0 : searchState.idx + (t.id === 'search-next' ? 1 : -1)) + n) % n);
		return;
	}
	if (t.matches('[data-copy-day]')) return copy(dayText(dayById[t.dataset.copyDay]), Z('已复制，可以贴到群组', 'Copied; paste it into the chat'));
	if (t.matches('[data-copy-link]')) return copy(linkFor(t.dataset.copyLink), Z('链接已复制', 'Link copied'));
	if (t.matches('[data-driver]')) return openDriver(t.dataset.driver);
	if (t.id === 'drv-copy') return copy(t.dataset.text, Z('地址已复制', 'Address copied'));
	if (t.matches('[data-close]')) {
		closeDialog(t.closest('dialog'));
		return;
	}
	if (t.matches('[data-map-day]')) {
		const f = t.dataset.mapDay;
		mapFull(true);
		withMap(() => map.filter(f));
		return;
	}
	if (t.matches('[data-view]')) return map && map.view(t.dataset.view);
	if (t.matches('[data-filter]')) return map && map.filter(t.dataset.filter);
	if (t.matches('[data-reset-all]')) {
		resetAll();
		return;
	}
	if (t.matches('[data-home]')) {
		homeAdd();
		return;
	}
	if (t.matches('[data-shift-add]')) {
		const [dy, f, m] = t.dataset.shiftAdd.split('|');
		shiftAdd(dy, +f, +m);
		return;
	}
	if (t.matches('[data-shift-edit]')) {
		shiftSheet(t.dataset.shiftEdit);
		return;
	}
	if (t.matches('[data-shift-from], [data-shift-min]')) {
		const g = t.closest('[role=radiogroup]');
		$$('[role=radio]', g).forEach((b) => b.setAttribute('aria-checked', String(b === t)));
		return;
	}
	if (t.matches('[data-shift-go]')) {
		const box = t.closest('.shift-sheet');
		const f = $('[data-shift-from][aria-checked="true"]', box);
		const m = $('[data-shift-min][aria-checked="true"]', box);
		if (f && m) shiftAdd(t.dataset.shiftGo, +f.dataset.shiftFrom, +m.dataset.shiftMin);
		return;
	}
	if (t.matches('[data-shift-clear]')) {
		shiftSet(t.dataset.shiftClear, []);
		store.set('lateNo', null);
		const ps = $('#placeSheet');
		if (ps && ps.open) closeDialog(ps);
		whenSettled(() => mineRerender(Z('已恢复原来的时间', 'Back to the planned times')));
		return;
	}
	if (t.matches('[data-late-no]')) {
		const [date, i, late] = t.dataset.lateNo.split('|');
		store.set('lateNo', { date, i: +i, late: +late });
		renderNow();
		return;
	}
	if (t.matches('[data-geo-on]')) {
		t.disabled = true;
		locateMe(() => renderNow());
		return;
	}
	if (t.matches('[data-geo-no]')) {
		store.set('geoNo', tpNow().date);
		renderNow();
		return;
	}
	if (t.matches('[data-geo-help]')) {
		geoHelp();
		return;
	}
	if (t.matches('[data-late-loc]')) {
		t.disabled = true;
		locateMe(() => renderNow());
		return;
	}
	if (t.matches('[data-flt-save]')) {
		const k = t.dataset.fltSave;
		const v = ($(`[data-flt="${k}"]`) || {}).value;
		if (tMin(v) == null) return;
		store.set(k === 'arr' ? 'fltArr' : 'fltDep', v === (k === 'arr' ? FLIGHTS.out.arr : FLIGHTS.ret.dep) ? '' : v);
		mineRerender(Z(`已按 ${v} 重算`, `Recalculated for ${v}`));
		return;
	}
	if (t.matches('[data-flt-reset]')) {
		const k = t.dataset.fltReset;
		store.set(k === 'arr' ? 'fltArr' : 'fltDep', '');
		mineRerender(Z('已改回原定时间', 'Back to the booked time'));
		return;
	}
	if (t.matches('[data-add-open]')) {
		const d = dayById[t.dataset.addOpen];
		const last = d.schedule.length - 1;
		openSheet(addFindSheet(t.dataset.addOpen, last >= 0 ? gapContext(d.id, String(last)) : {}));
		addFindRender('');
		return;
	}
	if (t.matches('[data-add-gap]')) {
		const [dayId, key] = t.dataset.addGap.split('|');
		openSheet(addFindSheet(dayId, gapContext(dayId, key)));
		addFindRender('');
		return;
	}
	if (t.matches('[data-addcat]')) {
		addCat = t.dataset.addcat;
		$$('[data-addcat]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
		addFindRender(($('[data-addq]') || {}).value);
		return;
	}
	if (t.matches('[data-addsort]')) {
		addSort = t.dataset.addsort;
		$$('[data-addsort]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
		addFindRender(($('[data-addq]') || {}).value);
		return;
	}
	if (t.matches('[data-add-g]')) {
		addFindGoogle(($('[data-addq]') || {}).value || '');
		return;
	}
	if (t.matches('[data-add]')) {
		let it;
		try {
			it = JSON.parse(t.dataset.add);
		} catch {
			return;
		}
		if (addDay && t.closest('[data-add-res]')) {
			it.day = addDay;
			if (addCtx.t) it.t = addCtx.t;
		}
		sheetShow(addSheet(it));
		setTimeout(addClashNote, 0);
		return;
	}
	if (t.matches('[data-add-day]')) {
		$$('[data-add-day]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
		addClashNote();
		return;
	}
	if (t.matches('[data-add-save]')) {
		const day = ($('[data-add-day][aria-pressed="true"]') || {}).dataset?.addDay;
		const tm = ($('[data-add-t]') || {}).value;
		if (!addItem || !day || tMin(tm) == null) {
			toast(Z('选好日期和时间', 'Pick a day and a time'));
			return;
		}
		const list = mineAll();
		const x = addItem.id ? list.find((y) => y.id === addItem.id) : null;
		if (x) {
			x.day = day;
			x.t = tm;
		} else
			list.push({
				id: `mine-${Date.now().toString(36)}`,
				day,
				t: tm,
				name: addItem.n,
				lat: addItem.lat,
				lng: addItem.lng,
				gpid: addItem.gpid,
				q: addItem.q,
				addr: addItem.addr,
			});
		mineSet(list);
		closeDialog($('#placeSheet'));
		addItem = null;
		whenSettled(() => mineRerender(Z(`已加入 Day ${dayById[day].n} ${tm}`, `Added to Day ${dayById[day].n}, ${tm}`)));
		return;
	}
	if (t.matches('[data-mine-edit]')) {
		const x = MINE[t.dataset.mineEdit];
		if (x) {
			sheetShow(addSheet({ id: x.id, n: x.name, lat: x.lat, lng: x.lng, gpid: x.gpid, q: x.q, addr: x.addr, day: x.day, t: x.t }));
			setTimeout(addClashNote, 0);
		}
		return;
	}
	if (t.matches('[data-mine-del]')) {
		const x = MINE[t.dataset.mineDel];
		if (!x || !confirm(Z(`从行程删除「${x.name}」？`, `Remove "${x.name}" from the plan?`))) return;
		mineSet(mineAll().filter((y) => y.id !== x.id));
		const sh = $('#placeSheet');
		if (sh && sh.open) closeDialog(sh);
		whenSettled(() => mineRerender(Z('已删除', 'Removed')));
		return;
	}
	if (t.matches('[data-mine-share]')) {
		const url = mineShareURL();
		const text = Z(`我加的${CITY[0]}行程：打开链接就能加入你的页面`, `My added ${CITY[1]} stops: open the link to add them`);
		if (navigator.share) navigator.share({ title: Z('我加的行程', 'My added stops'), text, url }).catch(() => {});
		else if (navigator.clipboard)
			navigator.clipboard.writeText(url).then(() => toast(Z('链接已复制，贴到群里', 'Link copied: paste it in the chat')));
		return;
	}
	if (t.matches('[data-mine-import]')) {
		const list = mineAll();
		let n = 0;
		(mineIncoming || []).forEach((x) => {
			if (!list.some((y) => y.day === x.day && y.t === x.t && y.name === x.name)) {
				list.push({ id: `mine-${Date.now().toString(36)}${n}`, q: x.name, ...x });
				n++;
			}
		});
		mineSet(list);
		mineIncoming = null;
		closeDialog($('#placeSheet'));
		whenSettled(() => mineRerender(Z(`已加入 ${n} 个`, `Added ${n}`)));
		return;
	}
	if (t.matches('[data-gsearch]')) {
		gSearch(($('#mapq') || {}).value.trim());
		return;
	}
	if (t.matches('[data-gback]')) {
		mapListSync();
		return;
	}
	if (t.matches('[data-mefrom]')) {
		locateMe(() =>
			$$('[data-mefrom]').forEach((b) => {
				const [la, ln] = b.dataset.mefrom.split(',').map(Number);
				b.outerHTML = farAway() ? farNote() : planHTML({ lat: la, lng: ln });
			}),
		);
		return;
	}
	if (t.matches('[data-cat]')) {
		// works before the map has loaded too: remembered, applied when it is ready
		const c = t.dataset.cat;
		const go = () => {
			if (c === 'all') {
				mapCat = 'all';
				map.filter(mapDay);
			} else map.filter(c);
		};
		if (map) go();
		else {
			mapCat = c;
			$$('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cat === c)));
			mapListSync();
			withMap(go);
		}
		return;
	}
	if (t.matches('[data-mapsort]')) {
		mapNear = t.dataset.mapsort === 'near';
		if (mapNear && !meLL) {
			locateMe(() => mapListSync());
		}
		mapListSync();
		return;
	}
	if (t.matches('[data-maplist]')) {
		mapListOpen($('#mapres').hidden);
		return;
	}
	if (t.matches('[data-mres]')) {
		const pid = t.dataset.mres;
		mapListOpen(false);
		if ($('#mapq')) $('#mapq').blur();
		const w = $('.map-wrap');
		if (!mapFullOn && w && w.getBoundingClientRect().top < 0) w.scrollIntoView({ block: 'center', behavior: 'instant' });
		withMap(() => map.select(pid));
		return;
	}
	if (t.matches('[data-zoom]')) return map && map.zoom(t.dataset.zoom === 'in' ? 0.6 : 1.6);
	if (t.matches('[data-pick]')) {
		if (liveFailed) {
			window.open(gmSearch(t.dataset.q), '_blank', 'noopener');
			return;
		}
		const pid = t.dataset.pick;
		mapFull(true);
		withMap(() => map.select(pid));
		return;
	}
	if (t.matches('[data-retry-map]')) {
		liveArmed = true;
		startLiveMap();
		return;
	}
	if (t.matches('[data-step]')) {
		store.set('repeat', Math.max(0, Math.min(PAX, +store.get('repeat', 3) + +t.dataset.step)));
		calcLucky();
		return;
	}
	if (t.id === 'reset-ask') {
		$('#reset-confirm').hidden = false;
		t.hidden = true;
		return;
	}
	if (t.id === 'reset-no') {
		$('#reset-confirm').hidden = true;
		$('#reset-ask').hidden = false;
		return;
	}
	if (t.id === 'reset-yes') {
		checks = {};
		store.set('checks', checks);
		$$('[data-check]').forEach((b) => {
			b.checked = false;
		});
		$('#reset-confirm').hidden = true;
		$('#reset-ask').hidden = false;
		updateProgress();
		renderNow();
		toast(Z('已清除', 'Cleared'));
		return;
	}
	if (t.matches('.tab, a[href^="#"]') && t.getAttribute('href').length > 1) {
		const id = t.getAttribute('href').slice(1);
		const card = !t.hasAttribute('data-go') && placeCardHTML(id);
		if (card) {
			e.preventDefault();
			openSheet(card, id);
			return;
		}
		const el = document.getElementById(id) || lazyFor(id);
		if (!el) return;
		e.preventDefault();
		closeDialog(t.closest('dialog'));
		const nav = t.matches('.tab, .toc-sec, .toc-day, .toc-now, .toc-top, .wk');
		goTo(
			el,
			'start',
			el.matches('[data-sec]')
				? () => {
						const h = el.querySelector('.lantern, h2');
						if (h && nav) landed(h);
					}
				: () => flash(el),
			nav,
		);
	}
});
document.addEventListener('change', (e) => {
	const c = e.target.closest('[data-check]');
	if (c) {
		if (c.checked) checks[c.dataset.check] = true;
		else delete checks[c.dataset.check];
		store.set('checks', checks);
		updateProgress();
		if (c.dataset.check.startsWith('entry-')) renderNow();
	}
});
// a hairline under the pinned sheet header once the list has scrolled under it
document.addEventListener(
	'scroll',
	(e) => {
		const d = e.target;
		if (d instanceof HTMLDialogElement && d.classList.contains('toc')) {
			const h = d.querySelector('.toc-head');
			if (h) h.classList.toggle('stuck', d.scrollTop > 4);
		}
	},
	{ capture: true, passive: true },
);
document.addEventListener('input', (e) => {
	if (e.target.matches && e.target.matches('[data-add-t]')) {
		addClashNote();
		return;
	}
	if (e.target.matches && e.target.matches('[data-addq]')) {
		const v = e.target.value;
		requestAnimationFrame(() => addFindRender(v));
		return;
	}
	if (e.target.id === 'mapq') {
		mapListOpen(true);
		if (!map) withMap(() => {});
		return;
	}
	if (e.target.id === 'q') {
		const v = e.target.value;
		requestAnimationFrame(() => runSearch(v));
	}
	if (e.target.id === 'rate') {
		const v = parseFloat(e.target.value);
		if (v > 1 && v < 30) {
			rate = v;
			store.set('rate', v);
			$$('[data-rm]').forEach((el) => {
				const [a, b] = el.dataset.rm.split(',').map(Number);
				el.textContent = rmText(a, b);
			});
			calcLucky();
		}
	}
});
document.addEventListener('keydown', (e) => {
	if (e.target.id === 'q' && e.key === 'Enter') {
		e.preventDefault();
		if (searchState.hits.length) jumpTo(0);
		e.target.blur();
	}
	if (e.key === 'Escape' && !$('#search-row').hidden) closeSearch();
	if (e.key === 'Escape' && mapFullOn && !document.querySelector('dialog[open]')) mapFull(false);
});
$('#q').addEventListener('focus', () => {
	if (searchState.q) $('#results').dataset.state = 'open';
});
window.addEventListener('resize', () => measureBar());
