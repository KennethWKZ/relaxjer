// Money helpers: per-person shares of group figures and the home-currency line. Pure; the trip supplies the currency
// symbol, the group size and the rate. Wrapped as `Money` inside the page script.
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** a group figure's rough share each, to the nearest 10 */
export const share = (n, pax) => Math.round(n / pax / 10) * 10;

/** how a group figure is marked in the data: ["五人", "for 5"] */
export const groupWord = (pax) => [`${CN[pax] || pax}人`, `for ${pax}`];

export const formatNum = (n) => Math.round(n).toLocaleString('en-US');

/** the first "SYM a" or "SYM a–b" in a text → [a, b], else null (bold markers ignored) */
export function amountsIn(text, sym) {
	const m = String(text)
		.replace(/\*\*/g, '')
		.match(new RegExp(`${reEsc(sym)}([\\d,]+)(?:–([\\d,]+))?`));
	if (!m) return null;
	const a = +m[1].replace(/,/g, '');
	return [a, m[2] ? +m[2].replace(/,/g, '') : a];
}

/**
 * Matches a group figure in escaped page text: "SYM a–b / 五人" or "SYM a–b for 5", the amount optionally in **bold**.
 * Groups: 1 the amount as written, 2 low, 3 high, 4 the group marker. A figure already followed by its share in
 * brackets is skipped.
 */
export function groupFigureRe(sym, pax) {
	const [zh, en] = groupWord(pax);
	const s = reEsc(sym);
	return new RegExp(`((?:\\*\\*)?${s}([\\d,]+)(?:–([\\d,]+))?(?:\\*\\*)?)( \\/ ${zh}| ${en})(?! \\(${s})`, 'g');
}

/**
 * Does the text already give the per-person figure for a group amount (lo–hi)? "NT$600 each, NT$3,000 for 5" or
 * "每人 NT$600，五人 NT$3,000" do; adding "≈NT$600 each" again would only repeat it. Exact amounts (not the rounded
 * share), bold markers ignored.
 */
export function statesShare(text, sym, lo, hi, pax) {
	const t = String(text).replace(/\*\*/g, '');
	const fig = (n) => formatNum(n / pax);
	const amt = `${reEsc(sym)} ?${reEsc(fig(lo))}${hi > lo ? `–${reEsc(fig(hi))}` : ''}`;
	if (lo % pax || hi % pax) return false; // a share with pennies is never written out that way
	return new RegExp(`${amt} each|每人(?:约)? ?${amt}(?![\\d,])`).test(t);
}

/**
 * A converted figure, rounded so it claims no more precision than a rate can give: one significant figure under 1, whole
 * under 100, to the nearest 10 under 10,000, and three significant figures above (12,345 → 12,300).
 */
export function roundHome(v) {
	if (!(v > 0)) return 0;
	if (v < 1) return +v.toPrecision(1);
	if (v < 100) return Math.round(v);
	if (v < 10000) return Math.round(v / 10) * 10;
	const step = 10 ** (Math.floor(Math.log10(v)) - 2);
	return Math.round(v / step) * step;
}

const homeNum = (v) => roundHome(v).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** "RM 100" / "RM 100–140": a figure in the trip's currency, in the home currency (rate: one home unit in the trip's) */
export function homeAmount(min, max, rate, home) {
	const a = homeNum(min / rate),
		b = homeNum(max / rate);
	return a === b ? `${home} ${a}` : `${home} ${a}–${b}`;
}

/** "≈ RM 100" / "≈ RM 100–140": the home-currency line under a figure */
export function homeText(min, max, rate, home) {
	return `≈ ${homeAmount(min, max, rate, home)}`;
}

/** can the page show its figures in the home currency? Only with a home currency that isn't the trip's own, and a rate */
export const canSwitch = (cur) => Boolean(cur && cur.sym && cur.home && cur.home !== cur.sym && cur.rate > 0);

// an amount as people write it: 1,200 · 1200 · 3.5 · 1.5万 · 5k (the 万/千/k counts)
const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(万|千|[kK](?![A-Za-z]))?`;
const SCALE = { 万: 1e4, 千: 1e3, k: 1e3, K: 1e3 };
const toNum = (n, unit) => +n.replace(/,/g, '') * (SCALE[unit] || 1);
// words that already say a figure is rough, right before it: 约 ¥5,000 · ≈¥20 · ~NT$300 · about ¥5,000
const APPROX = /(?:约|約|大约|≈|~|～|〜|about|around|approx\.?|roughly|ca\.)\s?$/i;

/**
 * Every amount in the trip's currency (`sym`) in a text, each replaced by what `fn` returns; the rest stays as written.
 * An amount is the symbol (not glued to a letter or digit before it, so "NT$" is never read as "$", nor "CN¥" as "¥"),
 * a number, and maybe a range to a second one ("–", "-" or "~", the symbol repeated or not) and a "+" after it. Other
 * currencies, times and distances are left alone.
 *
 * `fn` gets `{ text, lo, hi, approx, plus, note }`: the amount as written (with its "+"), its low and high figures, whether
 * the words before it already say it's rough (约, ≈, ~, about…), whether a "+" follows it, and, when `home` is given, the writer's own
 * home-currency note right after it ("（≈ RM 1,540）", " (≈ RM 1,540)"), which the match takes in so it isn't repeated.
 * Bold markers (`**`) around an amount stay where they are.
 */
export function mapAmounts(text, sym, fn, home = '') {
	const s = reEsc(sym);
	const one = String.raw`${s}[ \u00a0\u202f]?${NUM}`;
	const note = home ? String.raw`(\s?[（(]\s?(?:≈|约|~|about )?\s?${reEsc(home)}\s?[\d,.]+(?:\s?[–-]\s?[\d,.]+)?\s?[)）])?` : '()?';
	const re = new RegExp(String.raw`(?<![A-Za-z0-9])${one}(?:\s?[–\-~～〜]\s?(?:${s}[ \u00a0\u202f]?)?${NUM})?(\+)?${note}`, 'g');
	const first = new RegExp(`^${one}`);
	const str = String(text);
	return str.replace(re, (m, a, au, b, bu, plus, own, at) => {
		const before = str.slice(Math.max(0, at - 12), at).replace(/\*\*\s?$/, '');
		const approx = APPROX.test(before);
		const lo = toNum(a, au);
		const hi = b ? toNum(b, bu || au) : lo;
		if (hi < lo) {
			// "¥1,000-3人" isn't a range: the first figure alone, the rest as written
			const f = m.match(first)[0];
			return fn({ text: f, lo, hi: lo, approx, plus: false, note: '' }) + m.slice(f.length);
		}
		return fn({ text: own ? m.slice(0, m.length - own.length) : m, lo, hi, approx, plus: !!plus, note: own || '' });
	});
}

/** a plain text with its amounts in the home currency, for places without markup: "约 ¥5,000" → "约 RM 130" */
export function toHome(text, sym, rate, home) {
	return mapAmounts(text, sym, (a) => `${a.approx || !a.hi ? '' : '≈ '}${homeAmount(a.lo, a.hi, rate, home)}${a.plus ? '+' : ''}`, home);
}
