/* ───────── map ───────── */
const FIRST_VIEW = (TRIP.mapViews && TRIP.mapViews[0] && TRIP.mapViews[0].id) || 'all'; // the map opens on the trip's first area
let map = null;
let mapPins = [];
let mapDay = 'all';
let mapCat = 'all';
let mapNear = false;
let meLL = null; // map: every pin, day scope, category, sort by distance, where the phone is
function mapListHTML() {
	if (!GEO) return '';
	const pins = buildPins();
	const byDay = DAYS.filter((d) => d.id !== 'd7').map((d) => ({
		d,
		items: pins.filter((p) => p.days.includes(d.id) && p.type !== 'mrt' && !p.drink && !p.wc),
	}));
	const other = pins.filter((p) => !p.days.length && p.type !== 'mrt' && !p.drink && !p.wc);
	const btn = (p) => `<button type="button" class="tag pinbtn" data-pick="${p.pid}" data-q="${esc(p.q || p.name)}">${esc(p.name)}</button>`;
	return (
		byDay
			.map(({ d, items }) =>
				items.length
					? `<p class="tail-sub">Day ${d.n} · ${esc(dateLabel(d.date, d.dow))}</p><div class="pills">${items.map(btn).join('')}</div>`
					: '',
			)
			.join('') +
		(other.length ? `<p class="tail-sub">${Z('酒店与备选', 'Hotel & optional')}</p><div class="pills">${other.map(btn).join('')}</div>` : '')
	);
}
