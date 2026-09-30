// Taiwan: what the page knows about travelling there, whatever the city. Pure (no imports, no DOM, no trip globals):
// engine/build.mjs inlines it, merged with the city's pack, as the page's `Pack` when TRIP.destination is 'tw'.
// Amounts are in the country's currency; the trip's own currency settings stay in TRIP.currency.

export const country = ['台湾', 'Taiwan'];
export const sym = 'NT$';

/** tourist tax refund: at least this much in one shop on one day */
export const taxRefund = { min: 2000 };

/**
 * The tourism lucky draw for foreign visitors: a Repeat Visitor (entered since `since`) can win `repeat`, and brings
 * one companion who can win `companion`. The trip's ENTRY.lucky text holds the campaign's rules and dates.
 */
export const luckyDraw = {
	repeat: 5000,
	companion: 3000,
	since: '2023-01-01',
	// the programme's own words; {pax} = the group size
	words: {
		repeat: ['重游旅客', 'Repeat Visitors'],
		companion: ['同行亲友', 'Companions'],
		none: ['没有人符合「重游旅客」，这次{pax}人都不能参加。', 'No Repeat Visitor; none of us eligible.'],
		all: ['全部中奖最多', 'If every pair wins'],
	},
};

/** how many of the group can win what: r repeat visitors, each bringing one companion from the rest */
export function luckyShares(pax, repeat) {
	const r = Math.max(0, Math.min(pax, repeat));
	const companions = Math.min(pax - r, r);
	return { repeat: r, companions, left: pax - r - companions, total: r * luckyDraw.repeat + companions * luckyDraw.companion };
}
