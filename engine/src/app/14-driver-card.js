/* ───────── driver card ───────── */
function openDriver(pid) {
	const p = PLACES[pid];
	if (!p) return;
	const a = addrFor(pid);
	// the local-language lines carry the pack's language, so Japanese shows Japanese glyphs rather than Chinese ones
	const lg = nativeLang();
	['#drv-name', '#drv-alt', '#drv-addr'].forEach((s) => ($(s).lang = lg || 'zh-Hant'));
	// "please take us here" in the driver's language: the pack's own words where it has a native layer
	if (lg && Pack.native.ask) {
		$('#drv-ask').lang = lg;
		$('#drv-ask').textContent = `${Pack.native.ask} · Please take us here, thank you.`;
	}
	$('#drv-name').textContent = p.trad || L(p.name);
	$('#drv-alt').textContent = p.gname ? (lg ? `Google Maps: ${p.gname}` : `Google 地圖上的名稱：${p.gname}`) : '';
	$('#drv-addr').textContent = a.zh || '';
	$('#drv-en').textContent = [L(p.name), p.roma, a.en].filter(Boolean).join(' · ');
	$('#drv-tel').textContent = p.tel ? `☎ ${p.tel}` : '';
	const gm = p.gname ? (lg ? `（Google Maps: ${p.gname}）` : `（Google 地圖：${p.gname}）`) : '';
	$('#drv-copy').dataset.text = `${p.trad || L(p.name)}${gm}\n${a.zh || ''}`;
	$('#drv-map').href = gmSearch(p.maps);
	$('#drv-map-l').textContent = mapsApp === 'apple' ? 'Apple Maps' : 'Google Maps';
	openDialog($('#driver'));
}
