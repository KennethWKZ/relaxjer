// Unit tests for the engine's pure modules (engine/src/core). Expected values are what the page showed before the logic
// was pulled out of app.js, so these pin today's behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Time from '../../engine/src/core/time.mjs';
import * as Money from '../../engine/src/core/money.mjs';
import * as Plan from '../../engine/src/core/plan.mjs';
import * as Wrap from '../../engine/src/core/wrap.mjs';
import * as Fit from '../../engine/src/core/fit.mjs';
import * as Sky from '../../engine/src/core/sky.mjs';
import * as Way from '../../engine/src/core/way.mjs';

test('Time: clock parsing and formatting', () => {
	assert.equal(Time.clockMinutes('09:05'), 545);
	assert.equal(Time.clockMinutes('9:05'), 545);
	assert.equal(Time.clockMinutes('~09:05'), null); // exact HH:MM only
	assert.equal(Time.hm(1460), '00:20'); // an after-midnight flight
	assert.equal(Time.hm(-30), '23:30');
	assert.deepEqual(Time.timesIn('10:00–11:30'), { s: 600, e: 690 });
	assert.deepEqual(Time.timesIn('~18:30'), { s: 1110, e: null });
	assert.deepEqual(Time.timesIn('After the show'), { s: null, e: null });
});

test('Time: dates and labels', () => {
	assert.equal(Time.dayNumber('2027-03-14') - Time.dayNumber('2027-03-13'), 1);
	assert.equal(Time.addDays('2027-02-28', 1), '2027-03-01');
	assert.equal(Time.addDays('2027-03-01', -1), '2027-02-28');
	assert.equal(Time.dateLabel('2027-03-13', 'en', ['六', 'Sat']), 'Sat 13 Mar');
	assert.equal(Time.dateLabel('2027-03-13', 'zh', ['六', 'Sat']), '3月13日 周六');
	assert.equal(Time.dateLabel('2027-03-18', 'en'), '18 Mar');
	assert.equal(Time.shortDate('2027-03-19', 'en'), '19 Mar');
	assert.equal(Time.compactDate('2027-03-13', 'zh', ['六', 'Sat']), '3/13 周六');
	assert.equal(Time.compactDate('2027-03-13', 'en', ['六', 'Sat']), 'Sat 13 Mar');
	assert.equal(Time.compactDate('2027-11-07', 'zh'), '11/7');
	assert.equal(Time.shortDate('2027-03-19', 'zh'), '3/19');
	assert.equal(Time.rangeLabel('2027-03-13', '2027-03-19', 'en'), '13–19 Mar');
	assert.equal(Time.rangeLabel('2027-03-13', '2027-03-19', 'zh'), '3.13–3.19');
	assert.equal(Time.rangeLabel('2027-03-30', '2027-04-02', 'en'), '30 Mar – 2 Apr');
});

test('Time: weekday index, Monday first', () => {
	assert.deepEqual(['2027-03-13', '2027-03-15', '2027-03-18', '2027-03-21'].map(Time.weekdayIndex), [5, 0, 3, 6]); // Sat, Mon, Thu, Sun
});

test('Time: ordinals', () => {
	assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30].map(Time.ordinal), [
		'1st',
		'2nd',
		'3rd',
		'4th',
		'11th',
		'12th',
		'13th',
		'21st',
		'22nd',
		'23rd',
		'30th',
	]);
});

test('Time: now in the destination, not on the phone', () => {
	const at = new Date('2027-03-13T17:30:00Z'); // 01:30 next day in Taipei
	assert.deepEqual(Time.nowIn('Asia/Taipei', at), { date: '2027-03-14', mins: 90 });
	// the live demo's clock opens at its set moment and runs on, across midnight too
	assert.deepEqual(Time.demoNow('2027-03-15 10:05', 0), { date: '2027-03-15', mins: 605 });
	assert.deepEqual(Time.demoNow('2027-03-15 10:05', 30 * 6e4 + 59e3), { date: '2027-03-15', mins: 635 });
	assert.deepEqual(Time.demoNow('2027-03-15 23:50', 20 * 6e4), { date: '2027-03-16', mins: 10 });
	assert.deepEqual(Time.demoNow('2027-03-15 10:05', -5e3), { date: '2027-03-15', mins: 605 }, 'a clock set back never runs it backwards');
	// the live demo moves into the visitor's year by whole weeks: the same weekday, the nearest date
	assert.equal(Time.demoShift('2027-03-13', '2027-10-02'), 0);
	assert.equal(Time.demoShift('2027-03-13', '2026-10-02'), -364);
	for (const [today, start] of [
		['2028-06-01', '2028-03-11'],
		['2029-01-01', '2029-03-10'],
		['2031-12-31', '2031-03-15'],
		['2032-02-29', '2032-03-13'],
	]) {
		const n = Time.demoShift('2027-03-13', today);
		assert.equal(n % 7, 0, `${today}: whole weeks`);
		assert.equal(Time.addDays('2027-03-13', n), start, `${today}: lands on ${start}`);
		assert.equal(Time.weekdayIndex(Time.addDays('2027-03-13', n)), Time.weekdayIndex('2027-03-13'), `${today}: still a Saturday`);
	}
	assert.equal(
		Time.shiftDates('due 2027-03-10, checked 2027-03-01 · at 2027-03-15 10:05 · data from 2026-09-30', 364, '2026-11-13', '2027-07-17'),
		'due 2028-03-08, checked 2028-02-28 · at 2028-03-13 10:05 · data from 2026-09-30',
		'trip-season dates move; a date outside the season (a source) stays',
	);
	assert.equal(Time.shiftDates('2027-03-10', 0, '2027-01-01', '2027-12-31'), '2027-03-10');
	assert.deepEqual(Time.nowIn('Asia/Tokyo', at), { date: '2027-03-14', mins: 150 });
	// each zone keeps its own formatter: asking for one zone never answers in the last one asked
	assert.deepEqual(Time.nowIn('Asia/Taipei', at), { date: '2027-03-14', mins: 90 });
	assert.deepEqual(Time.nowIn('UTC', at), { date: '2027-03-13', mins: 1050 });
	assert.deepEqual(Time.nowIn('Asia/Tokyo', at), { date: '2027-03-14', mins: 150 });
});

test('Money: shares and group markers', () => {
	assert.equal(Money.share(1500, 5), 300);
	assert.equal(Money.share(2250, 5), 450);
	assert.equal(Money.share(1000, 4), 250);
	assert.deepEqual(Money.groupWord(5), ['五人', 'for 5']);
	assert.deepEqual(Money.groupWord(4), ['四人', 'for 4']);
	assert.deepEqual(Money.amountsIn('about **NT$1,200–1,800** each', 'NT$'), [1200, 1800]);
	assert.deepEqual(Money.amountsIn('¥3,000 for 4', '¥'), [3000, 3000]);
	assert.equal(Money.amountsIn('no money here', 'NT$'), null);
});

test('Money: group figures are found, bold or not, and only once', () => {
	const re = () => Money.groupFigureRe('NT$', 5);
	const find = (s) => [...s.matchAll(re())].map((m) => [m[1], m[2], m[3] || null, m[4]]);
	assert.deepEqual(find('NT$1,500–2,250 for 5'), [['NT$1,500–2,250', '1,500', '2,250', ' for 5']]);
	assert.deepEqual(find('NT$800 / 五人'), [['NT$800', '800', null, ' / 五人']]);
	assert.deepEqual(find('NT$600 each, **NT$3,000** for 5'), [['**NT$3,000**', '3,000', null, ' for 5']]);
	assert.deepEqual(find('NT$1,000 for 5 (NT$200 each)'), []); // already shows its share
	assert.deepEqual(find('NT$1,000 for 4'), []); // a different group size
	assert.deepEqual([...'¥8,000 for 4'.matchAll(Money.groupFigureRe('¥', 4))].length, 1);
});

test('Money: a share the text already states is not repeated', () => {
	assert.equal(Money.statesShare('NT$600 each, **NT$3,000** for 5', 'NT$', 3000, 3000, 5), true);
	assert.equal(Money.statesShare('每人 NT$600，五人 **NT$3,000**', 'NT$', 3000, 3000, 5), true);
	assert.equal(Money.statesShare('NT$300–400 each; NT$1,500–2,000 for 5', 'NT$', 1500, 2000, 5), true);
	assert.equal(Money.statesShare('Tickets NT$1,200 for 5', 'NT$', 1200, 1200, 5), false);
	assert.equal(Money.statesShare('NT$6,000 each; dinner NT$3,000 for 5', 'NT$', 3000, 3000, 5), false); // another figure
	assert.equal(Money.statesShare('NT$1,001 for 5', 'NT$', 1001, 1001, 5), false);
});

test('Money: the home-currency line', () => {
	assert.equal(Money.homeText(160, 160, 7.8, 'RM'), '≈ RM 21');
	assert.equal(Money.homeText(1200, 1800, 7.8, 'RM'), '≈ RM 150–230');
	assert.equal(Money.homeText(3000, 3000, 20, 'SGD'), '≈ SGD 150');
	// a range whose ends round to the same figure is one figure
	assert.equal(Money.homeText(160, 162, 7.8, 'RM'), '≈ RM 21');
	assert.equal(Money.homeAmount(1200, 1800, 7.8, 'RM'), 'RM 150–230');
});

test('Money: converted figures claim no more precision than a rate gives', () => {
	assert.equal(Money.roundHome(0), 0);
	assert.equal(Money.roundHome(0.257), 0.3); // one significant figure under 1
	assert.equal(Money.roundHome(0.026), 0.03);
	assert.equal(Money.roundHome(25.6), 26); // whole under 100
	assert.equal(Money.roundHome(2571), 2570); // to 10 under 10,000
	assert.equal(Money.roundHome(27585), 27600); // three significant figures above
	assert.equal(Money.roundHome(509090), 509000);
	assert.equal(Money.homeAmount(10, 10, 38.97, 'RM'), 'RM 0.3');
	assert.equal(Money.homeAmount(781000, 1075000, 38.97, 'RM'), 'RM 20,000–27,600');
});

test('Money: which trips can show their figures in the home currency', () => {
	assert.equal(Money.canSwitch({ sym: '¥', home: 'RM', rate: 38.97 }), true);
	assert.equal(Money.canSwitch({ sym: 'NT$', home: 'NT$', rate: 1 }), false); // the same currency
	assert.equal(Money.canSwitch({ sym: '¥', rate: 1 }), false); // no home currency
	assert.equal(Money.canSwitch({ sym: '¥', home: 'RM', rate: 0 }), false);
	assert.equal(Money.canSwitch(undefined), false);
});

test('Money: amounts in a text, found and converted', () => {
	const home = (t, sym = '¥', rate = 40, h = 'RM') => Money.toHome(t, sym, rate, h);
	// Chinese and English text, commas, decimals, ranges kept as ranges, ≈ added only where nothing says "rough" yet
	assert.equal(home('每人 ¥1,000'), '每人 ≈ RM 25');
	assert.equal(home('门票 ¥2,000，晚餐另计'), '门票 ≈ RM 50，晚餐另计');
	assert.equal(home('≈ ¥56,000–90,000'), '≈ RM 1,400–2,250');
	assert.equal(home('约 ¥4,000–6,000 / 四人'), '约 RM 100–150 / 四人');
	assert.equal(home('about ¥4,000–6,000 each'), 'about RM 100–150 each');
	assert.equal(home('~¥15,000 for 4'), '~RM 380 for 4');
	assert.equal(home('Bus ¥3.5k, taxi ¥1.2万'), 'Bus ≈ RM 88, taxi ≈ RM 300');
	assert.equal(home('¥1,000~¥2,000, ¥500-800'), '≈ RM 25–50, ≈ RM 13–20');
	assert.equal(home('¥3,000+ before tax'), '≈ RM 75+ before tax');
	assert.equal(home('**¥7,200** / 四人'), '**≈ RM 180** / 四人');
	assert.equal(home('约 **¥7,200**'), '约 **RM 180**');
	assert.equal(home('Free (¥0)'), 'Free (RM 0)');
	// another symbol: NT$, with its own rate
	assert.equal(home('NT$400–600 a car', 'NT$', 7.8), '≈ RM 51–77 a car');
	assert.equal(home('门票每人 NT$600，NT$3,000 / 五人', 'NT$', 7.8), '门票每人 ≈ RM 77，≈ RM 380 / 五人');
	// the writer's own home-currency note isn't repeated once the figure is in the home currency
	assert.equal(home('¥60,000（≈ RM 1,540），另问'), '≈ RM 1,500，另问');
	assert.equal(home('¥60,000 (≈ RM 1,540); ask'), '≈ RM 1,500; ask');
	// never converted: other currencies, a symbol glued to letters, times, distances, counts, a symbol with no number
	assert.equal(home('约 USD 500（≈ RM 2,100）'), '约 USD 500（≈ RM 2,100）');
	assert.equal(home('CN¥100, JP¥100'), 'CN¥100, JP¥100');
	assert.equal(home('NT$400', '$', 3.4, 'S$'), 'NT$400');
	assert.equal(home('S$50 or $50', '$', 3.4, 'S$'), 'S$50 or ≈ S$ 15');
	assert.equal(home('10:30–11:00, 5 km, 4人, 搜索：温泉、¥、拉面'), '10:30–11:00, 5 km, 4人, 搜索：温泉、¥、拉面');
	assert.equal(home('RM 2,000 / 四人'), 'RM 2,000 / 四人');
	// "¥1,000-3人" isn't a range: the figure alone converts
	assert.equal(home('¥1,000-3人'), '≈ RM 25-3人');
});

test('Money: each amount handed over with what it says', () => {
	const seen = [];
	const out = Money.mapAmounts('约 ¥1,000–2,000 / 4, ¥300 (≈ RM 8)', '¥', (a) => (seen.push(a), '#'), 'RM');
	assert.equal(out, '约 # / 4, #'); // the words before a figure stay; only the figure is handed over
	assert.deepEqual(seen, [
		{ text: '¥1,000–2,000', lo: 1000, hi: 2000, approx: true, plus: false, note: '' },
		{ text: '¥300', lo: 300, hi: 300, approx: false, plus: false, note: ' (≈ RM 8)' },
	]);
	// without a home currency, a bracket after a figure is the text's own
	assert.equal(
		Money.mapAmounts('¥300 (≈ RM 8)', '¥', () => '#'),
		'# (≈ RM 8)',
	);
});

test('Plan: flight-tied times', () => {
	assert.equal(Plan.depMinutes(20), 1460); // 00:20 take-off counts as the next day
	assert.equal(Plan.depMinutes(22 * 60), 1320);
	// landing 13:30 (810): +65..+110, and an item that is never before 18:30
	assert.deepEqual(Plan.relMinutes({ arr: [65, 110] }, 810, 1485, false), { a: 875, b: 920 });
	assert.deepEqual(Plan.relMinutes({ arr: [245], min: 1110 }, 810, 1485, false), { a: 1110, b: null });
	// take-off 00:45 (1485): 305 min before, on the evening before; on the take-off day itself the clock is a day on
	assert.deepEqual(Plan.relMinutes({ dep: [-305] }, 810, 1485, false), { a: 1180, b: null });
	assert.deepEqual(Plan.relMinutes({ dep: [0] }, 810, 1485, true), { a: 45, b: null });
	assert.deepEqual(Plan.relMinutes({ dep: [null, -440] }, 810, 1485, false), { a: null, b: 1045 });
});

test('Plan: a push-back stops at the next fixed time', () => {
	const fixed = [1150, 1170]; // 19:10 and 19:30 are fixed
	const pushes = [{ from: 870, min: 60 }];
	assert.equal(Plan.shiftAt(fixed, 660, pushes), 0, 'before the push');
	assert.equal(Plan.shiftAt(fixed, 870, pushes), 60);
	assert.equal(Plan.shiftAt(fixed, 1080, pushes), 60);
	assert.equal(Plan.shiftAt(fixed, 1200, pushes), 0, 'after a fixed time');
	assert.equal(Plan.shiftAt(fixed, 1080, [...pushes, { from: 900, min: 15 }]), 75, 'pushes add up');
	assert.deepEqual(Plan.validPushes([{ from: 870, min: 30 }, { from: null, min: 5 }, { from: 900, min: 0 }, null]), [{ from: 870, min: 30 }]);
	assert.equal(Plan.validPushes('junk').length, 0);
});

test('Plan: an added stop near a fixed time', () => {
	const fixed = [
		{ s: 1150, e: null, id: 'meet' },
		{ s: 1170, e: 1260, id: 'concert' },
	];
	assert.equal(Plan.nearFixed(1140, fixed)?.id, 'meet'); // 19:00, 10 min before 19:10
	assert.equal(Plan.nearFixed(1100, fixed), null); // 18:20 is 50 min before 19:10, outside the 45-min window
	assert.equal(Plan.nearFixed(1240, fixed)?.id, 'concert'); // during it
	assert.equal(Plan.nearFixed(900, fixed), null);
});

test('Plan: an added stop slots in by time; an untimed last row (back to the hotel) stays last', () => {
	const day = [
		{ s: 600, e: 690 }, // 10:00–11:30
		{ s: 960, e: 1170 }, // 16:00–19:30
		{ s: null, e: null }, // Evening: back to the hotel
	];
	assert.equal(Plan.slotFor(day, 1020), 2, '17:00: inside the 16:00–19:30 block, before going back');
	assert.equal(Plan.slotFor(day, 1230), 2, '20:30: still before the untimed last row');
	assert.equal(Plan.slotFor(day, 480), 0, '08:00: first');
	assert.equal(Plan.slotFor(day, 960), 2, 'a tie goes after the row that starts then');
	const middle = [
		{ s: 600, e: 720 },
		{ s: null, e: null },
		{ s: 900, e: null },
	]; // 10:00–12:00, Lunch, 15:00
	assert.equal(Plan.slotFor(middle, 690), 1, 'an untimed row in the middle starts when the row before ends');
	assert.equal(Plan.slotFor(middle, 750), 2);
	assert.equal(Plan.slotFor([{ s: 600, e: null }], 700), 1, 'after the last timed row: at the end');
});

test('Plan: "+" under a stop suggests a time that lands right after it', () => {
	assert.equal(Plan.gapTime(960, 1170, null), 1170, 'the end of 16:00–19:30');
	assert.equal(Plan.gapTime(600, 690, 690), 675, 'ends when the next starts: just before it');
	assert.equal(Plan.gapTime(600, null, 615), 607, 'very close: between the two');
	assert.equal(Plan.gapTime(null, null, 600), 570, 'no time of its own: before the next');
	assert.equal(Plan.gapTime(null, null, null), null);
	assert.equal(Plan.gapTime(1410, null, null), 1425, 'never past 23:45');
	const rows = Plan.effectiveRows([
		{ s: 960, e: 1170 },
		{ s: null, e: null },
	]);
	assert.deepEqual(rows[1], { s: 1170, e: null, closes: true }, 'an untimed last row starts when the one before ends, and closes the day');
	assert.equal(Plan.effectiveRows([{ s: null, e: null }])[0].closes, false, 'a day with no times at all has no closing row');
	assert.equal(
		Plan.slotFor(
			[
				{ s: null, e: null },
				{ s: null, e: null },
			],
			600,
		),
		2,
		'and its added stops go at the end',
	);
});

test('Plan: the last day runs past midnight, and stops after the late check-in still slot before the flight', () => {
	const last = [
		{ s: 660, e: null },
		{ s: 1255, e: 1285 },
		{ s: 45, e: null },
	]; // 11:00, 20:55–21:25, 00:45
	assert.deepEqual(
		Plan.onOneClock(last).map((r) => r.s),
		[660, 1255, 1485],
	);
	assert.equal(Plan.slotFor(last, 1290), 2, '21:30: after the check-in, before the 00:45 flight');
	assert.equal(Plan.slotFor(last, 15), 2, '00:15: after midnight, still before the flight');
	assert.equal(Plan.minuteOn(last, 420), 420, '07:00 stays morning');
	assert.equal(Plan.minuteOn(last, 60), 1500);
	assert.equal(Plan.onOneClock([{ s: 1380, e: 60 }])[0].e, 1500, 'an end before its start is the next morning');
});

test('Plan: a "+" only where a stop can go right after: not before a row that starts at the same minute', () => {
	assert.deepEqual(
		Plan.roomAfter([
			{ s: 630, e: null }, // 10:30 Arrive in Tamsui
			{ s: 630, e: 735 }, // 10:30–12:15 Old Street
			{ s: 735, e: 810 }, // 12:15–13:30 Lunch
			{ s: null, e: null }, // Evening: back to the hotel
		]),
		[false, true, true, false],
	);
});

test('Plan: day roles come from the trip, any length', () => {
	const days = (n) => Array.from({ length: n }, (_, i) => ({ id: `d${i + 1}`, date: `2027-03-${String(13 + i).padStart(2, '0')}` }));
	// an after-midnight take-off: the group leaves on the evening before; the last day holds only the flight
	assert.deepEqual(Plan.dayRoles(days(7), { dep: '00:45', date: '2027-03-19' }), { arrive: 'd1', leave: 'd6', flight: 'd7', free: 'd6' });
	assert.deepEqual(Plan.dayRoles(days(4), { dep: '00:45', date: '2027-03-16' }), { arrive: 'd1', leave: 'd3', flight: 'd4', free: 'd3' });
	// an evening flight: the last day is both the airport evening and the flight
	assert.deepEqual(Plan.dayRoles(days(3), { dep: '21:10', date: '2027-03-15' }), { arrive: 'd1', leave: 'd3', flight: null, free: 'd3' });
	// the free-time day is whichever day the data marks
	const marked = days(5).map((d) => (d.id === 'd2' ? { ...d, freeFrom: '14:00' } : d));
	assert.equal(Plan.dayRoles(marked, { dep: '10:00', date: '2027-03-17' }).free, 'd2');
});

test('Plan: one hotel for the trip, or one per night', () => {
	const days = ['d1', 'd2', 'd3', 'd4'].map((id) => ({ id }));
	assert.deepEqual(Plan.hotelsByDay(days), { d1: 'hotel', d2: 'hotel', d3: 'hotel', d4: 'hotel' });
	assert.deepEqual(Plan.hotelsByDay(days, 'inn'), { d1: 'inn', d2: 'inn', d3: 'inn', d4: 'inn' });
	// moving on night 3: the new hotel from then on, the leave day keeps where the bags are
	days[2].hotel = 'onsen';
	assert.deepEqual(Plan.hotelsByDay(days, 'inn'), { d1: 'inn', d2: 'inn', d3: 'onsen', d4: 'onsen' });
});

test('Plan: an added stop’s time is checked against getting there and getting on', () => {
	// a shop in Ximending at 17:00, during 16:00–19:30 there: reached from 16:00, a 6-min walk: fine
	const shop = Plan.legCheck({ at: 1020, from: { start: 960, end: 1170 }, go: { walk: 6, taxi: 12 }, next: null });
	assert.deepEqual([shop.best.mode, shop.short, shop.tight], ['walk', 0, false]);
	// 19:35 at a place 40 min away by MRT, 25 by taxi, after 16:00–19:30: earliest 19:55, 20 min short
	const far = Plan.legCheck({ at: 1175, from: { start: 960, end: 1170 }, go: { walk: 90, taxi: 25, mrt: 40 }, next: null });
	assert.deepEqual([far.best.mode, far.earliest, far.short], ['taxi', 1195, 20]);
	// the 20:00 show is 30 min on from there: leave by 19:30, so a 19:45 stop can't make it
	const show = Plan.legCheck({ at: 1185, from: null, go: null, next: 1200, onward: { walk: 50, taxi: 30 } });
	assert.deepEqual([show.leaveBy, show.tight, show.onBest.mode], [1170, true, 'taxi']);
	assert.equal(Plan.legCheck({ at: 600, from: null, go: null, next: null }).best, null, 'nothing to check against');
	assert.equal(Plan.legCheck({ at: 1170, from: { start: 960, end: 1170 }, go: { walk: 4 } }).short, 0, 'a few minutes short: no word');
});

test('Wrap: a number range or a phone number stays on one line', () => {
	const k = (s) => Wrap.keepRanges(s).replace(/<span class="rng">(.*?)<\/span>/g, '[$1]');
	assert.equal(k('NT$110–150 each'), 'NT$[110–150 each]'); // a short unit goes with it
	assert.equal(k('约60–75分钟'), '约[60–75分钟]');
	assert.equal(k('Mon–Fri 08:00–23:00'), 'Mon–Fri [08:00–23:00]'); // days are words, not numbers
	assert.equal(k('runs 09/30–11/14'), 'runs [09/30–11/14]');
	assert.equal(k('60–75 minutes'), '[60–75] minutes'); // a long word stays free
	assert.equal(k('Tel 02-2629-6860.'), 'Tel [02-2629-6860].');
	assert.equal(k('from 2026-09-30, 6-7 min'), 'from [2026-09-30], [6-7 min]');
	assert.equal(k('免费收惊（11:20-18:30）'), '免费收惊（[11:20-18:30]）'); // a plain hyphen between times
	assert.equal(k('105巷4-9號4-8號'), '105巷[4-9]號[4-8號]'); // a unit runs only to the next number
	assert.equal(k('Tel +886 2 2557 5379.'), 'Tel [+886 2 2557 5379].'); // spaced, after a country code
	assert.equal(k('WhatsApp +886 981 521 124 or Line'), 'WhatsApp [+886 981 521 124] or Line');
	assert.equal(k('call (02)2536-4459 or (02) 2883 9684'), 'call [(02)2536-4459] or [(02) 2883 9684]'); // an area code in brackets
	assert.equal(k('3 cars 2 hours, room 12 3'), '3 cars 2 hours, room 12 3'); // spaced digits alone stay free
	assert.equal(k('D3 at 19:00, A1 B1'), 'D3 at 19:00, A1 B1'); // a lone time or code: nothing to keep together
	assert.equal(k('a &amp; b, &#39;x&#39;'), 'a &amp; b, &#39;x&#39;'); // escaped entities are left alone
});

test("Plan: a stored route leg's times only while it still joins the same stops", () => {
	const legs = {
		'd3:1': { min: 14, from: 'canal', to: 'street', mode: 'walking' },
		'd3:2': { min: 20, from: 'street', to: 'museum', mode: 'walking' },
		'd2:0': { min: 9 }, // stored before the refresh recorded the ends
	};
	assert.equal(Plan.storedLeg(legs, 'd3', 1, ['canal', 'street', 'walking']).min, 14);
	// the day was reordered: position 2 now joins other stops, so no time rather than another leg's
	assert.equal(Plan.storedLeg(legs, 'd3', 2, ['station', 'market', 'walking']), null);
	assert.equal(Plan.storedLeg(legs, 'd3', 1, ['canal', 'street', 'driving']), null); // same stops, another way
	// a stop before it was removed or added: the same two stops, the same way, at another position of the day keep their time
	assert.equal(Plan.storedLeg(legs, 'd3', 0, ['street', 'museum', 'walking']).min, 20);
	assert.equal(Plan.storedLeg(legs, 'd3', 3, ['canal', 'street', 'walking']).min, 14);
	assert.equal(Plan.storedLeg(legs, 'd4', 1, ['street', 'museum', 'walking']), null); // never another day's
	assert.equal(Plan.storedLeg(legs, 'd2', 0, ['a', 'b', 'transit']).min, 9);
	assert.equal(Plan.storedLeg(legs, 'd4', 0, ['a', 'b', 'transit']), null);
	assert.equal(Plan.storedLeg(undefined, 'd1', 0, ['a', 'b', 'walking']), null);
	// a leg Google can't time (a train in Japan): the trip's own minutes, only while Google has none for it
	assert.deepEqual(Plan.storedLeg(undefined, 'd1', 0, ['a', 'b', 'transit', 90]), { min: 90, own: true });
	assert.deepEqual(Plan.storedLeg({}, 'd1', 0, ['a', 'b', 'transit', '10:00', 37]), { min: 37, own: true });
	assert.equal(Plan.storedLeg(legs, 'd2', 0, ['a', 'b', 'transit', 40]).min, 9); // Google's time wins
	assert.equal(Plan.storedLeg({}, 'd1', 0, ['a', 'b', 'driving', '16:55']), null); // an 'HH:MM' is not minutes
});

// a made-up city on a grid: 0.01° of latitude is about 1.1 km
const at = (dLat, dLng = 0) => ({ lat: 35 + dLat, lng: 139 + dLng });
const PLACE = at(0);

test('Fit: distance bands and the room after a stop', () => {
	assert.ok(Math.abs(Fit.distKm(at(0), at(0.01)) - 1.112) < 0.01);
	assert.equal(Fit.band(0.5), 0); // a short walk
	assert.equal(Fit.band(0.7), 0);
	assert.equal(Fit.band(2), 1); // a short ride
	assert.equal(Fit.band(7.9), 2);
	assert.equal(Fit.band(12), Fit.BANDS.length); // far
	// 10:00–12:00, next timed stop 14:00: two free hours
	assert.equal(Fit.freeAfter(600, 720, [540, 600, 840]), 120);
	// no end counts an hour; nothing timed after it runs to the evening
	assert.equal(Fit.freeAfter(1080, null, [600, 1080]), Fit.DAY_END - 1140);
	assert.equal(Fit.freeAfter(1290, 1320, []), 0); // already past the evening
	assert.equal(Fit.freeAfter(null, null, [600]), null);
});

test('Fit: each day measured from its nearest stop, hotels and past stops left out', () => {
	const days = [
		{
			id: 'd1',
			stops: [
				{ ...at(0.002), hotel: true },
				{ ...at(0.05), name: 'far' },
			],
		},
		{
			id: 'd2',
			stops: [
				{ ...at(0.004), name: 'near', room: 30 },
				{ ...at(0.02), name: 'mid' },
			],
		},
		{
			id: 'd3',
			stops: [
				{ ...at(0.001), past: true },
				{ ...at(0.03), name: 'later' },
			],
		},
		{ id: 'd4', stops: [{ lat: null, lng: null, name: 'no position' }] },
	];
	const { rows } = Fit.fitDays(PLACE, days);
	assert.deepEqual(
		rows.map((r) => [r.id, r.stop.name]),
		[
			['d2', 'near'],
			['d3', 'later'],
			['d1', 'far'],
		],
		'nearest first; a day with nothing to measure from is left out',
	);
});

test('Fit: the best day is the nearest band, then room after the stop, then the nearer', () => {
	const day = (id, dLat, extra = {}, stop = {}) => ({ id, stops: [{ ...at(dLat), ...stop }], ...extra });
	// both a short walk away: the one with two free hours after its stop beats the one 200 m nearer without
	let f = Fit.fitDays(PLACE, [day('d1', 0.002, {}, { room: 20 }), day('d2', 0.004, {}, { room: 120 })]);
	assert.equal(f.best.id, 'd2');
	assert.equal(f.best.roomy, true);
	// a short walk without room still beats a ride with room
	f = Fit.fitDays(PLACE, [day('d1', 0.003, {}, { room: 0 }), day('d2', 0.02, {}, { room: 200 })]);
	assert.equal(f.best.id, 'd1');
	// free time counts as room; a crowded day (four added stops) has none
	f = Fit.fitDays(PLACE, [day('d1', 0.002, { crowded: true }, { room: 300 }), day('d2', 0.005, {}, { free: true })]);
	assert.equal(f.best.id, 'd2');
	// same band, same room: the nearer
	f = Fit.fitDays(PLACE, [day('d1', 0.005), day('d2', 0.003)]);
	assert.equal(f.best.id, 'd2');
});

test('Fit: closed, already planned and past days are listed but never suggested; far is flagged', () => {
	const f = Fit.fitDays(PLACE, [
		{ id: 'd1', closed: true, stops: [at(0.001)] },
		{ id: 'd2', planned: true, stops: [at(0.002)] },
		{ id: 'd3', over: true, stops: [at(0.003)] },
		{ id: 'd4', stops: [at(0.1)] },
	]);
	assert.deepEqual(
		f.rows.map((r) => [r.id, r.ok]),
		[
			['d1', false],
			['d2', false],
			['d3', false],
			['d4', true],
		],
	);
	assert.equal(f.best.id, 'd4');
	assert.equal(f.far, true, '11 km from every stop it could join');
	const none = Fit.fitDays(PLACE, [{ id: 'd1', closed: true, stops: [at(0.001)] }]);
	assert.equal(none.best, null);
	assert.equal(none.far, false);
	assert.deepEqual(Fit.fitDays(PLACE, []), { rows: [], best: null, far: false });
});

test('Sky: which sky a page draws, a forecast as its weather, and how much falls', () => {
	// the trip's choice in a world with a sky, else the world's; a world without one draws none whatever the trip says
	assert.equal(Sky.modeFor(undefined, 'live'), 'live');
	assert.equal(Sky.modeFor('globe', 'live'), 'globe');
	assert.equal(Sky.modeFor('off', 'live'), 'off');
	assert.equal(Sky.modeFor('pile', null), 'off');
	assert.equal(Sky.modeFor('snowstorm', 'live'), 'live');
	// no forecast: a light snowfall; clear by day or a clear night after dark; rain reads as showers in a snow world
	assert.equal(Sky.kindOf(null), Sky.DEFAULT_KIND);
	assert.equal(Sky.kindOf(0), 'clear');
	assert.equal(Sky.kindOf(1, true), 'night');
	assert.equal(Sky.kindOf(3, true), 'light');
	assert.equal(Sky.kindOf(61), 'shower');
	assert.equal(Sky.kindOf(71), 'light');
	assert.equal(Sky.kindOf(75), 'heavy');
	assert.equal(Sky.kindOf(85), 'shower');
	assert.equal(Sky.kindOf(86), 'heavy');
	for (let c = 0; c <= 99; c++) assert.ok(Sky.KINDS.includes(Sky.kindOf(c)), `code ${c}`);
	assert.ok(Sky.isNight(18 * 60) && Sky.isNight(5 * 60 + 59) && !Sky.isNight(6 * 60) && !Sky.isNight(17 * 60 + 59));
	// every weather has its fall and its words in both languages
	for (const k of Sky.KINDS) assert.ok(Sky.FALL[k], k);
	for (const c of [0, 2, 45, 61, 71, 73, 75, 85, 95]) {
		const w = Sky.wordFor(c);
		assert.ok(w.name[0] && w.name[1] && w.icon, `code ${c}`);
	}
	assert.equal(Sky.wordFor(0, true).icon, 'moon');
	// the cap holds whatever the screen: a phone's band 110 flakes, a desktop's sky 240
	assert.equal(Sky.flakesFor(Sky.FALL.heavy, 390 * 844, Sky.CAP.phone), 110);
	assert.equal(Sky.flakesFor(Sky.FALL.heavy, 2560 * 1440, Sky.CAP.desk), 240);
	assert.equal(Sky.flakesFor(Sky.FALL.night, 1e6, 240), 0);
	assert.ok(Sky.flakesFor(Sky.FALL.light, 390 * 300, 110) < Sky.flakesFor(Sky.FALL.heavy, 390 * 300, 110));
	// the globe snows its own snow whatever the weather, but keeps a clear night's stars
	assert.equal(Sky.fallFor('globe', 'heavy').dens, Sky.GLOBE.dens);
	assert.equal(Sky.fallFor('globe', 'night').stars, 1);
	assert.equal(Sky.fallFor('live', 'heavy'), Sky.FALL.heavy);
	// a shake settles: its energy is under a tenth after SETTLE seconds
	assert.ok(Math.exp(-Sky.SETTLE / Sky.TAU) < 0.1);
});

test('Way: the walk or ride Google measures to a place, in the group’s minutes', () => {
	// a walk up to the page's 20 minutes at the group's pace; past it, a ride (taxi first for seniors)
	assert.equal(Way.modeFor(20), 'WALK');
	assert.equal(Way.modeFor(20.5), 'DRIVE');
	const at = (lat, lng) => ({ latitude: lat, longitude: lng });
	const json = {
		places: [
			{ id: 'g-far', location: at(43.07, 141.36) },
			{ id: 'g-here', location: at(43.0601, 141.3501) },
		],
		routingSummaries: [{ legs: [{ duration: '1200s', distanceMeters: 2000 }] }, { legs: [{ duration: '600s', distanceMeters: 800 }] }],
	};
	// a Google result is found by its id; a trip place without one by the nearest result within 150 m of its pin
	assert.equal(Way.pickIndex(json.places, { gpid: 'g-here' }), 1);
	assert.equal(Way.pickIndex(json.places, { lat: 43.06, lng: 141.35 }), 1);
	assert.equal(Way.pickIndex(json.places, { lat: 43.1, lng: 141.4 }), -1, 'nothing near the pin is the place');
	assert.equal(Way.pickIndex(json.places, { gpid: 'g-gone' }), -1);
	// a walk in the group's minutes (Google's 10 min × 1.4); a ride's minutes as Google gives them
	assert.deepEqual(Way.legOf(json, { gpid: 'g-here' }, 'WALK', 1.4), { m: 800, min: 14, mode: 'WALK' });
	assert.deepEqual(Way.legOf(json, { gpid: 'g-here' }, 'DRIVE', 1.4), { m: 800, min: 10, mode: 'DRIVE' });
	// a place Google didn't find, a summary without a leg, or an answer without places says nothing
	assert.equal(Way.legOf(json, { gpid: 'g-gone' }, 'WALK', 1.4), null);
	assert.equal(Way.legOf({ places: json.places, routingSummaries: [{}, {}] }, { gpid: 'g-here' }, 'WALK', 1.4), null);
	assert.equal(Way.legOf({}, { gpid: 'g-here' }, 'WALK', 1.4), null);
	// next door still reads a minute, never zero
	assert.equal(
		Way.legOf({ places: [{ id: 'x' }], routingSummaries: [{ legs: [{ duration: '20s', distanceMeters: 15 }] }] }, { gpid: 'x' }, 'WALK', 1.4).min,
		1,
	);
});
