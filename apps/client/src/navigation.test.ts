import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { parseRoute, speciesHref } from './navigation.js';

void test('species pages have stable static-host-friendly links, including padded IDs', () => {
    strictEqual(speciesHref(25), '#/species/25');
    deepStrictEqual(parseRoute(speciesHref(25)), { kind: 'species', id: 25 });
    deepStrictEqual(parseRoute('#/species/0001'), { kind: 'species', id: 1 });
    for (const hash of ['', '#', '#/']) deepStrictEqual(parseRoute(hash), { kind: 'dex' });
});

void test('invalid routes and IDs cannot trigger a species request', () => {
    for (const hash of [
        '#/species/0',
        '#/species/-1',
        '#/species/65536',
        '#/species/1.2',
        '#/species/1x',
        '#/species/1/unknown',
        '#/moves/25',
    ]) {
        deepStrictEqual(parseRoute(hash), { kind: 'not-found' }, hash);
    }
});
