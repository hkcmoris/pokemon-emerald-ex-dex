import { strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeSearch } from '../src/index.js';

void test('search ignores accents and case while retaining gender symbols', () => {
    strictEqual(normalizeSearch('Flabébé'), 'flabebe');
    strictEqual(normalizeSearch('NIDORAN♀'), 'nidoran♀');
    strictEqual(normalizeSearch('Farfetch’d'), "farfetch'd");
});
