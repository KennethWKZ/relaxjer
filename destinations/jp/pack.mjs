// Japan: what the page knows about travelling there, whatever the region. Pure (no imports, no DOM, no trip globals):
// engine/build.mjs inlines it, merged with the region's pack, as the page's `Pack` when TRIP.destination is 'jp'.
// Amounts are in yen; the trip's own currency settings stay in TRIP.currency. Facts and sources: knowledge.md.

export const country = ['日本', 'Japan'];
export const sym = '¥';

/** the Chinese Google's search and map answer in when the page reads Chinese: Simplified, as the page itself */
export const googleZh = 'zh-CN';

/**
 * the native layer: the group reads Chinese or English, so stops and places also show their Japanese, one tap to copy;
 * `ask` is "please take us here" on the driver card
 */
export const native = { lang: 'ja', name: ['日文', 'Japanese'], ask: 'この場所までお願いします。' };

/** tourist tax-free (the refund method since 2026-11-01): at least this much, before tax, in one shop on one day */
export const taxRefund = { min: 5000 };

/**
 * rest stops along a long drive (the pipeline's drive-stops step, ADR-20261128-drive-stops): what to search for along
 * the route, in order (`fewer`: only while fewer stops than that were found; `type`: Google's place type, narrowing the
 * search); how a stop's name tells its kind; the expressway's direction words; and the side of the road a car keeps
 * to. A service area often has a twin across the expressway, one signed 上り and one 下り. 上り runs toward the road's
 * legal start, which is Tokyo's way on most roads but not all (Sapporo to Otaru is 上り), so the words alone can't say
 * which twin a drive passes: the step keeps the one on the side the car keeps to (knowledge.md, Driving)
 */
export const driveStops = {
	search: [
		{ q: 'サービスエリア', kind: 'sa' },
		{ q: 'パーキングエリア', kind: 'pa' },
		{ q: '道の駅', kind: 'roadside' },
		{ q: 'ガソリンスタンド', kind: 'fuel', type: 'gas_station' },
		{ q: 'コンビニ', kind: 'store', type: 'convenience_store', fewer: 4 },
	],
	names: { sa: 'サービスエリア|(?<![A-Za-z])SA(?![A-Za-z])', pa: 'パーキングエリア|(?<![A-Za-z])PA(?![A-Za-z])', roadside: '道の駅' },
	dir: { up: '上り', down: '下り' },
	side: 'left',
};
