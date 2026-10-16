// Line breaks in text people read. Pure; wrapped as `Wrap` inside the page script.

// a number range with a short unit after it ("NT$110–150 each", "08:00–23:00", "09/30–11/14", "60–75分钟"), or digits
// joined by hyphens (a phone number "02-2629-6860", a date "2026-09-30")
const RUN = /\d[\d,.:/]*–\d[\d,.:/]*(?: ?\p{L}{1,4}(?![\p{L}\p{N}]))?|\d+(?:-\d+)+/gu;

/** escaped text with each number run in a no-wrap span: a line ending "NT$110–" over "150", or "Tel 02-" over
 *  "2579-5880", stranded the dash */
export const keepRanges = (h) => h.replace(RUN, '<span class="rng">$&</span>');
