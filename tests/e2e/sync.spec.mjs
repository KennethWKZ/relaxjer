// Group sync (ADR-20261001-group-sync): two phones on one trip, through the test server's stand-in database. A change
// on one phone shows on the other, live; the database only ever holds ciphertext under names it can't read; a phone
// offline keeps its changes and sends them later; personal ticks never leave the phone; and when the planner ends sync,
// the page says so and keeps working on its own copy.
import { test, expect } from '../support/fixtures.mjs';
import { endSync, freshDatabase, hasSyncPage, joinSpace, openSync, secondPhone, stored } from '../support/sync.mjs';

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

// tagged @demo: the day, the shared checklist group and its items are the demo trip's
test.describe('group sync', { tag: '@demo' }, () => {
	test.skip(() => !hasSyncPage(), 'the legacy engine has no group sync');
	let b;
	test.beforeEach(async ({ browser, request, tripNow, tripLang, page, context }, testInfo) => {
		await freshDatabase(request, testInfo);
		await joinSpace(context, testInfo);
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
