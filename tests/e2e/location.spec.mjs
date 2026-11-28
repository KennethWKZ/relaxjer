// Location is asked for from a card that says why, never by the page on its own, and the card returns whenever the
// browser has no "yes" on record (Safari forgets one). Both it and the header's Install are repeated hints
// (ADR-20261128-progressive-disclosure): in full the first time on this phone, one row (or More) after, and the card's ✕
// puts it away for good, with Location still in More's settings.
// Playwright can't answer a real permission prompt, so the browser's permission state and GPS are stubbed.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openSections, setStored, show } from '../support/page.mjs';
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

/** Opens the trip with its clock on a day relative to the first trip day (-3: three days before), on any trip, as this
 *  phone's first look at the location card (the opening before the clock is set has already shown it once) */
async function openOn(page, offset, time = '10:00') {
	await openTrip(page);
	const first = await page.evaluate(() => DAYS[0].date);
	const d = new Date(`${first}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + offset);
	await setStored(page, { now: `${d.toISOString().slice(0, 10)} ${time}`, hints: {} });
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

test('its ✕ puts the card away, and a reload keeps it away', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, -3);
	await card(page)
		.getByRole('button', { name: /Don’t show again/ })
		.click();
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

test("on a trip day the Now card's buttons come before the location card, on an iPhone's first screen", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 664 }); // an iPhone's visible area under Safari's bars
	await stubGeo(page, 'prompt');
	await openOn(page, 1, '10:30');
	await expect(card(page)).toBeVisible();
	const links = await page.locator('#now > .links-row').boundingBox(); // the card has its own row of buttons
	const ask = await card(page).boundingBox();
	expect(links.y, 'Open today and Go to next stop come first').toBeLessThan(ask.y);
	expect(links.y + links.height, 'and end on the first screen').toBeLessThanOrEqual(664);
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
	await setStored(page, { geoOk: true, hints: {} });
	await expect(card(page)).toContainText('asking for location again');
	await expect(card(page).getByRole('button', { name: 'Turn on location' })).toBeVisible();
});

test('allowing location from "near me" clears the card at once', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, -3);
	await expect(card(page)).toBeVisible();
	const near = page.locator('#app [data-near]').first();
	await show(page, near); // its view (food near me) on screen
	await near.click();
	await expect(card(page)).toHaveCount(0);
});

test('far from the trip, "near me" says it counts from the hotel, and the card still goes', async ({ page }) => {
	await stubGeo(page, 'prompt', { latitude: 3.139, longitude: 101.6869, accuracy: 20 }); // another country
	await openOn(page, -3);
	const near = page.locator('#app [data-near]').first();
	await show(page, near); // its view (food near me) on screen
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
	// wait for the answer first: a count of 0 straight after the reload can come before the kept answer draws the card
	await expect.poll(() => page.evaluate(() => window.__geoAnswered), { timeout: 3000 }).toBe(true);
	await expect(card(page)).toHaveCount(0);
});

test('a "no" turns the card into steps to switch it back on', async ({ page }) => {
	await stubGeo(page, 'denied');
	await openOn(page, -3);
	await expect(card(page)).toContainText('Location is off');
	await card(page).getByRole('button', { name: 'How to turn it on' }).click();
	await expect(page.locator('#placeSheet .home-steps li').first()).toBeVisible();
});

test('the location card: in full the first time, one row after, and once put away it stays away; Settings still has it', async ({ page }) => {
	await stubGeo(page, 'prompt');
	await openOn(page, -3);
	const c = card(page);
	await expect(c, 'the first time: what it does and where the position stays').toHaveClass(/is-full/);
	await expect(c.locator('.geo-why')).toBeVisible();
	await page.reload();
	await expect(c, 'after: one row').toHaveClass(/is-line/);
	const [line, btn, x] = await Promise.all([
		c.locator('.geo-l').boundingBox(),
		c.getByRole('button', { name: 'Turn on location' }).boundingBox(),
		c.locator('.geo-x').boundingBox(),
	]);
	const mid = (b) => b.y + b.height / 2;
	expect(Math.abs(mid(line) - mid(btn)), 'the words and the button on one row').toBeLessThan(6);
	expect(Math.abs(mid(btn) - mid(x)), 'and the ✕ beside them').toBeLessThan(6);
	expect(btn.height, 'a 44 px button').toBeGreaterThanOrEqual(44);
	await c.locator('.geo-x').click();
	await expect(c).toHaveCount(0);
	await page.reload();
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	await expect(c, 'put away for good on this phone').toHaveCount(0);
	await openSections(page);
	await expect(page.locator('[data-geo-row]').first(), 'Location stays in the settings').toBeVisible();
	await page.locator('[data-geo-row]').first().click();
	await expect.poll(() => page.evaluate(() => window.__geoAsked), { message: 'the row asks the browser' }).toBeGreaterThan(0);
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
	// a repeated hint: from the next opening the header keeps the brand, search, currency and language, and Install is a
	// row in More that opens the same steps
	await page.keyboard.press('Escape');
	await page.reload();
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
	await expect(btn, 'the header lets it go after its first showing').toBeHidden();
	await openSections(page);
	const row = page.locator('[data-home]:not(#homeBtn)').first();
	await expect(row).toBeVisible();
	await row.click();
	await expect(page.locator('#placeSheet .home-steps li').first()).toBeVisible();
});
