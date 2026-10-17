import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
    statKeys,
    type BaseStats,
    type Move,
    type OwnedPokemon,
    type Pokemon,
    type StatObservation,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { calculateBattleStrength, type BattleStrengthInput } from './battleStrength.js';

const romMoves = (
    JSON.parse(
        readFileSync(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
            'utf8',
        ),
    ) as { moves: Move[] }
).moves;
const moves: Move[] = romMoves.map((move) => ({
    ...move,
    descriptionCs: null,
    typeIconFile: null,
    categoryIconFile: null,
}));
const byId = new Map(moves.map((move) => [move.moveId, move]));
const typeIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function makeChart(overrides: Record<string, number> = {}): TypeEffectivenessChart {
    return {
        types: typeIds.map((typeId) => ({ typeId, name: String(typeId), iconFile: null })),
        matchups: typeIds.flatMap((attackingTypeId) =>
            typeIds.map((defendingTypeId) => ({
                attackingTypeId,
                defendingTypeId,
                multiplier: overrides[`${attackingTypeId}:${defendingTypeId}`] ?? 1,
            })),
        ),
    };
}

const species: Pokemon = {
    speciesId: 1,
    name: 'Reference',
    typeIds: [0],
    types: ['Normal'],
    typeIconFiles: [null],
    stats: { hp: 80, attack: 80, defense: 80, spAttack: 80, spDefense: 80, speed: 80 },
    baseStatTotal: 480,
    sprites: null,
};
const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: '',
    state: {
        speciesId: 1,
        level: 50,
        moves: [{ moveId: 33, name: 'Tackle' }],
        formEpoch: 'current',
    },
    deleted: false,
    createdAt: '2026-10-17T10:00:00Z',
};
const input: BattleStrengthInput = {
    pokemon,
    species,
    observations: [],
    moves,
    chart: makeChart(),
};

function equip(
    ids: readonly number[],
    overrides: Partial<BattleStrengthInput> = {},
): BattleStrengthInput {
    const current = overrides.pokemon ?? pokemon;
    return {
        ...input,
        ...overrides,
        pokemon: {
            ...current,
            state: {
                ...current.state,
                moves: ids.map((moveId) => ({ moveId, name: byId.get(moveId)?.name ?? 'Unknown' })),
            },
        },
    };
}

function measurement(
    stats: Partial<BaseStats>,
    overrides: Partial<StatObservation> = {},
): StatObservation {
    return {
        id: 'measurement',
        pokemonId: pokemon.id,
        speciesId: pokemon.state.speciesId,
        level: pokemon.state.level,
        formEpoch: pokemon.state.formEpoch,
        recordedAt: '2026-10-17T12:00:00Z',
        stats,
        deleted: false,
        ...overrides,
    };
}

const recorded: BaseStats = {
    hp: 160,
    attack: 120,
    defense: 100,
    spAttack: 80,
    spDefense: 100,
    speed: 90,
};

void test('scores derive from current level and stay on a fixed bounded scale', () => {
    const results = [5, 50, 100].map((level) =>
        calculateBattleStrength({
            ...input,
            pokemon: { ...pokemon, state: { ...pokemon.state, level } },
        }),
    );
    for (const result of results) {
        strictEqual(result.status, 'available');
        ok(result.value !== null && result.value >= 0 && result.value <= 100);
        deepStrictEqual(result.estimatedStats, statKeys);
    }
    ok(results[0].value! < results[1].value! && results[1].value! < results[2].value!);
    deepStrictEqual(calculateBattleStrength({ ...input, moves: [...moves].reverse() }), results[1]);

    const low = calculateBattleStrength(
        equip([147, 105, 89, 53], {
            pokemon: { ...pokemon, state: { ...pokemon.state, level: 5 } },
        }),
    );
    const high = calculateBattleStrength(
        equip([], { pokemon: { ...pokemon, state: { ...pokemon.state, level: 50 } } }),
    );
    ok(low.value! < high.value!, 'static move and typing quality cannot swamp current strength');
});

void test('level and nature are not counted twice when all current stats are recorded', () => {
    const base = calculateBattleStrength({ ...input, observations: [measurement(recorded)] });
    const sameStats = calculateBattleStrength({
        ...input,
        pokemon: { ...pokemon, natureId: 3, state: { ...pokemon.state, level: 100 } },
        observations: [measurement(recorded, { level: 100 })],
    });
    deepStrictEqual(sameStats, base);
    deepStrictEqual(base.estimatedStats, []);
    strictEqual(base.value, Math.round(base.parts.stats! + base.parts.moves! + base.parts.typing!));
});

void test('missing stats use 15 IV, zero EV and integer nature rounding without replacing measurements', () => {
    const owned = { ...pokemon, natureId: 3 };
    // Base 80, level 50: floor(175*50/100)=87; Adamant gives 101 Attack and 82 Sp. Atk.
    const estimated: BaseStats = {
        hp: 147,
        attack: 101,
        defense: 92,
        spAttack: 82,
        spDefense: 92,
        speed: 92,
    };
    const result = calculateBattleStrength({
        ...input,
        pokemon: owned,
        observations: [measurement({ hp: 180 })],
    });
    const measured = calculateBattleStrength({
        ...input,
        pokemon: owned,
        observations: [measurement({ ...estimated, hp: 180 })],
    });
    deepStrictEqual(result.parts, measured.parts);
    strictEqual(result.value, measured.value);
    deepStrictEqual(
        result.estimatedStats,
        statKeys.filter((key) => key !== 'hp'),
    );
    strictEqual(
        calculateBattleStrength({ ...input, pokemon: { ...pokemon, natureId: null } }).value,
        calculateBattleStrength(input).value,
    );
});

void test('Shedinja estimates retain its one HP exception', () => {
    const shedinja = { ...species, speciesId: 292, stats: { ...species.stats, hp: 1 } };
    const owned = { ...pokemon, state: { ...pokemon.state, speciesId: 292 } };
    const estimate = calculateBattleStrength({ ...input, pokemon: owned, species: shedinja });
    const measured = calculateBattleStrength({
        ...input,
        pokemon: owned,
        species: shedinja,
        observations: [
            measurement(
                { hp: 1, attack: 92, defense: 92, spAttack: 92, spDefense: 92, speed: 92 },
                { speciesId: 292 },
            ),
        ],
    });
    deepStrictEqual(estimate.parts, measured.parts);
});

void test('latest measurement replaces stale levels, forms, individuals and older full measurements', () => {
    const stale = [
        measurement(recorded, { level: 49 }),
        measurement(recorded, { formEpoch: 'previous' }),
        measurement(recorded, { speciesId: 2 }),
        measurement(recorded, { pokemonId: 'other' }),
        measurement(recorded, { deleted: true }),
    ];
    deepStrictEqual(
        calculateBattleStrength({ ...input, observations: stale }),
        calculateBattleStrength(input),
    );
    const newer = measurement({ hp: 180 }, { id: 'newer', recordedAt: '2026-10-17T13:00:00Z' });
    deepStrictEqual(
        calculateBattleStrength({ ...input, observations: [measurement(recorded), newer] }),
        calculateBattleStrength({ ...input, observations: [newer] }),
    );
});

void test('duplicate and weaker overlapping moves do not inflate attack coverage', () => {
    const best = calculateBattleStrength(equip([85]));
    deepStrictEqual(calculateBattleStrength(equip([85, 85])), best);
    deepStrictEqual(calculateBattleStrength(equip([85, 84])), best);
    const chart = makeChart({ '10:11': 0.5, '10:12': 2, '11:10': 2, '11:12': 0.5 });
    const fire = calculateBattleStrength(equip([53], { chart }));
    const coverage = calculateBattleStrength(equip([53, 57], { chart }));
    ok(coverage.parts.moves! > fire.parts.moves!);
});

void test('attack scoring respects accuracy, STAB and attacking-stat alignment', () => {
    const move = byId.get(85)!;
    const baseInput = equip([85], { observations: [measurement(recorded)] });
    const base = calculateBattleStrength(baseInput);
    const physical = calculateBattleStrength({ ...baseInput, moves: [{ ...move, categoryId: 0 }] });
    ok(physical.parts.moves! > base.parts.moves!);
    const lowAccuracy = calculateBattleStrength({
        ...baseInput,
        moves: [{ ...move, accuracy: 50 }],
    });
    strictEqual(lowAccuracy.parts.moves, base.parts.moves! / 2);
    const noCheck = calculateBattleStrength({ ...baseInput, moves: [{ ...move, accuracy: 0 }] });
    strictEqual(noCheck.parts.moves, base.parts.moves);
    const stab = calculateBattleStrength({ ...baseInput, species: { ...species, typeIds: [13] } });
    ok(stab.parts.moves! > base.parts.moves!);
});

void test('Body Press includes Defense in current offensive strength without an unbounded alignment bonus', () => {
    const defensive = { ...recorded, defense: 240 };
    const base = calculateBattleStrength(equip([33], { observations: [measurement(defensive)] }));
    const bodyPress = calculateBattleStrength(
        equip([704], { observations: [measurement(defensive)] }),
    );
    ok(bodyPress.parts.stats! > base.parts.stats!);
    const attackEquivalent = calculateBattleStrength(
        equip([704], { observations: [measurement({ ...defensive, attack: 240 })] }),
    );
    deepStrictEqual(bodyPress.parts, attackEquivalent.parts);
    deepStrictEqual(bodyPress.unsupportedMoves, []);
});

void test('defensive severity distinguishes 4x, 2x, neutral, half, quarter and immunity', () => {
    const score = (first: number, second: number): number =>
        calculateBattleStrength({
            ...input,
            species: { ...species, typeIds: [10, 11] },
            chart: makeChart({ '12:10': first, '12:11': second }),
        }).parts.typing!;
    const scores = [
        score(2, 2),
        score(2, 1),
        score(1, 1),
        score(0.5, 1),
        score(0.5, 0.5),
        score(0, 1),
    ];
    for (let index = 1; index < scores.length; index++) ok(scores[index] > scores[index - 1]);
    const mono = calculateBattleStrength(input);
    deepStrictEqual(
        calculateBattleStrength({ ...input, species: { ...species, typeIds: [0, 0] } }),
        mono,
    );
});

void test('reviewed utility rewards roles, caps at 20%, and does not sum duplicate effects', () => {
    const heal = calculateBattleStrength(equip([105]));
    strictEqual(calculateBattleStrength(equip([105, 135, 208, 303])).parts.moves, heal.parts.moves);
    const capped = calculateBattleStrength(equip([105, 147]));
    strictEqual(
        calculateBattleStrength(equip([105, 147, 113, 97])).parts.moves,
        capped.parts.moves,
    );
    ok(capped.parts.moves! > heal.parts.moves!);
    strictEqual(calculateBattleStrength(equip([14])).parts.moves, 0);
    ok(
        calculateBattleStrength(equip([14, 33])).parts.moves! >
            calculateBattleStrength(equip([33])).parts.moves!,
    );
    strictEqual(
        calculateBattleStrength(equip([14, 85])).parts.moves,
        calculateBattleStrength(equip([85])).parts.moves,
    );
    ok(
        calculateBattleStrength(equip([147])).parts.moves! >
            calculateBattleStrength(equip([79])).parts.moves!,
    );
});

void test('every audited utility rule matches the committed ROM identifiers and effects', () => {
    const ids = [
        14, 45, 79, 86, 92, 95, 97, 105, 113, 115, 135, 147, 156, 182, 184, 197, 204, 208, 261, 303,
        334, 339, 347, 349, 355, 417, 483,
    ];
    for (const id of ids) {
        const result = calculateBattleStrength(equip([id]));
        strictEqual(result.status, 'available');
        deepStrictEqual(result.unsupportedMoves, [], `audited ROM move ${id}`);
    }
    const recover = byId.get(105)!;
    for (const changed of [{ effectId: 1 }, { targetId: 0 }, { power: 10 }]) {
        const result = calculateBattleStrength(
            equip([105], { moves: [{ ...recover, ...changed }] }),
        );
        strictEqual(result.unsupportedMoves[0]?.moveId, 105);
        strictEqual(result.parts.moves, 0);
    }
});

void test('unsupported effects remain disclosed without inventing a move contribution', () => {
    for (const id of [150, 237, 63, 120, 331, 573, 284, 387]) {
        const result = calculateBattleStrength(equip([id]));
        strictEqual(result.status, 'available');
        strictEqual(result.parts.moves, 0);
        deepStrictEqual(result.unsupportedMoves, [{ moveId: id, name: byId.get(id)!.name }]);
    }
});

void test('unknown moves are incomplete, while a known empty moveset earns zero move points', () => {
    for (const [unknown, reason] of [
        [
            { ...input, pokemon: { ...pokemon, state: { ...pokemon.state, moves: null } } },
            'unknown-moves',
        ],
        [equip([33], { moves: [] }), 'missing-reference'],
    ] as const) {
        const result = calculateBattleStrength(unknown);
        strictEqual(result.status, 'incomplete');
        strictEqual(result.reason, reason);
        strictEqual(result.value, null);
        strictEqual(result.parts.moves, null);
        ok(result.parts.stats !== null && result.parts.typing !== null);
    }
    const empty = calculateBattleStrength(equip([], { moves: [] }));
    strictEqual(empty.status, 'available');
    strictEqual(empty.parts.moves, 0);
});

void test('missing or mismatched required references never produce a score', () => {
    for (const missing of [
        { ...input, species: undefined },
        { ...input, species: { ...species, speciesId: 2 } },
        { ...input, chart: undefined },
        { ...input, chart: { types: [], matchups: [] } },
        { ...input, chart: { ...input.chart!, matchups: input.chart!.matchups.slice(1) } },
        { ...input, species: { ...species, stats: { ...species.stats, hp: 0 } } },
    ]) {
        const result = calculateBattleStrength(missing);
        strictEqual(result.status, 'unavailable');
        strictEqual(result.value, null);
        strictEqual(result.reason, 'missing-reference');
    }
});

void test('sync and contradictory latest-stat conflicts suppress scores; nature only affects estimates', () => {
    for (const conflict of [
        { stateConflict: true },
        { observationConflict: true },
        { natureConflict: true },
    ]) {
        const result = calculateBattleStrength({ ...input, ...conflict });
        strictEqual(result.status, 'conflict');
        strictEqual(result.value, null);
    }
    const observations = [
        measurement(recorded),
        measurement({ ...recorded, hp: 170 }, { id: 'other' }),
    ];
    strictEqual(calculateBattleStrength({ ...input, observations }).status, 'conflict');
    strictEqual(
        calculateBattleStrength({ ...input, observations: [...observations].reverse() }).status,
        'conflict',
    );
    const allRecorded = { ...input, natureConflict: true, observations: [measurement(recorded)] };
    strictEqual(calculateBattleStrength(allRecorded).status, 'available');
    const withoutHp: Partial<BaseStats> = { ...recorded };
    delete withoutHp.hp;
    strictEqual(
        calculateBattleStrength({ ...allRecorded, observations: [measurement(withoutHp)] }).status,
        'available',
    );
});

void test('calibration points remain absolute and independent of collection composition', () => {
    const scores = [5, 50, 100].map(
        (level) =>
            calculateBattleStrength(
                equip([33], {
                    pokemon: { ...pokemon, state: { ...pokemon.state, level } },
                }),
            ).value,
    );
    deepStrictEqual(scores, [3, 23, 44]);
    const maximum = calculateBattleStrength(
        equip([105, 147, 89, 53], {
            observations: [
                measurement({
                    hp: 65535,
                    attack: 65535,
                    defense: 65535,
                    spAttack: 65535,
                    spDefense: 65535,
                    speed: 65535,
                }),
            ],
        }),
    );
    ok(maximum.value !== null && maximum.value <= 100);
});

void test('scoring leaves the Pokémon, observations and reference data unchanged', () => {
    const value = equip([33, 105], { observations: Object.freeze([measurement(recorded)]) });
    const before = structuredClone(value);
    calculateBattleStrength(value);
    deepStrictEqual(value, before);
});
