// Location is asked for from a card that says why, never by the page on its own, and the card returns whenever the
// browser has no "yes" on record (Safari forgets one). The install button lives in the header until the page is installed.
// Playwright can't answer a real permission prompt, so the browser's permission state and GPS are stubbed.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { setStored } from '../support/page.mjs';
/* global DAYS */

const HERE = { latitude: 25.0339, longitude: 121.5645, accuracy: 20 };

/** Stubs what the browser says about location: its permission state (after answerAfter ms, when set), and a fix once
 *  the page asks for one. */
async function stubGeo(page, state, here = HERE, answerAfter = 0) {
	await page.addInitScript(
		({ state, here, answerAfter }) => {
			const status = { state, onchange: null };
			window.__geoAnswered = false;
			const answer = () =>
				answerAfter
					? new Promise((r) =>
							setTimeout(() => {
								window.__geoAnswered = true;
								r(status);
							}, answerAfter),
						)
					: ((window.__geoAnswered = true), Promise.resolve(status));
			navigator.permissions.query = (d) => (d && d.name === 'geolocation' ? answer() : Promise.reject(new Error('stub')));
			const fix = () => ({ coords: { ...here, heading: null, speed: null }, timestamp: Date.now() });
			window.__geoAsked = 0;
			navigator.geolocation.watchPosition = (ok) => {
				window.__geoAsked++;
				for (const ms of [10, 40, 70]) setTimeout(() => ok(fix()), ms); // a watch keeps sending fixes
				return 1;
			};
			navigator.geolocation.getCurrentPosition = (ok) => {
				window.__geoAsked++;
				setTimeout(() => ok(fix()), 10);
			};
			navigator.geolocation.clearWatch = () => {};
		},
		{ state, here, answerAfter },
	);
}

const card = (page) => page.locator('#now .geo-ask');

/** Opens the trip with its clock on a day relative to the first trip day (-3: three days before), on any trip. */
async function openOn(page, offset, time = '10:00') {
	await openTrip(page);
	const first = await page.evaluate(() => DAYS[0].date);
	const d = new Date(`${first}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + offset);
	await setStored(page, { now: `${d.toISOString().slice(0, 10)} ${time}` });
}

test('the page never asks for location by itself, and the card asks on a tap', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, -3);
	await expect(card(page)).toContainText('Turn on location');
	expect(await page.evaluate(() => window.__geoAsked), 'no request before a tap').toBe(0);
	await card(page).getByRole('button', { name: 'Turn on location' }).click();
	await expect(card(page)).toHaveCount(0);
	expect(await page.evaluate(() => window.__geoAsked)).toBeGreaterThan(0);
});

test('"Not today" hides the card for the rest of the day', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, -3);
	await card(page).getByRole('button', { name: 'Not today' }).click();
	await expect(card(page)).toHaveCount(0);
	await page.reload();
	await expect(page.locator('#now')).not.toBeEmpty();
	await expect(card(page)).toHaveCount(0);
});

test('no card once location is allowed, and a trip day follows the phone without asking', async ({ page }) => {
	await stubGeo(page, 'granted');
	await openOn(page, 0);
	await expect(page.locator('#now .now-day')).toBeVisible();
	await expect(card(page)).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => window.__geoAsked), { message: 'tracking started on its own' }).toBeGreaterThan(0);
});

test('the card comes back on a trip day when the browser forgot the answer', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, 0);
	await expect(card(page)).toContainText('running late');
	expect(await page.evaluate(() => window.__geoAsked)).toBe(0);
});

test('an approximate location says the late check needs precise location', async ({ page }) => {
	await stubGeo(page, 'granted', { ...HERE, accuracy: 2500 }); // Android "Approximate" / iPhone Precise Location off
	await openOn(page, 0);
	await expect(card(page)).toContainText('only approximate');
	await card(page).getByRole('button', { name: 'How to turn it on' }).click();
	const phone = await page.evaluate(() => /iPhone|iPad|Android/.test(navigator.userAgent));
	await expect(page.locator('#placeSheet .home-steps')).toContainText(phone ? /[Pp]recise/ : 'use a phone');
});

test('a phone that allowed location before says plainly why it asks again', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, 0);
	await setStored(page, { geoOk: true });
	await expect(card(page)).toContainText('asking for location again');
	await expect(card(page).getByRole('button', { name: 'Turn on location' })).toBeVisible();
});

test('allowing location from "near me" clears the card at once', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, -3);
	await expect(card(page)).toBeVisible();
	const near = page.locator('#app [data-near]').first();
	await near.scrollIntoViewIfNeeded();
	await near.click();
	await expect(card(page)).toHaveCount(0);
});

test('far from the trip, "near me" says it counts from the hotel, and the card still goes', async ({ page }) => {
	await stubGeo(page, 'prompt', { latitude: 3.139, longitude: 101.6869, accuracy: 20 }); // another country
	await openOn(page, -3);
	const near = page.locator('#app [data-near]').first();
	await near.scrollIntoViewIfNeeded();
	await near.click();
	await expect(page.locator('#near .near-far')).toContainText('distances start from the hotel');
	await expect(card(page)).toHaveCount(0);
});

// the browser answers a moment after the page has drawn: going by the phone's last answer, the card is there from the
// first paint instead of pushing the page down as it appears
test('opened again, the card is there before the browser answers', async ({ page }) => {
	await stubGeo(page, 'prompt', HERE, 3000);
	await openOn(page, -3);
	await expect(card(page), 'the first open waits for the browser').toBeVisible({ timeout: 8000 });
	await page.reload();
	await expect(card(page)).toBeVisible({ timeout: 1500 });
	expect(await page.evaluate(() => window.__geoAnswered), 'drawn from the kept answer').toBe(false);
});

test('a kept answer gives way to what the browser says now', async ({ page }) => {
	await stubGeo(page, 'granted', HERE, 500);
	await openOn(page, -3);
	await setStored(page, { geoSeen: 'prompt' }); // the phone said "ask" last time, and has allowed it since
	await expect(card(page)).toHaveCount(0);
	expect(await page.evaluate(() => window.__geoAnswered)).toBe(true);
});

test('a "no" turns the card into steps to switch it back on', async ({ page }) => {
	await stubGeo(page, 'denied');
	await openOn(page, -3);
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
	// iPhone: the guide also says how to make "Allow" stick, so the page stops asking every time
	if (await page.evaluate(() => /iPhone|iPad/.test(navigator.userAgent)))
		await expect(page.locator('#placeSheet .home-notes')).toContainText('Settings → Apps → Safari → Location');
});
