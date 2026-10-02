// scripts/release-notes.mjs: a release's notes are its own CHANGELOG section, whichever heading form it has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notesFor } from '../../scripts/release-notes.mjs';

const log = `# Changelog

Intro.

## [1.0.1](https://example.com/compare/v1.0.0...v1.0.1) (2026-10-02)

### 🐛 Bug Fixes

* a fix

## 1.0.0 (2026-10-01)

### ✨ Features

* the first release
`;

test('release notes: a version’s own section, without its heading, for either heading form', () => {
	assert.equal(notesFor(log, 'v1.0.1'), '### 🐛 Bug Fixes\n\n* a fix');
	assert.equal(notesFor(log, '1.0.0'), '### ✨ Features\n\n* the first release');
	assert.equal(notesFor(log, 'v1.0.2'), null);
	assert.equal(notesFor(log, 'v1.0.10'), null, 'no prefix match');
	assert.equal(notesFor('## 1.0.0x (x)\n\n* no', 'v1.0.0'), null, 'the heading must end at the version');
});
