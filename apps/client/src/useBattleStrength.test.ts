import { notStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type CollectionDocument,
    type OwnedPokemon,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { useBattleStrength, type OwnedBattleStrength } from './useBattleStrength.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';

const species = {
    ...loadCollectionSpeciesFixture([255])[255],
    types: ['Fire'],
    typeIds: [10],
    typeIconFiles: [null],
    stats: { hp: 45, attack: 60, defense: 40, spAttack: 70, spDefense: 50, speed: 45 },
    baseStatTotal: 310,
};
const move = species.learnset.find((entry) => entry.moveId === 52)!;
const chart: TypeEffectivenessChart = {
    types: [{ typeId: 10, name: 'Fire', iconFile: null }],
    matchups: [{ attackingTypeId: 10, defendingTypeId: 10, multiplier: 0.5 }],
};
const pokemon: OwnedPokemon = {
    id: 'torchic',
    playthroughId: 'run',
    nickname: '',
    state: {
        speciesId: 255,
        level: 12,
        moves: [{ moveId: move.moveId, name: move.name }],
        formEpoch: 'first',
    },
    deleted: false,
    createdAt: '2026-10-17T12:00:00Z',
};
function documentFor(...entries: OwnedPokemon[]): CollectionDocument {
    return {
        ...emptyCollection(),
        pokemon: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
    };
}
function client(): QueryClient {
    return new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    });
}
function renderScores(
    queryClient: QueryClient,
    document: CollectionDocument,
    conflicts: CollectionConflict[] = [],
): ReadonlyMap<string, OwnedBattleStrength> {
    let result: ReadonlyMap<string, OwnedBattleStrength> | undefined;
    function Probe() {
        result = useBattleStrength(
            Object.values(document.pokemon),
            document,
            conflicts,
            'score-fixture',
        );
        return null;
    }
    renderToStaticMarkup(
        createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)),
    );
    return result!;
}

void test('scores use species reference moves without a separate move query and recompute from current owned state', () => {
    const queryClient = client();
    queryClient.setQueryData(['collection-species', 255], species);
    queryClient.setQueryData(['collection-type-effectiveness', 'score-fixture'], chart);
    const first = renderScores(queryClient, documentFor(pokemon)).get(pokemon.id)!;
    strictEqual(first.loading, false);
    strictEqual(first.result.status, 'available');
    const raised = { ...pokemon, state: { ...pokemon.state, level: 40 } };
    const second = renderScores(queryClient, documentFor(raised)).get(pokemon.id)!;
    notStrictEqual(second.result.value, first.result.value);
    strictEqual(queryClient.getQueryData(['collection-move', move.moveId]), undefined);
    queryClient.clear();
});

void test('conflicts suspend only the affected score; unknown moves remain distinct from an empty moveset', () => {
    const queryClient = client();
    queryClient.setQueryData(['collection-species', 255], species);
    queryClient.setQueryData(['collection-type-effectiveness', 'score-fixture'], chart);
    const unknown = { ...pokemon, id: 'unknown', state: { ...pokemon.state, moves: null } };
    const empty = { ...pokemon, id: 'empty', state: { ...pokemon.state, moves: [] } };
    const document = documentFor(pokemon, unknown, empty);
    const conflicts: CollectionConflict[] = [
        {
            id: 'conflict',
            kind: 'field',
            entity: 'pokemon',
            entityId: pokemon.id,
            field: 'state',
            base: null,
            local: null,
            remote: null,
        },
    ];
    const scores = renderScores(queryClient, document, conflicts);
    strictEqual(scores.get(pokemon.id)?.result.status, 'conflict');
    strictEqual(scores.get(pokemon.id)?.result.value, null);
    strictEqual(scores.get('unknown')?.result.status, 'incomplete');
    strictEqual(scores.get('unknown')?.result.value, null);
    strictEqual(scores.get('empty')?.result.status, 'available');
    strictEqual(scores.get('empty')?.result.parts.moves, 0);
    strictEqual(renderScores(queryClient, document).get(pokemon.id)?.result.status, 'available');
    queryClient.clear();
});

void test('offline reload reads cached species and chart and scores moves found only in the species cache', async (t) => {
    const records = new Map<string, unknown>([
        ['species:255', species],
        ['type-effectiveness:score-fixture', chart],
    ]);
    const previousIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const wasOnline = onlineManager.isOnline();
    const queryClient = client();
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: {
            open() {
                const request = {
                    result: {
                        transaction() {
                            const transaction = {
                                oncomplete: null as (() => void) | null,
                                objectStore: () => ({
                                    get(key: string) {
                                        const read = {
                                            result: structuredClone(records.get(key)),
                                            onsuccess: null as (() => void) | null,
                                        };
                                        queueMicrotask(() => {
                                            read.onsuccess?.();
                                            queueMicrotask(() => transaction.oncomplete?.());
                                        });
                                        return read;
                                    },
                                }),
                            };
                            return transaction;
                        },
                    },
                    onsuccess: null as (() => void) | null,
                };
                queueMicrotask(() => request.onsuccess?.());
                return request;
            },
        },
    });
    t.after(() => {
        onlineManager.setOnline(wasOnline);
        if (previousIndexedDB) Object.defineProperty(globalThis, 'indexedDB', previousIndexedDB);
        else Reflect.deleteProperty(globalThis, 'indexedDB');
        queryClient.clear();
    });
    onlineManager.setOnline(false);
    const fetch = t.mock.method(globalThis, 'fetch', () => {
        throw new Error('Offline');
    });
    renderScores(queryClient, documentFor(pokemon));
    await Promise.all([
        queryClient
            .getQueryCache()
            .find({ queryKey: ['collection-species', 255] })!
            .fetch(),
        queryClient
            .getQueryCache()
            .find({ queryKey: ['collection-type-effectiveness', 'score-fixture'] })!
            .fetch(),
    ]);
    const result = renderScores(queryClient, documentFor(pokemon)).get(pokemon.id)!;
    strictEqual(result.loading, false);
    strictEqual(result.result.status, 'available');
    strictEqual(fetch.mock.callCount(), 0);
    strictEqual(records.has('move-index'), false);
});
