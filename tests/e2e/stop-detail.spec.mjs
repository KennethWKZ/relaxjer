// A stop's longer note (schedule[].detail, trip-format.md; ADR-20261127-stop-detail-fold) folds under its short one:
// closed on a phone, where the day's string comes first, open on a wider screen, and a tap folds or unfolds it on any
// screen. The short note always shows; the page's search still finds the folded text and opens it.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';

/* global DAYS */

const firstDetail = (page) =>
	page.evaluate(() => {
		for (const d of DAYS) {
			const i = d.schedule.findIndex((it) => it.detail);
			if (i >= 0) return { stop: `${d.id}-s${i}`, en: d.schedule[i].detail[1] };
		}
		return null;
	});

// any trip: every stop with a detail shows its short note, then the fold; a stop without one has no fold
test("a stop's longer note folds under its short one: shut on a phone, open on a wider screen", async ({ page }) => {
	await openTrip(page);
	const want = await page.evaluate(() => DAYS.flatMap((d) => d.schedule.flatMap((it, i) => (it.detail ? [`${d.id}-s${i}`] : []))));
	test.skip(!want.length, 'this trip has no folded notes');
	await expect(page.locator('#app details.stop-detail')).toHaveCount(want.length);
	for (const s of want) await expect(page.locator(`#${s} .stop-b > .stop-note`), `${s} keeps its short note`).toHaveCount(1);

	const f = await firstDetail(page);
	test.skip(!f, 'this trip has no folded notes');
	await show(page, `#${f.stop}`);
	const fold = page.locator(`#${f.stop} details.stop-detail`);
	const sum = fold.locator('> summary');
	const body = fold.locator('> .stop-note');
	await expect(sum).toContainText('More details');
	await expect(sum.locator('svg.chev')).toHaveCount(1);
	expect((await sum.boundingBox()).height, 'the whole row is a 44 px target').toBeGreaterThanOrEqual(44);
	const phone = page.viewportSize().width < 600;
	if (phone) await expect(body).toBeHidden();
	else await expect(body).toBeVisible();

	// a tap folds or unfolds it on any screen, and it's the fold's tap, not the stop's sheet
	await sum.click();
	await expect(body).toBeVisible({ visible: phone });
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	await sum.click();
	await expect(body).toBeVisible({ visible: !phone });
	// the open row fills and the chevron turns: two cues (affordances rules 11 and 16)
	await page.mouse.move(1, 1);
	const look = () => sum.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e.querySelector('.chev')).transform].join(' '));
	const before = await look();
	await sum.click();
	await page.mouse.move(1, 1);
	await expect.poll(look).not.toBe(before);

	// kept for this page view: a language switch redraws the day and the reader's choice stays
	const chosen = await fold.evaluate((e) => e.open);
	await page.locator('#langBtn').click();
	await expect(page.locator(`#${f.stop} details.stop-detail`)).toHaveJSProperty('open', chosen);
	await page.locator('#langBtn').click();
	// a reload lands where the reader was, with the folds they had open (spotSave, 21-live-location.js): a phone's opened
	// fold stays open, and a wider screen's shut one comes back at its default, open
	await page.reload();
	await expect(page.locator(`#${f.stop} details.stop-detail`)).toHaveJSProperty('open', true);
});

test('search finds the words inside a folded note and opens it', async ({ page }) => {
	await openTrip(page);
	const f = await firstDetail(page);
	test.skip(!f, 'this trip has no folded notes');
	const words = f.en
		.split(/[,.:;(]/)[0]
		.trim()
		.split(/\s+/)
		.slice(0, 4)
		.join(' ');
	await page.locator('#searchBtn').click();
	await page.locator('#q').fill(words);
	const hit = page.locator('#results-inner .result[data-hit]').filter({ hasText: words }).first();
	await expect(hit).toBeVisible();
	await hit.click();
	await expect(page.locator(`#${f.stop} details.stop-detail`)).toHaveJSProperty('open', true);
	await expect(page.locator(`#${f.stop} details.stop-detail > .stop-note`)).toBeVisible();
});

// tagged @demo: the demo folds the EasyCard tips under Day 1's card stop
test('the demo folds its EasyCard tips under the short note @demo', async ({ page }) => {
	await openTrip(page);
	const f = await firstDetail(page);
	expect(f && f.en).toMatch(/^One card each/);
	await expect(page.locator(`#${f.stop} .stop-b > .stop-note`)).toHaveText('EasyCards at the MRT service desk');
});
