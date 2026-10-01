// Group sync (ADR-20261001-group-sync): two phones on one trip, through the test server's stand-in database. A change
// on one phone shows on the other, live; the database only ever holds ciphertext under names it can't read; a phone
// offline keeps its changes and sends them later; personal ticks never leave the phone; and when the planner ends sync,
// the page says so and keeps working on its own copy.
import { test, expect } from '../support/fixtures.mjs';
import { TEST_PLANNER_CODE } from '../support/global-setup.mjs';
import { endSync, freshDatabase, hasSyncPage, joinSpace, openSync, secondPhone, skipWelcome, stored } from '../support/sync.mjs';

const stopLink = (name) => {
	const pack = [['d3', '16:00', name, 25.1366, 121.5069, '', 'Beitou (demo)']];
	return `#add=${Buffer.from(JSON.stringify(pack)).toString('base64url')}`;
};
const tick = (page, key) => page.locator(`label[for="ck-${key}"]`).click();
// the sections menu draws when it opens: open it, then read its group-sync row (the menu button floats in only after a
// scroll, so it's clicked directly)
const syncRow = async (page) => {
	if (!(await page.locator('#toc').evaluate((d) => d.open))) await page.locator('#tocBtn').evaluate((el) => el.click());
	return page.locator('#toc [data-sync-label]');
};
const box = (page, key) => page.locator(`[data-check="${key}"]`);
const sheet = (page) => page.locator('#placeSheet');
// the Group sync sheet, from the sections menu
const openSyncSheet = async (page) => {
	await syncRow(page);
	await page.locator('#toc [data-sync-open]').click();
	await expect(sheet(page).locator('[data-sync-sheet]')).toBeVisible();
};
// gives the phone a name in Group sync, then closes the sheet
const setName = async (page, name) => {
	await openSyncSheet(page);
	const inp = sheet(page).locator('[data-sync-name]');
	await inp.fill(name);
	await inp.dispatchEvent('change');
	await expect(page.locator('#toast')).toContainText('Name saved');
	await sheet(page).locator('[data-close]').click();
};
// gives the trip's planner code on the phone (the sheet stays open)
const claimPlanner = async (page, code = TEST_PLANNER_CODE) => {
	await openSyncSheet(page);
	await sheet(page).locator('.sync-code > summary').click();
	await sheet(page).locator('[data-planner-code]').fill(code);
	await sheet(page).locator('[data-planner-ok]').click();
};
// adds a stop from a share link (a fresh load: the link is read on load)
const addByLink = async (page, name, day = 'd3', t = '16:00') => {
	await page.goto('about:blank');
	const pack = [[day, t, name, 25.1366, 121.5069, '', '']];
	await openSync(page, `#add=${Buffer.from(JSON.stringify(pack)).toString('base64url')}`);
	await sheet(page).locator('[data-mine-import]').click();
	await expect(page.locator(`#${day} .stop.mine`, { hasText: name })).toBeVisible();
};

// tagged @demo: the day, the shared checklist group and its items are the demo trip's
test.describe('group sync', { tag: '@demo' }, () => {
	test.skip(() => !hasSyncPage(), 'the legacy engine has no group sync');
	let b;
	test.beforeEach(async ({ browser, request, tripNow, tripLang, page, context }, testInfo) => {
		await freshDatabase(request, testInfo);
		await joinSpace(context, testInfo);
		await skipWelcome(context);
		page.on('dialog', (d) => d.accept());
		b = await secondPhone(browser, testInfo, { now: tripNow, lang: tripLang });
		b.page.on('dialog', (d) => d.accept());
	});
	test.afterEach(async () => {
		expect(b.errors, 'the second phone threw or logged errors').toEqual([]);
		await b.context.close();
	});

	test('a stop added on one phone shows on the other, and the database holds only ciphertext', async ({ page, request }, testInfo) => {
		await openSync(b.page);
		await openSync(page, stopLink('Demo Synced Stop'));
		await page.locator('#placeSheet [data-mine-import]').click();
		await expect(page.locator('#d3 .stop.mine')).toContainText('Demo Synced Stop');
		await expect(b.page.locator('#d3 .stop.mine'), 'live on the other phone').toContainText('Demo Synced Stop', { timeout: 15_000 });
		await expect(b.page.locator('#toast')).toContainText('Demo Synced Stop');

		const recs = await stored(request, testInfo);
		const names = Object.keys(recs);
		expect(names.length).toBeGreaterThan(0);
		for (const n of names) expect(n).toMatch(/^[A-Za-z0-9_-]{22}$/);
		const raw = JSON.stringify(recs);
		for (const plain of ['Demo Synced Stop', 'Beitou', 'stop:', 'mine-', '16:00']) expect(raw, `"${plain}" in the database`).not.toContain(plain);

		await b.page.reload();
		await expect(b.page.locator('#d3 .stop.mine'), 'saved on the other phone too').toContainText('Demo Synced Stop');
	});

	test('ticks in a shared list reach the group, personal ticks stay on the phone', async ({ page }) => {
		await openSync(page, '#checklist');
		await openSync(b.page, '#checklist');
		await expect(page.locator('#checklist .sync-tag')).toHaveCount(1); // the demo shares "Before the trip" only
		await tick(page, 'before-charter');
		await tick(page, 'pack-umbrella');
		await expect(box(b.page, 'before-charter')).toBeChecked({ timeout: 15_000 });
		await b.page.waitForTimeout(1500);
		await expect(box(b.page, 'pack-umbrella'), 'a packing tick is personal').not.toBeChecked();
		await tick(b.page, 'before-charter');
		await expect(box(page, 'before-charter'), 'unticking travels back').not.toBeChecked({ timeout: 15_000 });
		await expect(box(page, 'pack-umbrella')).toBeChecked();
	});

	test('a phone offline keeps its changes and sends them when it is back', async ({ page, context }) => {
		await openSync(page, '#checklist');
		await openSync(b.page, '#checklist');
		await context.setOffline(true);
		await tick(page, 'before-passport');
		await b.page.waitForTimeout(2000);
		await expect(box(b.page, 'before-passport'), 'not while offline').not.toBeChecked();
		await expect(await syncRow(page)).toContainText('waiting');
		await page.locator('#toc [data-close]').click();
		await context.setOffline(false);
		await expect(box(b.page, 'before-passport'), 'sent once back online').toBeChecked({ timeout: 15_000 });
	});

	test('the name a person gives travels with their changes', async ({ page }) => {
		await openSync(page);
		await openSync(b.page, '#checklist');
		await syncRow(page);
		await page.locator('#toc [data-sync-open]').click();
		const name = page.locator('#placeSheet [data-sync-name]');
		await name.fill('Ken');
		await name.dispatchEvent('change');
		await page.locator('#placeSheet [data-close]').click();
		await openSync(page, '#checklist');
		await tick(page, 'before-arrival');
		await expect(b.page.locator('#toast')).toContainText('Ken ticked', { timeout: 15_000 });
	});

	test('an added stop says who put it in the plan; only that phone can remove it, and it goes for everyone', async ({ page }) => {
		await openSync(b.page);
		await openSync(page);
		await setName(page, 'Ken');
		await addByLink(page, 'Demo Named Stop');
		const row = b.page.locator('#d3 .stop.mine', { hasText: 'Demo Named Stop' });
		await expect(row.locator('.mine-tag'), 'the other phone sees who added it').toHaveText('Added by Ken', { timeout: 15_000 });
		await expect(page.locator('#d3 [data-mine-share]'), 'everyone has the stops already: no share link').toHaveCount(0);
		await expect(row.locator('[data-mine-del]'), 'not the other phone’s to remove').toHaveCount(0);
		await expect(row.locator('[data-mine-edit]')).toHaveCount(0);

		const asked = [];
		page.on('dialog', (d) => asked.push(d.message()));
		await page.locator('#d3 .stop.mine', { hasText: 'Demo Named Stop' }).locator('[data-mine-del]').click();
		expect(asked.join(' ')).toContain('everyone');
		await expect(row, 'gone from the other phone too').toHaveCount(0, { timeout: 15_000 });
	});

	test('the planner code makes a phone a planner, who can change anyone’s stops and make others planners', async ({ page }) => {
		await openSync(b.page);
		await openSync(page);
		await setName(page, 'Ken');
		await setName(b.page, 'Ana');
		await addByLink(page, 'Demo Ken Stop');
		const there = b.page.locator('#d3 .stop.mine', { hasText: 'Demo Ken Stop' });
		await expect(there).toBeVisible({ timeout: 15_000 });
		await expect(there.locator('[data-mine-del]')).toHaveCount(0);

		await claimPlanner(b.page, 'not-the-code');
		await expect(b.page.locator('#toast')).toContainText('isn’t the planner code');
		await expect(sheet(b.page).locator('.sync-role'), 'not a planner yet').toHaveCount(0);
		await sheet(b.page).locator('[data-planner-code]').fill(TEST_PLANNER_CODE);
		await sheet(b.page).locator('[data-planner-ok]').click();
		await expect(sheet(b.page).locator('.sync-role')).toContainText('planner');
		const kenRow = sheet(b.page).locator('.sync-row', { hasText: 'Ken' });
		await expect(kenRow).toContainText('1 added stop');
		await sheet(b.page).locator('[data-close]').click();
		await there.locator('[data-mine-del]').click();
		await expect(page.locator('#d3 .stop.mine', { hasText: 'Demo Ken Stop' }), 'the planner removed it for everyone').toHaveCount(0, {
			timeout: 15_000,
		});

		// the planner makes Ken a planner too; then Ken's phone can change Ana's stop
		await addByLink(b.page, 'Demo Ana Stop', 'd3', '18:00');
		await openSyncSheet(b.page);
		await sheet(b.page).locator('.sync-row', { hasText: 'Ken' }).locator('[data-role-set]').click();
		await expect(b.page.locator('#toast')).toContainText('Ken is a planner now');
		await expect(page.locator('#toast'), 'Ken hears it').toContainText('made Ken a planner', { timeout: 15_000 });
		await expect(page.locator('#d3 .stop.mine', { hasText: 'Demo Ana Stop' }).locator('[data-mine-del]')).toHaveCount(1);

		// a planner's name isn't for another phone to take
		await openSyncSheet(page);
		await expect(sheet(page).locator('.sync-row', { hasText: 'Ana' }).locator('.sync-badge')).toHaveText('Planner');
	});

	test('a phone can’t take a planner’s name', async ({ page }) => {
		await openSync(b.page);
		await openSync(page);
		await setName(b.page, 'Ana');
		await claimPlanner(b.page);
		await expect(sheet(b.page).locator('.sync-role')).toContainText('planner');
		await openSyncSheet(page);
		await expect(sheet(page).locator('.sync-row', { hasText: 'Ana' })).toBeVisible({ timeout: 15_000 });
		const inp = sheet(page).locator('[data-sync-name]');
		await inp.fill(' ana ');
		await inp.dispatchEvent('change');
		await expect(page.locator('#toast')).toContainText('planner’s name');
		await expect(inp).toHaveValue('');
	});

	test('a removal can be undone from the toast, and put back later from Recently removed', async ({ page }) => {
		await openSync(b.page);
		await openSync(page);
		await setName(page, 'Ken');
		await addByLink(page, 'Demo Oops Stop');
		const there = b.page.locator('#d3 .stop.mine', { hasText: 'Demo Oops Stop' });
		await expect(there).toBeVisible({ timeout: 15_000 });
		const here = page.locator('#d3 .stop.mine', { hasText: 'Demo Oops Stop' });

		await here.locator('[data-mine-del]').click();
		await expect(there).toHaveCount(0, { timeout: 15_000 });
		await page.locator('#toast [data-toast-act]').click();
		await expect(there, 'Undo brings it back on every phone').toBeVisible({ timeout: 15_000 });

		await here.locator('[data-mine-del]').click();
		await expect(there).toHaveCount(0, { timeout: 15_000 });
		await openSyncSheet(b.page);
		const gone = sheet(b.page).locator('.sync-row', { hasText: 'Demo Oops Stop' });
		await expect(gone, 'the other phone lists it, and who removed it').toContainText('removed by Ken');
		await expect(gone.locator('[data-gone-back]'), 'not its stop to put back').toHaveCount(0);
		await sheet(b.page).locator('[data-close]').click();

		await openSyncSheet(page);
		await sheet(page).locator('.sync-row', { hasText: 'Demo Oops Stop' }).locator('[data-gone-back]').click();
		await expect(there, 'put back for everyone').toBeVisible({ timeout: 15_000 });
	});

	test('“Remove the stops I added” takes only this phone’s; who added what is in the sheet', async ({ page }) => {
		await openSync(b.page);
		await openSync(page);
		await setName(page, 'Ken');
		await setName(b.page, 'Ana');
		await addByLink(b.page, 'Demo Ana Stop', 'd3', '18:00');
		await addByLink(page, 'Demo Ken One', 'd3', '16:00');
		await addByLink(page, 'Demo Ken Two', 'd3', '17:00');
		await expect(b.page.locator('#d3 .stop.mine')).toHaveCount(3, { timeout: 15_000 });
		await expect(page.locator('#d3 .stop.mine')).toHaveCount(3, { timeout: 15_000 });

		await openSyncSheet(page);
		await expect(sheet(page).locator('.sync-row', { hasText: 'You (Ken)' })).toContainText('2 added stops');
		await expect(sheet(page).locator('.sync-row', { hasText: 'Ana' })).toContainText('1 added stop');
		await expect(sheet(page).locator('[data-mine-clear-dev]'), 'clearing someone else’s is a planner’s').toHaveCount(0);
		await expect(sheet(page).locator('[data-reset-all]'), 'so is resetting everyone’s plan').toHaveCount(0);
		await sheet(page).locator('[data-mine-clear-own]').click();
		await expect(b.page.locator('#d3 .stop.mine'), 'only Ana’s stays').toHaveCount(1, { timeout: 15_000 });
		await expect(b.page.locator('#d3 .stop.mine')).toContainText('Demo Ana Stop');
	});

	test('a planner can put everyone’s plan back; names stay, and Undo restores it', async ({ page }) => {
		await openSync(b.page);
		await openSync(page);
		await setName(page, 'Ken');
		await addByLink(page, 'Demo Reset One', 'd3', '16:00');
		await setName(b.page, 'Ana');
		await claimPlanner(b.page);
		await expect(sheet(b.page).locator('.sync-role')).toContainText('planner');
		await sheet(b.page).locator('[data-close]').click();
		await addByLink(b.page, 'Demo Reset Two', 'd3', '18:00');
		await expect(page.locator('#d3 .stop.mine')).toHaveCount(2, { timeout: 15_000 });

		await openSyncSheet(b.page);
		await sheet(b.page).locator('[data-reset-all]').click();
		await expect(b.page.locator('#toast')).toContainText('Back to the original plan');
		await expect(page.locator('#d3 .stop.mine'), 'gone on every phone').toHaveCount(0, { timeout: 15_000 });
		await b.page.locator('#toast [data-toast-act]').click();
		await expect(page.locator('#d3 .stop.mine'), 'Undo puts both back').toHaveCount(2, { timeout: 15_000 });

		await openSyncSheet(page);
		await expect(sheet(page).locator('[data-sync-name]'), 'the reset leaves names alone').toHaveValue('Ken');
		await sheet(page).locator('[data-close]').click();
		await openSyncSheet(b.page);
		await expect(sheet(b.page).locator('[data-sync-name]')).toHaveValue('Ana');
		await expect(sheet(b.page).locator('.sync-role'), 'and planners').toContainText('planner');
	});

	test('a phone’s first open asks for its name once, after the page shows; Not now leaves the bar', async ({
		browser,
		tripNow,
		tripLang,
	}, testInfo) => {
		const c = await secondPhone(browser, testInfo, { now: tripNow, lang: tripLang, welcome: true });
		await openSync(c.page);
		const welcome = c.page.locator('#placeSheet [data-sync-welcome]');
		await expect(welcome, 'after the page has drawn').toBeVisible({ timeout: 5_000 });
		await welcome.locator('[data-welcome-name]').fill('Mei');
		await welcome.locator('[data-welcome-save]').click();
		await expect(c.page.locator('#placeSheet')).not.toHaveAttribute('open', '');
		await expect(c.page.locator('#toast')).toContainText('Name saved');
		await expect(c.page.locator('#syncBar')).toBeHidden();
		await c.page.reload();
		await c.page.waitForTimeout(1800);
		await expect(c.page.locator('#placeSheet [data-sync-welcome]'), 'once only').toHaveCount(0);
		expect(c.errors).toEqual([]);
		await c.context.close();

		const d = await secondPhone(browser, testInfo, { now: tripNow, lang: tripLang, welcome: true });
		await openSync(d.page);
		await expect(d.page.locator('#placeSheet [data-sync-welcome]')).toBeVisible({ timeout: 5_000 });
		await d.page.locator('#placeSheet [data-sync-welcome] [data-close]').click();
		await expect(d.page.locator('#syncBar'), 'Not now: the bar stays as the reminder').toContainText('Group sync is on');
		await d.page.reload();
		await d.page.waitForTimeout(1800);
		await expect(d.page.locator('#placeSheet [data-sync-welcome]'), 'asked once, not every open').toHaveCount(0);
		expect(d.errors).toEqual([]);
		await d.context.close();
	});

	test('a phone with no name gets a bar that asks for one, and “Later” puts it away', async ({ page }) => {
		await openSync(page);
		const bar = page.locator('#syncBar');
		await expect(bar).toContainText('Group sync is on');
		await bar.locator('[data-sync-later]').click();
		await expect(bar).toBeHidden();
		await page.reload();
		await expect(bar, 'still away after a reload').toBeHidden();

		await openSync(b.page);
		await b.page.locator('#syncBar [data-sync-open]').click();
		const inp = sheet(b.page).locator('[data-sync-name]');
		await inp.fill('Ana');
		await inp.dispatchEvent('change');
		await sheet(b.page).locator('[data-close]').click();
		await expect(b.page.locator('#syncBar')).toBeHidden();
	});

	test('a name given after adding a stop goes on that stop too, on every phone', async ({ page }) => {
		await openSync(b.page);
		await openSync(page, stopLink('Demo Early Stop'));
		await page.locator('#placeSheet [data-mine-import]').click();
		const there = b.page.locator('#d3 .stop.mine', { hasText: 'Demo Early Stop' });
		await expect(there.locator('.mine-tag'), 'no name yet').toHaveText('Added', { timeout: 15_000 });
		await syncRow(page);
		await page.locator('#toc [data-sync-open]').click();
		const name = page.locator('#placeSheet [data-sync-name]');
		await name.fill('Ken');
		await name.dispatchEvent('change');
		await expect(page.locator('#toast')).toContainText('put on the 1 stop you added');
		await expect(there.locator('.mine-tag'), 'the other phone gets the name').toHaveText('Added by Ken', { timeout: 15_000 });
	});

	test('Sync now says it is working, then that it is done, and a second press meanwhile does nothing', async ({ page }) => {
		await openSync(page);
		await syncRow(page);
		await page.locator('#toc [data-sync-open]').click();
		const btn = page.locator('#placeSheet [data-sync-now]');
		await expect(btn).toHaveText('Sync now');
		await btn.click();
		await expect(btn).toHaveAttribute('aria-busy', 'true');
		await expect(btn).toHaveText('Syncing…');
		await expect(btn).toHaveText('Up to date', { timeout: 15_000 });
		await expect(btn).toHaveAttribute('data-state', 'done');
		await btn.click(); // ignored while it shows the result
		await expect(btn).not.toHaveAttribute('aria-busy', 'true');
		await expect(btn).toHaveText('Sync now', { timeout: 5_000 });
		await expect(btn).not.toHaveAttribute('data-state', /./);
	});

	test('when the planner ends sync, the page says so and keeps its own copy', async ({ page, request }, testInfo) => {
		await openSync(page, '#checklist');
		await tick(page, 'before-charter');
		await expect.poll(async () => Object.keys((await stored(request, testInfo)) || {}).length, { timeout: 15_000 }).toBeGreaterThan(0);
		await endSync(request, testInfo);
		await tick(page, 'before-passport');
		await expect(await syncRow(page)).toContainText('stopped', { timeout: 15_000 });
		await page.locator('#toc [data-close]').click();
		await expect(box(page, 'before-charter'), 'what this phone had stays').toBeChecked();
		await expect(box(page, 'before-passport')).toBeChecked();
	});
});
