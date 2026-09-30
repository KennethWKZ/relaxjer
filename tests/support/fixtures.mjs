// Shared e2e fixtures. Every test gets:
// - no outside network: anything not on the local test server is aborted and recorded (the page must work offline);
// - a pinned trip clock through the engine's own override (localStorage tp5.now = "YYYY-MM-DD HH:MM", Asia/Taipei);
// - a pinned UI language (tp5.lang), seeded once per tab so reloads keep what the page stored;
// - a failure if the page throws or logs an error.
import { test as base, expect } from '@playwright/test';

export { expect };

export const test = base.extend({
	tripNow: ['2027-03-06 09:00', { option: true }], // a week before the demo trip starts
	tripLang: ['en', { option: true }],
	allowHosts: [[], { option: true }],

	blocked: [
		async ({ context, allowHosts }, use) => {
			const blocked = [];
			await context.route('**/*', (route) => {
				const { hostname, host } = new URL(route.request().url());
				if (hostname === '127.0.0.1' || hostname === 'localhost' || allowHosts.includes(hostname)) return route.continue();
				blocked.push(host);
				return route.abort('blockedbyclient');
			});
			await use(blocked);
		},
		{ auto: true },
	],

	pageErrors: [
		async ({ page }, use) => {
			const errors = [];
			page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
			page.on('console', (m) => {
				// blocked hosts log "Failed to load resource"; that is the network guard working, not a page bug
				if (m.type() === 'error' && !/Failed to load resource|net::ERR_|blockedbyclient/i.test(m.text())) errors.push(`console: ${m.text()}`);
			});
			await use(errors);
			expect(errors, 'the page threw or logged errors').toEqual([]);
		},
		{ auto: true },
	],

	seed: [
		async ({ context, tripNow, tripLang }, use) => {
			await context.addInitScript(
				({ now, lang }) => {
					try {
						if (sessionStorage.getItem('__relaxjer_seeded')) return;
						localStorage.setItem('tp5.now', JSON.stringify(now));
						localStorage.setItem('tp5.lang', JSON.stringify(lang));
						sessionStorage.setItem('__relaxjer_seeded', '1');
					} catch {
						/* storage blocked: the page runs on its defaults */
					}
				},
				{ now: tripNow, lang: tripLang },
			);
			await use();
		},
		{ auto: true },
	],
});

/** Opens the built trip page and waits for the first render. */
export async function openTrip(page, hash = '') {
	await page.goto(`/trip.html${hash}`);
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
}
