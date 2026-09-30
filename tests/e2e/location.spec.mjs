// Location is asked for from a card that says why, never by the page on its own, and the card returns whenever the
// browser has no "yes" on record (Safari forgets one). The install button lives in the header until the page is installed.
// Playwright can't answer a real permission prompt, so the browser's permission state and GPS are stubbed.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { setStored } from '../support/page.mjs';
/* global DAYS */

const HERE = { latitude: 25.0339, longitude: 121.5645, accuracy: 20 };

/** Stubs what the browser says about location: its permission state, and a fix once the page asks for one. */
async function stubGeo(page, state) {
	await page.addInitScript(
		({ state, here }) => {
			const status = { state, onchange: null };
			navigator.permissions.query = (d) => (d && d.name === 'geolocation' ? Promise.resolve(status) : Promise.reject(new Error('stub')));
			const fix = () => ({ coords: { ...here, heading: null, speed: null }, timestamp: Date.now() });
			window.__geoAsked = 0;
			navigator.geolocation.watchPosition = (ok) => {
				window.__geoAsked++;
				setTimeout(() => ok(fix()), 10);
				return 1;
			};
			navigator.geolocation.getCurrentPosition = (ok) => {
				window.__geoAsked++;
				setTimeout(() => ok(fix()), 10);
			};
			navigator.geolocation.clearWatch = () => {};
		},
		{ state, here: HERE },
	);
}

const card = (page) => page.locator('#now .geo-ask');

test('the page never asks for location by itself, and the card asks on a tap', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openTrip(page);
	await expect(card(page)).toContainText('Turn on location');
	expect(await page.evaluate(() => window.__geoAsked), 'no request before a tap').toBe(0);
	await card(page).getByRole('button', { name: 'Turn on location' }).click();
	await expect(card(page)).toHaveCount(0);
	expect(await page.evaluate(() => window.__geoAsked)).toBeGreaterThan(0);
});

test('"Not today" hides the card for the rest of the day', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openTrip(page);
	await card(page).getByRole('button', { name: 'Not today' }).click();
	await expect(card(page)).toHaveCount(0);
	await page.reload();
	await expect(page.locator('#now')).not.toBeEmpty();
	await expect(card(page)).toHaveCount(0);
});

test('no card once location is allowed, and a trip day follows the phone without asking', async ({ page }) => {
	await stubGeo(page, 'granted');
	await openTrip(page);
	const first = await page.evaluate(() => DAYS[0].date);
	await setStored(page, { now: `${first} 10:00` });
	await expect(page.locator('#now .now-day')).toBeVisible();
	await expect(card(page)).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => window.__geoAsked), { message: 'tracking started on its own' }).toBeGreaterThan(0);
});

test('the card comes back on a trip day when the browser forgot the answer', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openTrip(page);
	const first = await page.evaluate(() => DAYS[0].date);
	await setStored(page, { now: `${first} 10:00` });
	await expect(card(page)).toContainText('running late');
	expect(await page.evaluate(() => window.__geoAsked)).toBe(0);
});

test('a "no" turns the card into steps to switch it back on', async ({ page }) => {
	await stubGeo(page, 'denied');
	await openTrip(page);
	await expect(card(page)).toContainText('Location is off');
	await card(page).getByRole('button', { name: 'How to turn it on' }).click();
	await expect(page.locator('#placeSheet .home-steps li').first()).toBeVisible();
});

test('the install button sits in the header and opens the steps', async ({ page }) => {
	await openTrip(page);
	const btn = page.locator('#bar #homeBtn');
	// phones get it (Android also installs from it; iPhone gets the steps); a desktop browser only when it offers an install
	const can = await page.evaluate(() => /iPhone|iPad|Android/.test(navigator.userAgent));
	await expect(page.locator('#top .home-btn'), 'no longer in the overview').toHaveCount(0);
	if (!can) {
		await expect(btn).toBeHidden();
		return;
	}
	await expect(btn).toBeVisible();
	await expect(btn).toHaveAttribute('aria-label', /home screen/);
	// the brand still fits next to it
	const [brand, b] = await Promise.all([page.locator('#bar .brand').boundingBox(), btn.boundingBox()]);
	expect(brand.x + brand.width).toBeLessThanOrEqual(b.x);
	await btn.click();
	await expect(page.locator('#placeSheet .home-steps li').first()).toBeVisible();
});
