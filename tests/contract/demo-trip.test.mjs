// The committed demo trip follows the trip contract and stays synthetic: nothing Google-derived, nothing personal.
// TRIP_DIR=<folder with data.js> runs the same contract on a real trip locally.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEMO_TRIP } from '../support/stage.mjs';
import { checkTrip, loadTrip, pointsOutside, readJSON } from '../support/trip-contract.mjs';

const dir = process.env.TRIP_DIR ? path.resolve(process.env.TRIP_DIR) : DEMO_TRIP;
const isDemo = dir === DEMO_TRIP;

test('trip follows the contract', () => {
  assert.deepEqual(checkTrip(loadTrip(dir)), []);
});

test('every pin sits inside the map', () => {
  assert.deepEqual(pointsOutside(dir), []);
});

test('every planned place has a pin', () => {
  const { PLACES } = loadTrip(dir);
  const geo = readJSON(dir, 'geo.json', { places: {} });
  const missing = Object.keys(PLACES).filter((id) => !geo.places[id]);
  assert.deepEqual(missing, []);
});

test('the contract catches a broken trip', () => {
  const trip = loadTrip(DEMO_TRIP);
  trip.DAYS[1].schedule[2].t = '08:00'; // earlier than the stop before
  trip.DAYS[2].schedule[0].place = 'nowhere';
  trip.BUDGET.totalMax = 1;
  trip.FACTS[0].v = ['日期', ''];
  trip.DAYS[1].route = [['hotel', 'atlantis', 'teleport']];
  delete trip.TRIP.pax;
  const problems = checkTrip(trip).join('\n');
  for (const want of ['earlier than the stop before', 'unknown place "nowhere"', 'totalMin', 'both languages needed', 'route leg 0', 'TRIP.pax missing']) assert.match(problems, new RegExp(want));
});

test('demo data carries nothing copied from Google', { skip: !isDemo && 'real trips may hold Google data' }, () => {
  // Maps Platform terms limit storing Places content; a public example must not redistribute it
  const FORBIDDEN = /"(gpid|rating|reviews|userRatingCount|rating_source|businessStatus)"\s*:|googleusercontent\.com|maps\.googleapis\.com\/maps\/api\/place\/photo/;
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.doesNotMatch(text, FORBIDDEN, `${f} has Google-derived fields`);
  }
});

test('demo data is visibly synthetic', { skip: !isDemo && 'only the demo is published' }, () => {
  const { FLIGHTS, PLACES } = loadTrip(dir);
  // "XX" is not an airline code, so the flights cannot be mistaken for a real booking
  for (const k of ['out', 'ret']) assert.match(FLIGHTS[k].no, /^XX \d+$/);
  assert.match(PLACES.hotel.name[1], /Sample|Demo/);
  assert.ok(!PLACES.hotel.tel, 'no phone numbers in the demo');
});

