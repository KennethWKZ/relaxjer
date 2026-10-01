// Group sync's pure rules (engine/src/core/sync.mjs, ADR-20261001-group-sync): what a phone shares, what changed, how a
// record from another phone is checked and put back, and which version wins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Sync from '../../engine/src/core/sync.mjs';

const shared = (k) => k.startsWith('before-');
const stop = (id, extra = {}) => ({
	id,
	day: 'd3',
	t: '16:00',
	name: 'Demo stop',
	q: 'Demo stop',
	lat: 25.1,
	lng: 121.5,
	gpid: null,
	addr: 'Beitou (demo)',
	...extra,
});
const state = {
	mine: [stop('mine-a')],
	shift: { '2027-03-14': [{ from: 600, min: 30 }], '2027-03-15': [] },
	fltArr: '17:40',
	fltDep: '',
	checks: { 'before-charter': true, 'pack-umbrella': true, 'before-passport': false },
};

test('Sync: a phone shares its stops, pushes, flight changes and shared ticks, nothing else', () => {
	assert.deepEqual(Object.keys(Sync.recordsOf(state, shared)).sort(), ['flt:arr', 'shift:2027-03-14', 'stop:mine-a', 'tick:before-charter']);
	assert.deepEqual(Sync.recordsOf({}, shared), {});
});

test('Sync: a change is a new value, or null when the record is gone; key order is not a change', () => {
	const before = Sync.recordsOf(state, shared);
	const after = Sync.recordsOf({ ...state, mine: [{ ...stop('mine-a') }, stop('mine-b')], fltArr: '', checks: { 'before-charter': true } }, shared);
	assert.deepEqual(Sync.changes(before, after).sort(), [
		['flt:arr', null],
		['stop:mine-b', stop('mine-b')],
	]);
	const reordered = { 'stop:mine-a': { lng: 121.5, lat: 25.1, ...stop('mine-a') } };
	assert.deepEqual(Sync.changes({ 'stop:mine-a': stop('mine-a') }, reordered), []);
});

test('Sync: a record from another phone is checked like a share link', () => {
	assert.deepEqual(
		Sync.cleanRecord('stop:mine-b', stop('mine-b', { name: 'x'.repeat(200), extra: '<script>' })),
		stop('mine-b', { name: 'x'.repeat(80) }),
	);
	assert.equal(Sync.cleanRecord('stop:mine-b', stop('mine-c')), undefined, 'the id inside must be the record id');
	assert.equal(Sync.cleanRecord('stop:mine-b', stop('mine-b', { lat: 'north' })), undefined);
	assert.equal(Sync.cleanRecord('stop:mine-b', stop('mine-b', { t: 'soon' })), undefined);
	assert.equal(Sync.cleanRecord('stop:mine-b', null), null, 'removed');
	// who added it travels with the stop, cut like a name; anything that isn't a name is dropped
	assert.equal(Sync.cleanRecord('stop:mine-b', stop('mine-b', { by: ` ${'K'.repeat(40)} ` })).by, 'K'.repeat(24));
	assert.equal('by' in Sync.cleanRecord('stop:mine-b', stop('mine-b', { by: { n: 'x' } })), false);
	assert.equal('by' in Sync.cleanRecord('stop:mine-b', stop('mine-b', { by: '  ' })), false);
	assert.deepEqual(
		Sync.cleanRecord('shift:2027-03-14', [
			{ from: 600, min: 30 },
			{ from: 'x', min: 5 },
			{ from: 700, min: 0 },
		]),
		[{ from: 600, min: 30 }],
	);
	assert.equal(Sync.cleanRecord('shift:2027-03-14', [{ from: 700, min: 0 }]), null, 'nothing left is the same as cleared');
	assert.equal(Sync.cleanRecord('shift:yesterday', []), undefined);
	assert.equal(Sync.cleanRecord('flt:arr', '18:05'), '18:05');
	assert.equal(Sync.cleanRecord('flt:arr', 'late'), undefined);
	assert.equal(Sync.cleanRecord('flt:gate', '18:05'), undefined);
	assert.equal(Sync.cleanRecord('tick:before-charter', true), true);
	assert.equal(Sync.cleanRecord('tick:before-charter', 'yes'), undefined);
	assert.equal(Sync.cleanRecord('theme:x', 'dark'), undefined, 'only the shared kinds');
});

test('Sync: records go back where the page keeps them, and a personal tick is never touched', () => {
	const next = Sync.applyRecords(
		state,
		[
			['stop:mine-0', stop('mine-0')],
			['stop:mine-a', null],
			['shift:2027-03-14', null],
			['shift:2027-03-16', [{ from: 540, min: 15 }]],
			['flt:dep', '01:10'],
			['tick:before-passport', true],
			['tick:pack-umbrella', null],
		],
		shared,
	);
	assert.deepEqual(next.mine, [stop('mine-0')]);
	assert.deepEqual(next.shift, { '2027-03-15': [], '2027-03-16': [{ from: 540, min: 15 }] });
	assert.equal(next.fltArr, '17:40');
	assert.equal(next.fltDep, '01:10');
	assert.deepEqual(next.checks, { 'before-charter': true, 'pack-umbrella': true, 'before-passport': true });
	assert.deepEqual(state.mine, [stop('mine-a')], 'the input is left as it was');
	assert.deepEqual(
		Sync.applyRecords({ mine: [stop('mine-lz2')] }, [['stop:mine-lz1', stop('mine-lz1')]], shared).mine.map((s) => s.id),
		['mine-lz1', 'mine-lz2'],
		'stops in the order they were made, whichever phone made them',
	);
});

test('Sync: the later edit wins, and a tie goes to the larger device id on every phone', () => {
	assert.ok(Sync.newer({ u: 2, d: 'a' }, { u: 1, d: 'z' }));
	assert.ok(!Sync.newer({ u: 1, d: 'z' }, { u: 2, d: 'a' }));
	assert.ok(Sync.newer({ u: 2, d: 'b' }, { u: 2, d: 'a' }));
	assert.ok(!Sync.newer({ u: 2, d: 'a' }, { u: 2, d: 'b' }));
	assert.ok(Sync.newer({ u: 1, d: 'a' }, undefined));
});

test('Sync: merging applies what is newer, ignores our own echo, and drops our pending change when it lost', () => {
	const known = { 'tick:before-charter': { u: 10, d: 'me' }, 'flt:arr': { u: 10, d: 'me' } };
	const pending = { 'stop:mine-a': { v: stop('mine-a'), u: 50, d: 'me' }, 'flt:dep': { v: '01:10', u: 20, d: 'me' } };
	const remote = {
		'tick:before-charter': { v: null, u: 30, d: 'ken', n: 'Ken' }, // newer than what we know: apply
		'flt:arr': { v: '18:00', u: 5, d: 'ken', n: 'Ken' }, // older: ignore
		'stop:mine-a': { v: stop('mine-a'), u: 50, d: 'me', n: '' }, // our own pending change coming back: ignore
		'flt:dep': { v: '02:00', u: 40, d: 'ken', n: 'Ken' }, // beats our pending one: apply, drop ours
		'shift:2027-03-15': { v: [{ from: 600, min: 30 }], u: 1, d: 'ken', n: 'Ken' }, // new to us: apply
	};
	const { apply, drop } = Sync.merge(known, pending, remote);
	assert.deepEqual(apply.map(([rid]) => rid).sort(), ['flt:dep', 'shift:2027-03-15', 'tick:before-charter']);
	assert.deepEqual(drop, ['flt:dep']);
	assert.deepEqual(Sync.merge(known, {}, { 'flt:arr': { v: '17:40', u: 10, d: 'me' } }).apply, [], 'a version we already have');
});

// ADR-20261002-sync-planners: who added a stop, the names phones go by, the planners, and the removed-stops list
test('Sync: a stop keeps the phone that added it; names and planner roles are records too', () => {
	assert.equal(Sync.cleanRecord('stop:mine-a', stop('mine-a', { dev: 'phoneA1' })).dev, 'phoneA1');
	assert.equal(Sync.cleanRecord('stop:mine-a', stop('mine-a', { dev: 'bad id!' })).dev, undefined, 'a malformed phone id is dropped');
	assert.equal(Sync.cleanRecord('who:phoneA1', '  Demo Name  '), 'Demo Name');
	assert.equal(Sync.cleanRecord('who:phoneA1', 'x'.repeat(40)).length, 24);
	assert.equal(Sync.cleanRecord('who:phoneA1', ''), undefined);
	assert.equal(Sync.cleanRecord('role:phoneA1', 'planner'), 'planner');
	assert.equal(Sync.cleanRecord('role:phoneA1', 'owner'), undefined, 'planner is the only role');
	assert.equal(Sync.cleanRecord('role:no', 'planner'), undefined);
	assert.equal(Sync.cleanRecord('role:phoneA1', null), null, 'a role can be taken away');

	const s = { people: { phoneA1: 'Demo Name' }, roles: { phoneA1: 'planner', phoneB2: 'guest' } };
	assert.deepEqual(Sync.recordsOf(s, shared), { 'who:phoneA1': 'Demo Name', 'role:phoneA1': 'planner' });
	const next = Sync.applyRecords(
		s,
		[
			['role:phoneB2', 'planner'],
			['role:phoneA1', null],
			['who:phoneB2', 'Other'],
		],
		shared,
	);
	assert.deepEqual(next.roles, { phoneB2: 'planner' });
	assert.deepEqual(next.people, { phoneA1: 'Demo Name', phoneB2: 'Other' });
});

test('Sync: a stop belongs to the phone it names, else the one that wrote it last, else this one', () => {
	assert.equal(Sync.ownerOf({ dev: 'phoneA1' }, { d: 'phoneB2' }, 'me0000'), 'phoneA1');
	assert.equal(Sync.ownerOf({}, { d: 'phoneB2' }, 'me0000'), 'phoneB2');
	assert.equal(Sync.ownerOf({}, undefined, 'me0000'), 'me0000');
	assert.equal(Sync.nameKey('  Demo   NAME '), Sync.nameKey('demo name'));
});

test('Sync: removed stops go on the list newest first, and leave it when they come back', () => {
	const a = stop('mine-a');
	const b = stop('mine-b');
	const who = { at: 1, by: 'Demo', me: true };
	let log = Sync.goneLog([], [a, b], [b], who);
	assert.deepEqual(
		log.map((e) => e.x.id),
		['mine-a'],
	);
	log = Sync.goneLog(log, [b], [], { ...who, at: 2 });
	assert.deepEqual(
		log.map((e) => e.x.id),
		['mine-b', 'mine-a'],
	);
	assert.deepEqual(
		Sync.goneLog(log, [], [a], who).map((e) => e.x.id),
		['mine-b'],
		'put back: off the list',
	);
	assert.equal(
		Sync.goneLog(
			[],
			Array.from({ length: 40 }, (_, i) => stop(`mine-${i}`)),
			[],
			who,
		).length,
		30,
		'capped',
	);
});

test('Sync: the group’s stops by the phone that added them, most first, under the name the phone gives', () => {
	const stops = [stop('mine-a', { dev: 'phoneA1', by: 'Old' }), stop('mine-b', { dev: 'phoneB2' }), stop('mine-c', { dev: 'phoneA1' })];
	const g = Sync.byPhone(stops, () => undefined, 'me0000', { phoneA1: 'Demo A' });
	assert.deepEqual(
		g.map((x) => [x.dev, x.by, x.ids.length]),
		[
			['phoneA1', 'Demo A', 2],
			['phoneB2', '', 1],
		],
	);
});
