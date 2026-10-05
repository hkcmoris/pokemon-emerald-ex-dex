import { strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { add } from '../src/index.js';

void test('smoke test', () => {
    strictEqual(add(1, 2), 3);
});
