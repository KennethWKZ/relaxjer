// Helpers for the group-sync e2e tests: the trip-sync.html page global-setup builds, the stand-in database's admin
// routes (tests/support/fake-rtdb.mjs), and a second phone with the same rules as the fixtures' first one.
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { PAGES_DIR, SYNC_TEST_FILE } from './global-setup.mjs';
import { STORE_KEY } from './store-key.mjs';

export const SYNC_PAGE = '/trip-sync.html';
export const hasSyncPage = () => fs.existsSync(path.join(PAGES_DIR, 'trip-sync.html'));
export const syncConfig = () => JSON.parse(fs.readFileSync(SYNC_TEST_FILE, 'utf8'));

// each test's own space in the stand-in database (tests run in parallel, and every sync page holds the same trip id)
const space = (testInfo) => `t${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`.replace(/[^\w-]/g, '');
const admin = (testInfo) => `trip=${syncConfig().trip}&ns=${space(testInfo)}`;
/** puts a browser context in the test's space */
export const joinSpace = (context, testInfo) => context.addCookies([{ name: 'rtdb_ns', value: space(testInfo), domain: '127.0.0.1', path: '/' }]);

/** a fresh database for the trip in this test's space: its write token in place, no records */
export async function freshDatabase(request, testInfo) {
	const s = syncConfig();
	expect((await request.post(`/__rtdb-admin/key?${admin(testInfo)}`, { data: s.writeToken })).ok()).toBe(true);
	return s;
}
/** what `pnpm sync end` does: the token and every record go, open streams are cancelled */
export const endSync = async (request, testInfo) => request.delete(`/__rtdb-admin/key?${admin(testInfo)}`);
/** the records the database holds, as stored */
export const stored = async (request, testInfo) => (await request.get(`/__rtdb-admin/dump?${admin(testInfo)}`)).json();

/** Opens the sync page and waits for the first render. */
export async function openSync(page, hash = '') {
	await page.goto(`${SYNC_PAGE}${hash}`);
	await expect(page.locator('#app [data-sec]').first()).toBeAttached();
}

const CONTEXT_OPTIONS = ['viewport', 'userAgent', 'deviceScaleFactor', 'isMobile', 'hasTouch', 'baseURL', 'timezoneId', 'locale'];
/**
 * Another phone in the group: its own browser context (its own storage), no outside network, the trip clock and
 * language pinned like the fixtures do, and its page errors collected for the test to check.
 */
export async function secondPhone(browser, testInfo, { now, lang }) {
	const use = testInfo.project.use;
	const context = await browser.newContext(Object.fromEntries(CONTEXT_OPTIONS.filter((k) => use[k] !== undefined).map((k) => [k, use[k]])));
	await context.route('**/*', (route) => {
		const { hostname } = new URL(route.request().url());
		return hostname === '127.0.0.1' || hostname === 'localhost' ? route.continue() : route.abort('blockedbyclient');
	});
	await context.addInitScript(
		({ now, lang, key }) => {
			try {
				if (sessionStorage.getItem('__relaxjer_seeded')) return;
				localStorage.setItem(`${key}now`, JSON.stringify(now));
				localStorage.setItem(`${key}lang`, JSON.stringify(lang));
				sessionStorage.setItem('__relaxjer_seeded', '1');
			} catch {
				/* storage blocked */
			}
		},
		{ now, lang, key: STORE_KEY },
	);
	await joinSpace(context, testInfo);
	const page = await context.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
	page.on('console', (m) => {
		if (m.type() === 'error' && !/Failed to load resource|net::ERR_|blockedbyclient/i.test(m.text())) errors.push(`console: ${m.text()}`);
	});
	return { context, page, errors };
}
