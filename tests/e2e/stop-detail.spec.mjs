// A stop is one line until it's opened (ADR-20261128-progressive-disclosure, which replaced the detail fold of
// ADR-20261127-stop-detail-fold): its start time, its kind on the string and its name. Opened in place, it shows its
// note and longer note (schedule[].note, .detail) and its actions; a note the group must act on (todo) stays in sight;
// a fixed time keeps its seal on a second line. The page's search still finds what's inside a shut stop and opens it.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { show } from '../support/page.mjs';

/* global DAYS */

const firstDetail = (page) =>
	page.evaluate(() => {
		for (const d of DAYS) {
			const i = d.schedule.findIndex((it) => it.detail);
			if (i >= 0) return { stop: `${d.id}-s${i}`, en: d.schedule[i].detail[1], note: d.schedule[i].note[1] };
		}
		return null;
	});

// any trip: every stop with a note is one line with a chevron; a tap opens it in place, with its note and longer note
test('a stop is one line, and a tap opens its note, its longer note and its actions in place', async ({ page }) => {
	await openTrip(page);
	const f = await page.evaluate(() => {
		for (const d of DAYS) {
			const i = d.schedule.findIndex((it) => it.note && !it.todo && !it.fixed);
			if (i >= 0) return { stop: `${d.id}-s${i}`, note: d.schedule[i].note[1], place: !!d.schedule[i].place };
		}
		return null;
	});
	test.skip(!f, 'this trip has no stop with a note');
	await show(page, `#${f.stop}`);
	const row = page.locator(`#${f.stop} details.stop-x`);
	const sum = row.locator('> summary');
	const note = row.locator('.stop-open > .stop-note').first();
	await expect(row).toHaveJSProperty('open', false);
	await expect(note, 'the note waits inside').toBeHidden();
	await expect(sum.locator('svg.chev')).toHaveCount(1);
	expect((await sum.boundingBox()).height, 'the whole row is a 44 px target').toBeGreaterThanOrEqual(44);
	// one line: the name's box is one line high (a stop's name may wrap on a long name, never to three lines)
	const lines = await sum
		.locator('.stop-name')
		.evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
	expect(lines).toBeLessThanOrEqual(2);

	// a tap opens it in place (no sheet), and the chevron turns
	const turn = () => sum.locator('.chev').evaluate((e) => getComputedStyle(e).rotate);
	const before = await turn();
	await sum.click();
	await expect(row).toHaveJSProperty('open', true);
	await expect(note).toBeVisible();
	await expect(note).toHaveText(f.note);
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	await expect.poll(turn).not.toBe(before);
	if (f.place) {
		// its actions are labelled icons, each 44 px or more (affordances rules 1 and 9)
		const acts = row.locator('.stop-acts .ibtn');
		expect(await acts.count()).toBeGreaterThan(1);
		for (const a of await acts.all()) {
			await expect(a.locator('.ibtn-l')).not.toBeEmpty();
			expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(44);
		}
	}

	// kept for this page view: a language switch redraws the day and the stop stays open
	await page.locator('#langBtn').click();
	await expect(page.locator(`#${f.stop} details.stop-x`)).toHaveJSProperty('open', true);
	await page.locator('#langBtn').click();
	// a reload lands where the reader was, with what they had open (spotSave, 21-live-location.js)
	await page.reload();
	await expect(page.locator(`#${f.stop} details.stop-x`)).toHaveJSProperty('open', true);
	// and the time on the left opens and shuts it too: the whole row is the target (affordances rule 4)
	await page.locator(`#${f.stop} > .stop-t`).click();
	await expect(page.locator(`#${f.stop} details.stop-x`)).toHaveJSProperty('open', false);
});

test("a stop's longer note opens under its note", async ({ page }) => {
	await openTrip(page);
	const f = await firstDetail(page);
	test.skip(!f, 'this trip has no longer notes');
	await show(page, `#${f.stop}`);
	const row = page.locator(`#${f.stop} details.stop-x`);
	await row.locator('> summary').click();
	await expect(row.locator('.stop-open > .stop-detail')).toBeVisible();
	await expect(row.locator('.stop-open > .stop-detail')).toHaveText(f.en);
});

// any trip: a todo note and a fixed time's seal stay on the row's second line, never more
test('a note the group must act on, and a fixed time, keep a second line; nothing keeps a third', async ({ page }) => {
	await openTrip(page);
	const want = await page.evaluate(() =>
		DAYS.flatMap((d) =>
			d.schedule.flatMap((it, i) =>
				it.todo || it.fixed ? [{ id: `${d.id}-s${i}`, todo: !!it.todo && !it.fixed, note: it.note && it.note[1] }] : [],
			),
		),
	);
	test.skip(!want.length, 'this trip has no todo notes or fixed times');
	for (const w of want.slice(0, 6)) {
		const two = page.locator(`#${w.id} .stop-sum > .stop-2`);
		await expect(two, `${w.id} has its second line`).toHaveCount(1);
		if (w.todo) await expect(two).toHaveText(w.note);
		else await expect(two.locator('.seal')).toHaveCount(1);
		await expect(page.locator(`#${w.id} .stop-sum > :is(p, .stop-note)`), 'no third line').toHaveCount(0);
	}
});

test('search finds the words inside a shut stop and opens it', async ({ page }) => {
	await openTrip(page);
	const f = await firstDetail(page);
	test.skip(!f, 'this trip has no longer notes');
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
	await expect(page.locator(`#${f.stop} details.stop-x`)).toHaveJSProperty('open', true);
	await expect(page.locator(`#${f.stop} .stop-open > .stop-detail`)).toBeVisible();
});

// tagged @demo: the demo keeps the EasyCard tips under Day 1's card stop
test('the demo keeps its EasyCard tips under the short note @demo', async ({ page }) => {
	await openTrip(page);
	const f = await firstDetail(page);
	expect(f && f.en).toMatch(/^One card each/);
	await show(page, `#${f.stop}`);
	await page.locator(`#${f.stop} details.stop-x > summary`).click();
	await expect(page.locator(`#${f.stop} .stop-open > .stop-note`).first()).toHaveText('EasyCards at the MRT service desk');
});
