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

test('day ids must run d1…dN, and one free-time day at most', () => {
	const trip = loadTrip(DEMO_TRIP);
	trip.DAYS[2].id = 'd9';
	trip.DAYS[1].freeFrom = '14:00';
	trip.FLIGHTS.ret.plan.steps[0].at = ['soon'];
	const problems = checkTrip(trip).join('\n');
	for (const want of ['day ids must run d1…d7 in order', 'only one day can be the free-time day', 'steps[0].at'])
		assert.match(problems, new RegExp(want.replace(/[…[\]]/g, '.')));
});
