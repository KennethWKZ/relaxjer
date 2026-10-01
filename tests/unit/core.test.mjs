// Unit tests for the engine's pure modules (engine/src/core). Expected values are what the page showed before the logic
// was pulled out of app.js, so these pin today's behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Time from '../../engine/src/core/time.mjs';
import * as Money from '../../engine/src/core/money.mjs';
import * as Plan from '../../engine/src/core/plan.mjs';

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
