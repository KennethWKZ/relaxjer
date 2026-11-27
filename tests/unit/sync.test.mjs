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

test('Sync: merging applies what is newer, and drops our pending change when it lost or is in the database already', () => {
	const known = { 'tick:before-charter': { u: 10, d: 'me' }, 'flt:arr': { u: 10, d: 'me' } };
	const pending = { 'stop:mine-a': { v: stop('mine-a'), u: 50, d: 'me' }, 'flt:dep': { v: '01:10', u: 20, d: 'me' } };
	const remote = {
		'tick:before-charter': { v: null, u: 30, d: 'lee', n: 'Lee' }, // newer than what we know: apply
		'flt:arr': { v: '18:00', u: 5, d: 'lee', n: 'Lee' }, // older: ignore
		// our own pending change, in the database already (the phone never heard back): nothing to apply, and not sent again,
		// or the rules refuse the whole send it rides in
		'stop:mine-a': { v: stop('mine-a'), u: 50, d: 'me', n: '' },
		'flt:dep': { v: '02:00', u: 40, d: 'lee', n: 'Lee' }, // beats our pending one: apply, drop ours
		'shift:2027-03-15': { v: [{ from: 600, min: 30 }], u: 1, d: 'lee', n: 'Lee' }, // new to us: apply
	};
	const { apply, drop } = Sync.merge(known, pending, remote);
	assert.deepEqual(apply.map(([rid]) => rid).sort(), ['flt:dep', 'shift:2027-03-15', 'tick:before-charter']);
	assert.deepEqual(drop.sort(), ['flt:dep', 'stop:mine-a']);
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

test('Sync: a planner can block a phone; what a blocked phone writes is dropped, its unblocking itself too', () => {
	assert.equal(Sync.cleanRecord('block:phoneB2', true), true);
	assert.equal(Sync.cleanRecord('block:phoneB2', 'yes'), undefined);
	assert.deepEqual(Sync.recordsOf({ blocks: { phoneB2: true } }, shared), { 'block:phoneB2': true });
	assert.deepEqual(Sync.applyRecords({}, [['block:phoneB2', true]], shared).blocks, { phoneB2: true });

	const remote = {
		'block:phoneB2': { v: true, u: 5, d: 'phoneA1' },
		'stop:mine-x': { v: stop('mine-x'), u: 6, d: 'phoneB2' },
		'tick:before-charter': { v: true, u: 7, d: 'phoneC3' },
	};
	const out = Sync.dropBlocked(remote, {});
	assert.deepEqual(Object.keys(out.remote).sort(), ['block:phoneB2', 'tick:before-charter'], 'the block counts in the same read');
	assert.deepEqual(out.blocks, { phoneB2: true });

	const self = Sync.dropBlocked({ 'block:phoneB2': { v: null, u: 9, d: 'phoneB2' } }, { phoneB2: true });
	assert.deepEqual(self.remote, {}, 'a blocked phone can’t unblock itself');
	assert.deepEqual(self.blocks, { phoneB2: true });
	assert.deepEqual(Sync.dropBlocked({ 'block:phoneB2': { v: null, u: 9, d: 'phoneA1' } }, { phoneB2: true }).blocks, {}, 'a planner can');
});

test('Sync: a device says what kind it is, as a kind from a short list, never the browser’s own description', () => {
	const kind = (ua, more = {}) => Sync.deviceKind({ ua, ...more });
	const iphone =
		'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
	assert.equal(kind(iphone), 'iphone/safari');
	assert.equal(kind(iphone, { standalone: true }), 'iphone/app', 'opened from the home screen');
	assert.equal(kind(iphone.replace('Version/26.1', 'CriOS/140.0.0.0')), 'iphone/chrome');
	assert.equal(kind(`${iphone} MicroMessenger/8.0.50`), 'iphone/wechat');
	const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
	assert.equal(kind(mac), 'mac/safari');
	assert.equal(kind(mac, { touch: 5 }), 'ipad/safari', 'an iPad asks for the desktop page and says Macintosh');
	const chromeMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
	assert.equal(kind(chromeMac), 'mac/chrome');
	assert.equal(kind(`${chromeMac} Edg/142.0.0.0`), 'mac/edge');
	assert.equal(
		kind('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36'),
		'android/chrome',
	);
	assert.equal(
		kind(
			'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
		),
		'android/samsung',
	);
	assert.equal(
		kind(
			'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 ArkWeb/4.1.6.1 Mobile HuaweiBrowser/5.0.3.300',
		),
		'huawei/huawei',
		'HarmonyOS NEXT',
	);
	assert.equal(
		kind(
			'Mozilla/5.0 (Linux; Android 12; HarmonyOS; NOH-AN00; HMSCore 6.13.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 HuaweiBrowser/15.0.4.312 Mobile Safari/537.36',
		),
		'huawei/huawei',
		'an older Huawei phone, which says Android too',
	);
	// an OPPO (ColorOS), Xiaomi or vivo phone is Android; their own browsers say who they are, Chrome doesn't
	const android = 'Mozilla/5.0 (Linux; Android 16; PLK110) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.135 Mobile Safari/537.36';
	assert.equal(kind(`${android} HeyTapBrowser/40.10.6.1`), 'android/oppo');
	assert.equal(kind(`${android} XiaoMi/MiuiBrowser/19.2.11`), 'android/xiaomi');
	assert.equal(kind(`${android} VivoBrowser/24.5.10.0`), 'android/vivo');
	assert.equal(kind(android), 'android/chrome');
	assert.equal(kind('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0'), 'windows/firefox');
	assert.equal(
		kind('Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
		'chromebook/chrome',
	);
	assert.equal(kind(''), 'other/other');
	for (const ua of [iphone, mac, chromeMac, '']) assert.ok(Sync.cleanRecord('kit:phoneA1', kind(ua)), `${kind(ua)} passes the record check`);
});

test('Sync: a device kind travels as its own record, checked against the list', () => {
	assert.deepEqual(Sync.recordsOf({ kits: { phoneA1: 'mac/chrome', phoneB2: 'toaster' } }, shared), { 'kit:phoneA1': 'mac/chrome' });
	assert.equal(Sync.cleanRecord('kit:phoneA1', 'ipad/app'), 'ipad/app');
	assert.equal(Sync.cleanRecord('kit:phoneA1', 'Mozilla/5.0 (iPhone)'), undefined, 'never a browser description');
	assert.equal(Sync.cleanRecord('kit:x', 'mac/chrome'), undefined, 'a device id that isn’t one');
	assert.equal(Sync.cleanRecord('kit:phoneA1', null), null);
	const next = Sync.applyRecords(
		{ kits: { phoneB2: 'iphone/app' } },
		[
			['kit:phoneA1', 'mac/chrome'],
			['kit:phoneB2', null],
		],
		shared,
	);
	assert.deepEqual(next.kits, { phoneA1: 'mac/chrome' });
	assert.ok(Sync.KEYS.includes('kits'));
});

test('Sync: the group is one entry per person; one name on a phone, a tablet and a laptop is one person', () => {
	const people = { phoneA1: 'Ken', laptopA2: ' ken ', tabletA3: 'KEN', phoneB1: 'Ana', strayC1: 'Ken' };
	const { people: list, blocked } = Sync.byPerson(
		['phoneB1', 'laptopA2', 'phoneA1', 'noname1', 'tabletA3', 'noname2', 'strayC1'],
		people,
		{ strayC1: true },
		'phoneA1',
	);
	assert.deepEqual(
		list.map((p) => [p.name.trim(), p.devs]),
		[
			['Ken', ['phoneA1', 'laptopA2', 'tabletA3']],
			['Ana', ['phoneB1']],
			['', ['noname1']],
			['', ['noname2']],
		],
		'this device’s person first, this device first in it; devices with no name stay one each',
	);
	assert.deepEqual(blocked, ['strayC1'], 'a blocked device leaves its person, whatever name it gives');
	assert.deepEqual(Sync.byPerson([], {}, {}, 'me').people, []);
});

test('Sync: while you were away keeps one line per record, the newest, newest first, capped', () => {
	const e = (r, u, d = 'A', t = [`改 ${r}`, `changed ${r}`]) => ({ r, u, d, n: 'Ken', t, day: 'd3' });
	const log = Sync.awayLog([e('stop:x', 10)], [e('stop:x', 30, 'A', ['删了 x', 'removed x']), e('tick:y', 20)]);
	assert.deepEqual(
		log.map((x) => [x.r, x.u, x.t[1]]),
		[
			['stop:x', 30, 'removed x'],
			['tick:y', 20, 'changed tick:y'],
		],
		'the later change to a record replaces the earlier one',
	);
	assert.equal(Sync.awayLog([e('stop:x', 30)], [e('stop:x', 20)])[0].u, 30, 'an older version arriving late doesn’t win');
	assert.equal(Sync.awayLog([e('stop:x', 30, 'A')], [e('stop:x', 30, 'B')])[0].d, 'B', 'a tie goes to the larger device id, as in merge');
	const many = Array.from({ length: 40 }, (_, i) => e(`tick:${i}`, i));
	assert.equal(Sync.awayLog([], many).length, 30, 'at most 30 kept');
	assert.equal(Sync.awayLog([], many)[0].u, 39, 'the newest kept first');
	assert.deepEqual(Sync.awayLog('junk', [null, { r: 'tick:z' }, { r: 'tick:z', u: 1, t: 'x' }]), [], 'damaged entries are dropped');
});
