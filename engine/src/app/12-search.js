  /* ───────── search ───────── */
  const T2S = '臺台車车館馆灣湾機机場场門门園园運运鐵铁買买賣卖錢钱點点雲云麵面魚鱼廳厅風风傘伞東东們们這这個个時时間间樓楼觀观燈灯佈布紀纪宮宫戲戏碼码頭头橋桥張张遊游費费預预錶表單单計计務务藥药妝妆貨货區区華华號号線线紅红藍蓝綠绿黃黄簡简體体發发開开關关見见說说話话從从來来過过還还進进後后會会對对帶带氣气溫温陽阳騎骑飲饮麼么價价劃划雙双實实驗验們们動动國国際际線线場场餐餐飯饭夜夜滬沪漁渔戶户豐丰嚴严選选內内隊队車车裡里號号衛卫億亿葉叶畫画廣广條条飛飞歲岁';
  const t2s = new Map(); for (let i = 0; i < T2S.length; i += 2) t2s.set(T2S[i], T2S[i + 1]);
  const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[一-鿿]/g, (c) => t2s.get(c) || c);
  const searchState = { q: '', hits: [], idx: -1 };
  const CAND = 'h2,h3,p,li,dt,dd,th,td,figcaption,.tag,.chip,.method-name,.bar-lab,.route,.wr-name';
  const textOf = (el) => (el.matches('figcaption') ? (el.firstChild ? el.firstChild.textContent : '') : el.textContent);
  const hay = (el) => norm(textOf(el) + ' ' + (el.dataset.alt || ''));
  const shown = (el) => el.getClientRects().length || el.closest('details:not([open])');
  function runSearch(raw) {
    searchState.q = raw; const q = norm(raw.trim());
    const res = $('#results'); const inner = $('#results-inner'); const count = $('#search-count');
    if (CSS.highlights) { CSS.highlights.delete('tp-hit'); CSS.highlights.delete('tp-hit-now'); }
    if (!q) { searchState.hits = []; count.textContent = ''; res.dataset.state = 'closed'; inner.innerHTML = ''; return; }
    lazyAll(); // closed lists are built on first open; search needs their text
    const els = $$(CAND, $('#app')).filter((el) => !el.closest('.credits') && hay(el).includes(q) && !$$(CAND, el).some((c) => hay(c).includes(q)) && shown(el));
    const todayId = (DAYS.find((d) => d.date === tpNow().date) || {}).id;
    const groups = new Map();
    els.forEach((el) => {
      const sec = el.closest('[data-sec]'); const k = sec ? sec.id : '_';
      const line = textOf(el).replace(/\s+/g, ' ').trim();
      const g = groups.get(k) || { k, items: [], seen: new Set() }; groups.set(k, g);
      if (!g.seen.has(line)) { g.seen.add(line); g.items.push(el); }
    });
    const rank = (k) => (k === todayId ? -1 : dayById[k] ? DAYS.indexOf(dayById[k]) : 100 + Math.max(0, NAV.findIndex((n) => n.id === k)));
    const ordered = [...groups.values()].sort((a, b) => rank(a.k) - rank(b.k));
    searchState.hits = ordered.flatMap((g) => g.items); searchState.idx = -1;
    const ranges = [];
    if (window.Highlight && CSS.highlights) {
      els.forEach((el) => {
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const t = norm(n.data); let i = t.indexOf(q);
          while (i > -1) { const r = new Range(); r.setStart(n, i); r.setEnd(n, Math.min(i + q.length, n.data.length)); ranges.push(r); i = t.indexOf(q, i + q.length); }
        }
      });
      CSS.highlights.set('tp-hit', new Highlight(...ranges));
    }
    const hits = searchState.hits; count.textContent = `${hits.length}`;
    let gi = -1;
    inner.innerHTML = hits.length ? hits.slice(0, 80).map((el, i) => {
      const sec = el.closest('[data-sec]'); const d = sec && dayById[sec.id];
      const where = d ? `Day ${d.n} · ${dateLabel(d.date, d.dow)}` : (NAV.find((n) => n.id === (sec && sec.id)) ? L(NAV.find((n) => n.id === sec.id).label) : '');
      const own = textOf(el).replace(/\s+/g, ' ').trim(); const hitOwn = norm(own).includes(q);
      const txt = hitOwn ? own : `${own} · ${el.dataset.alt || ''}`; const nt = norm(txt); const at = nt.indexOf(q, hitOwn ? 0 : own.length);
      const a = Math.max(0, at - 28), b = Math.min(txt.length, at + q.length + 60);
      const snip = (a > 0 ? '…' : '') + esc(txt.slice(a, at)) + '<mark>' + esc(txt.slice(at, at + q.length)) + '</mark>' + esc(txt.slice(at + q.length, b)) + (b < txt.length ? '…' : '');
      const g = ordered.findIndex((x) => x.items.includes(el)); const head = g !== gi ? (gi = g, `<p class="result-h" style="${d ? colorVars(d.c) : ''}">${d ? '<span class="result-dot" aria-hidden="true"></span>' : ''}${esc(where || Z('其他', 'Other'))}${d ? ` · ${esc(L(d.title))}` : ''}${ordered[g].k === todayId ? `<b class="flag">${Z('今天', 'Today')}</b>` : ''}<span class="result-n">${ordered[g].items.length}</span></p>`) : '';
      return `${head}<button type="button" class="result" data-hit="${i}" style="${d ? colorVars(d.c) : ''}"><span class="result-text">${snip}</span></button>`;
    }).join('') + (hits.length > 80 ? `<p class="results-empty">${Z(`还有 ${hits.length - 80} 个结果，请输入更精确的字。`, `${hits.length - 80} more; try a more specific word.`)}</p>` : '')
      : `<p class="results-empty">${Z('没有找到。试试别的字，或切换到 EN 用英文搜索。', 'Nothing found. Try another word or switch to 中 for Chinese.')}</p>`;
    res.dataset.state = 'open';
  }
  function jumpTo(i) {
    const el = searchState.hits[i]; if (!el) return; searchState.idx = i;
    let p = el.closest('details'); while (p) { p.open = true; p = p.parentElement && p.parentElement.closest('details'); }
    $('#results').dataset.state = 'closed';
    if (!(history.state && history.state.tpSearch)) { history.replaceState(Object.assign({}, history.state, { y: window.scrollY }), ''); history.pushState({ tpJump: 1, tpSearch: 1 }, ''); syncBackPill(); }
    scrollToEl(el, 'center', Math.abs(el.getBoundingClientRect().top) <= innerHeight * 3 && !noMotion());
    flash(el);
    if (window.Highlight && CSS.highlights) {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const q = norm(searchState.q.trim()); const rs = [];
      for (let n = w.nextNode(); n; n = w.nextNode()) { const k = norm(n.data).indexOf(q); if (k > -1) { const r = new Range(); r.setStart(n, k); r.setEnd(n, Math.min(k + q.length, n.data.length)); rs.push(r); } }
      CSS.highlights.set('tp-hit-now', new Highlight(...rs));
    }
    $('#search-count').textContent = `${i + 1}/${searchState.hits.length}`;
  }
  function landed(el) { el.classList.remove('landed'); void el.offsetWidth; el.classList.add('landed'); setTimeout(() => el.classList.remove('landed'), 1100); }
  function flash(el) {
    el.classList.remove('flash', 'fade'); void el.offsetWidth; el.classList.add('flash');
    setTimeout(() => el.classList.add('fade'), 60); setTimeout(() => el.classList.remove('flash', 'fade'), 1300);
  }
  function openSearch() {
    $('#bar-main').hidden = true; $('#search-row').hidden = false; $('#q').focus(); measureBar(); fabSync();
    if (searchState.q) runSearch(searchState.q);
  }
  function closeSearch() {
    $('#search-row').hidden = true; $('#bar-main').hidden = false; $('#results').dataset.state = 'closed'; measureBar(); fabSync();
    $('#searchBtn').focus();
  }
