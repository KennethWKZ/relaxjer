// Sapporo (and Otaru, the same taxi area): the subway's name, the transit card and the taxi meter. Pure; merged over
// the country pack (destinations/jp/pack.mjs) when TRIP.region is 'sapporo'. Facts and sources: ../../knowledge.md.

export const city = ['札幌', 'Sapporo'];
export const metro = ['地铁', 'Subway'];
/** the stored-value card: the city's own, or a nationwide one (Kitaca, Suica) on the subway, tram and JR */
export const transitCard = ['IC卡（SAPICA / Kitaca / Suica）', 'IC card (SAPICA / Kitaca / Suica)'];

/**
 * Sapporo–Otaru taxi meter (the upper-limit fare from 2025-12-17) for a straight-line distance: the road is taken as
 * ~1.3× longer (an estimate, as in Taipei). ¥600 for the first 1.05 km, ¥100 per 272 m after. A 20% surcharge from
 * 22:00 to 05:00, and all day in winter (10 Dec – 26 Mar); the two don't stack. `date` is 'YYYY-MM-DD' (no date: no
 * winter rate). Returns [low, high] per car, to the nearest 10: high is the upper limit, low 10% under it (companies
 * may charge less).
 */
export function taxiFare(km, minsNow, date) {
	const road = km * 1.3;
	const base = 600 + Math.max(0, Math.ceil((road - 1.05) / 0.272)) * 100;
	const md = date ? date.slice(5) : '';
	const winter = !!md && (md >= '12-10' || md <= '03-26');
	const night = minsNow >= 1320 || minsNow < 300;
	const r10 = (v) => Math.round(v / 10) * 10;
	const high = r10(base * (winter || night ? 1.2 : 1));
	return [r10(high * 0.9), high];
}
