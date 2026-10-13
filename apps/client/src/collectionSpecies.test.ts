import { deepStrictEqual, rejects, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { Move } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError } from './api.js';
import { loadCollectionMove, loadCollectionSpecies } from './collectionSpecies.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';

void test('collection move metadata resolves exact IDs and remains available offline', async (t) => {
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

    const species = loadCollectionSpeciesFixture([1])[1];
    const cachedMove: Move = {
        ...species.learnset[0],
        moveId: 50001,
        type: 'Water',
        typeIconFile: 'water.png',
    };
    records.set('move-index', { [cachedMove.moveId]: cachedMove });

    await t.test('uses persisted metadata without a network request', async (t) => {
        const fetch = t.mock.method(globalThis, 'fetch', () => {
            throw new Error('Offline');
        });
        deepStrictEqual(await loadCollectionMove(cachedMove.moveId), cachedMove);
        strictEqual(fetch.mock.callCount(), 0);
    });

    await t.test(
        'reuses loaded learnsets and machine moves without a network request',
        async (t) => {
            records.set(`species:${species.speciesId}`, species);
            const fetch = t.mock.method(globalThis, 'fetch', () => {
                throw new Error('Offline');
            });
            await loadCollectionSpecies(species.speciesId);
            const learnsetMove = species.learnset[0];
            const machineMove = species.machines.find(
                (move) => !species.learnset.some((entry) => entry.moveId === move.moveId),
            )!;
            deepStrictEqual(await loadCollectionMove(learnsetMove.moveId), learnsetMove);
            deepStrictEqual(await loadCollectionMove(machineMove.moveId), machineMove);
            strictEqual(fetch.mock.callCount(), 0);
        },
    );

    await t.test(
        'fetches the exact ID once and caches it alongside existing entries',
        async (t) => {
            const move = { ...cachedMove, moveId: 50002, name: 'Off-family move' };
            const fetch = t.mock.method(globalThis, 'fetch', (path: string) => {
                strictEqual(path, '/api/v1/moves/50002');
                return Promise.resolve(Response.json({ data: move }));
            });
            const results = await Promise.all([
                loadCollectionMove(move.moveId),
                loadCollectionMove(move.moveId),
            ]);
            deepStrictEqual(results, [move, move]);
            deepStrictEqual(await loadCollectionMove(move.moveId), move);
            strictEqual(fetch.mock.callCount(), 1);
            const stored = records.get('move-index') as Record<number, Move>;
            deepStrictEqual(stored[cachedMove.moveId], cachedMove);
            deepStrictEqual(stored[move.moveId], move);
        },
    );

    await t.test('keeps a missing move unresolved and permits a later retry', async (t) => {
        const move = { ...cachedMove, moveId: 50003 };
        let attempts = 0;
        t.mock.method(globalThis, 'fetch', () => {
            attempts += 1;
            return Promise.resolve(
                attempts === 1 ? new Response('', { status: 404 }) : Response.json({ data: move }),
            );
        });
        await rejects(
            loadCollectionMove(move.moveId),
            (error: unknown) => error instanceof ApiRequestError && error.status === 404,
        );
        deepStrictEqual(await loadCollectionMove(move.moveId), move);
        strictEqual(attempts, 2);
    });
});
