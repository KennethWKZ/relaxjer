// Day roles come from the trip, not from fixed ids: a 4-day trip made from the demo (tests/support/short-trip.mjs)
// follows the same contract, and the contract refuses day ids out of order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeShortTrip } from '../support/short-trip.mjs';
import { checkTrip, loadTrip } from '../support/trip-contract.mjs';
import { DEMO_TRIP } from '../support/stage.mjs';

test('a 4-day trip follows the contract', () => {
	const trip = loadTrip(makeShortTrip());
	assert.deepEqual(
		JSON.parse(JSON.stringify(trip.DAYS.map((d) => [d.id, d.date]))), // the trip lives in its own vm realm
		[
			['d1', '2027-03-13'],
			['d2', '2027-03-14'],
			['d3', '2027-03-15'],
			['d4', '2027-03-16'],
		],
	);
	assert.equal(trip.FLIGHTS.ret.date, '2027-03-16');
	assert.deepEqual(checkTrip(trip), []);
});

test('a day that splits forks before it rejoins, at stops the day has, with plans the page can draw', () => {
	const trip = loadTrip(DEMO_TRIP);
	const sp = trip.DAYS[4].split;
	assert.ok(sp, 'the demo splits Day 5');
	assert.deepEqual(checkTrip(trip), []);
	sp.options[0].join = '13:00'; // before the fork, and no stop starts then
	sp.options[1].id = sp.options[0].id;
	sp.options[1].line = [[25.05, 121.5]];
	sp.options[1].via = [
		[1, 1],
		[2, 2],
		[3, 3],
		[4, 4],
	];
	sp.options[0].default = true;
	sp.options[0].start.lat = 'north';
	sp.go[0].k = 'maybe';
	const problems = checkTrip(trip).join('\n');
	for (const want of [
		'join "13:00" must be the start time of a stop',
		'rejoins (13:00) before it forks',
		'option ids must be unique',
		'at most one option is the default',
		'line must be [lat, lng] points',
		'via holds at most 3',
		'start needs a',
		'go must be rows of',
	])
		assert.match(problems, new RegExp(want.replace(/[()[\]]/g, '.')), want);
});

test('day ids must run d1…dN, and one free-time day at most', () => {
	const trip = loadTrip(DEMO_TRIP);
	trip.DAYS[2].id = 'd9';
	trip.DAYS[1].freeFrom = '14:00';
	trip.FLIGHTS.ret.plan.steps[0].at = ['soon'];
	trip.AIRPORT.sites = ['nowhere'];
	trip.AIRPORT.terminals[1].place = 'atlantis';
	const problems = checkTrip(trip).join('\n');
	for (const want of [
		'day ids must run d1…d7 in order',
		'only one day can be the free-time day',
		'steps[0].at',
		'AIRPORT.sites: no site "nowhere"',
		'AIRPORT.terminals.1.',
	])
		assert.match(problems, new RegExp(want.replace(/[…[\]]/g, '.')));
});

test('shop lists: any number, each with a unique id and known places', () => {
	const trip = loadTrip(DEMO_TRIP);
	assert.ok(trip.SHOPLISTS.length >= 2, 'the demo shows more than one list');
	trip.SHOPLISTS[1].id = trip.SHOPLISTS[0].id;
	trip.SHOPLISTS[0].shops[0].place = 'nowhere';
	const problems = checkTrip(trip).join('\n');
	for (const want of ['id used twice', 'unknown place "nowhere"']) assert.match(problems, new RegExp(want));
});
