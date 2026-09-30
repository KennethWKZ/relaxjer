  /* ───────── render: blocks ───────── */
  function renderBlock(b, day) {
    const places = b.places ? `<div class="links-row">${b.places.map((p) => `<span class="plabel">${esc(L(PLACES[p].name))}</span>${placeLinks(p, { noDriver: true })}`).join('')}</div>` : '';
    const sites = b.sites ? `<div class="links-row">${b.sites.map((s) => ext(SITES[s].url, L(SITES[s].name), 'ext')).join('')}</div>` : '';
    switch (b.type) {
      case 'text':
        return `<div class="block">${blockH(b.icon, b.h)}<div class="stack">${b.p.map((p) => `<p>${fmt(p)}</p>`).join('')}</div>${b.total ? `<div style="margin-top:10px">${totalBox(b.total.amt, b.total.per, b.total.min, b.total.max, eachLine(b.total.min, b.total.max))}</div>` : ''}${b.link ? `<div class="links-row"><a class="mlink" href="${b.link[0]}">${icon('arrow')}${fmt(b.link[1])}</a></div>` : ''}${places}${sites}</div>`;
      case 'list':
        return `<div class="block">${blockH(b.icon, b.h)}${list(b.list)}${b.note ? `<p class="note">${fmt(b.note)}</p>` : ''}${places}</div>`;
      case 'costs':
        return `<div class="block">${blockH(b.icon, b.h)}<dl class="kv">${b.rows.map((r) => `<div><dt>${fmt(r[0])}</dt><dd>${fmt(r[1])}</dd></div>`).join('')}</dl></div>`;
      case 'kv':
        return `<div class="block">${blockH(b.icon, b.h)}<dl class="kv">${b.rows.map((r) => `<div><dt>${fmt(r[0])}</dt><dd class="wrap">${fmt(r[1])}</dd></div>`).join('')}</dl>${b.note ? `<p class="note">${fmt(b.note)}</p>` : ''}${places}${sites}</div>`;
      case 'table':
        return `<div class="block">${blockH(b.icon, b.h)}<div class="tbl-wrap"><table class="tbl"><thead><tr>${b.cols.map((c) => `<th scope="col">${fmt(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${fmt(c)}</th>` : `<td>${fmt(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div></div>`;
      case 'route':
        return `<div class="block">${blockH(b.icon, b.h)}<div class="route">${b.stops.map((s, i) => `${i ? icon('arrow', 'arr') : ''}${s.line && !b.plain ? `<span class="line-tag ${s.line}" style="background:var(--mrt-${s.line})">${s.code ? esc(s.code) : esc(L(s.name))}</span>` : ''}${!s.isLine ? `<span>${esc(L(s.name))}</span>` : ''}`).join('')}</div>
          ${b.note ? `<p class="note">${fmt(b.note)}</p>` : ''}${b.total ? `<div style="margin-top:10px">${totalBox(b.total.amt, b.total.per, b.total.min, b.total.max, eachLine(b.total.min, b.total.max))}</div>` : ''}${b.note2 ? `<p class="note">${fmt(b.note2)}</p>` : ''}${places}${sites}</div>`;
      case 'decide':
        return `<div class="block">${blockH(b.icon, b.h)}<div class="decide">${b.opts.map((o) => `<div class="opt ${o.k}"><span class="opt-mark" aria-hidden="true">${esc(o.mark)}</span><p class="opt-name">${fmt(o.name)}<span class="opt-cost">${fmt(o.cost)}</span></p><p class="opt-body">${fmt(o.when)}</p>${o.list ? list(o.list) : ''}${o.place ? `<div class="links-row opt-body">${placeLinks(o.place, { noDriver: true })}</div>` : ''}</div>`).join('')}</div></div>`;
      case 'weather':
        return `<div class="block" id="${day.id}-ride">${blockH(b.icon, b.h)}${b.flow ? rideFlow() : ''}<div class="decide">${b.opts.map(optRow).join('')}</div></div>`;
      case 'wear':
        return `<div class="block">${blockH('shirt', b.h)}<div class="wear"><p class="wear-main">${fmt(b.main)}</p>${b.bring ? `<div class="pills">${b.bring.map((x) => `<span class="tag">${fmt(x)}</span>`).join('')}</div>` : ''}${b.note ? `<p class="note">${fmt(b.note)}</p>` : ''}</div></div>`;
      case 'budget': {
        const rows = b.rows.map((r) => {
          let v = L(r[1]);
          if (r[2] === 'airportMrt' && AIRPORT.mrtFare) v = AIRPORT.mrtFare; // the trip's airport-rail fare for the group
          return `<div><dt>${fmt(r[0])}</dt><dd>${esc(v).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}${ddEach(v)}</dd></div>`;
        }).join('');
        return `<div class="block" id="${day.id}-budget">${blockH('money', b.h)}<dl class="kv kv-each">${rows}</dl><div style="margin-top:10px">${totalBox(L(b.total).replace(/^约 |^About /, '').replace(` / ${GROUP[0]}`, '').replace(` ${GROUP[1]}`, ''), [Z(b.est ? `${GROUP[0]} · 估算` : GROUP[0], b.est ? `${GROUP[1]} · estimate` : GROUP[1]), Z(b.est ? `${GROUP[0]} · 估算` : GROUP[0], b.est ? `${GROUP[1]} · estimate` : GROUP[1])], b.min, b.max, eachLine(b.min, b.max))}</div>${b.note ? `<p class="note">${fmt(b.note)}</p>` : ''}</div>`;
      }
      case 'rain':
        return `<div class="tail block">${blockH('umbrella', b.h)}${b.list ? list(b.list) : ''}${b.groups ? b.groups.map((g) => `<p class="tail-sub">${fmt(g.h)}</p>${list(g.list)}`).join('') : ''}</div>`;
      case 'checklist':
        return `<div class="block">${blockH(b.icon, b.h)}${checkList(b.items.map((t, i) => ({ id: `${b.id}-${i}`, t })))}</div>`;
      case 'groups':
        return `<div class="block">${blockH(b.icon, b.h)}<div class="tiers two">${b.groups.map((g) => `<div class="tier"><p class="tier-h">${fmt(g.h)}</p>${list(g.list)}</div>`).join('')}</div>${b.note ? `<p class="note">${fmt(b.note)}</p>` : ''}</div>`;
      default: return '';
    }
  }
  function optRow(o) {
    const mk = { go: 'check', wait: 'clock', stop: 'x' }[o.k];
    return `<div class="opt ${o.k}"><span class="opt-mark">${icon(mk)}</span><p class="opt-name">${fmt(o.name)}</p>${o.list ? list(o.list) : ''}${o.body ? `<p class="opt-body"><strong>${fmt(o.body)}</strong></p>` : ''}</div>`;
  }
  function checkList(items) {
    return `<ul class="checks">${items.map((it) => {
      const id = it.id; const on = !!checks[id];
      const due = it.due ? `<span class="check-sub">${Z('截止', 'By')} ${esc(dateLabel(it.due))}</span>` : '';
      const sub = it.sub ? `<span class="check-sub">${fmt(it.sub)}</span>` : '';
      const link = it.site && SITES[it.site] ? ` <a class="check-link" href="${esc(SITES[it.site].url)}" target="_blank" rel="noopener">${icon('ext')}${esc(L(SITES[it.site].name))}</a>` : it.link ? ` <a class="check-link" href="${esc(it.link)}">${icon('arrow')}${Z('看比较', 'Compare')}</a>` : ''; // in-page: the options to compare
      return `<li><label class="check" for="ck-${esc(id)}"><input type="checkbox" id="ck-${esc(id)}" data-check="${esc(id)}" ${on ? 'checked' : ''}><span class="box" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5"/></svg></span><span class="check-text">${fmt(it.t)}${sub}${due}</span></label>${link}</li>`;
    }).join('')}</ul>`;
  }

  /* YouBike weather decision, drawn as a flowchart (diagram-design rules: orthogonal, labelled exits) */
  function rideFlow() {
    const T = (zh, en) => esc(Z(zh, en));
    return `<figure class="diagram" style="margin:0 0 12px"><svg viewBox="0 0 344 368" role="img" aria-labelledby="ride-title ride-desc">
      <title id="ride-title">${T('要不要骑YouBike', 'Should we ride?')}</title>
      <desc id="ride-desc">${T('先看有无危险天气：有就取消改走Plan B；否则若只是上午阵雨，午餐后再决定，不然照常骑车。', 'Unsafe weather: cancel, Plan B. Else only morning showers: decide after lunch; otherwise ride.')}</desc>
      <path class="dg-line" d="M120 44V68"/><path class="dg-line" d="M200 112H232"/><path class="dg-line" d="M120 152V192"/><path class="dg-line" d="M200 236H232"/><path class="dg-line" d="M120 276V308"/>
      <path d="M116 64l4 6 4-6M228 108l6 4-6 4M116 188l4 6 4-6M228 232l6 4-6 4M116 304l4 6 4-6" fill="none" stroke="var(--ink-3)" stroke-width="1.5"/>
      <rect x="14" y="8" width="212" height="36" rx="18" class="dg-box"/><text x="120" y="31" text-anchor="middle" class="dg-text" font-size="14" font-weight="600">${T('早上看天气', 'Morning weather check')}</text>
      <path d="M120 72L200 112L120 152L40 112Z" class="dg-dia"/><text x="120" y="117" text-anchor="middle" class="dg-text" font-size="14" font-weight="700">${T('危险天气？', 'Unsafe?')}</text>
      <text x="216" y="104" text-anchor="middle" class="dg-muted" font-size="12" font-weight="700">${T('是', 'Yes')}</text><text x="132" y="176" class="dg-muted" font-size="12" font-weight="700">${T('否', 'No')}</text>
      <rect x="236" y="84" width="104" height="56" rx="8" class="dg-stop"/><text x="288" y="108" text-anchor="middle" class="dg-text" font-size="14" font-weight="700">${T('取消骑车', 'Cancel ride')}</text><text x="288" y="126" text-anchor="middle" class="dg-muted" font-size="12">${T('改走 Plan B', 'Take Plan B')}</text>
      <path d="M120 196L200 236L120 276L40 236Z" class="dg-dia"/><text x="120" y="233" text-anchor="middle" class="dg-text" font-size="13" font-weight="700">${T('只是上午', 'Only morning')}</text><text x="120" y="250" text-anchor="middle" class="dg-text" font-size="13" font-weight="700">${T('阵雨？', 'showers?')}</text>
      <text x="216" y="228" text-anchor="middle" class="dg-muted" font-size="12" font-weight="700">${T('是', 'Yes')}</text><text x="132" y="296" class="dg-muted" font-size="12" font-weight="700">${T('否', 'No')}</text>
      <rect x="236" y="208" width="104" height="56" rx="8" class="dg-wait"/><text x="288" y="232" text-anchor="middle" class="dg-text" font-size="14" font-weight="700">${T('午餐后', 'Decide after')}</text><text x="288" y="250" text-anchor="middle" class="dg-text" font-size="14" font-weight="700">${T('再决定', 'lunch')}</text>
      <rect x="40" y="312" width="160" height="48" rx="8" class="dg-focal"/><text x="120" y="334" text-anchor="middle" class="dg-text" font-size="14" font-weight="700">${T('照常骑车', 'Ride as planned')}</text><text x="120" y="351" text-anchor="middle" class="dg-muted" font-size="12">${T('先确认5辆好车', 'Check 5 good bikes')}</text>
    </svg></figure>`;
  }

  /* Airport route strip (vertical transit diagram) */
  function airportStrip() {
    const rows = AIRPORT.route; let y = 16; const parts = []; const lines = [];
    const col = (l) => ({ airport: 'var(--mrt-airport)', red: 'var(--mrt-red)', orange: 'var(--mrt-orange)', hotel: 'var(--ink)' }[l] || 'var(--ink-3)');
    const X = 28;
    rows.forEach((r) => {
      if (r.seg) {
        const altLines = r.alt ? L(r.alt).split('|') : [];
        const h = 44 + altLines.length * 18;
        lines.push(`<path d="M${X} ${y}V${y + h}" stroke="${r.walk ? 'var(--ink-3)' : col(r.line)}" stroke-width="${r.walk ? 2 : 6}" ${r.walk ? 'stroke-dasharray="3 5" stroke-linecap="round"' : ''} fill="none"/>`);
        parts.push(`<text x="${X + 22}" y="${y + 26}" class="dg-muted" font-size="13" font-weight="600">${esc(L(r.seg))}</text>`);
        altLines.forEach((t, i) => parts.push(`<text x="${X + 22}" y="${y + 46 + i * 17}" class="dg-soft" font-size="12">${esc(t)}</text>`));
        y += h;
      } else {
        const isHotel = r.line === 'hotel';
        parts.push(isHotel ? `<rect x="${X - 10}" y="${y - 10}" width="20" height="20" rx="5" fill="var(--ink)"/><path d="M${X - 5} ${y + 1}l5-5 5 5v5h-10z" fill="var(--paper)"/>`
          : `<circle cx="${X}" cy="${y}" r="9" fill="var(--paper)" stroke="${col(r.line)}" stroke-width="4"/>`);
        parts.push(`<text x="${X + 22}" y="${y + 5}" class="dg-text" font-size="15" font-weight="700">${esc(L(r.name))}${r.code ? `<tspan class="dg-soft" font-size="12" font-weight="600" dx="8">${esc(r.code)}</tspan>` : ''}</text>`);
      }
    });
    const H = y + 18;
    return `<figure class="diagram strip"><svg viewBox="0 0 360 ${H}" role="img" aria-labelledby="ap-title ap-desc"><title id="ap-title">${esc(Z('桃园机场到酒店：捷运路线', 'Airport to hotel by rail'))}</title><desc id="ap-desc">${esc(rows.map((r) => L(r.name || r.seg)).join(' → ').replace(/\|/g, ' '))}</desc>${lines.join('')}${parts.join('')}</svg></figure>`;
  }
