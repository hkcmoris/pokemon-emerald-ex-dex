import { strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { apiUrl } from './apiUrl.js';

void test('API and image URLs stay inside the configured website subfolder', () => {
    strictEqual(
        apiUrl('v1/species', '/pokemon-emerald-ex-dex/'),
        '/pokemon-emerald-ex-dex/api/v1/species',
    );
    strictEqual(
        apiUrl('icons/types/Fire.png', '/pokemon-emerald-ex-dex/'),
        '/pokemon-emerald-ex-dex/api/icons/types/Fire.png',
    );
    strictEqual(
        apiUrl('sprites/emerald-ex-1.0.4/front/0001.png', '/dex'),
        '/dex/api/sprites/emerald-ex-1.0.4/front/0001.png',
    );
    strictEqual(apiUrl('v1/types'), '/api/v1/types');
});
