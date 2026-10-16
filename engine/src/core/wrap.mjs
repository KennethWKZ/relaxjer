// Line breaks in text people read. Pure; wrapped as `Wrap` inside the page script.

// digits joined by two or more hyphens (a phone number "02-2629-6860", a date "2026-09-30"); a number range, with an en
// dash or a plain hyphen, and a short unit after it ("NT$110–150 each", "08:00–23:00", "11:20-18:30", "09/30–11/14",
// "60–75分钟", "6-7 min"); or a phone number written with spaces after a country code ("+886 2 2557 5379") or after an
// area code in brackets ("(02) 2536 4459", "(02)2536-4459"). Spaced digits need the "+" or the brackets, so
// "3 cars 2 hours" stays free.
const RUN =
	/\d+(?:-\d+){2,}|\d[\d,.:/]*[–-]\d[\d,.:/]*(?: ?\p{L}{1,4}(?![\p{L}\p{N}]))?|\+\d{1,3}(?: \d{1,4}){2,4}(?!\d)|\(\d{1,4}\) ?\d{2,4}(?:[ -]\d{2,4})+/gu;

/** escaped text with each number run in a no-wrap span: a line ending "NT$110–" over "150", or "Tel 02-" over
 *  "2579-5880", or "+886 2" over "2557 5379", stranded the rest */
export const keepRanges = (h) => h.replace(RUN, '<span class="rng">$&</span>');
