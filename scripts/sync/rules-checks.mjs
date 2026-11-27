// The group-sync rules' checks, one list for both databases that enforce them: Firebase's own emulator
// (scripts/sync/rules-test.mjs, `pnpm test:sync-rules`) and the e2e tests' stand-in (tests/support/fake-rtdb.mjs,
// tests/unit/sync-rules-stand-in.test.mjs), so the two can't drift apart.
//   base: the database root (http://127.0.0.1:9123 for the emulator, …/__rtdb for the stand-in)
//   ns:   the namespace, sent as ?ns= as the emulator wants it
//   check(what, got, want): asserts one; log(text): a heading between the trips
// A device's request carries its ID token as `auth=`, as the page sends it (EventSource can't set headers); both take
// an unsigned token, which testIdToken makes per user id. The planner's own writes (the CLI) go as the emulator's
// admin, `Authorization: Bearer owner`.
import { testIdToken } from '../../tests/support/fake-rtdb.mjs';

export async function ruleChecks({ base, ns, check, log = () => {} }) {
	const at = (p, uid) => `${base}${p}.json?ns=${ns}${uid ? `&auth=${testIdToken(uid)}` : ''}`;
	const admin = { Authorization: 'Bearer owner' };
	const call = (method, p, body, { as, headers = {} } = {}) =>
		fetch(at(p, as), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
	const req = async (method, p, body, opts) => (await call(method, p, body, opts)).status;
	const read = async (p, opts) => (await call('GET', p, undefined, opts)).json();

	// ── a token trip ──────────────────────────────────────────────────────────────────────────────────────────────────
	const TRIP = 'T'.repeat(22);
	const OTHER = 'O'.repeat(22);
	const TOKEN = 'w'.repeat(32);
	const name = (c) => c.repeat(22);
	const rec = (over = {}) => ({ c: 'aaaa.bbbb', u: Date.now(), d: 'device1', k: TOKEN, ...over });
	const r = (p = '') => `/trips/${TRIP}/r${p}`;

	log('a token trip');
	await check('the planner sets the trip’s write token', await req('PUT', `/keys/${TRIP}`, TOKEN, { headers: admin }), 200);
	await check('a phone reads a trip that has a token', await req('GET', r()), 200);
	await check('no reading a trip without a token', await req('GET', `/trips/${OTHER}/r`), 401);
	await check('no reading the tokens', await req('GET', '/keys'), 401);
	await check('no listing the trips', await req('GET', '/trips'), 401);
	await check('a record with the token goes in', await req('PATCH', r(), { [name('a')]: rec({ u: 1000 }) }), 200);
	await check('the wrong token is refused', await req('PATCH', r(), { [name('b')]: rec({ k: 'x'.repeat(32) }) }), 401);
	await check('a record without the token is refused', await req('PATCH', r(), { [name('b')]: rec({ k: undefined }) }), 401);
	await check('a missing field is refused', await req('PATCH', r(), { [name('b')]: { c: 'x', u: 5, k: TOKEN } }), 401);
	await check('an extra field is refused', await req('PATCH', r(), { [name('b')]: rec({ extra: 1 }) }), 401);
	await check('a record over 4 KB is refused', await req('PATCH', r(), { [name('b')]: rec({ c: 'x'.repeat(4097) }) }), 401);
	await check('an edit time far in the future is refused', await req('PATCH', r(), { [name('b')]: rec({ u: Date.now() + 2 * 86_400_000 }) }), 401);
	await check('a record name the page wouldn’t make is refused', await req('PATCH', r(), { short: rec() }), 401);
	await check('an older version can’t replace a newer one', await req('PATCH', r(), { [name('a')]: rec({ u: 999 }) }), 401);
	await check('the same time from a smaller device id loses', await req('PATCH', r(), { [name('a')]: rec({ u: 1000, d: 'device0' }) }), 401);
	await check('the same time from a larger device id wins', await req('PATCH', r(), { [name('a')]: rec({ u: 1000, d: 'device2' }) }), 200);
	await check('a newer version replaces it', await req('PATCH', r(), { [name('a')]: rec({ u: 2000 }) }), 200);
	await check('a batch with one bad record is refused whole', await req('PATCH', r(), { [name('c')]: rec(), [name('d')]: rec({ k: 'nope' }) }), 401);
	await check('nothing from that batch went in', await (await fetch(at(r(`/${name('c')}`)))).text(), 'null');
	await check('no deleting a record', await req('DELETE', r(`/${name('a')}`)), 401);
	await check('no deleting through a null', await req('PATCH', r(), { [name('a')]: null }), 401);
	await check('no writing to a trip without a token', await req('PATCH', `/trips/${OTHER}/r`, { [name('a')]: rec() }), 401);
	await check('no writing a token from a phone', await req('PUT', `/keys/${OTHER}`, TOKEN), 401);
	await check(
		'no join requests on a token trip',
		await req('PUT', `/trips/${TRIP}/devices/${'Q'.repeat(28)}`, { state: 'pending' }, { as: 'Q'.repeat(28) }),
		401,
	);
	await check('the planner ends sync: the token goes', await req('DELETE', `/keys/${TRIP}`, undefined, { headers: admin }), 200);
	await check('then the trip can’t be read', await req('GET', r()), 401);
	await check('nor written', await req('PATCH', r(), { [name('e')]: rec({ u: 3000 }) }), 401);

	// ── an approval trip ──────────────────────────────────────────────────────────────────────────────────────────────
	// user ids as Firebase's anonymous sign-in makes them (28 letters and digits); a device's sync id is its user id's first
	// 24 characters, so no device can take another's
	const A = 'A'.repeat(27) + '1'; // becomes the first planner, with the planner code
	const B = 'B'.repeat(27) + '1'; // a member a planner approves
	const C = 'C'.repeat(27) + '1'; // a stranger who asks and is never approved
	const E = 'E'.repeat(27) + '1'; // approved, gives the planner code later
	const X = 'X'.repeat(27) + '1'; // signed in, never asks
	const devOf = (uid) => uid.slice(0, 24);
	const PROOF = 'p'.repeat(43);
	const GT = 'G'.repeat(22);
	const g = (p = '') => `/trips/${GT}${p}`;
	const ask = (uid, over = {}) => ({
		name: 'sealed-name',
		kind: 'iphone/safari',
		dev: devOf(uid),
		code: '4821',
		state: 'pending',
		at: 1000,
		...over,
	});
	const arec = (uid, over = {}) => ({ c: 'aaaa.bbbb', u: Date.now(), d: devOf(uid), ...over });

	log('an approval trip');
	await check('the CLI marks the trip as an approval trip', await req('PUT', `/gates/${GT}`, { approval: true }, { headers: admin }), 200);
	await check('no reading the gates', await req('GET', `/gates/${GT}`), 401);
	await check('no reading the gates, signed in', await req('GET', `/gates/${GT}`, undefined, { as: A }), 401);
	await check('no writing a gate from a device', await req('PUT', `/gates/${OTHER}`, { approval: true }, { as: A }), 401);
	await check('a stranger without a sign-in reads no records', await req('GET', g('/r')), 401);
	await check('nor the devices', await req('GET', g('/devices')), 401);
	await check('nor the planners', await req('GET', g('/planners')), 401);
	await check('nor the trip', await req('GET', g()), 401);
	await check('nor anyone’s join request', await req('GET', g(`/devices/${B}`)), 401);
	await check('a stranger without a sign-in can’t ask to join', await req('PUT', g(`/devices/${B}`), ask(B)), 401);
	await check('nor write a record', await req('PATCH', g('/r'), { [name('a')]: arec(B) }), 401);
	await check('nor write with a write token', await req('PATCH', g('/r'), { [name('a')]: { ...arec(B), k: TOKEN } }), 401);
	await check('a signed-in device that never asked reads no records', await req('GET', g('/r'), undefined, { as: X }), 401);
	await check('nor the devices', await req('GET', g('/devices'), undefined, { as: X }), 401);
	await check('it reads its own entry: none yet', await (await call('GET', g(`/devices/${X}`), undefined, { as: X })).text(), 'null');

	// asking to join
	await check('a device asks to join as pending', await req('PUT', g(`/devices/${B}`), ask(B), { as: B }), 200);
	await check('not for another device', await req('PUT', g(`/devices/${C}`), ask(C), { as: B }), 401);
	await check('not as approved', await req('PUT', g(`/devices/${C}`), ask(C, { state: 'approved' }), { as: C }), 401);
	await check('not as blocked', await req('PUT', g(`/devices/${C}`), ask(C, { state: 'blocked' }), { as: C }), 401);
	await check('not with a person', await req('PUT', g(`/devices/${C}`), ask(C, { person: devOf(C) }), { as: C }), 401);
	await check('not under another device’s sync id', await req('PUT', g(`/devices/${C}`), ask(C, { dev: devOf(B) }), { as: C }), 401);
	await check('not under a short sync id', await req('PUT', g(`/devices/${C}`), ask(C, { dev: C.slice(0, 12) }), { as: C }), 401);
	await check('not without a name', await req('PUT', g(`/devices/${C}`), ask(C, { name: undefined }), { as: C }), 401);
	await check('not with an empty name', await req('PUT', g(`/devices/${C}`), ask(C, { name: '' }), { as: C }), 401);
	await check('not with a name over 400 characters', await req('PUT', g(`/devices/${C}`), ask(C, { name: 'x'.repeat(401) }), { as: C }), 401);
	await check('not with a kind off the list', await req('PUT', g(`/devices/${C}`), ask(C, { kind: 'Mozilla/5.0 (iPhone)' }), { as: C }), 401);
	await check('not with a join code that isn’t digits', await req('PUT', g(`/devices/${C}`), ask(C, { code: 'ab12' }), { as: C }), 401);
	await check('not with an extra field', await req('PUT', g(`/devices/${C}`), ask(C, { role: 'planner' }), { as: C }), 401);
	await check('the stranger asks properly', await req('PUT', g(`/devices/${C}`), ask(C), { as: C }), 200);
	await check('a pending device renames itself', await req('PATCH', g(`/devices/${B}`), { name: 'sealed-name-2' }, { as: B }), 200);
	await check('but can’t change its join code', await req('PATCH', g(`/devices/${B}`), { code: '1111' }, { as: B }), 401);
	await check('nor its kind', await req('PATCH', g(`/devices/${B}`), { kind: 'ipad/safari' }, { as: B }), 401);
	await check('nor its sync id', await req('PATCH', g(`/devices/${B}`), { dev: devOf(B).replace(/.$/, 'Z') }, { as: B }), 401);
	await check('nor give itself a person', await req('PATCH', g(`/devices/${B}`), { person: devOf(B) }, { as: B }), 401);
	await check('nor approve itself', await req('PATCH', g(`/devices/${B}`), { state: 'approved' }, { as: B }), 401);
	await check('nor take back its request', await req('DELETE', g(`/devices/${B}`), undefined, { as: B }), 401);
	await check('nor rename another pending device', await req('PATCH', g(`/devices/${C}`), { name: 'mine-now' }, { as: B }), 401);
	await check('a pending device reads no records', await req('GET', g('/r'), undefined, { as: B }), 401);
	await check('nor the devices', await req('GET', g('/devices'), undefined, { as: B }), 401);
	await check('nor the planners', await req('GET', g('/planners'), undefined, { as: B }), 401);
	await check('nor another device’s entry', await req('GET', g(`/devices/${C}`), undefined, { as: B }), 401);
	await check('it reads its own entry', (await read(g(`/devices/${B}`), { as: B })).state, 'pending');
	await check('and whether it’s a planner', await (await call('GET', g(`/planners/${B}`), undefined, { as: B })).text(), 'null');
	await check('a pending device writes no records', await req('PATCH', g('/r'), { [name('a')]: arec(B) }, { as: B }), 401);

	// the first planner: a pending device that gives the planner code approves itself
	await check('A asks to join', await req('PUT', g(`/devices/${A}`), ask(A, { code: '1234' }), { as: A }), 200);
	const selfApprove = (uid, claim) => ({
		...(claim === undefined ? {} : { [`claims/${uid}`]: claim }),
		[`planners/${uid}`]: true,
		[`devices/${uid}/state`]: 'approved',
		[`devices/${uid}/person`]: devOf(uid),
	});
	await check('no proof is taken before the CLI stored one', await req('PATCH', g(), selfApprove(A, PROOF), { as: A }), 401);
	await check('the CLI stores the planner-code proof', await req('PUT', `/gates/${GT}/proof`, PROOF, { headers: admin }), 200);
	await check('a wrong proof is refused', await req('PUT', g(`/claims/${A}`), 'q'.repeat(43), { as: A }), 401);
	await check('approving itself without the proof is refused', await req('PATCH', g(), selfApprove(A), { as: A }), 401);
	await check('approving itself with a wrong proof is refused', await req('PATCH', g(), selfApprove(A, 'q'.repeat(43)), { as: A }), 401);
	await check('the page’s hash of the code isn’t the proof', await req('PATCH', g(), selfApprove(A, 'h'.repeat(43)), { as: A }), 401);
	await check(
		'no planner entry with the proof for another device',
		await req('PATCH', g(), { [`claims/${A}`]: PROOF, [`planners/${B}`]: true }, { as: A }),
		401,
	);
	await check('no claim for another device', await req('PUT', g(`/claims/${B}`), PROOF, { as: A }), 401);
	await check(
		'a planner entry with the proof needs an approved device',
		await req('PATCH', g(), { [`claims/${A}`]: PROOF, [`planners/${A}`]: true }, { as: A }),
		401,
	);
	await check('the right proof approves it as a planner', await req('PATCH', g(), selfApprove(A, PROOF), { as: A }), 200);
	await check('nobody reads the claims', await req('GET', g(`/claims/${A}`), undefined, { as: A }), 401);
	await check('the planner reads the devices', await req('GET', g('/devices'), undefined, { as: A }), 200);
	await check('and the planners', (await read(g('/planners'), { as: A }))[A], true);
	await check('and the records', await req('GET', g('/r'), undefined, { as: A }), 200);
	await check('but not the proof', await req('GET', `/gates/${GT}/proof`, undefined, { as: A }), 401);

	// a planner approves
	await check('a planner approves a pending device', await req('PATCH', g(`/devices/${B}`), { state: 'approved', person: devOf(B) }, { as: A }), 200);
	await check('and can’t change its sync id', await req('PATCH', g(`/devices/${B}`), { dev: devOf(A) }, { as: A }), 401);
	await check('nor make an entry for a device that never asked', await req('PUT', g(`/devices/${X}`), ask(X, { state: 'approved' }), { as: A }), 401);
	await check('an approved device reads the records', await req('GET', g('/r'), undefined, { as: B }), 200);
	await check('and the devices', await req('GET', g('/devices'), undefined, { as: B }), 200);
	await check('and the planners', await req('GET', g('/planners'), undefined, { as: B }), 200);
	await check('but not the claims', await req('GET', g('/claims'), undefined, { as: B }), 401);
	await check('an approved device can’t rename itself', await req('PATCH', g(`/devices/${B}`), { name: 'renamed' }, { as: B }), 401);
	await check('nor move itself to another person', await req('PATCH', g(`/devices/${B}`), { person: devOf(A) }, { as: B }), 401);
	await check('nor approve another device', await req('PATCH', g(`/devices/${C}`), { state: 'approved', person: devOf(C) }, { as: B }), 401);
	await check('nor block one', await req('PATCH', g(`/devices/${A}`), { state: 'blocked' }, { as: B }), 401);
	await check('nor make itself a planner', await req('PUT', g(`/planners/${B}`), true, { as: B }), 401);
	await check('nor another', await req('PUT', g(`/planners/${C}`), true, { as: B }), 401);

	// records on an approval trip
	await check('an approved device writes a record as itself', await req('PATCH', g('/r'), { [name('a')]: arec(B, { u: 1000 }) }, { as: B }), 200);
	await check('not as another device', await req('PATCH', g('/r'), { [name('b')]: arec(A) }, { as: B }), 401);
	await check('not with a write token in it', await req('PATCH', g('/r'), { [name('b')]: arec(B, { k: TOKEN }) }, { as: B }), 401);
	await check('not with a missing field', await req('PATCH', g('/r'), { [name('b')]: { c: 'x', d: devOf(B) } }, { as: B }), 401);
	await check('not over 4 KB', await req('PATCH', g('/r'), { [name('b')]: arec(B, { c: 'x'.repeat(4097) }) }, { as: B }), 401);
	await check('an older version can’t replace a newer one', await req('PATCH', g('/r'), { [name('a')]: arec(A, { u: 999 }) }, { as: A }), 401);
	await check('the same time from a smaller sync id loses', await req('PATCH', g('/r'), { [name('a')]: arec(A, { u: 1000 }) }, { as: A }), 401);
	await check('a newer version replaces it', await req('PATCH', g('/r'), { [name('a')]: arec(A, { u: 2000 }) }, { as: A }), 200);
	await check('no deleting a record', await req('DELETE', g(`/r/${name('a')}`), undefined, { as: A }), 401);
	await check('the stranger, still pending, reads none of it', await req('GET', g('/r'), undefined, { as: C }), 401);

	// an approved device that gives the planner code later
	await check('E asks', await req('PUT', g(`/devices/${E}`), ask(E, { code: '5555' }), { as: E }), 200);
	await check('a planner approves E', await req('PATCH', g(`/devices/${E}`), { state: 'approved', person: devOf(E) }, { as: A }), 200);
	await check('E gives the code: a planner now', await req('PATCH', g(), { [`claims/${E}`]: PROOF, [`planners/${E}`]: true }, { as: E }), 200);
	await check('a planner takes away another’s role', await req('DELETE', g(`/planners/${E}`), undefined, { as: A }), 200);

	// blocking
	await check(
		'a planner blocks a device, and takes its role in the same go',
		await req('PATCH', g(), { [`devices/${B}/state`]: 'blocked', [`planners/${B}`]: null }, { as: A }),
		200,
	);
	await check('the blocked device reads no records', await req('GET', g('/r'), undefined, { as: B }), 401);
	await check('nor the devices', await req('GET', g('/devices'), undefined, { as: B }), 401);
	await check('it writes no records', await req('PATCH', g('/r'), { [name('c')]: arec(B, { u: Date.now() }) }, { as: B }), 401);
	await check('it reads its own entry, to say it’s blocked', (await read(g(`/devices/${B}`), { as: B })).state, 'blocked');
	await check('it can’t unblock itself', await req('PATCH', g(`/devices/${B}`), { state: 'approved' }, { as: B }), 401);
	await check('nor go back to pending', await req('PATCH', g(`/devices/${B}`), { state: 'pending' }, { as: B }), 401);
	await check('nor approve itself with the planner code', await req('PATCH', g(), selfApprove(B, PROOF), { as: B }), 401);
	await check('nor become a planner with it', await req('PATCH', g(), { [`claims/${B}`]: PROOF, [`planners/${B}`]: true }, { as: B }), 401);
	await check('a planner can’t make a blocked device a planner', await req('PUT', g(`/planners/${B}`), true, { as: A }), 401);
	await check('a planner unblocks it', await req('PATCH', g(`/devices/${B}`), { state: 'approved' }, { as: A }), 200);
	await check('then it reads again', await req('GET', g('/r'), undefined, { as: B }), 200);
	await check('a planner makes it a planner', await req('PUT', g(`/planners/${B}`), true, { as: A }), 200);
	await check('who renames a person', await req('PATCH', g(`/devices/${A}`), { name: 'sealed-other' }, { as: B }), 200);
	await check('moves a device to another person', await req('PATCH', g(`/devices/${A}`), { person: devOf(B) }, { as: B }), 200);
	await check('and blocks a planner', await req('PATCH', g(), { [`devices/${A}/state`]: 'blocked', [`planners/${A}`]: null }, { as: B }), 200);
	await check('a blocked planner has no say', await req('PATCH', g(`/devices/${C}`), { state: 'approved', person: devOf(C) }, { as: A }), 401);
	await check('a planner ignores a join request: it goes', await req('DELETE', g(`/devices/${C}`), undefined, { as: B }), 200);
	await check('nobody signed out deletes an entry', await req('DELETE', g(`/devices/${E}`)), 401);

	// a trip that has both is an approval trip: the token is no way round the gate
	await check('a token set beside the gate', await req('PUT', `/keys/${GT}`, TOKEN, { headers: admin }), 200);
	await check('doesn’t open reading', await req('GET', g('/r')), 401);
	await check('nor writing with it', await req('PATCH', g('/r'), { [name('d')]: { ...arec(E), k: TOKEN } }), 401);
	await check('the token goes again', await req('DELETE', `/keys/${GT}`, undefined, { headers: admin }), 200);

	// ending
	await check('the planner ends sync: the gate goes', await req('DELETE', `/gates/${GT}`, undefined, { headers: admin }), 200);
	await check('then no device reads the records', await req('GET', g('/r'), undefined, { as: B }), 401);
	await check('nor its own entry', await req('GET', g(`/devices/${B}`), undefined, { as: B }), 401);
	await check('nor writes', await req('PATCH', g('/r'), { [name('e')]: arec(B) }, { as: B }), 401);
}
