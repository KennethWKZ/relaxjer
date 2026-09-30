/* ───────── now / next ───────── */
function renderNow() {
	const now = tpNow();
	const el = $('#now');
	if (!el) return;
	const t0 = dnum(TRIP.start),
		t1 = dnum(TRIP.end),
		td = dnum(now.date);
	if (td < t0) {
		const n = t0 - td;
		const todo = [
			...ENTRY_CHECKS.items.map((i) => ({ ...i, gid: 'entry' })),
			...WEATHER.when
				.filter((w) => w.d)
				.map((w, i) => ({ id: 'wx' + i, t: [Z('看天气：', 'Weather: ') + L(w.v), Z('看天气：', 'Weather: ') + L(w.v)], due: w.d, gid: 'wx' })),
		]
			.filter((i) => i.due && !checks[`${i.gid}-${i.id}`] && dnum(i.due) >= td)
			.sort((a, b) => a.due.localeCompare(b.due))
			.slice(0, 3);
		el.innerHTML = `<div class="now-count"><span class="now-num">${n}</span><span class="now-unit">${Z('天后出发', n === 1 ? 'day to go' : 'days to go')}</span></div>
        <p class="muted">${Z(`${Time.dateLabel(FLIGHTS.out.date, 'zh', DAYS[0].dow)} 飞${TRIP.arriveCity[0]}，第一晚住`, `Fly to ${TRIP.arriveCity[1]} on ${Time.dateLabel(FLIGHTS.out.date, 'en', DAYS[0].dow)}; first night at`)} ${esc(L(PLACES.hotel.name))}</p>
        ${todo.length ? `<div class="now-rows">${todo.map((i) => `<div class="now-row"><span class="now-k">${esc(dateLabel(i.due))}</span><span class="now-v">${fmt(i.t)}</span></div>`).join('')}</div>` : ''}
        <div class="links-row"><a class="go-btn" href="#checklist">${icon('check')}${Z('打开清单', 'Open checklist')}</a><a class="go-btn ghost" href="#d1">${icon('arrow')}Day 1</a></div>`;
		return;
	}
	if (td > t1) {
		el.innerHTML = `<p class="now-unit">${Z('旅程结束，欢迎回家。', 'Trip done. Welcome home.')}</p>`;
		return;
	}
	const day = DAYS.find((d) => d.date === now.date);
	const { cur, next } = nowNext(day, now.mins);
	const row = (k, x) =>
		x
			? `<div class="now-row"><span class="now-k">${k}</span><span class="now-v"><a href="#${day.id}-s${x.i}"><span class="t">${esc(L(x.it.t))}</span>${fmt(x.it.what)}</a></span></div>`
			: '';
	const nxPlace = next && next.it.place;
	el.setAttribute('style', colorVars(day.c));
	el.innerHTML = `<div class="now-count"><span class="now-day" style="background:var(--c);color:var(--ci)">Day ${day.n}</span><span class="now-unit">${esc(dateLabel(day.date, day.dow))}</span></div>
      <p class="wish" lang="zh-Hans" style="font-size:2rem;margin:0">${esc(day.wish)}</p>
      <div class="now-rows">${row(Z('现在', 'Now'), cur)}${row(Z('接下来', 'Next'), next)}</div>
      ${lateHTML()}
      <div class="links-row"><a class="go-btn" href="#${cur ? `${day.id}-s${cur.i}` : next ? `${day.id}-s${next.i}` : day.id}">${icon('arrow')}${Z('看今天', 'Open today')}</a>${nxPlace ? ext(gmDir(PLACES[nxPlace].maps, 'transit'), Z('去下一站', 'Go to next stop'), 'route', 'go-btn ghost') : ''}</div>`;
}
function markToday() {
	const now = tpNow();
	const day = DAYS.find((d) => d.date === now.date);
	if (!day) return;
	const { cur, next } = nowNext(day, now.mins);
	day.schedule.forEach((it, i) => {
		const li = $(`#${day.id}-s${i}`);
		if (!li) return;
		const s = li.dataset.s != null ? +li.dataset.s : null;
		li.classList.toggle('done', s != null && s < now.mins && (!cur || cur.i !== i));
		li.classList.toggle('now', !!cur && cur.i === i);
		const slot = $('.flag-slot', li);
		if (slot)
			slot.innerHTML =
				cur && cur.i === i
					? `<span class="flag">${Z('现在', 'Now')}</span>`
					: next && next.i === i
						? `<span class="flag ghost">${Z('下一站', 'Next')}</span>`
						: '';
	});
	const ol = $(`#${day.id} .sched`);
	if (!ol) return;
	const n = $$('.stop.done', ol).length;
	let fold = $('.stop-fold', ol);
	if (n < 2) {
		if (fold) fold.remove();
		ol.classList.remove('folded');
		return;
	}
	if (!fold) {
		fold = document.createElement('li');
		fold.className = 'stop-fold';
		ol.prepend(fold);
	}
	const open = unfolded.has(day.id);
	ol.classList.toggle('folded', !open);
	fold.innerHTML = `<button type="button" data-fold="${day.id}">${icon('chev', 'chev')}${open ? Z('收起已过的', 'Hide done') : Z(`已过 ${n} 项`, `${n} done`)}</button>`;
}
const unfolded = new Set();
