/* ───────── events ───────── */
document.addEventListener('click', (e) => {
	const t = e.target.closest('button, a');
	if (!t) return;
	if (t.matches('[data-wc]')) {
		openSheet(wcSheet(t.dataset.wc));
		return;
	}
	if (t.matches('[data-refill]')) {
		// water refill near a stop: place | its day | the stop's start in minutes (05-render-small-parts.js)
		const [pk, date, at] = t.dataset.refill.split('|');
		openSheet(refillSheet(pk, date || null, at === '' ? null : +at));
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
		near.far = false;
		nearFrom(t.dataset.nearFrom);
		return;
	}
	if (t.matches('[data-near-gps]')) {
		nearLocate();
		return;
	}
	if (t.matches('[data-opts]')) {
		optsToggle(t);
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
		// Google's rating and photos: in the card it sits on, else (a stop, a place on a day card) in the details sheet
		const ref = t.dataset.gref || '';
		const info = (ref && placeInfo(ref)) || { ref, gpid: t.dataset.gplace || null };
		const card = t.closest('article');
		if (card) {
			let box = card.querySelector('.gplace');
			if (!box) {
				(card.querySelector('.links-row') || t).insertAdjacentHTML('beforebegin', '<div class="gplace"></div>');
				box = card.querySelector('.gplace');
			}
			t.hidden = true;
			gLoad(info, box);
		} else if (ref) openPlaceDetails(ref);
		return;
	}
	if (t.matches('[data-find-detail]')) {
		const info = finderAt && finderAt.info;
		if (!info) return;
		openSheet(placeDetailsHTML(info));
		const box = $('#placeSheet .pdet .gplace');
		// once Google's hours are in, the finder can say which days it's closed
		if (box) gLoad(info, box).then(finderRefresh);
		return;
	}
	if (t.matches('[data-find-back]')) {
		finderBack();
		return;
	}
	if (t.matches('[data-fit-add]')) {
		// the finder's day: the add sheet, set to that day, at the time right after the stop it follows
		const [dayId, key] = t.dataset.fitAdd.split('|');
		const info = finderAt && finderAt.info;
		if (!info || !dayById[dayId]) return;
		const ctx = gapContext(dayId, key);
		openSheet(
			addSheet({
				n: info.n,
				lat: info.lat,
				lng: info.lng,
				gpid: info.gpid,
				q: info.q || info.n,
				addr: info.addr || '',
				ref: info.ref,
				day: dayId,
				t: ctx.t || undefined,
			}),
		);
		setTimeout(addClashNote, 0);
		return;
	}
	if (t.matches('[data-gfind]')) {
		const info = placeInfo(`g:${t.dataset.gfind}`);
		if ($('#mapq')) $('#mapq').blur();
		finderOpen(info, null, `[data-gfind="${t.dataset.gfind}"]`);
		return;
	}
	if (t.matches('[data-mapfull]')) {
		mapFull(t.dataset.mapfull === '1');
		return;
	}
	// the desktop's Sections button, and the bottom bar's More and Days (ADR-20261124-bottom-app-bar)
	if (t.id === 'tocBtn' || t.id === 'moreBtn') {
		renderToc(t.id === 'moreBtn' ? 'more' : 'all');
		openDialog($('#toc'));
		return;
	}
	if (t.id === 'daysBtn') {
		renderDays();
		openDialog($('#days'));
		// the day on screen (else today) in sight, in a long trip's list
		requestAnimationFrame(() => {
			const row = $('#days details[open]') || $('#days [aria-current]') || ($('#days .flag') || {}).parentElement;
			const at = row && row.closest('.dd, a');
			if (at) at.scrollIntoView({ block: 'nearest', behavior: 'instant' });
		});
		return;
	}
	if (t.id === 'backPill') {
		history.back();
		return;
	}
	if (t.id === 'themeBtn' || t.matches('[data-theme-cycle]')) {
		themePref = THEME_NEXT[themePref];
		store.set('theme', themePref);
		applyTheme();
		if (t.matches('[data-theme-cycle]')) rowRedraw(t, themeRow(), '[data-theme-cycle]');
		toast(`${Z('主题', 'Theme')}：${themeName(themePref)}`);
		return;
	}
	if (t.matches('[data-maps-cycle]')) {
		mapsApp = mapsApp === 'apple' ? 'google' : 'apple';
		store.set('maps', mapsApp);
		const sp = spotNow();
		render(); // every Map and Directions link is drawn again for the chosen app
		spotRestore(sp);
		if (t.isConnected) rowRedraw(t, mapsRow(), '[data-maps-cycle]');
		toast(`${Z('打开地图用', 'Open maps in')}：${mapsName(mapsApp)}`);
		return;
	}
	// which currency the figures lead with: the header's button (it names the other one) or the Sections menu's choice
	if (t.matches('[data-amounts]')) {
		const home = t.dataset.amounts === 'home';
		if (CUR_SWITCH && home !== homeFirst) {
			const sp = spotNow();
			const inSheet = !!t.closest('.toc');
			homeFirst = home;
			store.set('amounts', home ? 'home' : 'trip');
			render();
			spotRestore(sp);
			const box = $('.toc-cur');
			if (box) {
				box.outerHTML = curRow(); // redrawn, so focus moves to the side now pressed
				if (inSheet) $(`.toc-cur [data-amounts="${home ? 'home' : 'trip'}"]`).focus();
			}
			toast(
				home
					? Z(`金额改用 ${CUR.home} 显示（1 ${CUR.home} = ${CUR.sym}${rate}）`, `Amounts in ${CUR.home} now (1 ${CUR.home} = ${CUR.sym}${rate})`)
					: Z(`金额改回 ${CUR.sym} 显示`, `Amounts in ${CUR.sym} again`),
			);
		}
		return;
	}
	if (t.matches('[data-rate-reset]')) {
		store.del('rate'); // forgotten, not copied: the phone follows the trip's rate again, a republished one too
		rateSet(CUR.rate);
		$$('input[data-rate]').forEach((i) => {
			i.value = rate;
			i.setAttribute('aria-invalid', 'false');
		});
		toast(Z(`汇率改回行程的 1 ${CUR.home} = ${CUR.sym}${rate}`, `Back to the trip's rate: 1 ${CUR.home} = ${CUR.sym}${rate}`));
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
	// the day's ⋯ sheet closes as it acts, so the message shows over the page (a sheet is above everything else)
	if (t.matches('[data-copy-day]')) {
		closeDialog(t.closest('dialog'));
		return copy(dayText(dayById[t.dataset.copyDay]), Z('已复制，可以贴到群组', 'Copied; paste it into the chat'));
	}
	if (t.matches('[data-copy-link]')) {
		closeDialog(t.closest('dialog'));
		return copy(linkFor(t.dataset.copyLink), Z('链接已复制', 'Link copied'));
	}
	if (t.matches('[data-driver]')) return openDriver(t.dataset.driver);
	if (t.matches('[data-native]')) return copy(t.dataset.native, Z(`已复制：${t.dataset.native}`, `Copied: ${t.dataset.native}`));
	if (t.id === 'drv-copy') return copy(t.dataset.text, Z('地址已复制', 'Address copied'));
	if (t.matches('[data-copy-text]')) return copy(t.dataset.copyText, Z(`已复制：${t.dataset.copyText}`, `Copied: ${t.dataset.copyText}`));
	if (t.matches('[data-coupon]')) return openCoupon(t.querySelector('img'));
	if (t.matches('[data-close]')) {
		closeDialog(t.closest('dialog'));
		return;
	}
	if (t.matches('[data-map-day]')) {
		const f = t.dataset.mapDay;
		const dlg = t.closest('dialog');
		const go = () => {
			mapView = 'list';
			mapFull(true);
			withMap(() => map.filter(f));
		};
		if (dlg) {
			closeDialog(dlg);
			whenSettled(go);
		} else go();
		return;
	}
	// the map's day and area live in a sheet behind one button (ADR-20261124-map-first-search): a pick applies and
	// closes it, so the map shows the change at once; before the map has loaded it's remembered and applied when it is
	if (t.matches('[data-mapfilters]')) {
		openDialog($('#mapfilt'));
		return;
	}
	if (t.matches('[data-view]')) {
		const k = t.dataset.view;
		closeDialog(t.closest('dialog'));
		$$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.view === k)));
		withMap(() => map.view(k));
		return;
	}
	if (t.matches('[data-filter]')) {
		const f = t.dataset.filter;
		mapView = 'list'; // a day the person picks: the page's places for it
		closeDialog(t.closest('dialog'));
		if (!map) {
			mapDay = f;
			$$('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === f)));
			mapFiltSync();
			mapListSync();
		}
		withMap(() => map.filter(f));
		return;
	}
	if (t.matches('[data-pane]')) {
		const k = t.dataset.pane;
		if (k === 'close') {
			if (finderAt) finderReset();
			mapListOpen(false);
			const q = $('#mapq');
			if (q) q.focus({ preventScroll: true });
			return;
		}
		const i = PANE_STOPS.indexOf(paneStop) + (k === 'up' ? 1 : -1);
		paneTo(PANE_STOPS[Math.max(0, Math.min(PANE_STOPS.length - 1, i))]);
		return;
	}
	if (t.matches('[data-reset-all]')) {
		resetAll();
		return;
	}
	if (t.matches('[data-sync-open]')) {
		closeDialog(t.closest('dialog'));
		whenSettled(() => openSheet(syncSheet()));
		return;
	}
	if (t.matches('[data-sync-now]')) {
		syncNow(t);
		return;
	}
	if (t.matches('[data-upd]')) {
		if (navigator.onLine === false) toast(Z('没有网络：先用这一版，有网络再更新', 'Offline: keep this copy and update when you’re online'));
		else {
			spotSave();
			location.reload();
		}
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
		geoBusy(t);
		locateMe(() => renderNow());
		return;
	}
	if (t.matches('[data-geo-no]')) {
		hintGone('geo');
		renderNow();
		toast(Z('不再提示。设置里还能打开定位', 'It won’t ask again. Settings can still turn location on'));
		return;
	}
	if (t.matches('[data-geo-row]')) {
		// Location in the settings: the steps when the browser said no, else the browser's own ask
		closeDialog(t.closest('dialog'));
		if (geoState === 'denied') whenSettled(() => geoHelp());
		else locateMe(() => renderNow());
		return;
	}
	if (t.matches('[data-geo-help]')) {
		geoHelp(t.dataset.geoHelp);
		return;
	}
	if (t.matches('[data-late-loc]')) {
		geoBusy(t);
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
			// from the add sheet's list: the place first, over the list, which Back brings back as it was
			it.day = addDay;
			if (addCtx.t) it.t = addCtx.t;
			addPeek(it, t);
		} else sheetShow(addSheet(it));
		setTimeout(addClashNote, 0);
		return;
	}
	if (t.matches('[data-add-peek]')) {
		// the row itself: the same as its "Add to plan"
		const a = t.parentElement && t.parentElement.querySelector('[data-add]');
		if (a) a.click();
		return;
	}
	if (t.matches('[data-add-back]')) {
		addPeekBack();
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
		if (x && !canEditStop(x)) return toast(noEditMsg());
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
				...addedBy(),
			});
		mineSet(list);
		closeDialog($('#placeSheet'));
		const sid = x ? x.id : list[list.length - 1].id;
		addItem = null;
		const added = Z(`已加入 Day ${dayById[day].n} ${tm}`, `Added to Day ${dayById[day].n}, ${tm}`);
		// added from another view (the map's finder, another day): one tap shows the day, at the new stop (20-views.js)
		const show =
			day !== curView
				? {
						label: Z(`看 Day ${dayById[day].n}`, `Show Day ${dayById[day].n}`),
						run: () => {
							const el = document.getElementById(sid);
							if (el) goTo(el);
						},
					}
				: null;
		whenSettled(() => mineRerender(SYNC ? `${added}${Z('（大家的页面都有）', ' · on everyone’s page')}` : added, show));
		return;
	}
	if (t.matches('[data-mine-edit]')) {
		const x = MINE[t.dataset.mineEdit];
		if (x && !canEditStop(x)) return toast(noEditMsg());
		if (x) {
			sheetShow(addSheet({ id: x.id, n: x.name, lat: x.lat, lng: x.lng, gpid: x.gpid, q: x.q, addr: x.addr, day: x.day, t: x.t }));
			setTimeout(addClashNote, 0);
		}
		return;
	}
	if (t.matches('[data-mine-del]')) {
		const x = MINE[t.dataset.mineDel];
		const everyone = SYNC ? Z('所有人的页面都会删掉它。', ' It goes from everyone’s page.') : '';
		if (x && !canEditStop(x)) return toast(noEditMsg());
		if (!x || !confirm(Z(`从行程删除「${x.name}」？${everyone}`, `Remove "${x.name}" from the plan?${everyone}`))) return;
		mineSet(mineAll().filter((y) => y.id !== x.id));
		const sh = $('#placeSheet');
		if (sh && sh.open && !sh.querySelector('[data-sync-sheet]')) closeDialog(sh);
		whenSettled(() => mineRerender(Z(`已删除「${x.name}」`, `Removed ${x.name}`), undoPutBack([x])));
		return;
	}
	if (t.matches('[data-mine-clear-own]')) {
		removeStops(mineAll().filter(ownsStop), (n) =>
			Z(`删除你加的 ${n} 个行程？所有人的页面都会删掉。`, `Remove the ${n} stop${n > 1 ? 's' : ''} you added? They go from everyone’s page.`),
		);
		return;
	}
	if (t.matches('[data-mine-clear-dev]')) {
		if (!syncIsPlanner()) return toast(noEditMsg());
		const dev = t.dataset.mineClearDev;
		const list = mineAll().filter((x) => (stopOwner(x) || '') === dev);
		const by = (list.find((x) => x.by) || {}).by || Z('这个人', 'this person');
		removeStops(list, (n) =>
			Z(`删除${by}加的 ${n} 个行程？所有人的页面都会删掉。`, `Remove the ${n} stop${n > 1 ? 's' : ''} ${by} added? They go from everyone’s page.`),
		);
		return;
	}
	// skipping a planned stop (07-skip.js, ADR-20261128-skip-planned-stops): open to anyone, with or without group sync
	if (t.matches('[data-skip]')) {
		const [dy, i] = t.dataset.skip.split('|');
		skipStop(dy, +i);
		return;
	}
	if (t.matches('[data-unskip]')) {
		unskip(t.dataset.unskip);
		return;
	}
	if (t.matches('[data-skip-pull]')) {
		const [dy, key] = t.dataset.skipPull.split('|');
		skipPull(dy, key);
		return;
	}
	if (t.matches('[data-skip-keep]')) {
		// No thanks: the suggestion goes, the skipped stop joins the day's fold at the next redraw
		skipAsk = null;
		whenSettled(() => mineRerender());
		return;
	}
	if (t.matches('[data-gone-back]')) {
		const e = (store.get('syncGone', []) || []).find((y) => y && y.x && y.x.id === t.dataset.goneBack);
		if (!e || MINE[e.x.id]) return;
		if (!canEditStop(e.x)) return toast(noEditMsg());
		putBack([e.x]);
		return;
	}
	if (t.matches('[data-role-set], [data-role-drop]')) {
		if (!syncIsPlanner()) return toast(noEditMsg());
		const dev = t.dataset.roleSet || t.dataset.roleDrop;
		const name = (store.get('people', {}) || {})[dev] || Z('这台设备', 'this device');
		const on = !!t.dataset.roleSet;
		if (
			!confirm(
				on
					? Z(`把${name}设为规划人？规划人可以改、删任何人加的行程。`, `Make ${name} a planner? Planners can change or remove anyone’s stops.`)
					: Z(`取消${name}的规划人？`, `${name} is no longer a planner?`),
			)
		)
			return;
		const roles = { ...(store.get('roles', {}) || {}) };
		if (on) roles[dev] = 'planner';
		else delete roles[dev];
		store.set('roles', roles);
		// an approval trip: the database keeps who's a planner (ADR-20261127-sync-approval)
		if (SYNC_GATE && syncApi) syncApi.gate([['planner', { dev, on }]]);
		whenSettled(() =>
			mineRerender(on ? Z(`${name}现在是规划人`, `${name} is a planner now`) : Z(`${name}不再是规划人`, `${name} is no longer a planner`)),
		);
		syncSheetRefresh();
		return;
	}
	if (t.matches('[data-block-set], [data-block-drop]')) {
		if (!syncIsPlanner()) return toast(noEditMsg());
		const dev = t.dataset.blockSet || t.dataset.blockDrop;
		const name = (store.get('people', {}) || {})[dev] || Z('这台设备', 'this device');
		const on = !!t.dataset.blockSet;
		if (!on) {
			if (!confirm(Z(`恢复${name}？之后它的改动会再出现在大家的页面上。`, `Unblock ${name}? Its changes reach everyone again from now on.`))) return;
			const b = { ...(store.get('blocks', {}) || {}) };
			delete b[dev];
			store.set('blocks', b);
			if (SYNC_GATE && syncApi) syncApi.gate([['unblock', { dev }]]);
			whenSettled(() => mineRerender(Z(`已恢复${name}`, `Unblocked ${name}`)));
			syncSheetRefresh();
			return;
		}
		// what goes with the block: its added stops, and the pushed-back times, flight changes, shared ticks and skips it
		// changed last, back to the original plan. Undo puts all of it back
		const theirs = mineAll().filter((x) => stopOwner(x) === dev);
		const last = Object.entries((syncMeta() || {}).known || {})
			.filter(([, v]) => v && v.d === dev)
			.map(([rid]) => rid);
		const shifts = last.filter((r) => r.startsWith('shift:')).map((r) => r.slice(6));
		const flts = last.filter((r) => r === 'flt:arr' || r === 'flt:dep');
		const ticks = last.filter((r) => r.startsWith('tick:')).map((r) => r.slice(5));
		const skipped = last
			.filter((r) => r.startsWith('skip:'))
			.map((r) => r.slice(5))
			.filter((k) => skipsAll()[k]);
		const other = shifts.length + flts.length + ticks.length + skipped.length;
		const ask = Z(
			`停用${name}？它加的 ${theirs.length} 个行程${other ? `和最后改的 ${other} 处（推迟时间、航班、勾选、跳过的站）` : ''}会改回原计划，之后它的改动大家都看不到。规划人可以再恢复。`,
			`Block ${name}? Its ${theirs.length} added stop${theirs.length === 1 ? '' : 's'}${other ? ` and the ${other} change${other === 1 ? '' : 's'} it made last (pushed-back times, flights, ticks, skipped stops)` : ''} go back to the original plan, and from now on its changes are ignored on every device. A planner can unblock it.`,
		);
		if (!confirm(ask)) return;
		const was = {
			roles: store.get('roles', {}) || {},
			shift: store.get('shift', {}) || {},
			fltArr: store.get('fltArr', ''),
			fltDep: store.get('fltDep', ''),
			checks: store.get('checks', {}) || {},
			skips: skipsAll(),
		};
		const roles = { ...was.roles };
		delete roles[dev];
		store.set('roles', roles);
		store.set('blocks', { ...(store.get('blocks', {}) || {}), [dev]: true });
		// an approval trip: the database now refuses the device too, and its planner role goes (ADR-20261127-sync-approval)
		if (SYNC_GATE && syncApi) syncApi.gate([['block', { dev }]]);
		if (theirs.length) mineSet(mineAll().filter((x) => stopOwner(x) !== dev));
		if (shifts.length) {
			const sh = { ...was.shift };
			for (const d of shifts) delete sh[d];
			store.set('shift', sh);
		}
		for (const f of flts) store.set(f === 'flt:arr' ? 'fltArr' : 'fltDep', '');
		if (skipped.length) {
			const sk = { ...was.skips };
			for (const k of skipped) delete sk[k];
			store.set('skips', sk);
		}
		if (ticks.length) {
			const ck = { ...was.checks };
			for (const k of ticks) delete ck[k];
			store.set('checks', ck);
			checks = ck;
		}
		const undo = {
			label: Z('撤销', 'Undo'),
			run: () => {
				const b = { ...(store.get('blocks', {}) || {}) };
				delete b[dev];
				store.set('blocks', b);
				if (was.roles[dev]) store.set('roles', { ...(store.get('roles', {}) || {}), [dev]: was.roles[dev] });
				if (SYNC_GATE && syncApi) syncApi.gate([['unblock', { dev }], ...(was.roles[dev] ? [['planner', { dev, on: true }]] : [])]);
				if (shifts.length)
					store.set('shift', { ...(store.get('shift', {}) || {}), ...Object.fromEntries(shifts.map((d) => [d, was.shift[d]]).filter(([, v]) => v)) });
				for (const f of flts) store.set(f === 'flt:arr' ? 'fltArr' : 'fltDep', f === 'flt:arr' ? was.fltArr : was.fltDep);
				if (skipped.length) store.set('skips', { ...skipsAll(), ...Object.fromEntries(skipped.map((k) => [k, was.skips[k]])) });
				if (ticks.length) {
					const ck = { ...(store.get('checks', {}) || {}) };
					for (const k of ticks) if (was.checks[k]) ck[k] = true;
					store.set('checks', ck);
					checks = ck;
				}
				if (theirs.length) putBack(theirs);
				else whenSettled(() => mineRerender(Z(`已恢复${name}`, `Unblocked ${name}`)));
			},
		};
		whenSettled(() => mineRerender(Z(`已停用${name}`, `Blocked ${name}`), undo));
		syncSheetRefresh();
		return;
	}
	if (t.matches('[data-toast-act]')) {
		toastRun();
		return;
	}
	if (t.matches('[data-add-use-time]')) {
		const inp = $('[data-add-t]');
		if (inp) inp.value = t.dataset.addUseTime;
		addClashNote();
		return;
	}
	if (t.matches('[data-welcome-save]')) {
		syncWelcomeSave();
		return;
	}
	if (t.matches('[data-sync-later]')) {
		store.set('syncBarLater', Date.now() + 24 * 3600000);
		syncBarPaint();
		return;
	}
	if (t.matches('[data-mine-share]')) {
		closeDialog(t.closest('dialog.bsheet')); // a day's ⋯ sheet
		const url = mineShareURL();
		const skips = Object.keys(skipsAll()).length > 0;
		const text = skips
			? Z(`我的${CITY[0]}行程改动：打开链接就能加入你的页面`, `My changes to the ${CITY[1]} plan: open the link to add them`)
			: Z(`我加的${CITY[0]}行程：打开链接就能加入你的页面`, `My added ${CITY[1]} stops: open the link to add them`);
		if (navigator.share)
			navigator.share({ title: skips ? Z('我的行程改动', 'My changes') : Z('我加的行程', 'My added stops'), text, url }).catch(() => {});
		else if (navigator.clipboard)
			navigator.clipboard.writeText(url).then(() => toast(Z('链接已复制，贴到群里', 'Link copied: paste it in the chat')));
		return;
	}
	if (t.matches('[data-mine-import]')) {
		const list = mineAll();
		let n = 0;
		(mineIncoming || []).forEach((x) => {
			if (!list.some((y) => y.day === x.day && y.t === x.t && y.name === x.name)) {
				list.push({ id: `mine-${Date.now().toString(36)}${n}`, q: x.name, ...x, ...addedBy() });
				n++;
			}
		});
		mineSet(list);
		// and the stops the sender skipped (still ones this page lets the group skip)
		const sk = mineIncomingSkips.filter((k) => SKIP_AT[k] && !skipsAll()[k]);
		if (sk.length) store.set('skips', { ...skipsAll(), ...Object.fromEntries(sk.map((k) => [k, { at: Date.now() }])) });
		mineIncoming = null;
		mineIncomingSkips = [];
		closeDialog($('#placeSheet'));
		whenSettled(() =>
			mineRerender(sk.length ? Z(`已加入 ${n} 个，跳过 ${sk.length} 站`, `Added ${n}, skipped ${sk.length}`) : Z(`已加入 ${n} 个`, `Added ${n}`)),
		);
		return;
	}
	if (t.matches('[data-gsearch]')) {
		gSearch(($('#mapq') || {}).value.trim());
		return;
	}
	if (t.matches('[data-gback]')) {
		mapView = 'list';
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
		mapView = 'list'; // a category the person picks: the page's places in it
		closeDialog(t.closest('dialog'));
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
			mapFiltSync();
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
		const p = findPool().find((x) => x.pid === pid);
		if ($('#mapq')) $('#mapq').blur();
		// a sight, a shop, food or drink: the finder, beside the map (how it fits the plan); transport and toilets: the pin
		const info = p && finderFor(p) && placeInfo(pinRef(p));
		if (info) {
			finderOpen(info, p.type === 'buy' ? null : pid, `[data-mres="${pid}"]`); // a shop box shop has no pin
			return;
		}
		const card = $('#mapcard');
		if (p && liveFailed && card) {
			// no map to show it on: its card, under the map
			showCard(p);
			scrollToEl(card, 'center', false);
			return;
		}
		// transport and toilets: the list stays, lowered to a peek on a phone, so the pin and its popup show above it
		if (!paneSide()) paneTo('peek');
		stageInView();
		if (p && !map) showCard(p); // the card under the map, while the live map is still on its way (or can't come)
		withMap(() => map.select(pid));
		return;
	}
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
	// a day that splits: switch its plan (remembered on this phone), or show a plan's route on the map
	const splitOpt = (v) => {
		const [day, id] = String(v).split('|');
		const d = dayById[day];
		return d && d.split ? [d, d.split.options.find((o) => o.id === id)] : [];
	};
	if (t.matches('[data-split-pick]')) {
		const [d, o] = splitOpt(t.dataset.splitPick);
		const card = t.closest('.split-card');
		if (!o || !card) return;
		store.set('splitPick', { ...(store.get('splitPick', {}) || {}), [d.id]: o.id });
		card.querySelectorAll('[data-split-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b === t)));
		card.querySelectorAll('[data-split-opt]').forEach((p) => (p.hidden = p.dataset.splitOpt !== o.id));
		card.querySelector('[data-split-sum]').textContent = splitLine(o);
		ybFill(card);
		return;
	}
	if (t.matches('[data-split-map]')) {
		const [d, o] = splitOpt(t.dataset.splitMap);
		if (!o || !o.line) return;
		if (liveFailed) {
			window.open(splitDir(o), '_blank', 'noopener');
			return;
		}
		const color = getComputedStyle(document.documentElement).getPropertyValue(`--l${d.c}`).trim() || '#1a73e8';
		mapFull(true);
		withMap(() => map.ride && map.ride(o.line, color));
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
		// with group sync on, the ticks in shared lists are the group's: clearing this phone leaves them be
		checks = Object.fromEntries(Object.entries(checks).filter(([k]) => sharedTick(k)));
		store.set('checks', checks);
		$$('[data-check]').forEach((b) => {
			b.checked = !!checks[b.dataset.check];
		});
		$('#reset-confirm').hidden = true;
		$('#reset-ask').hidden = false;
		updateProgress();
		renderNow();
		toast(Z('已清除', 'Cleared'));
		return;
	}
	if (t.matches('a[href^="#"]') && t.getAttribute('href').length > 1) {
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
		// a view (the bottom bar, the Days sheet, the week list, the rail, a day's previous / next) opens at its top; a
		// place inside one lands with the highlight and the ring that holds on it (20-views.js shows its view first)
		const nav = t.matches('.tb, .toc-now, .wk, .rl, .pg');
		goTo(
			el,
			'start',
			() => {
				flash(el);
				landed(el);
			},
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
// a split day's plan, opened: the live bike counts at its docks (the request goes out only then)
document.addEventListener(
	'toggle',
	(e) => {
		const d = e.target;
		if (d instanceof HTMLDetailsElement && d.open && d.classList.contains('split-card')) ybFill(d);
	},
	true,
);
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
		addAutoT = false; // a time typed in is the person's: warn, don't move it
		addClashNote();
		return;
	}
	if (e.target.matches && e.target.matches('[data-addq]')) {
		const v = e.target.value;
		requestAnimationFrame(() => addFindRender(v));
		return;
	}
	if (e.target.id === 'mapq') {
		mapView = 'list'; // a new query: the page's places for it, the Google search one tap below
		if (finderAt) finderReset();
		mapListOpen(true);
		if (!map) withMap(() => {});
		return;
	}
	if (e.target.id === 'q') {
		const v = e.target.value;
		requestAnimationFrame(() => runSearch(v));
	}
	// the rate, in the budget or the Sections menu (one value, kept on this phone): a usable one takes effect as it's typed
	if (e.target.matches && e.target.matches('input[data-rate]')) {
		const v = parseFloat(e.target.value);
		const ok = v > 0 && v < 1e5;
		e.target.setAttribute('aria-invalid', ok ? 'false' : 'true');
		if (ok) {
			store.set('rate', v);
			rateSet(v);
		}
	}
});
// a rate field left with an unusable entry shows the rate in use again
document.addEventListener('change', (e) => {
	if (e.target.matches && e.target.matches('input[data-rate]')) {
		e.target.value = rate;
		e.target.setAttribute('aria-invalid', 'false');
	}
});
// every figure that follows the rate, re-texted in place (no redraw, so the field keeps its focus): the home-currency
// lines, converted figures and labels, the budget chart when it's in the home currency, both rate fields, the reset
function rateSet(v) {
	rate = v;
	if (!homeFirst)
		$$('[data-rm]').forEach((el) => {
			const [a, b] = el.dataset.rm.split(',').map(Number);
			el.textContent = rmText(a, b);
		});
	$$('[data-cv]').forEach((el) => {
		const [a, b] = el.dataset.cv.split(',').map(Number);
		el.textContent = Money.homeAmount(a, b, rate, CUR.home);
	});
	$$('[data-cvt]').forEach((el) => {
		el.textContent = cvPlain(el.dataset.cvt);
	});
	// the budget's glance (what's paid, what's still to come) is worked out in the home currency: drawn again
	const bg = $('#budget-glance');
	if (bg) bg.outerHTML = budgetGlance();
	const bk = $('#budget-kinds'); // and so is the By kind sheet, once it's drawn
	if (bk) bk.innerHTML = budKindsHTML();
	if (homeFirst) {
		const bars = $('#budget-bars'),
			air = $('#airport-bars');
		if (bars) bars.innerHTML = budgetBars();
		if (air) air.innerHTML = airportBars();
	}
	$$('input[data-rate]').forEach((i) => {
		if (i !== document.activeElement) i.value = rate;
	});
	const reset = $('[data-rate-reset]');
	if (reset) reset.hidden = store.get('rate') == null; // only while this phone has a rate of its own
	calcLucky();
}
document.addEventListener('keydown', (e) => {
	// every field the page types into: the keyboard's Enter (Search, Go, Done) acts and lets go of the field, so a phone
	// puts its keyboard away and what the field found shows. A field outside a form gets nothing from Enter by itself.
	// enterKey leaves an input method's Enter alone (02-helpers.js)
	if (enterKey(e) && e.target.matches && e.target.matches('input[type="search"], input[type="text"], input[type="password"]')) {
		if (e.target.id === 'q') {
			e.preventDefault();
			if (searchState.hits.length) jumpTo(0);
		} else if (e.target.id === 'mapq') {
			e.preventDefault();
			if (e.target.value.trim()) mapListOpen(true);
		}
		// a name field's change saves it as it lets go (26-sync.js); the welcome name and the planner code act on their own
		e.target.blur();
	}
	if (e.key === 'Escape' && !$('#search-row').hidden) closeSearch();
	if (e.key === 'Escape' && mapFullOn && !document.querySelector('dialog[open]')) mapFull(false);
});
// the map's search lets go of its field (Search, the keyboard's own close, a tap on the map): once the keyboard has
// gone, the map and its sheet are lined up again, so the sheet's last row (Google's search) isn't behind the bottom bar
document.addEventListener('focusout', (e) => {
	if (e.target.id === 'mapq') stageAfterKeyboard();
});
$('#q').addEventListener('focus', () => {
	if (searchState.q) $('#results').dataset.state = 'open';
});
window.addEventListener('resize', () => measureBar());
/* a tax-refund coupon full screen, for the cashier's scanner (ADR-20261128-tax-refund): pure white, the whole coupon on
   the screen from the full-size image (scaled by CSS only, never a smaller copy), a landscape coupon turned a quarter
   turn on a phone held upright so it fills the long edge (Tax.turnFor); a double tap zooms in where it lands (one image
   pixel to one screen pixel, or twice the fit) and back, and pinch zoom works. The screen stays awake while it's open
   (Wake Lock, where the browser has it). A page can't set the brightness or lock the orientation, so it asks for the
   first and turns the image instead of the phone. ✕, Escape and Back close it */
let couponLock = null;
const couponWake = () => {
	if (!navigator.wakeLock || !$('#couponView') || !$('#couponView').open || document.visibilityState !== 'visible') return;
	navigator.wakeLock
		.request('screen')
		.then((l) => {
			couponLock = l;
		})
		.catch(() => {});
};
document.addEventListener('visibilitychange', couponWake); // the lock goes when the page is hidden: take it again
function openCoupon(img) {
	if (!img) return;
	let d = $('#couponView');
	if (!d) {
		d = document.createElement('dialog');
		d.id = 'couponView';
		d.className = 'coupon-view';
		document.body.append(d);
		d.addEventListener('close', () => {
			if (couponLock) couponLock.release().catch(() => {});
			couponLock = null;
		});
	}
	d.setAttribute('aria-label', img.alt);
	d.innerHTML = `<button type="button" class="icon-btn cv-x" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button><div class="cv-scroll"><img alt="${esc(img.alt)}"></div><p class="cv-tip">${Z('把屏幕调亮，扫得比较快', 'Turn the brightness up for a quicker scan')}</p>`;
	const box = d.querySelector('.cv-scroll');
	const big = box.querySelector('img');
	const turn = () =>
		box.classList.toggle(
			'is-turned',
			!box.classList.contains('is-zoomed') && Tax.turnFor(big.naturalWidth, big.naturalHeight, innerWidth, innerHeight),
		);
	big.addEventListener('load', turn);
	addEventListener('resize', turn);
	d.addEventListener('close', () => removeEventListener('resize', turn), { once: true });
	big.src = img.currentSrc || img.src;
	if (big.complete) turn();
	const zoom = (x, y) => {
		const on = !box.classList.contains('is-zoomed');
		box.classList.remove('is-turned'); // zoomed, it reads upright and scrolls; zoomed out, it turns again if it should
		const r = big.getBoundingClientRect();
		box.classList.toggle('is-zoomed', on);
		big.style.width = on ? `${Math.max(big.naturalWidth / (window.devicePixelRatio || 1), Math.min(r.width, innerWidth) * 2)}px` : '';
		if (!on) return turn();
		// keep the tapped point under the finger
		const n = big.getBoundingClientRect();
		const b = box.getBoundingClientRect();
		box.scrollLeft = Math.max(0, ((x - r.left) / r.width) * n.width - (x - b.left));
		box.scrollTop = Math.max(0, ((y - r.top) / r.height) * n.height - (y - b.top));
	};
	let last = 0;
	let lx = 0;
	let ly = 0;
	big.addEventListener('pointerup', (e) => {
		const now = Date.now();
		if (now - last < 350 && Math.hypot(e.clientX - lx, e.clientY - ly) < 30) {
			last = 0;
			zoom(e.clientX, e.clientY);
		} else [last, lx, ly] = [now, e.clientX, e.clientY];
	});
	openDialog(d);
	whenSettled(couponWake);
}
