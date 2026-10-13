import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import {
    statKeys,
    type BaseStats,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { getCurrentStats, getCurrentStatTotal } from './collectionStats.js';

const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 1, level: 20, moves: null, formEpoch: 'current-form' },
    deleted: false,
    createdAt: '2026-10-13T10:00:00.000Z',
};

const stats: BaseStats = {
    hp: 120,
    attack: 70,
    defense: 65,
    spAttack: 90,
    spDefense: 80,
    speed: 75,
};

function observation(overrides: Partial<StatObservation> = {}): StatObservation {
    return {
        id: 'measurement',
        pokemonId: pokemon.id,
        speciesId: pokemon.state.speciesId,
        level: pokemon.state.level,
        formEpoch: pokemon.state.formEpoch,
        recordedAt: '2026-10-13T12:00:00.000Z',
        stats: { ...stats },
        deleted: false,
        ...overrides,
    };
}

void test('current total sums all six recorded stats without changing the observations', () => {
    const observations = Object.freeze([
        observation(),
        observation({ id: 'older', recordedAt: '2026-10-13T11:00:00.000Z' }),
    ]);
    const before = structuredClone(observations);
    strictEqual(getCurrentStatTotal(pokemon, observations), 500);
    deepStrictEqual(observations, before);
});

void test('current total uses the latest same-level measurement, including same-level training', () => {
    const older = observation({
        id: 'older',
        recordedAt: '2026-10-13T11:00:00.000Z',
    });
    const newer = observation({ stats: { ...stats, attack: 85 } });
    for (const observations of [
        [older, newer],
        [newer, older],
    ]) {
        strictEqual(getCurrentStatTotal(pokemon, observations), 515);
    }
});

void test('current total ignores deleted, other individual, stale level and previous form measurements', () => {
    const irrelevant = [
        { deleted: true },
        { pokemonId: 'another' },
        { level: pokemon.state.level - 1 },
        { level: pokemon.state.level + 1 },
        { speciesId: pokemon.state.speciesId + 1 },
        { formEpoch: 'previous-form' },
    ].map((overrides, index) =>
        observation({
            ...overrides,
            id: `irrelevant-${index}`,
            recordedAt: '2026-10-13T13:00:00.000Z',
            stats: { ...stats, hp: 200 },
        }),
    );
    strictEqual(getCurrentStatTotal(pokemon, irrelevant), null);
    strictEqual(getCurrentStatTotal(pokemon, [...irrelevant, observation()]), 500);
    strictEqual(getCurrentStatTotal(pokemon, []), null);
});

void test('current total requires every stat in a single measurement', () => {
    for (const key of statKeys) {
        const partial: Partial<BaseStats> = { ...stats };
        delete partial[key];
        strictEqual(getCurrentStatTotal(pokemon, [observation({ stats: partial })]), null);
    }
});

void test('a newer partial measurement does not fall back to an older complete measurement', () => {
    const older = observation();
    const newer = observation({
        id: 'partial',
        recordedAt: '2026-10-13T13:00:00.000Z',
        stats: { hp: 140 },
    });
    strictEqual(getCurrentStatTotal(pokemon, [older, newer]), null);
    deepStrictEqual(getCurrentStats(pokemon, [older, newer]), { hp: 140 });
});

void test('current total does not combine complementary partial measurements', () => {
    const physical = observation({
        stats: { hp: stats.hp, attack: stats.attack, defense: stats.defense },
    });
    const special = observation({
        id: 'special',
        stats: { spAttack: stats.spAttack, spDefense: stats.spDefense, speed: stats.speed },
    });
    strictEqual(getCurrentStatTotal(pokemon, [physical, special]), null);
    deepStrictEqual(getCurrentStats(pokemon, [physical, special]), {});
});

void test('measurement chronology uses instants rather than timestamp text ordering', () => {
    const earlier = observation({ recordedAt: '2026-10-13T13:00:00+02:00' });
    const later = observation({
        id: 'later',
        recordedAt: '2026-10-13T12:00:00Z',
        stats: { ...stats, hp: 130 },
    });
    strictEqual(getCurrentStatTotal(pokemon, [earlier, later]), 510);
});

void test('equal-time measurements must agree on each stat, even when totals are equal', () => {
    const first = observation();
    const same = observation({ id: 'same', recordedAt: '2026-10-13T14:00:00+02:00' });
    strictEqual(getCurrentStatTotal(pokemon, [first, same]), 500);

    const different = {
        ...same,
        stats: { ...stats, attack: stats.attack + 10, defense: stats.defense - 10 },
    };
    strictEqual(getCurrentStatTotal(pokemon, [first, different]), null);
    strictEqual(getCurrentStatTotal(pokemon, [different, first]), null);
    deepStrictEqual(getCurrentStats(pokemon, [first, different]), {
        hp: 120,
        spAttack: 90,
        spDefense: 80,
        speed: 75,
    });

    const partial = { ...same, stats: { hp: stats.hp } };
    strictEqual(getCurrentStatTotal(pokemon, [first, partial]), null);
});
