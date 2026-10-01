// Every "+" under every stop, on every day, adds a stop that lands right after that stop: the time it suggests and
// the place the stop goes agree (Plan.gapTime, Plan.slotFor). Trip-agnostic, so it runs on any trip (TRIP_DIR).
// One browser is enough: placement is the page's own logic, not the browser's.
import { test, expect, openTrip } from '../support/fixtures.mjs';

test('every “+” on every day adds a stop right after its own stop', async ({ page }) => {
	test.skip(test.info().project.name !== 'chromium-1280', 'placement is the same in every browser');
	test.setTimeout(300_000);
	page.on('dialog', (d) => d.accept());
	await openTrip(page);
	const days = await page.locator('#app section.day').evaluateAll((ss) => ss.map((s) => s.id));
	const bad = [];
	let checked = 0;
	// the order of a day's rows as drawn: planned stops (dN-sI), added stops (mine), the split card
	const order = (d) => page.locator(`#${d} .sched > li`).evaluateAll((ls) => ls.map((l) => (l.classList.contains('mine') ? 'mine' : l.id)));
	const addAfter = async (d, gap) => {
		const n = await page.locator(`#${d} .stop.mine`).count();
		await page.locator(`[data-add-gap="${gap}"]`).evaluate((b) => b.click());
		const sheet = page.locator('#placeSheet');
		const pick = sheet.locator('[data-add-res] [data-add]').first();
		await expect(pick, `${gap}: a place to add`).toBeVisible();
		await pick.click();
		const t = await sheet.locator('[data-add-t]').inputValue();
		await sheet.locator('[data-add-save]').click();
		await expect(page.locator(`#${d} .stop.mine`)).toHaveCount(n + 1);
		return t;
	};
	for (const d of days) {
		await openTrip(page, `#${d}`);
		const gaps = await page.locator(`#${d} .sched > li.stop:not(.mine) [data-add-gap]`).evaluateAll((bs) => bs.map((b) => b.dataset.addGap));
		for (const gap of gaps) {
			const i = +gap.split('|')[1];
			const t = await addAfter(d, gap);
			const o = await order(d);
			const at = o.indexOf('mine');
			const after = o
				.slice(0, at)
				.filter((x) => x !== `${d}-split`)
				.pop();
			if (after !== `${d}-s${i}`) bad.push(`${d} “+” after stop ${i} → ${t} landed after ${after}`);
			// and "+" under that added stop lands right after it
			if (gap === gaps[0]) {
				const mineId = await page.locator(`#${d} .stop.mine`).first().getAttribute('id');
				const t2 = await addAfter(d, `${d}|${mineId}`);
				const o2 = await order(d);
				const k = o2.indexOf('mine');
				if (o2[k + 1] !== 'mine') bad.push(`${d} “+” after the added stop (${t}) → ${t2} didn't land right after it: ${o2.join(' ')}`);
			}
			// clear what this knot added, for the next
			while ((await page.locator(`#${d} .stop.mine [data-mine-del]`).count()) > 0) {
				await page.locator(`#${d} .stop.mine [data-mine-del]`).first().click();
				await page.waitForFunction((dd) => !document.querySelector(`#${dd} .stop.mine .removing`), d);
			}
			await expect(page.locator(`#${d} .stop.mine`)).toHaveCount(0);
			checked++;
		}
	}
	expect(checked, 'some knots to check').toBeGreaterThan(0);
	expect(bad, `${checked} knots checked`).toEqual([]);
});
