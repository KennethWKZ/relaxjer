/* ───────── Back button ─────────
     Sheets, dialogs and the full-screen map each take one history step, so the phone's Back gesture closes them
     instead of leaving the page. A jump to another section takes one too: Back (or the 返回 button, for chat-app
     browsers that hide Back) returns to where you were. */
const overlays = [];
let backPending = 0;
let dropN = 0;
const afterBack = [];
function openOverlay(close) {
	const o = { close };
	overlays.push(o);
	history.pushState({ tpOverlay: 1 }, '');
	syncBackPill();
	return o;
}
function dropOverlay(o) {
	// it closed by itself (✕, Esc, tap outside): remove its history step; several in one go become one step back
	const i = overlays.indexOf(o);
	if (i < 0) return;
	overlays.splice(i, 1);
	if (!dropN++)
		queueMicrotask(() => {
			const n = dropN;
			dropN = 0;
			backPending++;
			history.go(-n);
		});
}
function whenSettled(fn) {
	if (backPending || dropN) afterBack.push(fn);
	else fn();
}
window.addEventListener('popstate', () => {
	if (backPending) {
		backPending--;
		if (!backPending) {
			const q = afterBack.splice(0);
			setTimeout(() => {
				q.forEach((f) => f());
				syncBackPill();
			}, 30);
		}
		return;
	}
	const o = overlays.pop();
	if (o) {
		o.close();
		syncBackPill();
		return;
	}
	const y = history.state && history.state.y;
	if (y != null) {
		pinN++;
		window.scrollTo({ top: y, behavior: 'instant' });
	} // back to where you were, no long scroll
	syncBackPill();
});
function syncBackPill() {
	const b = $('#backPill');
	if (b) b.dataset.show = history.state && history.state.tpJump && !overlays.length ? '1' : '0';
}
function openDialog(d) {
	if (!d || d.open) return;
	whenSettled(() => {
		if (d.open) return;
		d.showModal();
		const o = openOverlay(() => {
			if (d.open) d.close();
		});
		d._ov = o;
		d.addEventListener('close', () => dropOverlay(o), { once: true }); // Esc: the close event comes later, that's fine
	});
}
// our own closes drop the history step right away: the close event is async, and a jump right after must come after it
function closeDialog(d) {
	if (!d) return;
	if (d.open) d.close();
	if (d._ov) {
		dropOverlay(d._ov);
		d._ov = null;
	}
}
// a jump to another part of the page: remember where we were, so Back comes back here
// a smooth scroll across sections that are not drawn yet (content-visibility) can stop short of the target:
// when it ends, snap to the target unless the person has started scrolling themselves
// after an instant jump, sections above the target still draw at their real height (content-visibility). Chromium's
// scroll anchoring keeps the target in place; WebKit says it supports overflow-anchor but doesn't hold it, so a tab jump
// landed hundreds of px off. Re-land for a moment, unless the reader touches the page first or another jump / Back
// (each bumps pinN) takes over.
function holdLanding(el, block) {
	let took = false;
	const mine = () => {
		took = true;
	};
	const IN = ['touchstart', 'wheel', 'keydown', 'pointerdown'];
	IN.forEach((ev) => addEventListener(ev, mine, { passive: true }));
	const t0 = el.getBoundingClientRect().top;
	const n = pinN;
	[50, 150, 350, 700, 1200].forEach((ms, i, all) =>
		setTimeout(() => {
			if (!took && pinN === n && el.isConnected && Math.abs(el.getBoundingClientRect().top - t0) > 2)
				el.scrollIntoView({ block, behavior: 'instant' });
			if (i === all.length - 1) IN.forEach((ev) => removeEventListener(ev, mine));
		}, ms),
	);
}
function scrollToEl(el, block, smooth) {
	pinN++; // a jump we make ourselves ends any "keep my place" hold from a redraw
	if (!smooth) {
		el.scrollIntoView({ block, behavior: 'instant' });
		holdLanding(el, block);
		return;
	}
	let took = false;
	const mine = () => {
		took = true;
	};
	const IN = ['touchstart', 'wheel', 'keydown'];
	const done = () => {
		clearTimeout(tm);
		removeEventListener('scrollend', done);
		IN.forEach((ev) => removeEventListener(ev, mine));
		if (!took) el.scrollIntoView({ block, behavior: 'instant' });
	};
	IN.forEach((ev) => addEventListener(ev, mine, { passive: true }));
	addEventListener('scrollend', done);
	const tm = setTimeout(done, 1200);
	el.scrollIntoView({ block, behavior: 'smooth' });
}
const noMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function goTo(el, block = 'start', after, instant) {
	const y0 = window.scrollY;
	if (mapFullOn) mapFull(false);
	whenSettled(() => {
		let p = el.closest('details');
		while (p) {
			p.open = true;
			p = p.parentElement && p.parentElement.closest('details');
		}
		history.replaceState(Object.assign({}, history.state, { y: y0 }), '');
		history.pushState({ tpJump: 1 }, '', el.id ? '#' + el.id : location.href);
		const far = instant || Math.abs(el.getBoundingClientRect().top) > innerHeight * 3;
		scrollToEl(el, block, !far && !noMotion());
		const sec = el.closest('[data-sec]');
		if (sec) {
			setActive(sec.id);
			spyHold = performance.now() + (far ? 250 : 1100);
		} // the tapped tab stays lit while we scroll there
		syncBackPill();
		if (after) after();
	});
}
// a place: show its card in a sheet over the page instead of jumping away from what you were reading
function sheetShow(html) {
	const d = $('#placeSheet');
	if (d && d.open) {
		d.querySelector('.psheet-body').innerHTML = html;
		d.scrollTop = 0;
	} else openSheet(html);
}
function openSheet(html, listId) {
	const d = $('#placeSheet');
	if (!d) return;
	d.innerHTML = `<div class="psheet-top"><span class="psheet-grip" aria-hidden="true"></span><button type="button" class="icon-btn" data-close aria-label="${Z('关闭', 'Close')}">${icon('x')}</button></div>
      <div class="psheet-body">${html}${listId && (document.getElementById(listId) || LAZY_ID.has(listId)) ? `<a class="mlink psheet-go" href="#${esc(listId)}" data-go>${icon('list')}${Z('在清单里看', 'Show in the list')}</a>` : ''}</div>`;
	d.querySelectorAll('.psheet-body [id]').forEach((x) => x.removeAttribute('id'));
	d.scrollTop = 0;
	openDialog(d);
}
function openPinSheet(p) {
	const box = document.createElement('div');
	showCard(p, box);
	openSheet(box.innerHTML, p.food ? foodId(p.food) : p.wish ? `wish-${p.wish.id}` : '');
}

/* full-screen map: a fixed layer, not the Fullscreen API (iPhone Safari has none for page elements) */
let mapFullOn = false;
let mapFullFrom = null;
let mapFullO = null;
function mapFull(on, after) {
	const st = $('#mapstage');
	if (on && (backPending || dropN)) {
		whenSettled(() => mapFull(true, after));
		return;
	}
	if (!st || on === mapFullOn) {
		if (after) whenSettled(after);
		return;
	}
	mapFullOn = on;
	st.classList.toggle('is-full', on);
	document.documentElement.classList.toggle('map-full-on', on);
	if (gmap) gmap.setOptions({ gestureHandling: on ? 'greedy' : 'cooperative' });
	if (map && map.refit) map.refit();
	if (on) {
		mapFullFrom = document.activeElement;
		mapFullO = openOverlay(() => mapFull(false));
		$('.map-exit').focus({ preventScroll: true });
		if (after) after();
		return;
	}
	if (mapFullO) {
		dropOverlay(mapFullO);
		mapFullO = null;
	} // closed by Back: already off the stack
	whenSettled(() => {
		if (after) after();
		else if (mapFullFrom && mapFullFrom.isConnected) mapFullFrom.focus({ preventScroll: true });
		mapFullFrom = null;
	});
}
// run fn once the live map exists; starts loading it now if it was waiting to be scrolled into view
let mapWait = [];
let liveIO = null;
function withMap(fn) {
	if (map) {
		fn();
		return;
	}
	mapWait.push(fn);
	if (liveIO) {
		liveIO.disconnect();
		liveIO = null;
		startLiveMap();
	}
}
