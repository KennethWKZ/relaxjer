// The committed demo trips (Taipei and Sapporo) follow the trip contract and stay synthetic: nothing Google-derived,
// nothing personal. TRIP_DIR=<folder with data.js> runs the same contract on a real trip locally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_TRIP, DEMO_TRIPS, ROOT } from '../support/stage.mjs';
import { checkTrip, loadTrip, OPTIONAL_GLOBALS, pointsOutside, readJSON, REQUIRED } from '../support/trip-contract.mjs';

const dirs = process.env.TRIP_DIR ? [path.resolve(process.env.TRIP_DIR)] : DEMO_TRIPS;

test('the contract catches a broken trip', () => {
	const trip = loadTrip(DEMO_TRIP);
	trip.DAYS[1].schedule[2].t = '08:00'; // earlier than the stop before
	trip.DAYS[2].schedule[0].place = 'nowhere';
	trip.BUDGET.totalMax = 1;
	trip.FACTS[0].v = ['日期', ''];
	trip.DAYS[1].route = [['hotel', 'atlantis', 'teleport']];
	trip.DAYS[2].route = [['hotel', 'hotel', 'transit', 0]]; // the trip's own minutes are whole and above 0
	trip.DAYS[3].motif = 'skiing in the morning'; // free text: the mark is a name from the list
	trip.TRIP.sky = 'aurora'; // a sky the engine doesn't draw
	trip.TRIP.walkPace = '1.4'; // a pace is a number, not text
	const decide = trip.DAYS.flatMap((d) => d.blocks).find((b) => b.type === 'decide');
	decide.pick = 'z'; // no option has that key
	trip.DAYS[0].blocks[0].sum = 'one language only';
	delete trip.TRIP.pax;
	const problems = checkTrip(trip).join('\n');
	for (const want of [
		'earlier than the stop before',
		'unknown place "nowhere"',
		'totalMin',
		'both languages needed',
		'route leg 0',
		'd3 route leg 0: needs',
		'd4: motif "skiing in the morning" must be one of snowboard\\|',
		'TRIP.sky "aurora" must be one of live\\|globe\\|pile\\|off',
		'TRIP.walkPace must be a number from 1 to 2',
		'pick "z" must be the k of one of its options',
		'd1 \\w+ block: sum must be \\[zh, en\\]',
		'TRIP.pax missing',
	])
		assert.match(problems, new RegExp(want));
});

for (const dir of dirs) {
	const isDemo = DEMO_TRIPS.includes(dir);
	const at = ` (${path.relative(ROOT, dir) || dir})`;

	test('trip follows the contract' + at, () => {
		assert.deepEqual(checkTrip(loadTrip(dir)), []);
	});

	test('every pin sits inside the map' + at, () => {
		assert.deepEqual(pointsOutside(dir), []);
	});

	test('every planned place has a pin' + at, () => {
		const { PLACES } = loadTrip(dir);
		const geo = readJSON(dir, 'geo.json', { places: {} });
		const missing = Object.keys(PLACES).filter((id) => !geo.places[id]);
		assert.deepEqual(missing, []);
	});

	test('demo data carries nothing copied from Google' + at, { skip: !isDemo && 'real trips may hold Google data' }, () => {
		// Maps Platform terms limit storing Places content; a public example must not redistribute it
		const FORBIDDEN =
			/"(gpid|rating|reviews|userRatingCount|rating_source|businessStatus)"\s*:|googleusercontent\.com|maps\.googleapis\.com\/maps\/api\/place\/photo/;
		for (const f of fs.readdirSync(dir)) {
			const text = fs.readFileSync(path.join(dir, f), 'utf8');
			assert.doesNotMatch(text, FORBIDDEN, `${f} has Google-derived fields`);
		}
	});

	test("the live demo can move every date into a visitor's own year" + at, { skip: !isDemo && 'only the demo has a live demo' }, () => {
		// it moves the date fields (engine/src/app/01-demo-year.js), so a date typed into a sentence would stay behind
		const trip = loadTrip(dir);
		const side = fs
			.readdirSync(dir)
			.filter((f) => f.endsWith('.json'))
			.map((f) => [f, readJSON(dir, f)]);
		const written = [];
		const walk = (v, at) => {
			if (typeof v === 'string') {
				const text = v.replace(/\b\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?\b/g, ''); // a date field's own value moves
				for (const re of [
					/\b20\d\d\b/, // a year
					/\b\d{1,2}(?:–\d{1,2})? (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/, // 13 Mar, 13–19 Mar
					/\d{1,2}月\d{1,2}日/, // 3月13日
					/(?:^|[^\d/])\d{1,2}\/\d{1,2}(?![\d/])/, // 3/13
				]) {
					const m = text.match(re);
					if (m) written.push(`${at}: "${m[0]}"`);
				}
			} else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${at}.${k}`);
		};
		for (const k of [...REQUIRED, ...OPTIONAL_GLOBALS]) walk(trip[k], k);
		for (const [f, v] of side) walk(v, f);
		assert.deepEqual(written, [], 'write the day ("Day 6") or let the page say the date; the live demo can only move date fields');
		// and the engine walks every top-level data name the contract knows
		const shift = fs.readFileSync(path.join(ROOT, 'engine', 'src', 'app', '01-demo-year.js'), 'utf8');
		assert.deepEqual(
			[...REQUIRED, ...OPTIONAL_GLOBALS].filter((k) => !new RegExp(`\\b${k}\\b`).test(shift)),
			[],
			'01-demo-year.js leaves these out',
		);
	});

	test('demo data is visibly synthetic' + at, { skip: !isDemo && 'only the demo is published' }, () => {
		const { FLIGHTS, PLACES } = loadTrip(dir);
		// "XX" is not an airline code, so the flights cannot be mistaken for a real booking
		for (const k of ['out', 'ret']) assert.match(FLIGHTS[k].no, /^XX \d+$/);
		assert.match(PLACES.hotel.name[1], /Sample|Demo/);
		assert.ok(!PLACES.hotel.tel, 'no phone numbers in the demo');
	});
}
