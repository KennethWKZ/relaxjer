// Ratings from different sites sit on different scales, so a list sorted "by rating" compares them on one scale first.
// Tabelog's scores are much lower than Google's: most listed places sit near 3.0, and 3.5 is already in its "very
// good" band, while Google's restaurant ratings mostly sit around 3.8–4.5. A raw sort put any Google 4.3 above a
// Tabelog 3.8. The page still shows each rating as its site gave it; this only orders them.
//
// The mapping: Tabelog t counts as 3.8 + 1.2 × (t − 3.0) Google stars (3.0 → 3.8, 3.5 → 4.4, 3.8 → 4.76, 4.0 → 5.0),
// a straight line through two anchors: Tabelog's typical 3.0 against a typical Google 3.8, and Tabelog's "very good"
// 3.5 against a very good Google 4.4. Above 4.0 it runs past 5 on purpose, so Tabelog's rare top scores still rank
// above Google's. Any other source, or none, is taken as Google-like stars.

const TABELOG = /tabelog|食べログ/i;

/** a rating as Google-like stars for sorting; 0 when there is none */
export function score(rating, source) {
	const r = +rating;
	if (!(r > 0)) return 0;
	return TABELOG.test(source || '') ? 3.8 + 1.2 * (r - 3) : r;
}

/** a sort comparator, highest first, for items read as [rating, source] by pick */
export const byScore =
	(pick = (x) => [x.rating, x.rating_source]) =>
	(a, b) =>
		score(...pick(b)) - score(...pick(a));
