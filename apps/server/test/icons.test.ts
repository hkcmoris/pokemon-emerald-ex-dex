import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { createApp } from '../src/app.js';
import { categoryIconAssetRoot, typeIconAssetRoot } from '../src/icons.js';
import { startTestServer } from './httpTestServer.js';

void test('category icon files are served through the API without exposing directories or other files', async () => {
    const server = await startTestServer(createApp());
    try {
        for (const file of ['physical.png', 'special.png', 'status.png']) {
            const response = await fetch(`${server.url}/api/icons/move-categories/${file}`);
            strictEqual(response.status, 200);
            strictEqual(response.headers.get('content-type'), 'image/png');
            strictEqual(response.headers.get('cache-control'), 'public, max-age=86400');
            deepStrictEqual(
                Buffer.from(await response.arrayBuffer()),
                await readFile(`${categoryIconAssetRoot}/${file}`),
            );
        }
        for (const path of [
            '',
            'missing.png',
            'README.md',
            '.hidden.png',
            '%2e%2e%2fphysical.png',
            'nested%2fphysical.png',
            '%2e%2e%5cphysical.png',
        ]) {
            strictEqual(
                (await fetch(`${server.url}/api/icons/move-categories/${path}`)).status,
                404,
                path,
            );
        }
    } finally {
        await server.close();
    }
});

void test('all supplied type PNGs are served through the type icon route with caching', async () => {
    const server = await startTestServer(createApp());
    try {
        for (const file of await readdir(typeIconAssetRoot)) {
            if (!file.endsWith('.png')) continue;
            const response = await fetch(
                `${server.url}/api/icons/types/${encodeURIComponent(file)}`,
            );
            strictEqual(response.status, 200, file);
            strictEqual(response.headers.get('content-type'), 'image/png');
            strictEqual(response.headers.get('cache-control'), 'public, max-age=86400');
            deepStrictEqual(
                Buffer.from(await response.arrayBuffer()),
                await readFile(`${typeIconAssetRoot}/${file}`),
            );
        }
        for (const path of ['', 'missing.png', 'README.md', 'nested%2fPoison.png']) {
            strictEqual((await fetch(`${server.url}/api/icons/types/${path}`)).status, 404, path);
        }
    } finally {
        await server.close();
    }
});
