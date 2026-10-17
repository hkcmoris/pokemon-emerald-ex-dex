import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import {
    emptyCollection,
    type CollectionDocument,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { saveStatObservation } from './collectionObservations.js';

const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: 'Sprout',
    state: { speciesId: 1, level: 12, moves: null, formEpoch: 'current-form' },
    deleted: false,
    createdAt: '2026-10-13T10:00:00.000Z',
};
const document: CollectionDocument = {
    ...emptyCollection(),
    pokemon: { [pokemon.id]: pokemon },
};
const observation: StatObservation = {
    id: 'observation',
    pokemonId: pokemon.id,
    speciesId: pokemon.state.speciesId,
    formEpoch: pokemon.state.formEpoch,
    level: 15,
    recordedAt: '2026-10-17T10:00:00.000Z',
    stats: { hp: 42, speed: 28 },
    deleted: false,
};

void test('a new higher-level observation advances level and saves partial stats together', () => {
    const next = saveStatObservation(document, observation);
    deepStrictEqual(next.pokemon[pokemon.id], {
        ...pokemon,
        state: { ...pokemon.state, level: 15 },
    });
    strictEqual(next.observations[observation.id], observation);
    strictEqual(document.pokemon[pokemon.id].state.level, 12);
    deepStrictEqual(document.observations, {});
});

void test('older and same-level screenshots stay in history without lowering current level', () => {
    for (const level of [9, 12]) {
        const entry = { ...observation, level };
        const next = saveStatObservation(document, entry);
        strictEqual(next.pokemon, document.pokemon);
        strictEqual(next.observations[entry.id], entry);
    }
});

void test('observations from another species or form stage never change the current form or level', () => {
    for (const entry of [
        { ...observation, speciesId: 2 },
        { ...observation, formEpoch: 'earlier-form' },
    ]) {
        const next = saveStatObservation(document, entry);
        strictEqual(next.pokemon, document.pokemon);
        strictEqual(next.observations[entry.id], entry);
    }
});

void test('correcting, removing, or restoring an existing observation never advances level', () => {
    const original = { ...observation, level: 10 };
    for (const deleted of [false, true]) {
        const current = {
            ...document,
            observations: { [original.id]: { ...original, deleted } },
        };
        for (const entry of [observation, { ...observation, deleted: true }]) {
            const next = saveStatObservation(current, entry);
            strictEqual(next.pokemon, current.pokemon);
            strictEqual(next.observations[entry.id], entry);
        }
    }
});

void test('a deleted observation or released Pokémon cannot advance the current level', () => {
    strictEqual(
        saveStatObservation(document, { ...observation, deleted: true }).pokemon,
        document.pokemon,
    );
    const released = {
        ...document,
        pokemon: { [pokemon.id]: { ...pokemon, deleted: true } },
    };
    strictEqual(saveStatObservation(released, observation).pokemon, released.pokemon);
});

void test('the transition uses the latest saved level and form, not the form opened by the user', () => {
    const evolved = {
        ...document,
        pokemon: {
            [pokemon.id]: {
                ...pokemon,
                state: { ...pokemon.state, speciesId: 2, formEpoch: 'evolved', level: 16 },
            },
        },
    };
    const next = saveStatObservation(evolved, observation);
    strictEqual(next.pokemon, evolved.pokemon);
    strictEqual(next.observations[observation.id], observation);
});
