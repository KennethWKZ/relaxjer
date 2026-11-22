/* ───────── the planner's preview panel (ADR-20261122-day-views) ─────────
   Only in a page built with `pnpm build --trip … --preview` (engine/build.mjs joins this file before 99-close.js and
   writes <name>-preview.html, never the page that gets published). The planner compares looks on it: the sky's style,
   a weather to preview, the snow on or off, the theme, and the clock (now, during the trip, before it). Its choices
   are for looking only: they live in LOOK (01-storage.js) for this visit, never in the trip's data, never saved, never
   synced. */
(() => {
	const root = document.documentElement;
	const hasSky = !!root.dataset.sky; // the world draws a sky (its build set one)
	const pick = { sky: hasSky ? skyMode() : 'off', wx: '', snow: '', theme: '', clock: '' };
	const mid = DAYS[Math.min(2, DAYS.length - 1)];
	const CLOCKS = {
		trip: { date: mid.date, mins: 10 * 60 + 40 },
		pre: { date: Time.addDays(TRIP.start, -5), mins: 9 * 60 },
	};
	const ROWS = [
		hasSky && [
			'sky',
			['天空', 'Sky'],
			[
				['live', ['实时天气', 'Live weather']],
				['globe', ['雪球', 'Snow globe']],
				['pile', ['积雪', 'Piling snow']],
				['off', ['不要天空', 'No sky']],
			],
			['雪按那天的预报下；雪球要摇；积雪会堆在日期上。', 'Live: the forecast falls. Globe: shake it. Piling: snow builds up on the dates.'],
		],
		hasSky && [
			'wx',
			['天气预览', 'Weather to preview'],
			[
				['', ['跟着那天', 'Follow the day']],
				['heavy', ['大雪', 'Heavy snow']],
				['light', ['小雪', 'Light snow']],
				['shower', ['阵雪', 'Snow showers']],
				['clear', ['晴天', 'Clear']],
				['night', ['晴夜', 'Clear night']],
			],
		],
		hasSky && [
			'snow',
			['下雪', 'Snow'],
			[
				['', ['跟这支手机', 'As this phone has it']],
				['on', ['动', 'Falling']],
				['off', ['停', 'Paused']],
			],
		],
		[
			'theme',
			['主题', 'Theme'],
			[
				['', ['跟这支手机', 'As this phone has it']],
				['light', ['浅色', 'Light']],
				['dark', ['深色', 'Dark']],
				['system', ['跟系统', 'Match system']],
			],
		],
		[
			'clock',
			['演示时间', 'Clock'],
			[
				['', ['现在', 'Now']],
				['trip', [`旅途中（Day ${mid.n} 10:40）`, `During the trip (Day ${mid.n} 10:40)`]],
				['pre', ['出发前 5 天', '5 days before']],
			],
		],
	].filter(Boolean);
	const chip = document.createElement('button');
	chip.type = 'button';
	chip.className = 'pv-chip';
	chip.id = 'pvChip';
	chip.setAttribute('aria-expanded', 'false');
	chip.setAttribute('aria-controls', 'pvPanel');
	const panel = document.createElement('div');
	panel.className = 'pv-panel';
	panel.id = 'pvPanel';
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-labelledby', 'pvH');
	panel.hidden = true;
	$('#bar-main').insertBefore(chip, $('#searchBtn'));
	document.body.append(panel);
	const draw = () => {
		chip.innerHTML = `${Z('预览', 'Preview')}${icon('chev', 'pv-chev')}`;
		panel.innerHTML = `<div class="pv-head"><h2 id="pvH">${Z('预览设置', 'Preview settings')}<small>${Z('只为比较方案，不属于页面设计，也不会存下或同步', 'For comparing looks: not part of the page, never saved or synced')}</small></h2><button type="button" class="icon-btn pv-x" data-pv-close aria-label="${Z('关闭预览设置', 'Close the preview settings')}">${icon('x')}</button></div>
      ${ROWS.map(
				([k, h, opts, note]) =>
					`<fieldset><legend>${esc(L(h))}</legend><div class="pv-seg">${opts
						.map(
							([v, lab]) =>
								`<label><input type="radio" name="pv-${k}" value="${v}"${pick[k] === v ? ' checked' : ''}><span>${icon('check')}${esc(L(lab))}</span></label>`,
						)
						.join('')}</div>${note ? `<p class="pv-note">${esc(L(note))}</p>` : ''}</fieldset>`,
			).join('')}`;
	};
	const open = (on) => {
		panel.hidden = !on;
		chip.setAttribute('aria-expanded', String(on));
		if (on) panel.querySelector('input:checked, input').focus();
	};
	// a redraw keeps the reader's place, as a language switch does
	const redraw = () => {
		const sp = spotNow();
		render();
		spotRestore(sp);
	};
	chip.addEventListener('click', () => open(panel.hidden));
	panel.addEventListener('click', (e) => {
		if (e.target.closest('[data-pv-close]')) {
			open(false);
			chip.focus();
		}
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !panel.hidden) {
			open(false);
			chip.focus();
		}
	});
	panel.addEventListener('change', (e) => {
		const t = e.target;
		if (!t.name || !t.name.startsWith('pv-')) return;
		const k = t.name.slice(3);
		pick[k] = t.value;
		if (k === 'sky') {
			LOOK.sky = t.value;
			redraw();
		} else if (k === 'wx') {
			LOOK.wx = t.value || null;
			skyView(curView);
		} else if (k === 'snow') {
			LOOK.snow = t.value === 'on' ? true : t.value === 'off' ? false : null;
			skyBtnSync();
			skyFx.sync();
		} else if (k === 'theme') {
			themePref = t.value || (['dark', 'system'].includes(store.get('theme', 'light')) ? store.get('theme') : 'light');
			applyTheme();
			skyFx.colours();
		} else if (k === 'clock') {
			LOOK.clock = CLOCKS[t.value] || null;
			redraw();
		}
	});
	draw();
	root.dataset.preview = '1';
})();
