import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createApp } from '../src/app.js';
import { spriteAssetRoot } from '../src/sprites.js';
import { startTestServer } from './httpTestServer.js';

void test('standard and shiny PNGs are served with caching through the API prefix', async () => {
    const server = await startTestServer(createApp());
    try {
        for (const file of [
            'front/0001_Bulbasaur.png',
            'shiny_front/0001_Bulbasaur.png',
            'front/0958_Raichu.png',
        ]) {
            const response = await fetch(`${server.url}/api/sprites/emerald-ex-1.0.4/${file}`);
            strictEqual(response.status, 200);
            strictEqual(response.headers.get('content-type'), 'image/png');
            strictEqual(response.headers.get('cache-control'), 'public, max-age=86400');
            deepStrictEqual(
                Buffer.from(await response.arrayBuffer()),
                await readFile(`${spriteAssetRoot}/${file}`),
            );
        }
        for (const path of [
            'sprite_manifest.json',
            'README.txt',
            'front/',
            'front/missing.png',
            'front/%2e%2e%2f%2e%2e%2fpackage.json',
        ]) {
            strictEqual(
                (await fetch(`${server.url}/api/sprites/emerald-ex-1.0.4/${path}`)).status,
                404,
                path,
            );
        }
        strictEqual(
            (await fetch(`${server.url}/api/sprites/unknown/front/0001_Bulbasaur.png`)).status,
            404,
        );
    } finally {
        await server.close();
    }
});
