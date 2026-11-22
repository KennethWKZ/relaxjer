// ht-ml.app scans every page before it goes live and refuses one it reads as carrying a payment card number
// ("Scan failed: payment_card"; knowledge/hosting.md). What it caught on 2026-11-22: numbers separated only by spaces
// whose digits hold a card-shaped run that passes the Luhn check, read from the page's text and its URL-encoded parts
// (an SVG drawn in the CSS), not from base64. publish:trip checks a page this way before it uploads, and
// tests/repo/host-scan.test.mjs checks what the engine writes into every page.

// the issuer prefixes and lengths a card scanner knows (Visa, Mastercard, Amex, Discover, JCB, UnionPay, Diners)
const CARD = /^(4\d{12}(\d{3}){0,2}|5[1-5]\d{14}|2[2-7]\d{14}|3[47]\d{13}|6(011|5\d\d)\d{12,15}|35\d{14,17}|62\d{14,17}|3(0[0-5]|[68]\d)\d{11,16})$/;

export const luhn = (d) =>
	[...d].reverse().reduce((t, c, i) => {
		let n = +c;
		if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
		return t + n;
	}, 0) %
		10 ===
	0;

const holdsCard = (digits) => {
	for (let n = 13; n <= 19; n++)
		for (let i = 0; i + n <= digits.length; i++) if (CARD.test(digits.slice(i, i + n)) && luhn(digits.slice(i, i + n))) return true;
	return false;
};

/** each run of numbers separated only by spaces that holds a card-shaped number: { run, index } */
export const cardRuns = (text) =>
	[...String(text).matchAll(/(?<![\d.])\d+(?: \d+)+/g)].filter((m) => holdsCard(m[0].replace(/\D/g, ''))).map((m) => ({ run: m[0], index: m.index }));

// a lone % that isn't an escape (a CSS 50%) would stop decodeURIComponent, so it's escaped first
const decoded = (s) => decodeURIComponent(s.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));

/** the runs in a page, as the host reads it: the text as it is and URL-decoded (base64 is left alone) */
export const pageCardRuns = (html) => {
	const seen = new Set();
	return [...cardRuns(html), ...cardRuns(decoded(String(html)))].filter((r) => !seen.has(r.run) && seen.add(r.run));
};

/** a run with all but its first two and last two digits hidden, so a message never carries a whole number */
export const maskRun = (run) => {
	const total = run.replace(/\D/g, '').length;
	let i = 0;
	return run.replace(/\d/g, (d) => (i++ < 2 || i > total - 2 ? d : '•'));
};
