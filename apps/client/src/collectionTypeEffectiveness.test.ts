import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError } from './api.js';
import { loadCollectionTypeEffectiveness } from './collectionTypeEffectiveness.js';

const chart: TypeEffectivenessChart = {
    types: [{ typeId: 12, name: 'Grass', iconFile: 'grass.png' }],
    matchups: [{ attackingTypeId: 12, defendingTypeId: 12, multiplier: 0.5 }],
};

void test('collection type charts persist offline and remain scoped to their dataset', async (t) => {
    const records = new Map<string, unknown>();
    const previousIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const database = {
        transaction() {
            const transaction = {
                oncomplete: null as (() => void) | null,
                objectStore: () => ({
                    get(key: string) {
                        const request = {
                            result: structuredClone(records.get(key)),
                            onsuccess: null as (() => void) | null,
                        };
                        queueMicrotask(() => {
                            request.onsuccess?.();
                            queueMicrotask(() => transaction.oncomplete?.());
                        });
                        return request;
                    },
                    put(value: unknown, key: string) {
                        records.set(key, structuredClone(value));
                    },
                }),
            };
            return transaction;
        },
    };
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: {
            open() {
                const request = { result: database, onsuccess: null as (() => void) | null };
                queueMicrotask(() => request.onsuccess?.());
                return request;
            },
        },
    });
    t.after(() => {
        if (previousIndexedDB) Object.defineProperty(globalThis, 'indexedDB', previousIndexedDB);
        else Reflect.deleteProperty(globalThis, 'indexedDB');
    });

    await t.test('uses a persisted complete chart while offline', async (t) => {
        records.set('type-effectiveness:offline-dataset', chart);
        const fetch = t.mock.method(globalThis, 'fetch', () => {
            throw new Error('Offline');
        });
        deepStrictEqual(await loadCollectionTypeEffectiveness('offline-dataset'), chart);
        deepStrictEqual(await loadCollectionTypeEffectiveness('offline-dataset'), chart);
        strictEqual(fetch.mock.callCount(), 0);
        await rejects(loadCollectionTypeEffectiveness('another-dataset'), /Offline/);
    });

    await t.test('shares concurrent requests and persists the returned chart', async (t) => {
        const fetch = t.mock.method(globalThis, 'fetch', (path: string) => {
            strictEqual(path, '/api/v1/type-effectiveness');
            return Promise.resolve(Response.json({ data: chart }));
        });
        deepStrictEqual(
            await Promise.all([
                loadCollectionTypeEffectiveness('fresh-dataset'),
                loadCollectionTypeEffectiveness('fresh-dataset'),
            ]),
            [chart, chart],
        );
        strictEqual(fetch.mock.callCount(), 1);
        deepStrictEqual(records.get('type-effectiveness:fresh-dataset'), chart);
    });

    await t.test(
        'rejects partial cached and fetched data and allows retry after failure',
        async (t) => {
            records.set('type-effectiveness:retry-dataset', { ...chart, matchups: [] });
            let attempts = 0;
            t.mock.method(globalThis, 'fetch', () => {
                attempts += 1;
                return Promise.resolve(
                    attempts === 1
                        ? new Response('', { status: 503 })
                        : Response.json({
                              data: attempts === 2 ? { ...chart, matchups: [] } : chart,
                          }),
                );
            });
            await rejects(
                loadCollectionTypeEffectiveness('retry-dataset'),
                (error: unknown) => error instanceof ApiRequestError && error.status === 503,
            );
            await rejects(
                loadCollectionTypeEffectiveness('retry-dataset'),
                /Type effectiveness data is unavailable/,
            );
            deepStrictEqual(await loadCollectionTypeEffectiveness('retry-dataset'), chart);
            strictEqual(attempts, 3);
        },
    );
});
