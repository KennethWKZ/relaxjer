// The tourist tax refund's shop coupons (TAX.coupons, ADR-20261128-tax-refund): which are still good on a day. Pure: no
// imports, no DOM, no trip globals.

/** has a coupon's last day ('YYYY-MM-DD', its `until`) passed on `today`? A coupon is good through its last day, and one
 *  without a last day never runs out */
export const expired = (until, today) => typeof until === 'string' && typeof today === 'string' && today > until;

/** the trip's coupons split into the ones still good on `today` and the ones past their last day, each in the trip's own
 *  order */
export function couponsOn(coupons, today) {
	const list = Array.isArray(coupons) ? coupons.filter((c) => c && typeof c === 'object') : [];
	return { good: list.filter((c) => !expired(c.until, today)), gone: list.filter((c) => expired(c.until, today)) };
}

/** should the coupon viewer turn this image a quarter turn? Only a landscape image (wider than tall, a barcode strip) on
 *  a portrait screen, so it fills the phone's long edge without the reader turning the phone; a portrait image, a square
 *  one, or a phone already held sideways keeps it upright */
export const turnFor = (imgW, imgH, viewW, viewH) => imgW > imgH && viewH > viewW;
