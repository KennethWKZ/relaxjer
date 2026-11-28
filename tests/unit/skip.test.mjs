// Skipping a planned stop (ADR-20261128-skip-planned-stops): which stops can be skipped (never a flight or the lodging),
// each stop's key, the closed-that-day check, the suggestion to move the next stops earlier, the route without a skipped
// place, and the skip as a group-sync record and on Recently removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Plan from '../../engine/src/core/plan.mjs';
import * as Sync from '../../engine/src/core/sync.mjs';

const day = {
	id: 'd3',
	schedule: [
		{ t: '09:00', what: ['酒店早餐', 'Breakfast at the hotel'], place: 'hotel' },
		{ t: '10:00–11:30', what: ['温泉博物馆', 'Hot spring museum'], place: 'museum' },
		{ t: '12:00', what: ['午餐', 'Lunch'] },
		{ t: '12:00', what: ['午餐', 'Lunch'] }, // written the same twice
	],
};

test('Plan: each planned stop has a key of its own, from the stop as the data writes it', () => {
	const keys = Plan.stopKeys(day);
	assert.equal(keys.length, 4);
	for (const k of keys) assert.match(k, Plan.SKIP_KEY);
	assert.ok(keys.every((k) => k.startsWith('d3-')));
	assert.equal(keys[3], `${keys[2]}-2`, 'a stop written the same twice gets -2');
	assert.equal(new Set(keys).size, 4);
	// the same stop keeps its key; a planner who changes its time, its name or its place makes a new one
	assert.deepEqual(Plan.stopKeys(structuredClone(day)), keys);
	const moved = structuredClone(day);
	moved.schedule[1].t = '10:30–12:00';
	assert.notEqual(Plan.stopKeys(moved)[1], keys[1]);
	const renamed = structuredClone(day);
	renamed.schedule[1].what = ['温泉博物馆', 'Hot Spring Museum'];
	assert.notEqual(Plan.stopKeys(renamed)[1], keys[1]);
	// a note isn't part of it: fixing a typo in it keeps the skip
	const noted = structuredClone(day);
	noted.schedule[1].note = ['周一休', 'Closed Mondays'];
	assert.equal(Plan.stopKeys(noted)[1], keys[1]);
	// another day's same stop is another key
	assert.notEqual(Plan.stopKeys({ ...day, id: 'd4' })[1], keys[1]);
});

test('Plan: every stop can be skipped but a flight and the lodging', () => {
	const opts = { hotels: ['hotel', 'onsenInn'], terminals: ['tpe1'] };
	const can = (it, o = opts) => Plan.skippable(it, o);
	assert.equal(can({ t: '10:00', what: ['寺', 'Temple'], place: 'temple' }), true);
	assert.equal(can({ t: '19:30', what: ['音乐会', 'Concert'], place: 'hall', fixed: true }), true, 'a fixed time can, after a second ask');
	assert.equal(can({ t: '12:00', what: ['午餐', 'Lunch'] }), true, 'a stop with no place');
	assert.equal(can({ t: '13:30', what: ['落地', 'Land'], place: 'tpe1', rel: { arr: [0] }, fixed: true }), false, 'landing');
	assert.equal(can({ what: ['出关', 'Immigration'], place: 'tpe1', rel: { arr: [15, 65] } }), false, 'tied to the flight');
	assert.equal(can({ what: ['去机场', 'Leave for the airport'], place: 'hotel', rel: { dep: [-305] } }), false, 'leaving for the airport');
	assert.equal(can({ t: '20:55', what: ['值机', 'Check in'], place: 'tpe1' }), false, 'at a terminal');
	assert.equal(can({ t: '15:20', what: ['入住', 'Check-in'], place: 'hotel' }), false, 'the hotel');
	assert.equal(can({ t: '11:00', what: ['退房', 'Check out'], place: 'hotel', fixed: true }), false, 'checkout');
	assert.equal(can({ t: '17:00', what: ['回酒店', 'Back to the hotel'], place: 'onsenInn' }), false, "another night's lodging");
	assert.equal(can({ t: '22:00', what: ['回酒店', 'Back to the hotel'], icon: 'bed' }), false, 'marked bed, no place');
	assert.equal(can({ t: '06:00', what: ['飞', 'Fly'], icon: 'plane' }), false, 'marked plane, no place');
	assert.equal(can({ t: '22:00', what: ['回酒店', 'Back to the hotel'] }), true, "the words aren't read: no place, no kind, skippable");
	assert.equal(can({ t: '05:25', what: ['落地', 'Land'] }, { ...opts, flightDay: true }), false, 'the day of only the flight home');
	assert.equal(can(null), false);
	assert.equal(can({ t: '10:00', what: ['寺', 'Temple'], place: 'temple' }, undefined), true, 'no hotels or terminals known');
});

test('Plan: a place shut on a trip date, from the data refresh', () => {
	assert.equal(Plan.closedOn({ closed_dates: ['2027-03-15'] }, '2027-03-15'), true);
	assert.equal(Plan.closedOn({ closed_dates: ['2027-03-15'] }, '2027-03-16'), false);
	assert.equal(Plan.closedOn({ hours_en: 'closed Mon' }, '2027-03-15'), false, 'only the dates the refresh worked out');
	assert.equal(Plan.closedOn(null, '2027-03-15'), false);
	assert.equal(Plan.closedOn({ closed_dates: ['2027-03-15'] }, ''), false);
});

test('Plan: after a skip, the next stops can start about when the skipped one began', () => {
	const r = (s, e = null, more = {}) => ({ s, e, fixed: false, skip: false, still: false, ...more });
	// 12:00–13:30 lunch, 13:30–15:00 skipped, 15:00–17:00 soak, 18:00 dinner
	const rows = [r(720, 810), r(810, 900, { skip: true }), r(900, 1020), r(1080)];
	assert.deepEqual(Plan.pullEarlier(rows, 1), { at: 2, min: 90 }, 'by the skipped stop’s length');
	// no end: to the skipped stop's start
	assert.deepEqual(Plan.pullEarlier([r(600, 660), r(1110, null, { skip: true }), r(1170)], 1), { at: 2, min: 60 });
	// never before the stop before it ends
	assert.deepEqual(Plan.pullEarlier([r(600, 700), r(660, 720, { skip: true }), r(720)], 1), { at: 2, min: 20 });
	// never into the past: it's 14:40 and the soak is at 15:00
	assert.deepEqual(Plan.pullEarlier(rows, 1, 880), { at: 2, min: 20 });
	assert.equal(Plan.pullEarlier(rows, 1, 895), null, 'five minutes is nothing to gain');
	// whole 5 minutes, at most 3 h
	assert.deepEqual(Plan.pullEarlier([r(480), r(600, 677, { skip: true }), r(700)], 1), { at: 2, min: 75 });
	assert.deepEqual(Plan.pullEarlier([r(480), r(540, 800, { skip: true }), r(800)], 1), { at: 2, min: 180 });
	// a fixed time never moves, nor a flight-tied one
	assert.equal(Plan.pullEarlier([r(600), r(660, 720, { skip: true }), r(720, null, { fixed: true })], 1), null);
	assert.equal(Plan.pullEarlier([r(600), r(660, 720, { skip: true }), r(720, null, { still: true })], 1), null);
	// skipped stops after it are passed over; nothing after it, nothing to move
	assert.deepEqual(Plan.pullEarlier([r(600), r(660, 720, { skip: true }), r(720, null, { skip: true }), r(780)], 1), { at: 3, min: 60 });
	assert.equal(Plan.pullEarlier([r(600), r(660, 720, { skip: true })], 1), null);
	assert.equal(Plan.pullEarlier([r(null), r(null, null, { skip: true }), r(780)], 1), null, 'an untimed stop');
});

test('Plan: the route goes round a skipped place, by a ride when either way was one', () => {
	const legs = [
		['hotel', 'museum', 'transit', '09:30', 30],
		['museum', 'valley', 'walking'],
		['valley', 'soak', 'walking'],
		['soak', 'hotel', 'transit'],
	];
	assert.deepEqual(Plan.routeWithout(legs, new Set(['valley'])), [
		['hotel', 'museum', 'transit', '09:30', 30],
		['museum', 'soak', 'walking'],
		['soak', 'hotel', 'transit'],
	]);
	assert.deepEqual(Plan.routeWithout(legs, new Set(['museum'])), [
		['hotel', 'valley', 'transit'],
		['valley', 'soak', 'walking'],
		['soak', 'hotel', 'transit'],
	]);
	assert.deepEqual(Plan.routeWithout(legs, new Set(['valley', 'soak'])), [
		['hotel', 'museum', 'transit', '09:30', 30],
		['museum', 'hotel', 'transit'],
	]);
	// out and back to one skipped place: both legs go; the last place skipped: the route ends before it
	assert.deepEqual(
		Plan.routeWithout(
			[
				['hotel', 'x', 'walking'],
				['x', 'hotel', 'walking'],
			],
			new Set(['x']),
		),
		[],
	);
	assert.deepEqual(
		Plan.routeWithout(
			[
				['hotel', 'a', 'transit'],
				['a', 'x', 'walking'],
			],
			new Set(['x']),
		),
		[['hotel', 'a', 'transit']],
	);
	// a route that starts at a skipped place starts at the next
	assert.deepEqual(
		Plan.routeWithout(
			[
				['x', 'a', 'walking'],
				['a', 'b', 'transit'],
			],
			new Set(['x']),
		),
		[['a', 'b', 'transit']],
	);
	assert.equal(Plan.routeWithout(legs, new Set()), legs, 'nothing skipped: the same legs');
	assert.equal(Plan.routeWithout(undefined, new Set(['x'])), undefined);
	// the new leg has no stored minutes until the next refresh (storedLeg finds no leg joining those two)
	const LT = { 'd3:0': { from: 'hotel', to: 'museum', mode: 'transit', min: 30 }, 'd3:1': { from: 'museum', to: 'valley', mode: 'walking', min: 8 } };
	const after = Plan.routeWithout(legs, new Set(['valley']));
	assert.equal(Plan.storedLeg(LT, 'd3', 1, after[1]), null);
	assert.equal(Plan.storedLeg(LT, 'd3', 0, after[0]).min, 30);
});

test('Plan: a pull earlier is a negative move, stored with the push backs', () => {
	assert.deepEqual(
		Plan.validPushes([
			{ from: 900, min: -90 },
			{ from: 870, min: 30 },
			{ from: 900, min: 0 },
			{ from: 900, min: 'x' },
		]),
		[
			{ from: 900, min: -90 },
			{ from: 870, min: 30 },
		],
	);
	// a pull and a push from the same and earlier starts add up, up to the next fixed time
	assert.equal(
		Plan.shiftAt([], 960, [
			{ from: 870, min: 30 },
			{ from: 900, min: -90 },
		]),
		-60,
	);
	assert.equal(Plan.shiftAt([930], 960, [{ from: 900, min: -90 }]), 0, 'a fixed time between holds it');
});

test('Sync: a skip is a record anyone can send, checked like the others', () => {
	const state = { skips: { 'd3-1grwpl0': { by: 'Mei', dev: 'devAAAAAA', at: 5, pull: { from: 900, min: 90 }, junk: 1 }, 'not a key': {} } };
	const recs = Sync.recordsOf(state, () => false);
	assert.deepEqual(recs, { 'skip:d3-1grwpl0': { by: 'Mei', dev: 'devAAAAAA', at: 5, pull: { from: 900, min: 90 } } });
	assert.ok(Sync.KEYS.includes('skips'));
	assert.ok(!Sync.GATED_KINDS.includes('skip'), 'an approval trip sends skips like stops');
	// what comes in is cleaned: the wrong shape is dropped, a bad pull or name goes, put back is null
	assert.deepEqual(Sync.cleanRecord('skip:d3-1grwpl0', { by: ' Ana ', pull: { from: 900, min: -5 } }), { by: 'Ana' });
	assert.deepEqual(Sync.cleanRecord('skip:d3-1grwpl0', {}), {});
	assert.equal(Sync.cleanRecord('skip:d3-1grwpl0', null), null);
	assert.equal(Sync.cleanRecord('skip:d3-1grwpl0', true), undefined);
	assert.equal(Sync.cleanRecord('skip:../x', {}), undefined);
	// in and out of the saved state
	const next = Sync.applyRecords(
		{ skips: { 'd2-a': {} } },
		[
			['skip:d3-b', { by: 'Mei' }],
			['skip:d2-a', null],
		],
		() => false,
	);
	assert.deepEqual(next.skips, { 'd3-b': { by: 'Mei' } });
	assert.equal(Sync.ungated({ 'skip:d3-b': { v: {} } })['skip:d3-b'] !== undefined, true);
	// a move earlier travels as a negative minute count; a phone keeps it, a zero goes
	assert.deepEqual(
		Sync.cleanRecord('shift:2027-03-15', [
			{ from: 900, min: -90 },
			{ from: 870, min: 0 },
		]),
		[{ from: 900, min: -90 }],
	);
});

test('Sync: Recently removed lists each skipped stop with who skipped it, until it is put back', () => {
	const me = { at: 10, by: 'Lee', me: true };
	let log = Sync.goneLog([], [{ id: 'mine-a', day: 'd3', name: 'Oops' }], [], me);
	log = Sync.skipLog(log, {}, { 'd3-k1': { by: 'Mei' } }, { at: 20, by: '', me: false });
	assert.deepEqual(log[0], { s: 'd3-k1', at: 20, by: 'Mei', me: false }, 'named by the skip itself');
	assert.equal(log[1].x.id, 'mine-a', "an added stop's entry passes through");
	// a skip rewritten (the move earlier added) isn't new
	assert.equal(Sync.skipLog(log, { 'd3-k1': {} }, { 'd3-k1': { pull: { from: 1, min: 10 } } }, me).length, 2);
	// a removal later keeps the skip's entry
	const more = Sync.goneLog(log, [{ id: 'mine-b', day: 'd3', name: 'B' }], [], me);
	assert.deepEqual(
		more.map((e) => e.s || e.x.id),
		['mine-b', 'd3-k1', 'mine-a'],
	);
	// put back: it leaves the list
	assert.deepEqual(
		Sync.skipLog(more, { 'd3-k1': {} }, {}, me).map((e) => e.s || e.x.id),
		['mine-b', 'mine-a'],
	);
	// skipped again: newest first, once
	const again = Sync.skipLog(Sync.skipLog(more, { 'd3-k1': {} }, {}, me), {}, { 'd3-k1': {} }, me);
	assert.deepEqual(
		again.map((e) => e.s || e.x.id),
		['d3-k1', 'mine-b', 'mine-a'],
	);
	assert.equal(Sync.skipLog([], {}, Object.fromEntries([...Array(40)].map((_, i) => [`d1-k${i}`, {}])), me).length, 30, 'keeps 30');
});
