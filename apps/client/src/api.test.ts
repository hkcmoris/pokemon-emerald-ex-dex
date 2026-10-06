import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import {
    ApiRequestError,
    fetchCatalog,
    fetchSpecies,
    fetchSpeciesDetails,
    fetchSpeciesEvolutions,
} from './api.js';

void test('catalog metadata and type choices come from the API', async (t) => {
    const dataset = {
        datasetId: 'test-version',
        game: 'Test',
        version: '2.0',
        speciesFormCount: 3,
    };
    const types = [{ typeId: 18, name: 'Fairy', iconFile: 'fairy-v2.png' }];
    const paths: string[] = [];
    t.mock.method(globalThis, 'fetch', (path: string) => {
        paths.push(path);
        return Promise.resolve(Response.json({ data: path.endsWith('dataset') ? dataset : types }));
    });
    deepStrictEqual(await fetchCatalog(), { dataset, types });
    deepStrictEqual(paths.sort(), ['/api/v1/dataset', '/api/v1/types']);
});

void test('species requests encode filters and pagination and forward the cancellation signal', async (t) => {
    const controller = new AbortController();
    const response = { data: [], meta: { total: 0, page: 2, pageSize: 40, totalPages: 0 } };
    t.mock.method(globalThis, 'fetch', (path: string, init: RequestInit) => {
        const url = new URL(path, 'http://localhost');
        strictEqual(url.pathname, '/api/v1/species');
        deepStrictEqual(Object.fromEntries(url.searchParams), {
            q: '#0001 & Pokémon',
            type: 'Poison',
            sort: 'speed',
            page: '2',
            pageSize: '40',
        });
        strictEqual(init.signal, controller.signal);
        return Promise.resolve(Response.json(response));
    });
    deepStrictEqual(
        await fetchSpecies(
            { q: '#0001 & Pokémon', type: 'Poison', sort: 'speed', page: 2, pageSize: 40 },
            controller.signal,
        ),
        response,
    );
});

void test('an API failure rejects the request instead of falling back to a JSON export', async (t) => {
    t.mock.method(globalThis, 'fetch', () =>
        Promise.resolve(new Response('Unavailable', { status: 503 })),
    );
    await rejects(fetchCatalog(), /HTTP 503/);
    await rejects(fetchSpecies({ q: '', type: '', sort: 'id', page: 1, pageSize: 40 }), /HTTP 503/);
});

void test('cancelled requests are rejected', async (t) => {
    const controller = new AbortController();
    controller.abort();
    t.mock.method(globalThis, 'fetch', (_path: string, init: RequestInit) => {
        init.signal?.throwIfAborted();
        return Promise.resolve(Response.json({ data: [] }));
    });
    await rejects(fetchCatalog(controller.signal), { name: 'AbortError' });
});

void test('species details are loaded by internal ID with the cancellation signal', async (t) => {
    const signal = new AbortController().signal;
    const record = { speciesId: 25, learnset: [], machines: [], evolutionLinks: [] };
    t.mock.method(globalThis, 'fetch', (path: string, init: RequestInit) => {
        strictEqual(path, '/api/v1/species/25/details');
        strictEqual(init.signal, signal);
        return Promise.resolve(Response.json({ data: record }));
    });
    deepStrictEqual(await fetchSpeciesDetails(25, signal), record);
});

void test('a missing species preserves its 404 status for the detail page', async (t) => {
    t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('', { status: 404 })));
    await rejects(
        fetchSpeciesDetails(65535),
        (error: unknown) => error instanceof ApiRequestError && error.status === 404,
    );
});

void test('the full evolution line uses its dedicated API endpoint and forwards cancellation', async (t) => {
    const signal = new AbortController().signal;
    const links = [
        { fromSpeciesId: 92, toSpeciesId: 93 },
        { fromSpeciesId: 93, toSpeciesId: 94 },
    ];
    t.mock.method(globalThis, 'fetch', (path: string, init: RequestInit) => {
        strictEqual(path, '/api/v1/species/94/evolution');
        strictEqual(init.signal, signal);
        return Promise.resolve(Response.json({ data: links }));
    });
    deepStrictEqual(await fetchSpeciesEvolutions(94, signal), links);
});

void test('an unavailable evolution line stays an error instead of showing incomplete immediate links', async (t) => {
    t.mock.method(globalThis, 'fetch', () => Promise.resolve(new Response('', { status: 503 })));
    await rejects(fetchSpeciesEvolutions(94), /HTTP 503/);
});
