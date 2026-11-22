// A day's activity mark (DAYS[i].motif, trip-format.md): what the group does that day, drawn as one small icon in the
// page's icon style (24 × 24, stroke 1.9, round). Trip data names it; the engine never guesses it from a day's text.
// `use` borrows a symbol the page's icon sprite already has (engine/src/shell.html); `d` is drawn here.
export const MARKS = {
	snowboard: {
		name: ['单板滑雪', 'Snowboarding'],
		d: '<path d="M3.6 17.2L17 7.6a2.3 2.3 0 0 1 2.7 3.7L6.3 20.9a2.3 2.3 0 0 1-2.7-3.7z"/><path d="M8.2 15.6l1.5 2.1M13.4 11.9l1.5 2.1"/><circle cx="16.5" cy="3.6" r="1.4"/>',
	},
	ski: {
		name: ['滑雪', 'Skiing'],
		d: '<path d="M4.5 4.5l15 15M19.5 4.5l-15 15"/><path d="M3 7.5l3-3M21 7.5l-3-3"/><path d="M8.5 21h7"/>',
	},
	onsen: {
		name: ['温泉', 'Hot spring'],
		d: '<path d="M3.5 14.5c0 3.3 3.8 6 8.5 6s8.5-2.7 8.5-6"/><path d="M3.5 14.5h17"/><path d="M8 11.5c-1.4-1.4 1.4-2.6 0-4s0-3.5 0-3.5M12 11.5c-1.4-1.4 1.4-2.6 0-4s0-3.5 0-3.5M16 11.5c-1.4-1.4 1.4-2.6 0-4s0-3.5 0-3.5"/>',
	},
	zoo: {
		name: ['动物园', 'Zoo'],
		d: '<circle cx="6.2" cy="10" r="1.9"/><circle cx="10" cy="5.8" r="1.9"/><circle cx="14.6" cy="5.8" r="1.9"/><circle cx="18.2" cy="10" r="1.9"/><path d="M12.2 11.2c-2.6 0-5 3.4-5 6 0 1.8 1.3 2.8 2.8 2.8 1 0 1.4-.5 2.2-.5s1.2.5 2.2.5c1.5 0 2.8-1 2.8-2.8 0-2.6-2.4-6-5-6z"/>',
	},
	city: {
		name: ['城市', 'City'],
		d: '<path d="M3 21h18"/><path d="M5 21V11h5v10M10 21V4.5h5V21M15 21v-7.5h4V21"/><path d="M12.5 4.5V2.5M12.5 8.5v.01M12.5 12v.01"/>',
	},
	sea: {
		name: ['海边', 'Seaside'],
		d: '<path d="M8 10.5a4 4 0 0 1 8 0"/><path d="M2.5 14.5c1.6 0 1.6-1.3 3.2-1.3s1.6 1.3 3.2 1.3 1.6-1.3 3.2-1.3 1.6 1.3 3.2 1.3 1.6-1.3 3.2-1.3 1.5 1.3 3 1.3"/><path d="M2.5 19c1.6 0 1.6-1.3 3.2-1.3s1.6 1.3 3.2 1.3 1.6-1.3 3.2-1.3 1.6 1.3 3.2 1.3 1.6-1.3 3.2-1.3 1.5 1.3 3 1.3"/>',
	},
	snow: { name: ['雪景', 'Snow country'], use: 'snow' },
	train: { name: ['坐火车', 'By train'], use: 'train' },
	drive: {
		name: ['公路旅行', 'Road trip'],
		d: '<path d="M2.5 17V8.5a2 2 0 0 1 2-2h10l4.2 4.3 1.6.6a1.8 1.8 0 0 1 1.2 1.7V17"/><path d="M2.5 17h2.4M9.3 17h5.4M19.2 17h2.3"/><path d="M2.5 10.8h16.2M9.5 6.5v4.3M14.5 6.5v4.3"/><circle cx="7.1" cy="17.2" r="2.2"/><circle cx="17" cy="17.2" r="2.2"/>',
	},
	plane: { name: ['飞行日', 'Flying'], use: 'plane' },
	shop: { name: ['购物', 'Shopping'], use: 'bag' },
	food: { name: ['美食', 'Food'], use: 'food' },
};

/** The allowed values of DAYS[i].motif. */
export const names = Object.keys(MARKS);

/**
 * The trip's leading activity for its drawn icon: the mark on the most days among those the world can draw beside its
 * own emblem (`drawable`, from the world's module), ties to the one that comes first. Flying days don't decide it unless
 * the world draws a plane. Null when no day carries a drawable mark: the icon is then the world's emblem alone.
 */
export function leadMotif(days, drawable = []) {
	const count = new Map();
	for (const d of days || []) if (drawable.includes(d?.motif)) count.set(d.motif, (count.get(d.motif) || 0) + 1);
	let lead = null;
	for (const [m, n] of count) if (!lead || n > count.get(lead)) lead = m;
	return lead;
}

/** A day with no mark, in a world that shows one for every day: a candle set in snow. */
export const candle =
	'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 13.5h9l-1.2 7h-6.6z"/><path d="M12 10.5c-1.8-1.5-.8-3.9 0-6 .8 2.1 1.8 4.5 0 6z"/><path d="M4 20.5h16"/></svg>';

/** The mark's drawing as an inline <svg> (decorative: the label beside it carries the meaning), '' for an unknown one. */
export function svg(motif, cls = '') {
	const m = Object.hasOwn(MARKS, motif) ? MARKS[motif] : null;
	if (!m) return '';
	return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${m.use ? `<use href="#i-${m.use}"/>` : m.d}</svg>`;
}
