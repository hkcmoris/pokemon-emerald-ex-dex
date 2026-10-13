import { deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

import { orderCollectionPokemon } from './collectionOrder.js';

function pokemon(id: string): OwnedPokemon {
    return {
        id,
        playthroughId: 'run',
        nickname: '',
        state: { speciesId: 1, level: 5, moves: null, formEpoch: 'stage-one' },
        deleted: false,
        createdAt: '2026-10-13T12:00:00.000Z',
    };
}

const party = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const storedOrder = ['second', 'third', 'sixth', 'first', 'fourth', 'fifth'];

void test('collection follows all six party positions instead of record insertion order', () => {
    const records = Object.fromEntries(storedOrder.map((id) => [id, pokemon(id)]));
    const owned = Object.values(records);

    deepStrictEqual(
        orderCollectionPokemon(owned, party).map((entry) => entry.id),
        party,
    );
    deepStrictEqual(
        owned.map((entry) => entry.id),
        storedOrder,
    );
    deepStrictEqual(Object.keys(records), storedOrder);
});

void test('collection follows party changes and keeps reserve Pokemon afterward in their existing order', () => {
    const owned = ['reserve-b', ...storedOrder, 'reserve-a'].map(pokemon);
    const reorderedParty = ['sixth', 'first', 'second', 'third', 'fourth', 'fifth'];
    deepStrictEqual(
        orderCollectionPokemon(owned, reorderedParty).map((entry) => entry.id),
        [...reorderedParty, 'reserve-b', 'reserve-a'],
    );

    const replacedParty = ['reserve-a', ...reorderedParty.slice(1)];
    deepStrictEqual(
        orderCollectionPokemon(owned, replacedParty).map((entry) => entry.id),
        [...replacedParty, 'reserve-b', 'sixth'],
    );
});

void test('collection keeps its existing order without an active party', () => {
    const owned = storedOrder.map(pokemon);
    deepStrictEqual(orderCollectionPokemon(owned, []), owned);
    deepStrictEqual(orderCollectionPokemon([], party), []);
});
