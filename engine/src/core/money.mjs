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
  const m = String(text).replace(/\*\*/g, '').match(new RegExp(`${reEsc(sym)}([\\d,]+)(?:–([\\d,]+))?`));
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

/** "≈ RM 100" / "≈ RM 100–140": a figure in the home currency, rounded to 10 above 100 */
export function homeText(min, max, rate, home) {
  const r = (v) => formatNum(v < 100 ? Math.round(v) : Math.round(v / 10) * 10);
  return min === max ? `≈ ${home} ${r(min / rate)}` : `≈ ${home} ${r(min / rate)}–${r(max / rate)}`;
}
