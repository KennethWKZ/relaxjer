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
  const fixed = [{ s: 1150, e: null, id: 'meet' }, { s: 1170, e: 1260, id: 'concert' }];
  assert.equal(Plan.nearFixed(1140, fixed)?.id, 'meet'); // 19:00, 10 min before 19:10
  assert.equal(Plan.nearFixed(1100, fixed), null); // 18:20 is 50 min before 19:10, outside the 45-min window
  assert.equal(Plan.nearFixed(1240, fixed)?.id, 'concert'); // during it
  assert.equal(Plan.nearFixed(900, fixed), null);
});
