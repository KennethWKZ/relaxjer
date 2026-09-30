  /* ───────── render: small parts ───────── */
  const lanternMark = (c) => `<svg class="lantern-mark" viewBox="0 0 34 40" aria-hidden="true" style="${colorVars(c)}"><rect x="13" y="1" width="8" height="4" rx="1.5" fill="currentColor" opacity=".3"/><path class="paper" d="M4 6Q17 2 30 6L26.5 34Q17 37.5 7.5 34Z"/><path class="rib" d="M5.5 13Q17 9.5 28.5 13M6.7 26Q17 29.5 27.3 26M17 4.5V35.5"/><ellipse class="flame" cx="17" cy="33" rx="3" ry="1.6" opacity=".9"/></svg>`;
  const seal = () => `<span class="seal"><b aria-hidden="true">定</b>${Z('固定时间', 'Fixed time')}</span>`;
  const list = (items, cls = 'list') => `<ul class="${cls}">${items.map((x) => `<li>${fmt(x)}</li>`).join('')}</ul>`;
  const totalBox = (amt, per, min, max, extra = '') => `<div class="total"><span class="amt">${esc(amt)}</span><span class="per">${fmt(per)}</span>${min != null ? `<span class="rm" data-rm="${min},${max}">${rmText(min, max)}</span>` : ''}${extra}</div>`;
  function figure(id) {
    const c = credit[id]; if (!c) return '';
    return `<figure class="ph"><img src="${imgSrc(id)}" data-img="${imgKey(id)}" alt="${esc(lang === 'en' ? c.subject_en : c.subject_zh)}" width="960" height="640" loading="lazy" decoding="async"><figcaption>${esc(lang === 'en' ? c.subject_en : c.subject_zh)}<span class="cr">${esc(Z('照片', 'Photo'))}: ${esc(c.author)} · <a href="${esc(c.source_url)}" target="_blank" rel="noopener">${esc(c.license)}</a></span></figcaption></figure>`;
  }
  const thumb = (id) => (credit[id] ? `<img class="stop-thumb" src="${imgSrc(id, true)}" data-img="${imgKey(id, true)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : '');
  const blockH = (ic, h, extra = '') => `<h3 class="block-h">${ic ? icon(ic) : ''}${fmt(h)}${extra}</h3>`;

  function ticketBlock(id, open) {
    const t = (EXTRA.tickets || []).find((x) => x.id === id); if (!t) return '';
    const steps = lang === 'en' ? t.steps_en : t.steps_zh;
    const rows = [[Z('价格', 'Price'), lang === 'en' ? t.price_en : t.price_zh], [Z('时间', 'Hours'), lang === 'en' ? t.hours_en : t.hours_zh]].filter((r) => r[1]);
    return `<details class="more" ${open ? 'open' : ''}><summary>${icon('ticket')}${esc(lang === 'en' ? t.title_en : t.title_zh)}${icon('chev', 'chev')}</summary><div class="more-body stack">
      ${(lang === 'en' ? t.summary_en : t.summary_zh) ? `<p class="small muted">${esc(lang === 'en' ? t.summary_en : t.summary_zh)}</p>` : ''}
      ${steps && steps.length ? `<ol class="list">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${rows.length ? `<dl class="kv">${rows.map((r) => `<div><dt>${esc(r[0])}</dt><dd class="wrap">${esc(r[1])}</dd></div>`).join('')}</dl>` : ''}
      <div class="links-row">${t.url ? ext(t.url, Z('官方购票 / 资讯', 'Official booking / info'), 'ticket') : ''}${t.confidence && t.confidence !== 'verified' ? `<span class="xsmall">${Z('部分资讯待确认', 'Some details unconfirmed')}</span>` : ''}</div>
    </div></details>`;
  }

  /* meal stops in a day's route → that meal's researched options (open that day) + wishlist food that suits the meal and is close by or planned that day */
  const MEAL_NAMES = { breakfast: ['早餐', 'Breakfast'], lunch: ['午餐', 'Lunch'], dinner: ['晚餐', 'Dinner'], supper: ['宵夜', 'Late-night'], snack: ['小吃甜品', 'Snacks & sweets'], drink: ['饮料', 'Drinks'], rest: ['坐下歇脚', 'Sit & rest'], wc: ['厕所', 'Toilets'] };
  const DRINKS = window.DRINKS || []; // cat "drink" = grab-and-go stand; cat "rest" = sit down (teahouse, dessert, café)
  const isRest = (x) => x.cat === 'rest';
  const TOILETS = window.TOILETS || { wc: [], near: {}, gp: {}, borrow: {} }; // scripts/gtoilets.py
  const MRT = window.MRT || null; // scripts/mrt.py: stations + lines (Google positions and ride times, stop order from OpenStreetMap)
  const YB = window.YB || []; // scripts/gtransit.py: YouBike stations near our places (live counts fetched on tap)
  const BUS = window.BUS || []; // scripts/gtransit.py: bus stops near our places (Google)
  const rrOf = (gpid) => (gpid && TOILETS.gp[gpid]) || [null, null]; // [has restroom, wheelchair restroom]: 1 / 0 / null
  const wcName = (w) => (lang === 'en' ? w.n_en || w.n_trad : w.n_zh || w.n_trad);
  const nearestWc = (lat, lng) => { let best = null; for (const w of TOILETS.wc) { const k = km({ lat, lng }, w); if (!best || k < best.k) best = { w, k }; } return best; };
  // one line for a card: does the place have its own toilet; if not, the nearest public one
  function rrLine(gpid, lat, lng) {
    const [r, a] = rrOf(gpid); const nw = lat && lng ? nearestWc(+lat, +lng) : null; const nwT = nw && nw.k < 0.5 ? Z(`最近公厕 ${distLabel(nw.k)}`, `public toilet ${distLabel(nw.k)}`) : '';
    const t = r === 1 ? Z('店内有厕所', 'Has a toilet') + (a === 1 ? Z('（有无障碍）', ' (accessible)') : '') : r === 0 ? Z('店内没有厕所', 'No toilet here') + (nwT ? ' · ' + nwT : '') : nwT;
    return t ? `<p class="xsmall wc-line">${icon('wc')} ${esc(t)}</p>` : '';
  }
  const REST_KIND = { tea: ['茶馆', 'Teahouse'], dessert: ['甜品', 'Dessert'], cafe: ['咖啡', 'Café'], bar: ['酒吧', 'Bar'] };
  // which timeline stops are meals, and which researched food slots (extra.json) suit them: each day's `mealAt`
  // in the trip data, [[stop-name pattern, [[meal, [slot, …]], …]], …]
  const MEAL_AT = Object.fromEntries(DAYS.filter((d) => d.mealAt).map((d) => [d.id, d.mealAt]));
  const HOTEL_AREA = new Set(['bk-hotel', 'sup-hotel', 'd1-hotel']);
  const WISH_FOOD = new Set(['food', 'snack', 'dessert', 'drink', 'market']);
  const SLOT_MEALS = (slot) => (/^bk-/.test(slot) ? ['breakfast'] : /^sup-/.test(slot) ? ['supper'] : /dessert/.test(slot) ? ['snack'] : /lunch/.test(slot) ? ['lunch'] : /dinner|-hotel$/.test(slot) ? ['dinner'] : /meals/.test(slot) ? ['lunch', 'dinner'] : ['lunch', 'dinner']); // only when a food entry lists no meals of its own
  const mealsOf = (f) => (f.meals && f.meals.length ? f.meals : SLOT_MEALS(f.slot || ''));
  const km = (a, b) => { const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r), y = (b.lat - a.lat) * r; return 6371 * Math.hypot(x, y); };
  const placeLL = (pid) => { const g = GEO && GEO.places && GEO.places[pid]; return g && g.lat ? { lat: +g.lat, lng: +g.lng } : null; };
  const foodId = (f) => `food-${slug(f.slot + '-' + (f.name_en || f.name_trad))}`;
  const distLabel = (k) => (k < 0.1 ? Z('就在旁边', 'next door') : k < 1 ? `${Math.round(k * 1000 / 50) * 50} m` : `${k.toFixed(1)} km`);
  const star = (r) => (r ? ` <span class="eat-r">★${esc(r)}</span>` : '');
  const more = (n) => (n > 3 ? `<button type="button" class="eat-chip eat-more" data-more-chips aria-label="${Z(`再显示${n - 3}家`, `Show ${n - 3} more`)}">+${n - 3}</button>` : '');
  function mealGroup(d, it, meal, slots) {
    const spec = slots.map((x) => x.split(':'));
    const all = (EXTRA.food || []).filter((f) => spec.some(([sl, only]) => f.slot === sl && (!only || mealsOf(f).includes(only))));
    const opts = all.filter((f) => !f.paused && !(f.closed_dates || []).includes(d.date)).sort((a, b) => (+b.rating || 0) - (+a.rating || 0));
    const hidden = all.length - opts.length;
    const pts = opts.filter((f) => f.lat && f.lng);
    const c = pts.length ? { lat: pts.reduce((a, f) => a + +f.lat, 0) / pts.length, lng: pts.reduce((a, f) => a + +f.lng, 0) / pts.length }
      : (spec.some(([sl]) => HOTEL_AREA.has(sl)) ? placeLL('hotel') : it.place ? placeLL(it.place) : null);
    const where = spec.some(([sl]) => HOTEL_AREA.has(sl)) ? Z('（酒店附近）', ' (near the hotel)') : '';
    const html = opts.length || hidden ? `<p class="eat-h">${icon('food')}${esc(L(MEAL_NAMES[meal]))}${where}${opts.length > 1 ? Z(' · 按评分', ' · by rating') : ''}${hidden ? `<span class="eat-r"> · ${Z(`${hidden}家今天休息`, `${hidden} closed today`)}</span>` : ''}</p>
      ${opts.length ? `<div class="eat-row">${opts.map((f) => `<a class="eat-chip" href="#${foodId(f)}">${esc(lang === 'en' ? f.name_en || f.name_trad : f.name_zh || f.name_trad)}${star(f.rating)}</a>`).join('')}${more(opts.length)}</div>` : ''}` : '';
    return { html, c };
  }
  // wishlist food that suits any of this stop's meals: one list, distances from one point
  function stopWish(d, c, meals) {
    const wl = WISH.filter((w) => w.status !== 'closed' && WISH_FOOD.has(w.kind) && (w.meals || []).some((m) => meals.includes(m))).map((w) => {
      const br = wBest(w); const k = c && br && br.lat ? km(c, { lat: +br.lat, lng: +br.lng }) : null;
      return { w, br, k, onDay: (w.fits || []).some((f) => f.day === d.id) };
    }).filter((x) => x.br && !(x.br.closed_dates || []).includes(d.date) && ((x.k != null && x.k <= 1.2) || x.onDay)).sort((a, b) => (a.k == null ? 99 : a.k) - (b.k == null ? 99 : b.k)).slice(0, 8);
    return wl.length ? `<p class="eat-h">${icon('star')}${Z('想吃清单', 'Wishlist')}</p><div class="eat-row">${wl.map((x) => `<a class="eat-chip is-wish" href="#wish-${esc(x.w.id)}">${esc(wName(x.w))} <span class="eat-r">${x.k == null || x.k > 1.2 ? `${Z('今天顺路', 'on today’s route')}${x.k != null ? ' · ' + distLabel(x.k) : ''}` : distLabel(x.k)}</span></a>`).join('')}${more(wl.length)}</div>` : '';
  }
  const NEAR_KINDS = new Set(['shop', 'market', 'souvenir', 'sight', 'temple', 'nature', 'hotspring']);
  const mustB = (w) => (w.must ? `<b class="must-b">${Z('必去', 'Must')}</b>` : '');
  function nearWish(d, it) { // wishlist shops and sights an easy walk from this stop
    if (!it.place || it.place === 'hotel') return '';
    const at = placeLL(it.place); if (!at) return '';
    const rows = WISH.filter((w) => w.status !== 'closed' && NEAR_KINDS.has(w.kind)).map((w) => {
      let best = null;
      w.branches.forEach((br) => { if (br.lat == null || (br.closed_dates || []).includes(d.date)) return; const k = km(at, { lat: +br.lat, lng: +br.lng }); if (!best || k < best.k) best = { k }; });
      return best && best.k > 0.05 && best.k <= 0.7 ? { w, k: best.k } : null; // > 50 m: not the stop itself
    }).filter(Boolean).sort((a, b) => (b.w.must ? 1 : 0) - (a.w.must ? 1 : 0) || a.k - b.k).slice(0, 3);
    return rows.length ? `<div class="stop-near"><span class="sn-h">${icon('star')}${Z('附近想去', 'Nearby')}</span>${rows.map((x) => `<a class="eat-chip is-wish${x.w.must ? ' must' : ''}" href="#wish-${esc(x.w.id)}">${mustB(x.w)}${esc(wName(x.w))} <span class="eat-r">${distLabel(x.k)}</span></a>`).join('')}</div>` : '';
  }
  function nearDrinks(d, it) { // a drink within a few minutes' walk: best rated first
    if (!it.place || !DRINKS.length) return '';
    if (it.place === 'hotel') return ''; // the hotel has its own food section; a pickup stop is no time for a drink list
    const n = (rest) => spotsNear(it.place, rest, d.date).length;
    const dr = n(false), rs = n(true);
    const wcB = wcPill(it.place);
    if (!dr && !rs && !wcB) return '';
    const btn = (rest, c) => (c ? `<button type="button" class="near-pill${rest ? ' is-rest' : ''}" data-spots="${esc(it.place)}|${rest ? 'rest' : 'drink'}|${d.date}">${icon(rest ? 'coffee' : 'boba')}<span>${rest ? Z('歇脚', 'Rest') : Z('饮料', 'Drinks')}</span><b>${c}</b></button>` : '');
    return `<div class="stop-drink">${btn(false, dr)}${btn(true, rs)}${wcB}</div>`;
  }
  // 厕所 button: "场内" when the place has its own, else the nearest public toilet, else "可借" (a café or shop with one)
  /* my own stops: added from any card or a Google search; kept on this phone, shareable by link */
  let MINE = {};
  const mineAll = () => { const l = store.get('mine', []); return Array.isArray(l) ? l.filter((x) => x && x.id && x.day && x.lat != null) : []; };
  function mineSet(list) { store.set('mine', list); MINE = Object.fromEntries(list.map((x) => [x.id, x])); }
  MINE = Object.fromEntries(mineAll().map((x) => [x.id, x]));
  const placeTitle = (pk) => (PLACES[pk] ? L(PLACES[pk].name) : MINE[pk] ? MINE[pk].name : pk);
  const gpidOfPk = (pk) => ((GEO.places || {})[pk] || {}).gpid || (MINE[pk] || {}).gpid || null;
  const nearOf = (x, pk) => { if (x.near && x.near[pk] != null) return x.near[pk]; const m = MINE[pk]; if (!m) return null; const d = km(m, x) * 1000; return d <= 500 ? Math.round(d) : null; };
  const wcNear = (pk) => TOILETS.near[pk] || (MINE[pk] ? TOILETS.wc.map((w, i) => [i, Math.round(km(MINE[pk], w) * 1000)]).filter(([, m]) => m <= 500).sort((a, b) => a[1] - b[1]).slice(0, 4) : []);
  function wcPill(pk) {
    const [r] = rrOf(gpidOfPk(pk)); const nw = wcNear(pk)[0]; const bw = (TOILETS.borrow[pk] || [])[0];
    const badge = r === 1 ? Z('场内', 'on site') : nw && nw[1] <= 500 ? `${Math.round(nw[1] / 10) * 10}m` : bw ? Z('可借', 'borrow') : '';
    return badge ? `<button type="button" class="near-pill is-wc" data-wc="${esc(pk)}">${icon('wc')}<span>${Z('厕所', 'Toilet')}</span><b>${badge}</b></button>` : '';
  }
  function wcSheet(pk) {
    const g = (GEO.places || {})[pk] || {}; const [r, a] = rrOf(gpidOfPk(pk)); const nm = placeTitle(pk);
    const walk = (m) => Z(`走路约${Math.max(1, Math.round(m * 1.3 / 80))}分钟`, `~${Math.max(1, Math.round(m * 1.3 / 80))} min walk`);
    const row = (n, meta, m, q, gpid) => `<li class="spot"><div class="spot-main"><span class="spot-n">${esc(n)}</span><span class="spot-m">${meta ? `<span class="spot-k wc">${esc(meta)}</span>` : ''}${distLabel(m / 1000)} · ${walk(m)}</span></div><span class="spot-a">${extI(gmDir(q, 'walking', undefined, gpid), Z('走路去', 'Walk there'), 'route')}</span></li>`;
    const pub = wcNear(pk).map(([i, m]) => { const w = TOILETS.wc[i]; return row(wcName(w), Z('公厕', 'Public'), m, `${w.n_trad} ${w.lat},${w.lng}`, w.gpid); });
    const TYPE = { cafe: ['咖啡馆', 'Café'], coffee_shop: ['咖啡馆', 'Café'], restaurant: ['餐厅', 'Restaurant'], fast_food_restaurant: ['快餐', 'Fast food'], shopping_mall: ['商场', 'Mall'], department_store: ['百货', 'Dept. store'], convenience_store: ['便利店', 'Conv. store'], book_store: ['书店', 'Bookshop'], tea_house: ['茶馆', 'Teahouse'] };
    const bor = (TOILETS.borrow[pk] || []).map((b) => row(lang === 'en' ? b.n_trad : b.n_zh, L(TYPE[b.type] || (/restaurant$/.test(b.type || '') ? ['餐厅', 'Restaurant'] : ['店家', 'Shop'])), b.d, `${b.n_trad} ${b.lat},${b.lng}`, b.gpid));
    const mrt = g.mrt && g.mrt.walk ? Z(`捷运${g.mrt.zh}站也有厕所（约${g.mrt.min}分钟）`, `MRT ${g.mrt.en || g.mrt.zh} also has toilets (~${g.mrt.min} min)`) : '';
    return `<h3 class="spots-h">${icon('wc')}${esc(Z(`${nm} · 厕所`, `Toilets · ${nm}`))}</h3>
      ${r === 1 ? `<p class="callout ok">${icon('check')}<span>${esc(Z(`${nm}里面有厕所`, `${nm} has its own toilets`))}${a === 1 ? esc(Z('，有无障碍厕所', ', incl. accessible')) : ''}</span></p>` : ''}
      ${pub.length ? `<p class="sub-h">${Z('公厕（按距离）', 'Public toilets, nearest first')}</p><ul class="spots">${pub.join('')}</ul>` : ''}
      ${bor.length ? `<p class="sub-h">${Z('可借用的店家（Google 标示有厕所；先买点东西再开口较好）', 'Shops with a toilet you can ask to use (buy something first)')}</p><ul class="spots">${bor.join('')}</ul>` : ''}
      <p class="xsmall muted" style="margin-top:10px">${mrt ? esc(mrt) + Z('；', '. ') : ''}${Z('捷运站厕所若在闸门内：向询问处要免费「临时通行票」，15分钟内同站进出，不用刷卡。', 'MRT toilet inside the gates? Ask the info counter for a free temporary pass: 15 min, same station, no fare.')}</p>`;
  }
  // drink stands or sit-down spots within a short walk of a planned place, nearest first
  const spotsNear = (pk, rest, date) => DRINKS.filter((x) => isRest(x) === rest && nearOf(x, pk) != null && !(date && (x.closed_dates || []).includes(date))).sort((a, b) => nearOf(a, pk) - nearOf(b, pk));
  // that trip day's opening hours (x.week is Mon…Sun from Google), else the whole week
  const dayHours = (x, date) => {
    const all = lang === 'en' ? x.hours_en : x.hours_zh;
    if (!date || !x.week) return all;
    const h = x.week[(new Date(date + 'T12:00:00+08:00').getUTCDay() + 6) % 7];
    return h === 'closed' ? Z('当天休息', 'closed that day') : `${Z(`${+date.slice(5, 7)}/${+date.slice(8)}`, `${+date.slice(8)} Oct`)} ${h === '24h' ? Z('24小时', '24 h') : h.replace(/,/g, ', ')}`;
  };
  function spotsSheet(pk, rest, date) {
    const rows = spotsNear(pk, rest, date);
    const row = (x) => { const q = `${x.name_trad} ${x.address_trad || ''}`; const hrs = dayHours(x, date); const tip = lang === 'en' ? x.tip_en : x.tip_zh;
      return `<li class="spot"><button type="button" class="spot-main" data-spot="${esc(x.id)}"><span class="spot-n">${esc(drinkName(x))}</span><span class="spot-m">${x.kind ? `<span class="spot-k">${esc(L(REST_KIND[x.kind]))}</span>` : ''}${distLabel(nearOf(x, pk) / 1000)} · ${Z(`走路约${Math.max(1, Math.round(nearOf(x, pk) * 1.3 / 80))}分钟`, `~${Math.max(1, Math.round(nearOf(x, pk) * 1.3 / 80))} min walk`)}${x.rating ? ` · ★${esc(x.rating)}` : ''}</span>${tip && !x.kind ? `<span class="spot-t">${x.brand ? Z('招牌：', 'Try: ') : ''}${esc(tip)}</span>` : ''}${hrs ? `<span class="spot-t">${icon('clock')} ${esc(hrs)}</span>` : ''}</button><span class="spot-a">${extI(gmDir(q, 'walking', undefined, x.gpid), Z('走路去', 'Walk there'), 'route')}</span></li>`; };
    const h = rest ? Z(`${placeTitle(pk)}附近 · 坐下歇脚`, `Sit & rest near ${placeTitle(pk)}`) : Z(`${placeTitle(pk)}附近 · 饮料`, `Drinks near ${placeTitle(pk)}`);
    const sub = rest ? Z('茶馆、甜品、咖啡馆：有位子坐，吹冷气歇一下。按距离排。', 'Teahouses, desserts, cafés: seats and AC. Nearest first.') : Z('手摇饮和台湾经典饮料，边走边喝。按距离排。', 'Tea stands and Taiwan classics to sip on the go. Nearest first.');
    return `<h3 class="spots-h">${icon(rest ? 'coffee' : 'boba')}${esc(h)}</h3><p class="xsmall muted">${sub}${date ? Z(`只列${+date.slice(5, 7)}月${+date.slice(8)}日有开的。`, ` Open on ${+date.slice(8)} Oct only.`) : ''}</p><ul class="spots">${rows.map(row).join('')}</ul>${rest ? '' : drinkHowTo()}`;
  }
  function mealEats(d, it) {
    const hit = (MEAL_AT[d.id] || []).find(([re]) => re.test(Array.isArray(it.what) ? it.what[0] : String(it.what || '')));
    if (!hit) return '';
    const groups = hit[1].map(([meal, slots]) => mealGroup(d, it, meal, slots));
    const ref = (groups.find((g) => g.c) || {}).c;
    const html = groups.map((g) => g.html).filter(Boolean);
    const wish = stopWish(d, ref, hit[1].map(([meal]) => meal));
    if (!html.length && !wish) return '';
    return `<div class="stop-eat">${html.join('<hr class="eat-sep">')}${wish ? `${html.length ? '<hr class="eat-sep">' : ''}${wish}` : ''}</div>`;
  }

  const placeMemo = new Map(); // this page view only; ratings/photos are never stored
  const gBtn = (id) => (GM && id ? `<button type="button" class="mlink gbtn" data-gplace="${esc(id)}">${icon('star')}<span>${Z('评分', 'Rating')}</span><span class="dlbl">${Z('和照片', ' & photos')}</span></button>` : '');
  const gBox = (id) => (GM && id ? '<div class="gplace" hidden></div>' : '');
  async function loadPlace(id, box) {
    box.innerHTML = `<p class="xsmall">${Z('载入中…', 'Loading…')}</p>`;
    try {
      await loadGoogle(); const { Place } = await google.maps.importLibrary('places');
      let pl = placeMemo.get(id);
      if (!pl) { pl = new Place({ id }); await pl.fetchFields({ fields: ['rating', 'userRatingCount', 'photos', 'googleMapsURI', 'businessStatus', 'regularOpeningHours'] }); if (!pl.googleMapsURI) throw new Error('empty'); placeMemo.set(id, pl); }
      const photos = (pl.photos || []).slice(0, 2);
      const stars = `<p class="gstars">${pl.rating ? `<span class="rating">${icon('star', 'star')}<b>${esc(pl.rating.toFixed(1))}</b> · ${num(pl.userRatingCount || 0)} ${Z('则评论', 'reviews')}</span>` : Z('Google 上还没有评分', 'No Google rating yet')} <a class="gattr" href="${esc(pl.googleMapsURI || '#')}" target="_blank" rel="noopener">Google Maps</a></p>`;
      const shut = pl.businessStatus === 'CLOSED_PERMANENTLY' ? Z('Google 显示已永久歇业，别去了', 'Google: permanently closed; skip') : pl.businessStatus === 'CLOSED_TEMPORARILY' ? Z('Google 显示暂停营业，去之前先确认', 'Google: temporarily closed; check first') : '';
      // a quoted Google rating in the card is an older copy of the same number: the live one takes its place
      const card = box.closest('.hang'); const quoted = card && card.querySelector('.rating-q');
      if (quoted) quoted.outerHTML = stars;
      const wd = (pl.regularOpeningHours && pl.regularOpeningHours.weekdayDescriptions) || []; const todayI = (new Date(Date.now() + 8 * 3600e3).getUTCDay() + 6) % 7;
      const hrs = wd.length ? `<details class="ghours"><summary>${icon('clock')}${Z('Google 营业时间', 'Google opening hours')}${icon('chev', 'chev')}</summary><ul>${wd.map((x, i) => `<li${i === todayI ? ' class="today"' : ''}>${esc(x)}</li>`).join('')}</ul></details>` : '';
      box.innerHTML = `${shut ? `<p class="warn">${icon('alert')}${shut}</p>` : ''}${quoted ? '' : stars}${hrs}
        ${photos.length ? `<div class="gphotos">${photos.map((ph) => { const a = (ph.authorAttributions || [])[0]; return `<figure><a href="${esc(pl.googleMapsURI || '#')}" target="_blank" rel="noopener"><img src="${esc(ph.getURI({ maxHeight: 400 }))}" alt="" loading="lazy" width="240" height="180"></a><figcaption>${a ? `<a href="${esc(a.uri || '#')}" target="_blank" rel="noopener">${esc(a.displayName || '')}</a>` : ''}</figcaption></figure>`; }).join('')}</div>` : ''}`;
    } catch {
      box.innerHTML = `<p class="xsmall">${Z('暂时查不到 Google 资料（可能额度用完）。点「地图」看。', 'Google details unavailable (quota may be used up). Tap “Map”.')}</p>`;
    }
  }
  const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
  // nearest MRT from Google (walking time at Google's pace; seniors add a few minutes)
  const mrtText = (m) => (!m ? '' : m.walk ? Z(`${m.train ? '火车' : '捷运'}${m.zh}，步行约${m.min}分钟`, `${m.train ? 'Train' : 'MRT'} ${m.en || m.zh}, ~${m.min} min walk`) : Z(`最近捷运${m.zh}（约${m.km}公里，要转车）`, `Nearest MRT ${m.en || m.zh} (~${m.km} km; take a bus or taxi)`));
  const mrtLine = (m) => (m ? `<p class="xsmall">${icon('train')} ${esc(mrtText(m))}</p>` : '');
  function foodRow(f) {
    const name = lang === 'en' ? (f.name_en || f.name_trad) : (f.name_zh || f.name_trad);
    const dish = lang === 'en' ? f.dish_en : f.dish_zh;
    const shut = (f.closed_dates || []).filter((d) => TRIP_DATES.includes(d));
    const tag = f.paused ? Z('暂停营业', 'paused') : shut.length ? `${shut.map(md).join(' ')} ${Z('休', 'closed')}` : '';
    return `<li><a class="food-row" href="#${esc(foodId(f))}"><span class="fr-main"><span class="fr-name">${esc(name)}</span>${dish ? `<span class="fr-dish">${esc(dish)}</span>` : ''}</span>${tag ? `<span class="fr-x">${esc(tag)}</span>` : ''}${f.rating ? `<span class="fr-r">★${esc(f.rating)}</span>` : ''}${icon('chev', 'fr-chev')}</a></li>`;
  }
  // the card for a food or wishlist id, built from the data (the page shows compact rows, not every card)
  const drinkName = (x) => (lang === 'en' ? x.name_en || x.name_zh : x.name_zh);
  function drinkCard(x) {
    const q = `${x.name_trad} ${x.address_trad || ''}`;
    return `<article class="hang drink${isRest(x) ? ' is-rest' : ''}" id="${esc(x.id)}">
      <div class="hang-h"><span class="kind-ic">${icon(isRest(x) ? 'coffee' : 'boba')}</span><div><p class="hang-name">${esc(drinkName(x))}</p>${(lang === 'en' ? x.tip_en : x.tip_zh) ? `<p class="hang-meta">${x.brand ? Z('招牌：', 'Try: ') : ''}${esc(lang === 'en' ? x.tip_en : x.tip_zh)}</p>` : ''}${x.rating ? `<span class="rating">${icon('star', 'star')}<b>${esc(x.rating)}</b> · ${num(x.reviews || 0)} ${Z('则评论', 'reviews')}<span class="xsmall"> · Google · ${Z('查于', 'checked')} ${esc(dateLabel(x.checked))}</span></span>` : ''}</div></div>
      ${x.address_trad ? `<p class="addr">${icon('pin')}<span>${esc(x.address_trad)}</span></p>` : ''}
      ${(lang === 'en' ? x.hours_en : x.hours_zh) ? `<p class="xsmall">${icon('clock')} ${esc(lang === 'en' ? x.hours_en : x.hours_zh)}</p>` : ''}
      ${rrLine(x.gpid, x.lat, x.lng)}
      ${closedNote(x)}
      <div class="links-row">${extI(gmSearch(q, x.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(q, 'walking', undefined, x.gpid), Z('路线', 'Directions'), 'route')}${addBtn(drinkName(x), x.lat, x.lng, x.gpid, q, x.address_trad)}</div>
    </article>`;
  }
  function placeCardHTML(id) {
    if (id.startsWith('drink-')) { const x = DRINKS.find((y) => y.id === id); return x ? drinkCard(x) : ''; }
    if (id.startsWith('food-')) { const f = (EXTRA.food || []).find((x) => foodId(x) === id); return f ? foodCard(f) : ''; }
    if (id.startsWith('wish-')) { const w = WISH.find((x) => `wish-${x.id}` === id); return w ? wishCard(w) : ''; }
    return '';
  }
  function foodBlock(slots, h) {
    const items = (EXTRA.food || []).filter((f) => slots.includes(f.slot)); if (!items.length) return '';
    return `<div class="block">${blockH('food', h || ['去哪吃（参考）', 'Where to eat (suggestions)'])}<ul class="food-rows">${items.map(foodRow).join('')}</ul>
      <p class="note">${Z('以下为推荐，非原计划；评分会变，出发前查Google地图。', "Suggestions, not in original plan. Ratings change; check Google Maps first.")}</p></div>`;
  }
  function foodCard(f) {
    const name = lang === 'en' ? (f.name_en || f.name_trad) : (f.name_zh || f.name_trad);
    const rating = f.rating ? `<span class="rating${/google/i.test(f.rating_source || '') ? ' rating-q' : ''}">${icon('star', 'star')}<b>${esc(f.rating)}</b>${f.reviews ? ` · ${num(f.reviews)} ${Z('则评论', 'reviews')}` : ''}<span class="xsmall" title="${esc(f.rating_source || '')}"> · ${esc(srcShort(f.rating_source))}${f.rating_checked ? ` · ${Z('查于', 'checked')} ${esc(dateLabel(f.rating_checked))}` : ''}</span></span>` : '';
    const q = f.maps_query || f.address_trad || name;
    return `<article class="hang food" id="${esc(foodId(f))}">
      <div class="hang-h"><div><p class="hang-name"${altX(name, f.name_zh, f.name_en, f.name_trad)}>${esc(name)}</p><p class="hang-meta">${esc(lang === 'en' ? f.dish_en : f.dish_zh)}${(lang === 'en' ? f.price_hint_en : f.price_hint_zh) ? ` · ${esc(lang === 'en' ? f.price_hint_en : f.price_hint_zh)}` : ''}</p>${rating}</div></div>
      ${f.address_trad ? `<p class="addr">${icon('pin')}<span>${esc(f.address_trad)}${f.address_en && lang === 'en' ? `<br><span class="xsmall">${esc(f.address_en)}</span>` : ''}</span></p>` : ''}
      ${(lang === 'en' ? f.hours_en : f.hours_zh) ? `<p class="xsmall">${icon('clock')} ${esc(lang === 'en' ? f.hours_en : f.hours_zh)}${f.hours_check ? ` <b class="hchk">${Z('与 Google 不同，以 Google 为准', 'Google differs; trust Google')}</b>` : ''}</p>` : ''}
      ${mrtLine(f.mrt)}
      ${rrLine(f.gpid, f.lat, f.lng)}
      ${closedNote(f)}
      ${(lang === 'en' ? f.note_en : f.note_zh) ? `<p class="note">${esc(lang === 'en' ? f.note_en : f.note_zh)}</p>` : ''}
      ${gBox(f.gpid)}
      <div class="links-row">${gBtn(f.gpid)}${extI(gmSearch(q, f.gpid), Z('地图', 'Map'), 'pin')}${extI(gmDir(q, 'transit', undefined, f.gpid), Z('路线', 'Directions'), 'route')}${f.site ? extI(f.site, Z('官网', 'Website'), 'ext') : ''}${addBtn(name, f.lat, f.lng, f.gpid, q, f.address_trad)}</div>
    </article>`;
  }
  const srcShort = (s = '') => (/^google maps$/i.test(s) ? 'Google' : /google/i.test(s) ? Z('Google评分（转引）', 'Google rating, quoted') : /trip\.com/i.test(s) ? 'Trip.com' : /tripadvisor/i.test(s) ? 'Tripadvisor' : /klook/i.test(s) ? 'Klook' : Z('网络评分', 'web rating'));
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

  /* day route legs: each day's `route` in the trip data, [from place, to place, travel mode] */
  const LEGS = Object.fromEntries(DAYS.filter((d) => d.route && d.route.length).map((d) => [d.id, d.route]));
  // Today's route lives in the day's header card: one button per leg, in order, so each only needs its destination
  const RIDE = { SUBWAY: ['捷运', 'MRT'], BUS: ['公车', 'bus'], HEAVY_RAIL: ['火车', 'train'], COMMUTER_TRAIN: ['火车', 'train'], RAIL: ['火车', 'train'], LIGHT_RAIL: ['轻轨', 'light rail'] };
  const legSub = (t) => {
    if (!t) return '';
    const rides = (t.rides || []).map((r) => (r.kind === 'SUBWAY' || r.kind === 'LIGHT_RAIL' ? Z(r.line, r.line_en || r.line) : Z((RIDE[r.kind] || ['车', 'ride'])[0], (RIDE[r.kind] || ['车', 'ride'])[1])));
    return `<small class="l-leg-s">${Z(`约${t.min}分`, `~${t.min} min`)}${rides.length ? ` · ${esc(rides.join(' → '))}` : ''}</small>`;
  };
  function routeCard(day) {
    const legs = LEGS[day.id]; if (!legs) return '';
    const nm = (pid) => L(PLACES[pid].name);
    const LT = (GEO && GEO.legs) || {};
    const rows = legs.map(([a, b, m], li) => `<a class="l-leg" href="${esc(gmDir(PLACES[b].maps, m, PLACES[a].maps))}" target="_blank" rel="noopener" aria-label="${esc(`${nm(a)} → ${nm(b)} · ${Z(MODES[m][0], MODES[m][1])}`)}">${icon(MODES[m][2])}<span class="l-leg-t">${b === 'hotel' ? Z('回酒店', 'back to hotel') : `${Z('去', 'to')} ${esc(nm(b))}`}${legSub(LT[`${day.id}:${li}`])}</span><span class="l-leg-m dlbl">${esc(Z(MODES[m][0], MODES[m][1]))}</span></a>`).join('');
    const ids = [legs[0][0], ...legs.map((l) => l[1])];
    const chunks = []; // ≤3 waypoints per link on phones, so a long day is split; each part says where it starts and ends
    for (let i = 0; i < ids.length - 1; i += 4) chunks.push(ids.slice(i, Math.min(i + 5, ids.length)));
    const end = (pid) => (pid === 'hotel' ? Z('酒店', 'hotel') : nm(pid));
    const multi = chunks.map((c, i) => `<a class="l-leg all" href="${esc(gmMulti(c.map((p) => PLACES[p].maps), 'driving'))}" target="_blank" rel="noopener">${icon('map')}<span class="l-leg-t">${chunks.length > 1 ? `${Z('全程路线', 'Whole route')} ${i + 1}/${chunks.length}<span class="l-leg-sub"> · ${esc(end(c[0]))} → ${esc(end(c[c.length - 1]))}</span>` : Z('全程路线', 'Whole route')}</span><span class="l-leg-m">${Z('开车', 'drive')}</span></a>`).join('');
    return `<div class="l-route" id="${day.id}-route"><p class="l-route-h">${icon('route')}${Z('今天路线', "Today's route")}<span>${Z('点一下用 Google 地图导航', 'Tap to navigate in Google Maps')}</span></p><div class="l-legs">${rows}${multi}</div></div>`;
  }
