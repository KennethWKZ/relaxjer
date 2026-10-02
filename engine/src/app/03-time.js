/* ───────── time (the destination's clock) ───────── */
// the live demo's clock (build --demo-clock, the demo trip only): it opens at a set moment of the trip and runs on
const DEMO_FROM = Date.now();
function tpNow() {
	const o = store.get('now', null); // test override "YYYY-MM-DD HH:MM"
	if (o && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(o)) return { date: o.slice(0, 10), mins: +o.slice(11, 13) * 60 + +o.slice(14, 16) };
	if (window.DEMO_CLOCK) return Time.demoNow(window.DEMO_CLOCK, Date.now() - DEMO_FROM);
	return Time.nowIn(TZ);
}
const dnum = Time.dayNumber;
const dateLabel = (s, dow) => Time.dateLabel(s, lang, dow);
const parseT = (t) => Time.timesIn(L(t));
function nowNext(day, mins) {
	const items = day.schedule.map((it, i) => ({ it, i, ...parseT(it.t || '') })).filter((x) => x.s != null);
	let cur = null,
		next = null;
	for (let k = 0; k < items.length; k++) {
		const x = items[k];
		const end = x.e != null ? x.e : items[k + 1] ? items[k + 1].s : x.s + 60;
		if (x.s <= mins && mins < end) cur = x;
		if (x.s > mins && !next) next = x;
	}
	return { cur, next };
}

// the evening the group leaves for the airport: the day before an after-midnight take-off
const departEve = () => (Time.clockMinutes(FLIGHTS.ret.dep) < 12 * 60 ? Time.addDays(FLIGHTS.ret.date, -1) : FLIGHTS.ret.date);
// which day does what (arrival, airport evening, flight-only day, free-time day), from the trip data: Plan.dayRoles
const ROLE = Plan.dayRoles(DAYS, FLIGHTS.ret);
