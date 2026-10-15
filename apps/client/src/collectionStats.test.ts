import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import {
    statKeys,
    type BaseStats,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { getCurrentStats, getCurrentStatTotal, predictStats } from './collectionStats.js';

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

function predictionHistory(): StatObservation[] {
    return [
        observation({
            id: 'previous-level',
            level: 18,
            recordedAt: '2026-10-13T10:00:00Z',
            stats: { hp: 114, attack: 68, defense: 64, spAttack: 86, spDefense: 77, speed: 73 },
        }),
        observation({
            id: 'latest-level',
            level: 19,
            recordedAt: '2026-10-13T11:00:00Z',
        }),
    ];
}

const predictedStats: BaseStats = {
    hp: 126,
    attack: 72,
    defense: 66,
    spAttack: 94,
    spDefense: 83,
    speed: 77,
};

void test('predictions extrapolate all six stats without changing or reordering history', () => {
    const history = Object.freeze(predictionHistory().reverse());
    const before = structuredClone(history);
    deepStrictEqual(predictStats(pokemon, history), predictedStats);
    deepStrictEqual(history, before);
    deepStrictEqual(predictStats(pokemon, [...history].reverse()), predictedStats);
});

void test('predictions account for level gaps, round values, and allow unchanged stats', () => {
    const history = [
        observation({
            level: 14,
            recordedAt: '2026-10-13T10:00:00Z',
            stats: { hp: 33, attack: 20 },
        }),
        observation({ level: 18, stats: { hp: 40, attack: 20 } }),
    ];
    deepStrictEqual(predictStats(pokemon, history), { hp: 44, attack: 20 });
    deepStrictEqual(predictStats(pokemon, history, 22), { hp: 47, attack: 20 });
});

void test('predictions require two distinct levels and a valid unrecorded later target', () => {
    deepStrictEqual(predictStats(pokemon, []), {});
    deepStrictEqual(predictStats(pokemon, [predictionHistory()[0]]), {});
    deepStrictEqual(predictStats(pokemon, [predictionHistory()[0], predictionHistory()[0]]), {});
    for (const target of [0, -1, 101, 19.5, NaN, Infinity, 18, 19])
        deepStrictEqual(predictStats(pokemon, predictionHistory(), target), {});
    for (const recordedLevel of [20, 21]) {
        deepStrictEqual(
            predictStats(pokemon, [...predictionHistory(), observation({ level: recordedLevel })]),
            {},
        );
    }
});

void test('predictions ignore deleted measurements and history from other individuals or forms', () => {
    const irrelevant = [
        { deleted: true },
        { pokemonId: 'another' },
        { speciesId: pokemon.state.speciesId + 1 },
        { formEpoch: 'previous-form' },
    ].map((overrides, index) =>
        observation({ ...overrides, id: `irrelevant-${index}`, level: 21 }),
    );
    deepStrictEqual(predictStats(pokemon, [...predictionHistory(), ...irrelevant]), predictedStats);
    deepStrictEqual(predictStats(pokemon, irrelevant), {});
});

void test('predictions use the latest measurement per level without resurrecting omitted stats', () => {
    const history = predictionHistory();
    const newer = observation({
        level: 19,
        recordedAt: '2026-10-13T12:00:00Z',
        stats: { hp: 124 },
    });
    deepStrictEqual(predictStats(pokemon, [...history, newer]), { hp: 134 });
    deepStrictEqual(predictStats(pokemon, [newer, ...history]), { hp: 134 });
});

void test('predictions do not bridge missing stats at either of the latest two levels', () => {
    const history = [
        observation({
            level: 17,
            recordedAt: '2026-10-13T09:00:00Z',
            stats: { hp: 100, attack: 65 },
        }),
        observation({
            level: 18,
            recordedAt: '2026-10-13T10:00:00Z',
            stats: { attack: 68 },
        }),
        observation({ level: 19, stats: { hp: 120 } }),
    ];
    deepStrictEqual(predictStats(pokemon, history), {});
});

void test('predictions omit only stats that conflict across tied latest measurements', () => {
    const history = predictionHistory();
    const tiedLatest = {
        ...history[1],
        id: 'conflicting-latest',
        recordedAt: '2026-10-13T13:00:00+02:00',
        stats: { ...stats, hp: stats.hp + 5 },
    };
    const tiedPrevious = {
        ...history[0],
        id: 'conflicting-previous',
        stats: { ...history[0].stats, attack: 60 },
    };
    const expected = { defense: 66, spAttack: 94, spDefense: 83, speed: 77 };
    deepStrictEqual(predictStats(pokemon, [...history, tiedLatest, tiedPrevious]), expected);
    deepStrictEqual(predictStats(pokemon, [tiedPrevious, tiedLatest, ...history]), expected);
    deepStrictEqual(
        predictStats(pokemon, [...history, { ...history[1], stats: { hp: stats.hp } }]),
        { hp: 126 },
    );
});

void test('predictions omit decreasing stats instead of projecting questionable growth', () => {
    const history = predictionHistory();
    history[1].stats = { hp: 110, attack: 68 };
    deepStrictEqual(predictStats(pokemon, history), { attack: 68 });
});

void test('predictions compare recording instants and allow levels recorded in the same minute', () => {
    const history = predictionHistory();
    history[0].recordedAt = '2026-10-13T12:30:00+02:00';
    deepStrictEqual(predictStats(pokemon, history), predictedStats);
    history[0].recordedAt = '2026-10-13T11:00:00Z';
    deepStrictEqual(predictStats(pokemon, history), predictedStats);
    history[0].recordedAt = '2026-10-13T11:01:00Z';
    deepStrictEqual(predictStats(pokemon, history), {});
});

void test('predictions omit values beyond the stat limit and support level 100', () => {
    const history = predictionHistory();
    history[0].level = 98;
    history[0].stats = { hp: 32000, attack: 400 };
    history[1].level = 99;
    history[1].stats = { hp: 65000, attack: 401 };
    deepStrictEqual(predictStats(pokemon, history, 100), { attack: 402 });
});
