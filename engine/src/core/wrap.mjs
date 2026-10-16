// Line breaks in text people read. Pure; wrapped as `Wrap` inside the page script.

// a number range with a short unit after it ("NT$110–150 each", "08:00–23:00", "09/30–11/14", "60–75分钟"); a phone
// number written with spaces after a country code ("+886 2 2557 5379") or after an area code in brackets
// ("(02) 2536 4459", "(02)2536-4459"); or digits joined by hyphens (a phone number "02-2629-6860", a date
// "2026-09-30"). Spaced digits need the "+" or the brackets, so "3 cars 2 hours" stays free.
const RUN =
	/\d[\d,.:/]*–\d[\d,.:/]*(?: ?\p{L}{1,4}(?![\p{L}\p{N}]))?|\+\d{1,3}(?: \d{1,4}){2,4}(?!\d)|\(\d{1,4}\) ?\d{2,4}(?:[ -]\d{2,4})+|\d+(?:-\d+)+/gu;

/** escaped text with each number run in a no-wrap span: a line ending "NT$110–" over "150", or "Tel 02-" over
 *  "2579-5880", or "+886 2" over "2557 5379", stranded the rest */
export const keepRanges = (h) => h.replace(RUN, '<span class="rng">$&</span>');
