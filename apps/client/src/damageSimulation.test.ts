import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import type { Move, Pokemon, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import {
    estimateEnemyStats,
    getMoveEffectiveness,
    simulateMoveDamage,
    type DamageSimulationInput,
} from './damageSimulation.js';

const typeIds = [0, 1, 4, 7, 10, 11, 12, 14, 15];
const specialMatchups: Record<string, number> = {
    '0:7': 0,
    '10:10': 0.5,
    '10:11': 0.5,
    '10:12': 2,
    '10:15': 2,
    '11:10': 2,
    '11:11': 0.5,
    '11:12': 0.5,
};
const chart: TypeEffectivenessChart = {
    types: typeIds.map((typeId) => ({ typeId, name: String(typeId), iconFile: null })),
    matchups: typeIds.flatMap((attackingTypeId) =>
        typeIds.map((defendingTypeId) => ({
            attackingTypeId,
            defendingTypeId,
            multiplier: specialMatchups[`${attackingTypeId}:${defendingTypeId}`] ?? 1,
        })),
    ),
};
const waterGun: Move = {
    moveId: 55,
    name: 'Water Gun',
    description: '',
    descriptionCs: null,
    typeId: 11,
    type: 'Water',
    typeIconFile: null,
    categoryId: 1,
    category: 'Special',
    categoryIconFile: null,
    power: 40,
    accuracy: 100,
    pp: 25,
    priority: 0,
    effectId: 0,
    targetId: 0,
};
const input: DamageSimulationInput = {
    move: waterGun,
    level: 17,
    stats: { attack: 25, defense: 40, spAttack: 31 },
    typeIds: [11],
    enemyStats: { hp: 100, defense: 30, spDefense: 30 },
    enemyTypeIds: [0],
    chart,
};

void test('known-move threats use actual move type independently of attacker typing or stats', () => {
    deepStrictEqual(getMoveEffectiveness(waterGun, [10], chart), {
        status: 'available',
        multiplier: 2,
    });
    deepStrictEqual(getMoveEffectiveness({ ...waterGun, typeId: 10 }, [12, 15], chart), {
        status: 'available',
        multiplier: 4,
    });
    deepStrictEqual(getMoveEffectiveness(waterGun, [11], chart), {
        status: 'available',
        multiplier: 0.5,
    });
    deepStrictEqual(getMoveEffectiveness({ ...waterGun, typeId: 0 }, [7], chart), {
        status: 'available',
        multiplier: 0,
    });
    deepStrictEqual(getMoveEffectiveness({ ...waterGun, moveId: 165, typeId: 0 }, [7], chart), {
        status: 'available',
        multiplier: 1,
    });
});

void test('threat guidance does not treat status, variable damage or special effectiveness as ordinary weaknesses', () => {
    equal(
        getMoveEffectiveness({ ...waterGun, categoryId: 2 }, [10], chart).status,
        'not-applicable',
    );
    equal(getMoveEffectiveness({ ...waterGun, power: 1 }, [10], chart).status, 'unsupported');
    for (const moveId of [237, 311, 492, 560, 573, 614, 804, 805])
        equal(getMoveEffectiveness({ ...waterGun, moveId }, [10], chart).status, 'unsupported');
    equal(getMoveEffectiveness(undefined, [10], chart).status, 'missing-data');
    equal(getMoveEffectiveness(waterGun, [], chart).status, 'missing-data');
    equal(getMoveEffectiveness(waterGun, [999], chart).status, 'missing-data');
    equal(getMoveEffectiveness(waterGun, [10], undefined).status, 'missing-data');
    equal(
        getMoveEffectiveness(waterGun, [10], { ...chart, matchups: chart.matchups.slice(1) })
            .status,
        'missing-data',
    );
});

void test('special damage floors the base and random roll before applying STAB', () => {
    // floor(floor(8 * 40 * 31 / 30) / 50) + 2 = 8; random gives 6..8, STAB 9..12.
    deepStrictEqual(simulateMoveDamage(input), {
        status: 'available',
        min: 9,
        max: 12,
        minPercent: 9,
        maxPercent: 12,
        effectiveness: 1,
        stab: 1.5,
        attackStat: 'spAttack',
        defenseStat: 'spDefense',
        hits: { min: 1, max: 1 },
        perHit: [{ min: 9, max: 12 }],
        appliedAbility: null,
    });
});

void test('physical moves use Attack and Defense while special moves use Sp. Atk and Sp. Def', () => {
    const stats = { attack: 25, spAttack: 100 };
    const enemyStats = { defense: 50, spDefense: 200 };
    const physical = simulateMoveDamage({
        ...input,
        move: { ...waterGun, categoryId: 0 },
        stats,
        enemyStats,
    });
    const special = simulateMoveDamage({ ...input, stats, enemyStats });
    ok(physical.status === 'available' && special.status === 'available');
    deepStrictEqual([physical.min, physical.max], [6, 7]);
    deepStrictEqual([special.min, special.max], [6, 7]);
    equal(physical.attackStat, 'attack');
    equal(physical.defenseStat, 'defense');
    equal(special.attackStat, 'spAttack');
    equal(special.defenseStat, 'spDefense');
    equal(special.minPercent, null);
    equal(special.maxPercent, null);
});

void test('level, raw attack and target defense participate independently in the damage formula', () => {
    // At level 50: floor(floor(22 * 80 * 120 / 100) / 50) + 2 = 44.
    const result = simulateMoveDamage({
        ...input,
        level: 50,
        move: { ...waterGun, power: 80 },
        stats: { spAttack: 120 },
        enemyStats: { spDefense: 100, hp: 200 },
    });
    ok(result.status === 'available');
    deepStrictEqual([result.min, result.max], [55, 66]);
    deepStrictEqual([result.minPercent, result.maxPercent], [27.5, 33]);
});

void test('STAB and combined type modifiers round halves down rather than using Math.round or floor', () => {
    // Base 10, random 8..10, STAB 12..15, quarter resistance 3..3.75 => 3..4.
    const result = simulateMoveDamage({
        ...input,
        level: 50,
        move: { ...waterGun, typeId: 10 },
        stats: { spAttack: 100 },
        typeIds: [10],
        enemyStats: { spDefense: 220 },
        enemyTypeIds: [10, 11],
    });
    ok(result.status === 'available');
    deepStrictEqual([result.min, result.max, result.effectiveness], [3, 4, 0.25]);

    const half = simulateMoveDamage({
        ...input,
        level: 50,
        stats: { spAttack: 100 },
        enemyStats: { spDefense: 220 },
        enemyTypeIds: [11],
    });
    ok(half.status === 'available');
    deepStrictEqual([half.min, half.max], [6, 7]); // 15 * 0.5 = 7.5 rounds down.
});

void test('dual weaknesses multiply and duplicate type slots count only once', () => {
    const fireInput = { ...input, move: { ...waterGun, typeId: 10 }, typeIds: [10] };
    const double = simulateMoveDamage({ ...fireInput, enemyTypeIds: [12, 15] });
    const duplicate = simulateMoveDamage({ ...fireInput, enemyTypeIds: [12, 12] });
    ok(double.status === 'available' && duplicate.status === 'available');
    deepStrictEqual([double.min, double.max, double.effectiveness], [36, 48, 4]);
    deepStrictEqual([duplicate.min, duplicate.max, duplicate.effectiveness], [18, 24, 2]);
});

void test('immunity returns zero while a resisted damaging hit retains the one-HP minimum', () => {
    const immune = simulateMoveDamage({
        ...input,
        move: { ...waterGun, typeId: 0 },
        enemyTypeIds: [0, 7],
    });
    ok(immune.status === 'available');
    deepStrictEqual([immune.min, immune.max, immune.effectiveness], [0, 0, 0]);
    const weak = simulateMoveDamage({
        ...input,
        level: 1,
        stats: { spAttack: 1 },
        enemyStats: { spDefense: 999 },
        enemyTypeIds: [11],
        typeIds: [0],
    });
    ok(weak.status === 'available');
    deepStrictEqual([weak.min, weak.max], [1, 1]);
});

void test('Body Press uses the attacker Defense and the target Defense', () => {
    const result = simulateMoveDamage({
        ...input,
        move: { ...waterGun, moveId: 704, power: 80, categoryId: 0, typeId: 1 },
        stats: { defense: 40 },
        enemyStats: { defense: 30 },
    });
    ok(result.status === 'available');
    deepStrictEqual([result.min, result.max], [16, 19]);
    equal(result.attackStat, 'defense');
    equal(result.defenseStat, 'defense');
});

void test('Psyshock, Psystrike and Secret Sword use Sp. Atk against Defense', () => {
    for (const moveId of [473, 540, 548]) {
        const result = simulateMoveDamage({
            ...input,
            move: { ...waterGun, moveId, power: 80 },
            stats: { spAttack: 40 },
            enemyStats: { defense: 30, spDefense: 300 },
        });
        ok(result.status === 'available');
        deepStrictEqual([result.min, result.max], [24, 28]);
        equal(result.attackStat, 'spAttack');
        equal(result.defenseStat, 'defense');
    }
});

void test('Struggle has neither STAB nor type resistance or immunity', () => {
    const result = simulateMoveDamage({
        ...input,
        move: { ...waterGun, moveId: 165, typeId: 0, categoryId: 0, power: 50 },
        typeIds: [0],
        enemyTypeIds: [7],
    });
    ok(result.status === 'available');
    deepStrictEqual([result.min, result.max, result.stab, result.effectiveness], [6, 8, 1, 1]);
});

void test('status, fixed damage, variable stats and exceptional effectiveness are explicit states', () => {
    equal(
        simulateMoveDamage({ ...input, move: { ...waterGun, categoryId: 2 } }).status,
        'not-applicable',
    );
    equal(
        simulateMoveDamage({ ...input, move: { ...waterGun, power: 0 } }).status,
        'not-applicable',
    );
    equal(simulateMoveDamage({ ...input, move: { ...waterGun, power: 1 } }).status, 'unsupported');
    for (const moveId of [237, 492, 675, 729, 485, 560, 573, 614, 804, 805])
        equal(
            simulateMoveDamage({ ...input, move: { ...waterGun, moveId } }).status,
            'unsupported',
        );
});

void test('missing relevant inputs and invalid numbers cannot become plausible damage', () => {
    for (const patch of [
        { move: undefined },
        { stats: {} },
        { enemyStats: { defense: 10 } },
        { typeIds: undefined },
        { typeIds: [] },
        { typeIds: [999] },
        { enemyTypeIds: undefined },
        { enemyTypeIds: [] },
        { enemyTypeIds: [999] },
        { chart: undefined },
        { chart: { ...chart, matchups: chart.matchups.slice(1) } },
    ])
        equal(simulateMoveDamage({ ...input, ...patch }).status, 'missing-data');

    for (const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
        equal(simulateMoveDamage({ ...input, stats: { spAttack: value } }).status, 'missing-data');
        if (value !== Number.MAX_SAFE_INTEGER)
            equal(
                simulateMoveDamage({ ...input, enemyStats: { spDefense: value } }).status,
                'missing-data',
            );
    }
    for (const level of [0, 101, -1, 1.5, NaN, Infinity])
        equal(simulateMoveDamage({ ...input, level }).status, 'missing-data');
});

void test('missing or invalid enemy HP hides only the percentage, and percentages are not capped', () => {
    for (const hp of [undefined, 0, -1, NaN, Infinity, 1.5]) {
        const result = simulateMoveDamage({ ...input, enemyStats: { spDefense: 30, hp } });
        ok(result.status === 'available');
        equal(result.minPercent, null);
        equal(result.maxPercent, null);
    }
    const result = simulateMoveDamage({ ...input, enemyStats: { spDefense: 30, hp: 1 } });
    ok(result.status === 'available');
    equal(result.maxPercent, 1200);
});

const species: Pick<Pokemon, 'speciesId' | 'name' | 'stats'> = {
    speciesId: 25,
    name: 'Pikachu',
    stats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
};

void test('enemy stats use neutral nature, 31 IVs and 0 EVs with integer floors', () => {
    deepStrictEqual(estimateEnemyStats(species, 50), {
        hp: 110,
        attack: 75,
        defense: 60,
        spAttack: 70,
        spDefense: 70,
        speed: 110,
    });
    deepStrictEqual(estimateEnemyStats(species, 17), {
        hp: 44,
        attack: 28,
        defense: 23,
        spAttack: 27,
        spDefense: 27,
        speed: 40,
    });
});

void test('ROM Shedinja has one HP at every level and invalid base stats or levels are rejected', () => {
    const shedinja = {
        ...species,
        speciesId: 292,
        name: 'Shedinja',
        stats: { ...species.stats, hp: 1 },
    };
    for (const level of [1, 17, 50, 100]) equal(estimateEnemyStats(shedinja, level)?.hp, 1);
    for (const level of [0, 101, -1, 1.5, NaN, Infinity])
        equal(estimateEnemyStats(species, level), null);
    for (const hp of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
        equal(estimateEnemyStats({ ...species, stats: { ...species.stats, hp } }, 50), null);
});

void test('simulation and estimation leave collection inputs and type chart unchanged', () => {
    const originalInput = structuredClone(input);
    const originalSpecies = structuredClone(species);
    simulateMoveDamage(input);
    estimateEnemyStats(species, 50);
    deepStrictEqual(input, originalInput);
    deepStrictEqual(species, originalSpecies);
});
