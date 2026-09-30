// E2E characterisation of the trip page: 390 px and desktop, Chromium and WebKit (docs/adr/0002-test-strategy.md).
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.RELAXJER_TEST_PORT || 8124);
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
const desktop = { viewport: { width: 1280, height: 800 } };

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/support/global-setup.mjs',
	fullyParallel: true,
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
		{ name: 'chromium-390', use: { ...devices['Desktop Chrome'], ...phone } },
		{ name: 'chromium-1280', use: { ...devices['Desktop Chrome'], ...desktop } },
		{ name: 'webkit-390', use: { ...devices['iPhone 13'] } },
		{ name: 'webkit-1280', use: { ...devices['Desktop Safari'], ...desktop } },
	],
});
