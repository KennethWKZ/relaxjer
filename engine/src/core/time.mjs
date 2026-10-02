// Clock and date helpers. Pure: no DOM, no storage, no trip globals. Dates are "YYYY-MM-DD"; times are minutes after
// midnight. The build wraps this file as `Time` inside the page script; tests import it directly.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "HH:MM" exactly → minutes, else null */
export const clockMinutes = (t) => {
	const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
	return m ? +m[1] * 60 + +m[2] : null;
};

/** minutes → "HH:MM", wrapping past midnight either way */
export const hm = (m) =>
	`${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String((((m % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;

/** the first and second clock times in a text ("10:00–11:30", "~18:30", "After the show") */
export function timesIn(text) {
	const m = [...String(text).matchAll(/(\d{1,2}):(\d{2})/g)].map((x) => +x[1] * 60 + +x[2]);
	return { s: m.length ? m[0] : null, e: m.length > 1 ? m[1] : null };
}

/** days since 1970-01-01 (UTC), so dates can be compared and counted */
export const dayNumber = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;

export const addDays = (s, n) => new Date((dayNumber(s) + n) * 864e5).toISOString().slice(0, 10);

/** today's date and minutes in a time zone (the destination's, not the phone's) */
export function nowIn(timeZone, at = new Date()) {
	const f = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	});
	const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
	return { date: `${p.year}-${p.month}-${p.day}`, mins: (+p.hour % 24) * 60 + +p.minute };
}

/** the live demo's clock: a set moment of the trip ("YYYY-MM-DD HH:MM", in the trip's time), run on by the time
 *  since the page opened, so a visitor lands on a day under way and it keeps moving */
export function demoNow(clock, elapsedMs) {
	const m = +clock.slice(11, 13) * 60 + +clock.slice(14, 16) + Math.floor(Math.max(0, elapsedMs) / 6e4);
	return { date: addDays(clock.slice(0, 10), Math.floor(m / 1440)), mins: m % 1440 };
}

/** a date's weekday, Monday = 0 … Sunday = 6 (the order of Google's opening hours) */
export const weekdayIndex = (s) => (new Date(dayNumber(s) * 864e5).getUTCDay() + 6) % 7;

/** "Sat 13 Mar" / "3月13日 周六"; dow is the day's [zh, en] weekday, optional */
export const dateLabel = (s, lang, dow) =>
	lang === 'en'
		? `${dow ? dow[1] + ' ' : ''}${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}`
		: `${+s.slice(5, 7)}月${+s.slice(8, 10)}日${dow ? ' 周' + dow[0] : ''}`;

/** "19 Mar" / "3/19": the short form used in front of a next-day time */
export const shortDate = (s, lang) => (lang === 'en' ? `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}` : `${+s.slice(5, 7)}/${+s.slice(8, 10)}`);

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st */
export const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

/** a trip's dates for the header: "13–19 Mar", "30 Mar – 2 Apr" / "3.13–3.19" */
export function rangeLabel(start, end, lang) {
	const [m1, d1, m2, d2] = [+start.slice(5, 7), +start.slice(8, 10), +end.slice(5, 7), +end.slice(8, 10)];
	if (lang !== 'en') return `${m1}.${d1}–${m2}.${d2}`;
	return m1 === m2 ? `${d1}–${d2} ${MON[m1 - 1]}` : `${d1} ${MON[m1 - 1]} – ${d2} ${MON[m2 - 1]}`;
}
