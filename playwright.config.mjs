// E2E characterisation of the trip page: 390 px and desktop, Chromium and WebKit (memory-bank/standards/decisions/ADR-20260930-test-strategy.md).
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.RELAXJER_TEST_PORT || 8124);
const phone = { width: 390, height: 844 };
const desktop = { viewport: { width: 1280, height: 800 } };

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/support/global-setup.mjs',
	fullyParallel: true,
	// locally three browsers at a time: the default (half the cores) keeps a laptop's fans at full tilt for the whole run
	workers: process.env.CI ? undefined : 3,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	// WebKit renders the 400 KB page slowly with four projects in parallel; 5 s assertions flaked there
	expect: { timeout: 10_000 },
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		timezoneId: 'Asia/Taipei',
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
	},
	webServer: {
		command: `node tests/support/serve.mjs .cache/pages ${PORT}`,
		url: `http://127.0.0.1:${PORT}/__health`,
		reuseExistingServer: !process.env.CI,
	},
	projects: [
		// the group's Android phones: Chrome's Android user agent (install button, Android steps), at the 390 px the iPhone uses
		{ name: 'android-390', use: { ...devices['Pixel 7'], viewport: phone } },
		{ name: 'chromium-1280', use: { ...devices['Desktop Chrome'], ...desktop } },
		{ name: 'webkit-390', use: { ...devices['iPhone 13'] } },
		{ name: 'webkit-1280', use: { ...devices['Desktop Safari'], ...desktop } },
	],
});
