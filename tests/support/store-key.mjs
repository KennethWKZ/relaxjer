// The localStorage prefix of the page under test (the engine's Plan.storeKey: TRIP.storageKey, else rj.<start>.), so
// tests can pin the clock and language the way the page reads them. The legacy engine always used tp5.
import { storeKey } from '../../engine/src/core/plan.mjs';
import { resolveEngine, resolveTrip } from './stage.mjs';
import { loadTrip } from './trip-contract.mjs';

export const STORE_KEY = resolveEngine().kind === 'legacy' ? 'tp5.' : storeKey(loadTrip(resolveTrip().dir).TRIP);
