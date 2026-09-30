  /* ───────── copy / share ───────── */
  const toastEl = () => $('#toast');
  let toastT;
  function toast(msg) { const t = toastEl(); t.textContent = msg; t.dataset.state = 'open'; clearTimeout(toastT); toastT = setTimeout(() => { t.dataset.state = 'closed'; }, 1800); }
  function copy(text, okMsg) {
    const fallback = () => { const d = $('#copydlg'); $('#copytext').value = text; openDialog(d); setTimeout(() => $('#copytext').select(), 60); };
    try { navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback); } catch { fallback(); }
  }
  const linkFor = (id) => (SHARE_URL ? SHARE_URL.split('#')[0] : location.href.split('#')[0]) + '#' + id;
  function dayText(d) {
    const out = [`【Day ${d.n} · ${dateLabel(d.date, d.dow)}】${L(d.title)}`];
    d.schedule.forEach((it) => { out.push(`${it.step ? it.step + '.' : L(it.t || '')} ${L(it.what)}${it.note ? `（${L(it.note).replace(/\*\*/g, '')}）` : ''}`.replace('（', lang === 'en' ? ' (' : '（').replace('）', lang === 'en' ? ')' : '）')); });
    const b = d.blocks.find((x) => x.type === 'budget'); if (b) out.push(`${Z('预算', 'Budget')}: ${L(b.total).replace(/\*\*/g, '')} · ${Z('每人约', 'each ≈')}${eachText(b.min, b.max)}`);
    const r = d.blocks.find((x) => x.type === 'rain'); if (r && r.list) out.push(`${Z('下雨', 'If it rains')}: ${r.list.map(L).join(Z('；', '; '))}`);
    out.push(linkFor(d.id));
    return out.join('\n');
  }
