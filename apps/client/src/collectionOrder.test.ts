import { deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

import { orderCollectionByScore, orderCollectionPokemon } from './collectionOrder.js';

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

void test('score order ranks reserves and party members together without keeping the party first', () => {
    const owned = ['first', 'reserve-a', 'second', 'reserve-b'].map(pokemon);
    const scores = new Map([
        ['first', 20],
        ['second', 60],
        ['reserve-a', 90],
        ['reserve-b', 40],
    ]);

    deepStrictEqual(
        orderCollectionByScore(owned, ['first', 'second'], scores).map((entry) => entry.id),
        ['reserve-a', 'second', 'reserve-b', 'first'],
    );
});

void test('equal scores retain party positions followed by the existing reserve order', () => {
    const owned = ['reserve-b', ...storedOrder, 'reserve-a'].map(pokemon);
    const scores = new Map(owned.map((entry) => [entry.id, 50]));

    deepStrictEqual(
        orderCollectionByScore(owned, party, scores).map((entry) => entry.id),
        [...party, 'reserve-b', 'reserve-a'],
    );
    deepStrictEqual(orderCollectionByScore(owned, [], scores), owned);
});

void test('null and missing scores follow every numeric score, including zero, in default order', () => {
    const owned = ['reserve-missing', 'first', 'zero', 'second', 'reserve-null'].map(pokemon);
    const scores = new Map<string, number | null>([
        ['first', null],
        ['zero', 0],
        ['reserve-null', null],
    ]);

    deepStrictEqual(
        orderCollectionByScore(owned, ['second', 'first'], scores).map((entry) => entry.id),
        ['zero', 'second', 'first', 'reserve-missing', 'reserve-null'],
    );
    deepStrictEqual(orderCollectionByScore([], party, scores), []);
});

void test('score sorting leaves Pokémon records, party positions and the score map unchanged', () => {
    const owned = Object.freeze(['second', 'reserve', 'first'].map(pokemon));
    const lineup = Object.freeze(['first', 'second']);
    const scores = new Map<string, number | null>([
        ['first', null],
        ['second', 40],
        ['reserve', 80],
    ]);
    const before = structuredClone({ owned, lineup, scores });

    deepStrictEqual(
        orderCollectionByScore(owned, lineup, scores).map((entry) => entry.id),
        ['reserve', 'second', 'first'],
    );
    deepStrictEqual({ owned, lineup, scores }, before);
});
