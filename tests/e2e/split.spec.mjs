// A day that splits (DAYS[].split, trip-format.md): part of the group's own plan hangs, folded, on the string where it
// forks, with its go / wait / skip rule, a switch between its plans (remembered on the phone), each plan's docks,
// directions and route, and a note on the stop where they come back.
import { test, expect, openTrip } from '../support/fixtures.mjs';

const card = (page) => page.locator('#d5-split details.split-card');

// tagged @demo: the demo's Day 5 split, its times and its plans
test.describe('a day that splits', { tag: '@demo' }, () => {
	test('it hangs where it forks, folded on the default plan, and each rejoin stop says so', async ({ page }) => {
		await openTrip(page, '#d5');
		const order = await page.locator('#d5 .sched > li.stop').evaluateAll((ls) => ls.map((l) => l.id));
		expect(order.indexOf('d5-split'), 'after the gondola, before the rest at 14:30').toBe(order.indexOf('d5-s2') + 1);
		await expect(card(page)).not.toHaveAttribute('open', '');
		await expect(card(page).locator('[data-split-sum]')).toHaveText('Long · ≈16 km · back ≈16:20');
		await expect(page.locator('#d5-s4 .split-back')).toHaveText('One of us rejoins here (Short)');
		await expect(page.locator('#d5-s5 .split-back')).toHaveText('One of us rejoins here (Long)');
		await expect(page.locator('#d3 .split-back'), 'only the day that splits').toHaveCount(0);
	});

	test('open, it shows the rule and the default plan; the switch shows another, and the phone remembers it', async ({ page }) => {
		await openTrip(page, '#d5');
		const c = card(page);
		await c.locator('summary').click();
		await expect(c.locator('.decide .opt')).toHaveCount(3);
		const long = c.locator('[data-split-opt="long"]');
		await expect(long).toBeVisible();
		await expect(c.locator('[data-split-opt="short"]')).toBeHidden();
		await expect(long.locator('.warn')).toContainText('Head back by 16:00');
		await expect(long.locator('.split-alt')).toContainText('Demo dock D');
		// live counts are asked for when it opens; the tests are offline, so it says it can't tell
		await expect(long.locator('.yb-live').first()).toHaveText(/unavailable|bikes to rent/);
		const dir = long.locator('a[href*="google.com/maps/dir"]');
		await expect(dir).toHaveAttribute('href', /travelmode=bicycling/);
		await expect(dir).toHaveAttribute('href', /waypoints=/);

		await c.locator('[data-split-pick="d5|short"]').click();
		await expect(c.locator('[data-split-pick="d5|short"]')).toHaveAttribute('aria-pressed', 'true');
		await expect(c.locator('[data-split-pick="d5|long"]')).toHaveAttribute('aria-pressed', 'false');
		await expect(c.locator('[data-split-opt="short"]')).toBeVisible();
		await expect(long).toBeHidden();
		await expect(c.locator('[data-split-sum]')).toHaveText('Short · ≈8 km · back ≈15:30');
		await page.reload();
		await expect(card(page).locator('[data-split-sum]'), 'remembered on this phone').toHaveText('Short · ≈8 km · back ≈15:30');
	});

	test('a plan with a route opens the map full screen', async ({ page }) => {
		await openTrip(page, '#d5');
		await card(page).locator('summary').click();
		await card(page).locator('[data-split-opt="long"] [data-split-map]').click();
		await expect(page.locator('html')).toHaveClass(/map-full-on/);
	});
});
