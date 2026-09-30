// ESLint flat config. Formatting is Prettier's job (eslint-config-prettier turns the style rules off).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
	{
		ignores: [
			'trips/**',
			'dist/**',
			'.cache/**',
			'node_modules/**',
			'test-results/**',
			'playwright-report/**',
			'**/dist/**',
			// the two halves of the IIFE the build wraps around the fragments; neither parses alone
			'engine/src/app/00-open.js',
			'engine/src/app/99-close.js',
		],
	},
	js.configs.recommended,
	{
		// build scripts, pure core modules, tests and tooling: Node ES modules
		files: ['**/*.mjs'],
		languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
		},
	},
	{
		// Playwright callbacks run inside the page (page.evaluate, addInitScript), in tests and in the docs scripts
		files: ['tests/**/*.mjs', 'scripts/**/*.mjs'],
		languageOptions: { globals: { ...globals.browser } },
	},
	{
		// the page script: engine/build.mjs joins these fragments into one IIFE, so a name defined in one fragment is used
		// in another, and the trip data (TRIP, DAYS, …) arrives as page globals. Per-file undefined/unused checks would
		// only report that split; the e2e suite fails on any page error instead.
		files: ['engine/src/app/**/*.js'],
		languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser } },
		rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-redeclare': 'off' },
	},
	{
		// the landing page's own script (site/, served by GitHub Pages as is)
		files: ['site/**/*.js'],
		languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser } },
	},
	{
		// a trip's data file: top-level consts the page reads as globals
		files: ['examples/**/data.js'],
		languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.browser } },
		rules: { 'no-unused-vars': 'off' },
	},
	prettier,
];
