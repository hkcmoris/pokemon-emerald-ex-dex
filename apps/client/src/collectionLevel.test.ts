import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import {
    emptyCollection,
    type CollectionDocument,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { setOwnedPokemonLevel } from './collectionLevel.js';

const expected: OwnedPokemon = {
    id: 'ember',
    playthroughId: 'run',
    nickname: 'Ember',
    deleted: false,
    state: {
        speciesId: 256,
        formEpoch: 'combusken',
        level: 22,
        moves: [{ moveId: 10, name: 'Scratch' }],
    },
    createdAt: '2026-10-17T00:00:00Z',
};
const observation: StatObservation = {
    id: 'before',
    pokemonId: expected.id,
    speciesId: 256,
    formEpoch: 'combusken',
    level: 22,
    recordedAt: '2026-10-17T10:00:00Z',
    stats: { speed: 30 },
    deleted: false,
};
function collection(pokemon: OwnedPokemon = expected): CollectionDocument {
    return {
        ...emptyCollection(),
        playthroughs: { run: { id: 'run', name: 'Emerald', party: [expected.id], deleted: false } },
        pokemon: { [expected.id]: pokemon },
        observations: { before: observation },
    };
}

void test('saved level changes retain newer moves, nickname, traits and all observations', () => {
    const current: OwnedPokemon = {
        ...expected,
        nickname: 'Flare',
        natureId: 3,
        state: { ...expected.state, moves: [{ moveId: 52, name: 'Ember' }] },
    };
    const source = collection(current);
    const result = setOwnedPokemonLevel(source, expected, 23);
    deepStrictEqual(result.pokemon.ember, { ...current, state: { ...current.state, level: 23 } });
    strictEqual(result.observations, source.observations);
    strictEqual(result.playthroughs, source.playthroughs);
    strictEqual(source.pokemon.ember.state.level, 22);
});

void test('a level correction does not alter historical measurements and unchanged levels are a no-op', () => {
    const source = collection();
    strictEqual(setOwnedPokemonLevel(source, expected, 22), source);
    const corrected = setOwnedPokemonLevel(source, expected, 21);
    strictEqual(corrected.pokemon.ember.state.level, 21);
    strictEqual(corrected.observations.before.level, 22);
    strictEqual(setOwnedPokemonLevel(source, expected, 1).pokemon.ember.state.level, 1);
    strictEqual(setOwnedPokemonLevel(source, expected, 100).pokemon.ember.state.level, 100);
});

void test('stale levels, changed forms, reassigned members and deleted records cannot be overwritten', () => {
    for (const current of [
        { ...expected, state: { ...expected.state, level: 23 } },
        { ...expected, state: { ...expected.state, level: 21 } },
        { ...expected, state: { ...expected.state, formEpoch: 'later-stage' } },
        { ...expected, state: { ...expected.state, speciesId: 257 } },
        { ...expected, playthroughId: 'other-run' },
        { ...expected, deleted: true },
    ])
        throws(() => setOwnedPokemonLevel(collection(current), expected, 24));
    const source = collection();
    throws(() => setOwnedPokemonLevel({ ...source, pokemon: {} }, expected, 24));
    throws(() => setOwnedPokemonLevel({ ...source, playthroughs: {} }, expected, 24));
    throws(() =>
        setOwnedPokemonLevel(
            { ...source, playthroughs: { run: { ...source.playthroughs.run, deleted: true } } },
            expected,
            24,
        ),
    );
});

void test('level writes reject fractional and out-of-range input at the update boundary', () => {
    for (const level of [0, -1, 101, 22.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        throws(() => setOwnedPokemonLevel(collection(), expected, level));
    }
});
