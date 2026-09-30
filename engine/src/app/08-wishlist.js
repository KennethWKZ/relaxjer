  /* ───────── wishlist ───────── */
  const TRIP_DATES = DAYS.slice(0, 6).map((d) => d.date);
  const WISH_ICON = { food: 'food', snack: 'food', dessert: 'coffee', drink: 'coffee', shop: 'bag', market: 'bag', souvenir: 'bag', sight: 'pin', temple: 'flag', nature: 'sun', hotspring: 'sun' };
  const wName = (w) => (lang === 'en' ? (w.name_en || w.name_trad) : (w.name_zh || w.name_trad));
  const wBest = (w) => w.branches[Math.min(Math.max(+w.best || 0, 0), w.branches.length - 1)];
  const wQuery = (br, w) => br.maps_query || br.address_trad || w.name_trad;
  const fitLabel = (f) => (dayById[f.day] ? `Day ${dayById[f.day].n}` : f.day === 'any-evening' ? Z('任何晚上', 'Any evening') : Z('要专程', 'Special trip'));
  const closedNote = (br, onlyDate) => {
    if (br.paused) return `<p class="warn">${icon('alert')}${Z(`Google 显示暂停营业（${checkedOn('short')}查），出发前再确认`, `Google: temporarily closed (${checkedOn('short')}); recheck before trip`)}</p>`;
    const c = (br.closed_dates || []).filter((d) => TRIP_DATES.includes(d) && (!onlyDate || d === onlyDate));
    return c.length ? `<p class="warn">${icon('alert')}${Z('这天休息', 'Closed')}: ${c.map((d) => esc(dateLabel(d))).join(Z('、', ', '))}</p>` : '';
  };
  function wishCard(w) {
    const br = wBest(w); const q = wQuery(br, w);
    const others = w.branches.filter((b) => b !== br);
    const rating = w.rating ? `<span class="rating${/google/i.test(w.rating_source || '') ? ' rating-q' : ''}">${icon('star', 'star')}<b>${esc(w.rating)}</b>${w.reviews ? ` · ${num(w.reviews)} ${Z('则评论', 'reviews')}` : ''}<span class="xsmall" title="${esc(w.rating_source || '')}"> · ${esc(srcShort(w.rating_source))}</span></span>` : '';
    const status = w.status === 'closed' ? `<p class="warn">${icon('alert')}${Z('查到已停业或搬迁，去之前确认', 'Reported closed/moved; check first')}</p>` : w.status === 'unclear' || w.confidence === 'unverified' ? `<p class="xsmall">${icon('info')} ${Z('资料未能完全确认', 'Not fully verified')}</p>` : '';
    return `<article class="hang wishcard" id="wish-${esc(w.id)}">
      <div class="hang-h"><span class="kind-ic">${icon(WISH_ICON[w.kind] || 'pin')}</span><div><p class="hang-name"${altX(wName(w), w.name_zh, w.name_en, w.name_trad, w.list_name)}>${mustB(w)}${esc(wName(w))}</p><p class="hang-meta">${esc(lang === 'en' ? w.order_en || '' : w.order_zh || '')}${(lang === 'en' ? w.price_en : w.price_zh) ? ` · ${esc(lang === 'en' ? w.price_en : w.price_zh)}` : ''}</p>${rating}</div></div>
      <div class="pills fits">${(w.fits || []).map((f) => `<span class="fit" ${dayById[f.day] ? `style="${colorVars(dayById[f.day].c)}"` : ''}><b>${esc(fitLabel(f))}</b> ${esc(lang === 'en' ? f.en : f.zh)}</span>`).join('')}</div>
      ${status}
      ${br.address_trad ? `<p class="addr">${icon('pin')}<span>${esc(br.label_zh && others.length ? `${lang === 'en' ? br.label_en || br.label_zh : br.label_zh}：` : '')}${esc(br.address_trad)}${lang === 'en' && br.address_en ? `<br><span class="xsmall">${esc(br.address_en)}</span>` : ''}</span></p>` : ''}
      ${(lang === 'en' ? br.mrt_en : br.mrt_zh) ? `<p class="xsmall">${icon('train')} ${esc(lang === 'en' ? br.mrt_en : br.mrt_zh)}</p>` : mrtLine(br.mrt)}
      ${(lang === 'en' ? br.hours_en : br.hours_zh) ? `<p class="xsmall">${icon('clock')} ${esc(lang === 'en' ? br.hours_en : br.hours_zh)}${br.hours_check ? ` <b class="hchk">${Z('与 Google 不同，以 Google 为准', 'Google differs; trust Google')}</b>` : ''}</p>` : ''}
      ${rrLine(br.gpid, br.lat, br.lng)}
      ${closedNote(br)}
      ${gBox(br.gpid)}
      <div class="links-row">${gBtn(br.gpid)}${extI(gmSearch(q, br.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(q, 'transit', undefined, br.gpid), Z('路线', 'Directions'), 'route')}${w.site ? extI(w.site, Z('官网', 'Website'), 'ext') : ''}${addBtn(wName(w), br.lat, br.lng, br.gpid, q, br.address_trad)}</div>
      ${(lang === 'en' ? w.note_en : w.note_zh) ? `<details class="more wnote"><summary>${icon('info')}${Z('备注', 'Notes')}${icon('chev', 'chev')}</summary><div class="more-body"><p class="note">${esc(lang === 'en' ? w.note_en : w.note_zh)}</p></div></details>` : ''}
      ${others.length ? `<details class="more branches"><summary>${icon('list')}${Z('其他分店', 'Other branches')} (${others.length})${icon('chev', 'chev')}</summary><div class="more-body"><ul class="blist">${others.map((b) => `<li><p class="small"><strong>${esc(lang === 'en' ? b.label_en || b.label_zh || '' : b.label_zh || '')}</strong> ${esc(b.address_trad || '')}</p>${(lang === 'en' ? b.mrt_en : b.mrt_zh) ? `<p class="xsmall">${esc(lang === 'en' ? b.mrt_en : b.mrt_zh)}${(lang === 'en' ? b.hours_en : b.hours_zh) ? ` · ${esc(lang === 'en' ? b.hours_en : b.hours_zh)}` : ''}</p>` : ''}${closedNote(b)}<div class="links-row">${ext(gmSearch(wQuery(b, w)), Z('地图', 'Map'), 'pin')}${ext(gmDir(wQuery(b, w), 'transit'), Z('路线', 'Directions'), 'route')}</div></li>`).join('')}</ul></div></details>` : ''}
    </article>`;
  }
  function wishForDay(d) {
    const items = WISH.filter((w) => w.status !== 'closed' && (w.fits || []).some((f) => f.day === d.id || (f.day === 'any-evening' && ['d1', 'd4'].includes(d.id)))).sort((a, b) => (b.must ? 1 : 0) - (a.must ? 1 : 0));
    if (!items.length) return '';
    return `<div class="block">${blockH('star', ['顺路还可以去（想去清单）', 'Also nearby (wishlist)'])}<ul class="wish-rows">${items.map((w) => {
      const br = wBest(w); const q = wQuery(br, w); const f = (w.fits || []).find((x) => x.day === d.id) || (w.fits || [])[0];
      return `<li class="wish-row"><div><a class="wr-name" href="#wish-${esc(w.id)}"${altX(wName(w), w.name_zh, w.name_en, w.name_trad, w.list_name)}>${mustB(w)}${esc(wName(w))}</a>${(lang === 'en' ? w.order_en : w.order_zh) ? `<span class="wr-order"> · ${esc(lang === 'en' ? w.order_en : w.order_zh)}</span>` : ''}${f ? `<p class="xsmall">${esc(lang === 'en' ? f.en : f.zh)}</p>` : ''}${closedNote(br, d.date)}</div><div class="links-row">${ext(gmSearch(q), Z('地图', 'Map'), 'pin')}${ext(gmDir(q, 'transit'), Z('路线', 'Directions'), 'route')}</div></li>`;
    }).join('')}</ul></div>`;
  }
  /* lazy lists: a closed <details data-lazy> is filled the first time it opens (or when search / a jump needs what's inside) */
  const LAZY = new Map(); const LAZY_ID = new Map(); let lazyN = 0;
  const lazyKey = (fn, ids = []) => { const k = `lz${++lazyN}`; LAZY.set(k, fn); ids.forEach((id) => LAZY_ID.set(id, k)); return k; };
  function lazyFill(d) { const k = d && d.dataset.lazy; const fn = k && LAZY.get(k); if (!fn) return; const body = d.querySelector('[data-lazy-body]') || d; body.insertAdjacentHTML('beforeend', fn()); delete d.dataset.lazy; LAZY.delete(k); }
  const lazyAll = () => $$('details[data-lazy]').forEach(lazyFill);
  const lazyFor = (id) => { const k = LAZY_ID.get(id); if (k) lazyFill($(`details[data-lazy="${k}"]`)); return document.getElementById(id); };
  document.addEventListener('toggle', (e) => { const d = e.target; if (d instanceof HTMLDetailsElement && d.open && d.dataset.lazy) lazyFill(d); }, true);
  const wGroup = (h, c, items) => `<details class="more wgroup" data-lazy="${lazyKey(() => items.map(wishCard).join(''), items.map((w) => `wish-${w.id}`))}"${c ? ` style="${colorVars(c)}"` : ''}><summary><h3 class="wish-h">${c ? '<span class="sw" aria-hidden="true"></span>' : icon('star')}<span>${esc(h)}</span></h3><span class="wg-n">${items.length}</span>${icon('chev', 'chev')}</summary><div class="hung" data-lazy-body></div></details>`;
  // how to order at a Taiwan tea stand (the menu words that matter)
  const drinkHowTo = () => `<details class="more" style="margin-top:12px"><summary>${icon('boba')}${Z('怎么点饮料', 'How to order a drink')}${icon('chev', 'chev')}</summary><div class="more-body"><dl class="kv">
      <div><dt>${Z('甜度', 'Sugar')}</dt><dd class="wrap">${Z('正常 · 少糖 · 半糖 · 微糖 · 无糖（怕甜说「微糖」）', 'regular · less · half · light · none ("微糖" = light)')}</dd></div>
      <div><dt>${Z('冰块', 'Ice')}</dt><dd class="wrap">${Z('正常 · 少冰 · 微冰 · 去冰 · 常温 · 热', 'regular · less · light · no ice · room temp · hot')}</dd></div>
      <div><dt>${Z('加料', 'Toppings')}</dt><dd class="wrap">${Z('珍珠/波霸（大颗）· 椰果 · 仙草 · 布丁', 'pearls / boba (large) · coconut jelly · grass jelly · pudding')}</dd></div>
      <div><dt>${Z('价钱', 'Price')}</dt><dd class="wrap">${Z('大杯约NT$45–80；自备杯常折NT$5', 'large ~NT$45–80; own cup usually NT$5 off')}</dd></div>
    </dl></div></details>`;
  function secEat() {
    return `<section class="sec" id="eat" data-sec="eat">
      <h2 class="sec-title">${icon('food')}${Z('附近吃什么', 'Food nearby')}</h2>
      <p class="sec-lede">${Z('按一下，按手机位置列出附近今天有开的早餐、午餐、晚餐、宵夜、小吃。', 'One tap: nearest places open today (breakfast, lunch, dinner, late-night, snacks) by phone location.')}</p>
      <div class="links-row"><button type="button" class="go-btn" data-near>${icon('pin')}${Z('找我附近吃的', 'Find food near me')}</button><button type="button" class="go-btn ghost" data-near="drink">${icon('boba')}${Z('附近饮料', 'Drinks near me')}</button><button type="button" class="go-btn ghost" data-near="rest">${icon('coffee')}${Z('坐下歇脚', 'Sit & rest')}</button><button type="button" class="go-btn ghost" data-near="wc">${icon('wc')}${Z('附近厕所', 'Toilets near me')}</button></div>
      ${drinkHowTo()}
      ${foodBlock(['bk-hotel'], ['酒店附近早餐（每天都可以）', 'Breakfast near the hotel (any day)'])}
      ${foodBlock(['sup-hotel'], ['酒店附近宵夜', 'Late-night food near the hotel'])}
    </section>`;
  }
  function secWish() {
    if (!WISH.length) return '';
    const buckets = [...DAYS.slice(0, 6).map((d) => ({ k: d.id, h: `Day ${d.n} · ${dateLabel(d.date, d.dow)} · ${L(d.title)}`, c: d.c })), { k: 'any-evening', h: Z('酒店附近 · 任何晚上', 'Near the hotel · any evening') }, { k: 'special', h: Z('要专程去', 'Needs its own trip') }];
    const placed = new Set();
    const groups = buckets.map((b) => {
      const items = WISH.filter((w) => !placed.has(w.id) && (w.fits || [])[0] && (w.fits[0].day === b.k || (b.k === 'special' && !dayById[w.fits[0].day] && w.fits[0].day !== 'any-evening')));
      items.forEach((w) => placed.add(w.id));
      return items.length ? wGroup(b.h, b.c, items) : '';
    }).join('');
    const rest = WISH.filter((w) => !placed.has(w.id));
    return `<section class="sec" id="wish" data-sec="wish">
      <h2 class="sec-title">${icon('star')}${Z('想去清单', 'Wishlist')}</h2>
      <p class="sec-lede">${Z('想去、想吃的地方，按「哪天顺路」排列。全部可选：主行程优先，顺路有空才去。', "Wanted stops/eats, sorted by day on the way. All optional; main plan first.")}</p>
      <div class="wgroups">${groups}${rest.length ? wGroup(Z('其他', 'Other'), 0, rest) : ''}</div>
      <p class="xsmall" style="margin-top:12px">${Z(`地址、营业时间查于${checkedOn('ymd')}，可能变；出发前看Google地图。`, `Addresses/hours checked ${checkedOn('long')}; confirm on Google Maps first.`)}</p>
    </section>`;
  }

  function budgetChip(d) {
    const b = d.blocks.find((x) => x.type === 'budget');
    if (!b) return `<span class="chip">${icon('money')}${esc(L(d.budgetChip))}</span>`;
    const rm = (a, z) => `<span class="chip-rm nw" data-rm="${a},${z}">${rmText(a, z)}</span>`; // on a narrow phone the RM drops under the NT$ instead of overflowing
    return `<a class="chip chip-link chip-2l" href="#${d.id}-budget">${icon('money')}<span class="chip-lines"><span><span class="nw">${Z('每人', 'Each')} <b>${eachText(b.min, b.max)}</b>${b.est ? Z('（估）', ' (est.)') : ''}</span> ${rm(each(b.min), each(b.max))}</span><span class="chip-sub"><span class="nw">${Z(GROUP[0], 'Group')} ${CUR.sym}${num(b.min)}–${num(b.max)}</span> ${rm(b.min, b.max)}</span></span></a>`;
  }

  function secBudget() {
    const B = BUDGET;
    const maxv = 12000;
    const dayRows = DAYS.map((d) => { const b = d.blocks.find((x) => x.type === 'budget'); return b ? { d, b } : null; }).filter(Boolean);
    const bars = dayRows.map(({ d, b }) => {
      const l = (b.min / maxv) * 100, w = ((b.max - b.min) / maxv) * 100;
      return `<a class="bar-row2 barlink" href="#${d.id}-budget" style="${colorVars(d.c)}"><span class="bar-lab">${+d.date.slice(8)} ${esc(L(d.dow))}<small>Day ${d.n}${b.est ? Z(' · 估', ' · est.') : ''}</small></span><div class="bar-track"><div class="bar-grid"></div><div class="bar-range ${b.est ? 'est' : ''}" style="left:${l}%;width:${w}%"></div><span class="bar-val${l + w > 70 ? ' lft' : ''}" style="${l + w > 70 ? `right:calc(${100 - l}% + 6px)` : `left:calc(${l + w}% + 6px)`}">${num(b.min)}–${num(b.max)}<span class="bar-each">${Z('每人', '')}${num(each(b.min))}–${num(each(b.max))}${Z('', ' each')}</span></span></div></a>`;
    }).join('');
    return `<section class="sec" id="budget" data-sec="budget">
      <h2 class="sec-title">${icon('money')}${Z(`${GROUP[0]}预算`, `Budget ${GROUP[1]}`)}</h2>
      <p class="sec-lede">${Z('不包括', 'Not included')}: ${B.excludes.map(L).map(esc).join(Z('、', ', '))}</p>
      <div class="fx"><label for="rate">${Z('汇率', 'Rate')}: 1 ${esc(CUR.home)} =</label><input id="rate" type="number" inputmode="decimal" step="0.01" min="1" max="20" value="${rate}"><span>${esc(CUR.sym)}</span><span class="xsmall">${esc(L(CUR.rateNote))}</span></div>
      <div style="margin-top:14px">${totalBox(L(B.total).replace(/^约 |^About /, ''), [Z(`主行程 · ${GROUP[0]}`, `main costs · ${GROUP[1]}`), Z(`主行程 · ${GROUP[0]}`, `main costs · ${GROUP[1]}`)], B.totalMin, B.totalMax, eachLine(B.totalMin, B.totalMax))}</div>
      <p class="note">${fmt(B.suggest)}</p>
      <p class="callout">${icon('users')}<span>${fmt(B.split)}</span></p>
      <p class="callout">${icon('info')}<span>${fmt(B.poolText)} <span data-rm="${B.pool},${B.pool}">${rmText(B.pool, B.pool)}</span></span></p>
      <h3 class="sub">${icon('list')}${Z('主要共同支出', 'Main shared costs')}</h3>
      <dl class="kv">${B.rows.map((r) => `<div><dt>${fmt(r[0])}${r[4] === 'airport' && B.airportNote ? `<span class="check-sub"><a href="#airport">${esc(L(B.airportNote))}</a></span>` : ''}</dt><dd>${fmt(r[1])}<small class="dd-each">${Z('每人', 'each')} ${eachText(r[2], r[3])}</small></dd></div>`).join('')}<div class="sum"><dt>${Z('合计', 'Total')}</dt><dd>${fmt(B.total)}<small class="dd-each">${Z('每人', 'each')} ${eachText(B.totalMin, B.totalMax)}</small></dd></div></dl>
      <h3 class="sub">${icon('chart')}${Z(`每天花费（条＝${GROUP[0]}，小字＝每人，${CUR.sym}）`, `Per day (bar = all ${PAX}, small = each, ${CUR.sym})`)}</h3>
      <div class="bars">${bars}</div>
      <div class="bar-axis"><span></span><div class="bar-axis-t"><span>0</span><span>3,000</span><span>6,000</span><span>9,000</span><span>12,000</span></div></div>
      <p class="note">${esc(L(B.chartNote || ['虚线框 = 估算。', 'Dashed = estimate.']))}</p>
      <h3 class="sub">${icon('card')}${Z('现金、信用卡和悠游卡', 'Cash, cards and EasyCard')}</h3>
      <div class="tiers">
        <div class="tier"><p class="tier-h">${icon('money')}${Z('共同现金', 'Shared cash')}</p><p class="wear-main" style="margin-top:6px">${esc(MONEY.cash.amt)}</p><p class="xsmall" data-rm="${(numsIn(MONEY.cash.amt) || [0, 0]).join(',')}">${rmText(...(numsIn(MONEY.cash.amt) || [0, 0]))}</p><p class="xsmall">${Z('每人约', 'Each ≈')} <b>${eachText(15000, 20000)}</b></p>${list(MONEY.cash.uses)}</div>
        <div class="tier"><p class="tier-h">${icon('card')}${Z('信用卡', 'Credit card')}</p>${list(MONEY.card)}</div>
        <div class="tier"><p class="tier-h">${icon('train')}${Z('悠游卡', 'EasyCard')}</p><p style="margin-top:6px">${fmt(MONEY.easycard)}</p><div class="links-row"><a class="mlink" href="#easycard">${icon('arrow')}${Z('买卡与加值', 'Buying & topping up')}</a></div></div>
      </div>
    </section>`;
  }

  function secWeather() {
    const W = WEATHER;
    return `<section class="sec" id="weather" data-sec="weather">
      <h2 class="sec-title">${icon('cloud')}${Z('天气和穿着', 'Weather & what to wear')}</h2>
      <p class="sec-lede">${fmt(W.lede)}</p>
      <h3 class="sub">${icon('calendar')}${Z('什么时候看天气', 'When to check')}</h3>
      <dl class="kv">${W.when.map((w) => `<div><dt>${fmt(w.t)}</dt><dd class="wrap">${fmt(w.v)}</dd></div>`).join('')}</dl>
      <div class="links-row">${ext(SITES.cwa.url, L(SITES.cwa.name), 'ext')}${ext(SITES.cwaEn.url, L(SITES.cwaEn.name), 'ext')}</div>
      <h3 class="sub">${icon('list')}${Z('每天检查', 'Check each day')}</h3>
      <div class="pills">${W.items.map((x) => `<span class="tag">${fmt(x)}</span>`).join('')}</div>
      <h3 class="sub">${icon('shirt')}${Z('怎么穿', 'Outfits')}</h3>
      <div class="stack">${W.outfits.map((o) => `<a class="wear outfit" href="#${o.day}" style="${colorVars(dayById[o.day].c)}"><span class="sw" aria-hidden="true"></span><span><span class="xsmall">${fmt(o.h)}</span><span class="wear-main" style="display:block">${fmt(o.main)}</span><span class="note" style="display:block">${fmt(o.note)}</span></span></a>`).join('')}</div>
    </section>`;
  }

  function secChecklist() {
    const groups = [ENTRY_CHECKS, ...CHECKLIST];
    return `<section class="sec" id="checklist" data-sec="checklist">
      <h2 class="sec-title">${icon('check')}${Z('出发前清单', 'Before we go')}</h2>
      <p class="sec-lede">${Z('勾选只保存在这台手机上；每个人各自勾。', "Ticks stay on this phone only; per person.")}</p>
      <div class="progress"><span id="prog-text"></span><div class="progress-track"><div class="progress-fill" id="prog-fill"></div></div></div>
      ${groups.map((g) => `<h3 class="sub">${fmt(g.h)}</h3>${checkList(g.items.map((it) => ({ ...it, id: `${g.id}-${it.id}` })))}`).join('')}
      <div class="links-row" style="margin-top:14px"><button type="button" class="mlink" id="reset-ask">${icon('x')}${Z('清除全部勾选', 'Clear all ticks')}</button><span id="reset-confirm" hidden><button type="button" class="mlink danger" id="reset-yes">${Z('确定清除', 'Yes, clear')}</button><button type="button" class="mlink" id="reset-no">${Z('取消', 'Cancel')}</button></span></div>
    </section>`;
  }

  function secRules() {
    const P = PRIORITIES;
    return `<section class="sec" id="rules" data-sec="rules">
      <h2 class="sec-title">${icon('flag')}${Z('优先级', 'Priorities')}</h2>
      <div class="tiers" style="margin-top:14px">
        <div class="tier"><p class="tier-h">${Z('必做', 'Must do')}</p><ol>${P.must.map((x) => `<li>${fmt(x)}</li>`).join('')}</ol></div>
        <div class="tier"><p class="tier-h">${Z('应该去', 'Should do')}</p>${list(P.should, '')}</div>
        <div class="tier"><p class="tier-h">${Z('看心情', 'If we feel like it')}</p>${list(P.mood, '')}</div>
      </div>
      <div class="principle"><p class="wish" lang="zh-Hans">${esc(PRINCIPLE.wish)}</p>${PRINCIPLE.p.map((p) => `<p>${fmt(p)}</p>`).join('')}</div>
      ${CREDITS.length ? `<details class="more" style="margin-top:22px"><summary>${icon('image')}${Z('照片来源', 'Photo credits')} (${CREDITS.length})${icon('chev', 'chev')}</summary><div class="more-body"><ul class="credits">${CREDITS.map((c) => `<li>${esc(lang === 'en' ? c.subject_en : c.subject_zh)}: ${esc(c.author)}, <a href="${esc(c.source_url)}" target="_blank" rel="noopener">${esc(c.commons_title || 'Wikimedia Commons')}</a>, <a href="${esc(c.license_url || c.source_url)}" target="_blank" rel="noopener">${esc(c.license)}</a></li>`).join('')}</ul></div></details>` : ''}
    </section>`;
  }
