  /* ───────── offline MRT hint: walk → ride → change → walk on the station graph. No routing API, no key in the page:
     ride minutes are Google's (built on the Mac), walking and waiting are estimates. ───────── */
  const walkMin = (a, b) => (km(a, b) * 1000 * 1.3) / 75;
  const WAIT = { mrt: 4, branch: 8, lrt: 7, apt: 10, apx: 8 };
  const stName = (i) => (MRT ? (lang === 'en' ? MRT.st[i][2] || MRT.st[i][0] : MRT.st[i][0]) : '');
  let mrtG = null;
  function mrtGraph() {
    if (mrtG || !MRT) return mrtG;
    const st = MRT.st.map(([zh, trad, en, lat, lng]) => ({ zh, trad, en, lat, lng }));
    const nodes = []; const byStation = st.map(() => []); const lineNodes = MRT.ln.map(() => []);
    MRT.ln.forEach((l, li) => l.s.forEach((si, pos) => { const id = nodes.length; nodes.push({ li, pos, si }); byStation[si].push(id); lineNodes[li][pos] = id; }));
    return (mrtG = { st, nodes, byStation, lineNodes });
  }
  function mrtPlan(from, to) {
    const G = mrtGraph(); const direct = walkMin(from, to); if (!G) return { walk: direct, none: true };
    // stations within a 20-min walk; if none, the nearest two anyway (the last bit is then a bus / taxi)
    const near = (pt) => { const all = G.st.map((x, i) => ({ i, m: walkMin(pt, x) })).sort((a, b) => a.m - b.m); const w = all.filter((x) => x.m <= 20).slice(0, 4); return w.length ? w : all.filter((x) => x.m <= 60).slice(0, 2); };
    const WW = 1.4; // walking counts extra (two seniors): a short ride beats a long walk
    const o = near(from), d = near(to);
    if (!o.length || !d.length) return { walk: direct, none: true };
    const N = G.nodes.length; const dist = new Float64Array(N).fill(Infinity); const prev = new Int32Array(N).fill(-1); const done = new Uint8Array(N); const w0 = new Map();
    o.forEach(({ i, m }) => G.byStation[i].forEach((id) => { const c = m * WW + WAIT[MRT.ln[G.nodes[id].li].k]; if (c < dist[id]) { dist[id] = c; prev[id] = -2; w0.set(id, m); } }));
    const w1 = new Map(d.map(({ i, m }) => [i, m]));
    let best = Infinity, end = -1;
    for (;;) { // ~500 nodes: a plain O(n²) Dijkstra is instant
      let u = -1, du = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; }
      if (u < 0 || du >= best) break; done[u] = 1;
      const n = G.nodes[u]; const l = MRT.ln[n.li];
      const ew = w1.get(n.si); if (ew != null && du + ew * WW < best) { best = du + ew * WW; end = u; }
      const nx = G.lineNodes[n.li][n.pos + 1];
      if (nx != null) { const c = du + (l.t[n.pos] || 2) + (l.g ? 0 : 0.4); if (c < dist[nx]) { dist[nx] = c; prev[nx] = u; } } // Google's times already include the stops
      G.byStation[n.si].forEach((v) => { if (G.nodes[v].li === n.li) return; const l2 = MRT.ln[G.nodes[v].li]; const c = du + ((l.ref === 'A') !== (l2.ref === 'A') ? 10 : 6) + WAIT[l2.k]; if (c < dist[v]) { dist[v] = c; prev[v] = u; } }); // a change: platforms, stairs
    }
    if (end < 0) return { walk: direct, none: true };
    const path = []; for (let u = end; u >= 0; u = prev[u]) path.unshift(u);
    const rides = []; let cur = null;
    path.forEach((id) => { const n = G.nodes[id]; if (!cur || cur.li !== n.li) { if (cur && cur.n) rides.push(cur); cur = { li: n.li, from: n.si, to: n.si, n: 0 }; } else { cur.to = n.si; cur.n++; } });
    if (cur && cur.n) rides.push(cur);
    if (!rides.length) return { walk: direct, none: true };
    const a = w0.get(path[0]) || 0, z = w1.get(G.nodes[end].si) || 0;
    return { walk: direct, total: best - (WW - 1) * (a + z), w0: a, w1: z, rides };
  }
  const CARS = Math.ceil(PAX / 4); // taxis the group needs, 4 seats each
  // Taipei taxi meter (公共運輸處, since 2023-04): NT$85 first 1.25 km, NT$5 per 200 m, +NT$20 23:00–06:00; +20% for slow traffic
  function taxiFare(dk) { const road = dk * 1.3; const base = 85 + Math.max(0, Math.ceil((road - 1.25) / 0.2)) * 5 + (tpNow().mins >= 1380 || tpNow().mins < 360 ? 20 : 0); const r10 = (v) => Math.round(v / 10) * 10; return [r10(base), r10(base * 1.2)]; }
  const mline = (l) => `<span class="mline" style="--lc:${esc(l.c)}"><b>${esc(l.ref)}</b>${esc(lang === 'en' ? l.en : l.zh)}</span>`;
  // "from where you are": walking when that is as quick, else the MRT legs; compact = one line for the map popup
  function planHTML(to, compact) {
    if (!meLL || farAway()) return '';
    const pl = mrtPlan(meLL, to); const wk = Math.max(1, Math.round(pl.walk));
    const dk = km(meLL, to); const taxi = Math.round((dk * 1.3) / 22 * 60 + 4); // city taxi ~22 km/h door to door
    const [f0, f1] = taxiFare(dk);
    const taxiP = (lead) => `<p class="plan${lead ? ' lead' : ''}">${icon('car')}<span>${Z(`计程车约${taxi}分钟 · 约${CUR.sym}${num(f0)}–${num(f1)}/辆（${PAX}人要${CARS}辆）`, `Taxi ~${taxi} min · ~${CUR.sym}${num(f0)}–${num(f1)} per car (${PAX} people = ${CARS} car${CARS > 1 ? 's' : ''})`)}</span></p>`;
    if (pl.none && wk > 25) return `<div class="plan-box">${taxiP(true)}<p class="xsmall muted">${Z(`离你约${dk.toFixed(1)} km，附近没有捷运；公车看 Google 地图`, `${dk.toFixed(1)} km away, no MRT near; buses: Google Maps`)}</p></div>`;
    const longLeg = !pl.none && (pl.w0 > 20 || pl.w1 > 20);
    const walkOnly = pl.none || wk <= Math.min(15, pl.total + 3);
    if (walkOnly) return `<p class="plan">${icon('walk')}<span>${Z(`从你这里走路约${wk}分钟`, `~${wk} min walk from you`)} · ${distLabel(km(meLL, to))}${pl.none && wk > 25 ? Z('。附近没有捷运：看 Google 地图（公车/计程车）', '. No MRT nearby: check Google Maps (bus/taxi)') : ''}</span></p>`;
    const tot = Math.round(pl.total);
    if (compact) return `<p class="plan">${icon('train')}<span>${Z(`捷运约${tot}分钟`, `MRT ~${tot} min`)}: ${pl.rides.map((r) => mline(MRT.ln[r.li])).join(' → ')}${Z('（估）', ' (est.)')}</span></p>`;
    const leg = (m, zh, en) => (m > 20 ? `<li>${icon('bus')}${Z(`${zh}约${(m * 75 / 1300).toFixed(1)} km：搭公车或计程车（走路要${Math.round(m)}分钟）`, `${en} ~${(m * 75 / 1300).toFixed(1)} km: bus or taxi (a ${Math.round(m)}-min walk)`)}</li>` : null);
    const steps = [leg(pl.w0, `到 <b>${esc(stName(pl.rides[0].from))}</b>站`, `To <b>${esc(stName(pl.rides[0].from))}</b>`) || `<li>${icon('walk')}${Z(`走路约${Math.max(1, Math.round(pl.w0))}分钟到 <b>${esc(stName(pl.rides[0].from))}</b>站`, `Walk ~${Math.max(1, Math.round(pl.w0))} min to <b>${esc(stName(pl.rides[0].from))}</b>`)}</li>`]
      .concat(pl.rides.map((r, k) => { const l = MRT.ln[r.li]; const term = stName(l.s[l.s.length - 1]); return `<li>${k ? Z('换乘 ', 'Change to ') : ''}${mline(l)} ${Z(`往${esc(term)} · ${r.n}站 → <b>${esc(stName(r.to))}</b>`, `towards ${esc(term)} · ${r.n} stop${r.n > 1 ? 's' : ''} → <b>${esc(stName(r.to))}</b>`)}</li>`; }))
      .concat(leg(pl.w1, '出站后', 'After the station,') || `<li>${icon('walk')}${Z(`出站走路约${Math.max(1, Math.round(pl.w1))}分钟`, `Walk ~${Math.max(1, Math.round(pl.w1))} min`)}</li>`);
    const mrtBody = `<ol class="plan-steps">${steps.join('')}</ol>`;
    const est = `<span class="xsmall muted">${Z('（估：Google 乘车时间＋步行/等车估算）', ' (est.: Google ride times + walk/wait estimate)')}</span>`;
    if (longLeg || taxi * 2 < tot) return `<div class="plan-box"><p class="plan-h">${icon('car')}${Z('从你这里：建议计程车', 'From you: taxi is easiest')}</p>${taxiP(true)}<details class="plan-alt"><summary>${icon('train')}${Z(`或搭捷运：约${tot}分钟`, `Or by MRT: ~${tot} min`)}${est}</summary>${mrtBody}</details></div>`;
    return `<div class="plan-box"><p class="plan-h">${icon('train')}${Z(`从你这里搭捷运：约${tot}分钟`, `From you by MRT: ~${tot} min`)}${est}</p>${mrtBody}${taxiP(false)}${wk <= 40 ? `<p class="xsmall muted">${Z(`直接走路约${wk}分钟`, `Walking all the way: ~${wk} min`)}</p>` : ''}</div>`;
  }
  const planAsk = (p) => `<button type="button" class="mlink" data-mefrom="${p.lat},${p.lng}">${icon('pin')}${Z('从我这里怎么去（估）', 'How to get there from me (est.)')}</button>`;
  const farNote = () => `<p class="xsmall muted">${icon('info')} ${Z('你现在不在台北：到了台北，这里会显示从你所在位置怎么去。', "You're not in Taipei yet: once there, this shows how to get here from where you are.")}</p>`;
  const planOrAsk = (p) => (!meLL ? planAsk(p) : farAway() ? farNote() : planHTML(p));
