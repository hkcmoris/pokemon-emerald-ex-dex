import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { createApp } from '../src/app.js';
import { DexRepository } from '../src/dexRepository.js';
import { startTestServer } from './httpTestServer.js';

void test('invalid IDs, query values and unknown resources are rejected before querying SQL', async () => {
    let queries = 0;
    const repository = new DexRepository(
        {
            query: () => {
                queries++;
                return Promise.resolve([]);
            },
        },
        'test',
    );
    const server = await startTestServer(createApp(repository));
    try {
        for (const path of [
            'species/abc',
            'species/1.5',
            'species/-1',
            'species/0',
            'species/0/details',
            'species/0/sprites',
            'species/0/forms',
            'species/65536',
            'moves/-1',
            'abilities/-1',
            'abilities/65536',
            'abilities/abc',
            'abilities?q=a&q=b',
            'abilities?pageSize=251',
            'abilities?unknown=1',
            'species/0/abilities',
            'items/-1',
            'items/65536',
            'items/abc',
            'items?q=a&q=b',
            'items?pocket[x]=Items',
            'items?pageSize=251',
            'items?unknown=1',
            'moves/65536',
            'species?page=0',
            'species?pageSize=251',
            'species?page=1e2',
            'species?sort=name;DROP',
            'species?q=a&q=b',
            'species?type[x]=Fire',
            `species?q=${'x'.repeat(101)}`,
            'moves?pageSize=0',
        ]) {
            const response = await fetch(`${server.url}/api/v1/${path}`);
            strictEqual(response.status, 400, path);
            const body = (await response.json()) as { error: { message: string } };
            strictEqual(typeof body.error.message, 'string');
        }
        for (const path of [
            'species/1/unknown',
            'moves/33/unknown',
            'items/1/unknown',
            'abilities/1/unknown',
            'unknown',
        ]) {
            strictEqual((await fetch(`${server.url}/api/v1/${path}`)).status, 404, path);
        }
        strictEqual(queries, 0);
    } finally {
        await server.close();
    }
});

void test('unknown species and moves return 404, including their subresources', async () => {
    const repository = new DexRepository({ query: () => Promise.resolve([]) }, 'test');
    const server = await startTestServer(createApp(repository));
    try {
        for (const path of [
            'species/1',
            'species/1/name',
            'species/1/details',
            'species/1/sprites',
            'species/1/learnset',
            'species/1/evolution',
            'species/1/machines',
            'species/1/forms',
            'moves/0',
            'items/0',
            'abilities/0',
            'abilities/65535',
            'species/1/abilities',
            'items/65535',
            'moves/33/type',
        ]) {
            strictEqual((await fetch(`${server.url}/api/v1/${path}`)).status, 404, path);
        }
    } finally {
        await server.close();
    }
});

void test('SQL failures do not disclose query details to API callers', async () => {
    const repository = new DexRepository(
        {
            query: () => {
                return Promise.reject(new Error('private SQL connection details'));
            },
        },
        'test',
    );
    const server = await startTestServer(createApp(repository));
    try {
        const response = await fetch(`${server.url}/api/v1/species/1`);
        strictEqual(response.status, 500);
        deepStrictEqual(await response.json(), {
            error: { code: 'internal_error', message: 'Internal server error' },
        });
    } finally {
        await server.close();
    }
});

void test('an app without a database keeps health available and reports the dex unavailable', async () => {
    const server = await startTestServer(createApp());
    try {
        strictEqual((await fetch(`${server.url}/api/health`)).status, 200);
        strictEqual((await fetch(`${server.url}/api/v1/species`)).status, 503);
        strictEqual((await fetch(`${server.url}/api/unknown`)).status, 404);
    } finally {
        await server.close();
    }
});
