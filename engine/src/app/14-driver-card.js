  /* ───────── driver card ───────── */
  function openDriver(pid) {
    const p = PLACES[pid]; if (!p) return; const a = addrFor(pid);
    $('#drv-name').textContent = p.trad || L(p.name);
    $('#drv-alt').textContent = p.gname ? `Google 地圖上的名稱：${p.gname}` : '';
    $('#drv-addr').textContent = a.zh || '';
    $('#drv-en').textContent = [L(p.name), a.en].filter(Boolean).join(' · ');
    $('#drv-tel').textContent = p.tel ? `☎ ${p.tel}` : '';
    $('#drv-copy').dataset.text = `${p.trad || L(p.name)}${p.gname ? `（Google 地圖：${p.gname}）` : ''}\n${a.zh || ''}`;
    $('#drv-map').href = gmSearch(p.maps);
    openDialog($('#driver'));
  }
