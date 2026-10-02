/* ───────── the live demo's year ───────── */
// The live demo (build --demo-clock, the demo trip only) is written for one March. A visitor sees it in their own year
// instead: before anything reads a date, every date of the trip season moves by whole weeks (Time.demoShift), so each
// weekday holds and the page still opens mid-morning on Day 3. Only dates in the trip data and its side files move;
// the storage key stays the one the build wrote. Every other page keeps its dates exactly as written.
if (window.DEMO_CLOCK) {
	const days = Time.demoShift(TRIP.start, Time.nowIn(TRIP.tz || 'UTC').date);
	if (days) {
		if (!TRIP.storageKey) TRIP.storageKey = Plan.storeKey(TRIP);
		const from = Time.addDays(TRIP.start, -120);
		const to = Time.addDays(TRIP.end, 120);
		const move = (o) => {
			for (const k of Object.keys(o)) {
				const v = o[k];
				if (typeof v === 'string') o[k] = Time.shiftDates(v, days, from, to);
				else if (v && typeof v === 'object') move(v);
			}
		};
		// the trip format's top-level data (memory-bank/standards/trip-format.md), as far as this trip has it
		const data = [
			TRIP,
			typeof PLACES !== 'undefined' && PLACES,
			typeof SITES !== 'undefined' && SITES,
			typeof FACTS !== 'undefined' && FACTS,
			typeof BACKUPS !== 'undefined' && BACKUPS,
			DAYS,
			typeof OPTIONAL !== 'undefined' && OPTIONAL,
			typeof SHOPLISTS !== 'undefined' && SHOPLISTS,
			typeof SNOW !== 'undefined' && SNOW,
			typeof BUDGET !== 'undefined' && BUDGET,
			typeof MONEY !== 'undefined' && MONEY,
			typeof WEATHER !== 'undefined' && WEATHER,
			typeof TAX !== 'undefined' && TAX,
			typeof FLIGHTS !== 'undefined' && FLIGHTS,
			typeof CHECKLIST !== 'undefined' && CHECKLIST,
			typeof PRIORITIES !== 'undefined' && PRIORITIES,
			typeof PRINCIPLE !== 'undefined' && PRINCIPLE,
			typeof AIRPORT !== 'undefined' && AIRPORT,
			typeof ENTRY !== 'undefined' && ENTRY,
			typeof ENTRY_CHECKS !== 'undefined' && ENTRY_CHECKS,
			// the side files (build.mjs): when hours were checked, the forecast's days
			...['EXTRA', 'WISH', 'FORECAST', 'DRINKS', 'TOILETS', 'YB', 'BUS', 'SHOPS'].map((n) => window[n]),
		];
		for (const o of data) if (o && typeof o === 'object') move(o);
		window.DEMO_CLOCK = `${Time.addDays(window.DEMO_CLOCK.slice(0, 10), days)}${window.DEMO_CLOCK.slice(10)}`;
		document.title = `${TRIP.brand} ${TRIP.start.slice(0, 4)}`;
	}
}
