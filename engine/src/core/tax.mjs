// The tourist tax refund's shop coupons (TAX.coupons, ADR-20261128-tax-refund): which are still good on a day. Pure: no
// imports, no DOM, no trip globals.

/** has a coupon's last day ('YYYY-MM-DD', its `until`) passed on `today`? A coupon is good through its last day, and one
 *  without a last day (none printed on it: no `until`, or anything that isn't a date) never runs out */
const DAY = /^\d{4}-\d\d-\d\d$/;
export const expired = (until, today) => DAY.test(until || '') && DAY.test(today || '') && today > until;

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

/** the coupon viewer's layout for an image of imgW × imgH on a box of boxW × boxH free pixels (the screen less its
 *  margins; viewW × viewH the whole screen, which decides the turn): `turned`, the scale, the size it takes on the
 *  screen (w × h, turned already) and the image's own size before its turn (iw × ih). Fitted, the whole coupon shows and
 *  never grows past its own pixels; zoomed, it doubles the fit, or reaches one image pixel to one screen pixel when that
 *  is bigger. Zooming keeps the turn, so a barcode strip stays along the long edge */
export function couponView({ imgW, imgH, boxW, boxH, viewW, viewH, dpr = 1, zoomed = false }) {
	if (!(imgW > 0 && imgH > 0 && boxW > 0 && boxH > 0)) return { turned: false, scale: 0, w: 0, h: 0, iw: 0, ih: 0 };
	const turned = turnFor(imgW, imgH, viewW, viewH);
	const [dw, dh] = turned ? [imgH, imgW] : [imgW, imgH];
	const fit = Math.min(boxW / dw, boxH / dh, 1);
	const scale = zoomed ? Math.max(fit * 2, 1 / (dpr || 1)) : fit;
	return { turned, scale, w: dw * scale, h: dh * scale, iw: imgW * scale, ih: imgH * scale };
}
