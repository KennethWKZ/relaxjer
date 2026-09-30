// A paused home-screen app keeps the copy it loaded. The page checks the live copy's build id when it comes back
// online, offers a reload only when there is something new, and never while offline (a reload then is a blank page).
import { test, expect, openTrip } from '../support/fixtures.mjs';

const BUILD_RE = /(<meta name="relaxjer-build" content=")[^"]+/;

/** Serves the page as built on the first load, then as `next` (a different build id, or the same one) after that. */
async function serve(page, next) {
	const seen = [];
	await page.route('**/trip.html', async (route) => {
		seen.push(route.request().url());
		if (seen.length === 1 || !next) return route.continue();
		const r = await route.fetch();
		return route.fulfill({ response: r, body: (await r.text()).replace(BUILD_RE, `$1${next}`) });
	});
	return seen;
}

test('the page carries its build id near the top of the file', async ({ page }) => {
	await openTrip(page);
	const id = await page.locator('meta[name="relaxjer-build"]').getAttribute('content');
	expect(id).toMatch(/^[0-9a-f]{12}$/);
});

test('no bar when the live copy is the same build', async ({ page }) => {
	const seen = await serve(page, null);
	await openTrip(page);
	await expect.poll(() => seen.length, { timeout: 15_000, message: 'the page checked the live copy' }).toBeGreaterThan(1);
	await page.waitForTimeout(500);
	await expect(page.locator('#updBar')).toBeHidden();
});

test('a newer live copy shows the bar, and Update loads it', async ({ page }) => {
	await serve(page, 'newer0000000');
	await openTrip(page);
	const bar = page.locator('#updBar');
	await expect(bar).toBeVisible({ timeout: 15_000 });
	await expect(bar).toContainText('New version');
	await bar.getByRole('button', { name: 'Update' }).click();
	await expect(page.locator('meta[name="relaxjer-build"]')).toHaveAttribute('content', 'newer0000000');
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	await page.waitForTimeout(5000);
	await expect(bar, 'up to date after the reload').toBeHidden();
});

test('offline, the page does not check or offer a reload', async ({ page, context }) => {
	const seen = await serve(page, 'newer0000000');
	await openTrip(page);
	await context.setOffline(true);
	await page.waitForTimeout(5500);
	expect(seen.length, 'no check while offline').toBe(1);
	await expect(page.locator('#updBar')).toBeHidden();
});
