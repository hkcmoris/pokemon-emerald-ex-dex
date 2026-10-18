import { deepStrictEqual, equal, notDeepStrictEqual, ok } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Move, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import {
    simulateMoveDamage,
    type DamageSimulation,
    type DamageSimulationInput,
} from './damageSimulation.js';

type RomMove = Omit<Move, 'descriptionCs' | 'typeIconFile' | 'categoryIconFile'>;
const rom = JSON.parse(
    readFileSync(
        new URL('../../../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
        'utf8',
    ),
) as { moves: RomMove[] };
const abilities = JSON.parse(
    readFileSync(
        new URL('../../../docs/pokemon_emerald_ex_1.0.4_abilities.json', import.meta.url),
        'utf8',
    ),
) as { abilities: { abilityId: number; name: string }[] };

function moveNamed(name: string): Move {
    const move = rom.moves.find((candidate) => candidate.name === name);
    ok(move, `ROM fixture is missing ${name}`);
    return { ...move, descriptionCs: null, typeIconFile: null, categoryIconFile: null };
}

// Only the type interactions used by these fixtures matter for their expected damage.
const typeIds = Array.from({ length: 19 }, (_, typeId) => typeId);
const multipliers: Record<string, number> = {
    '15:12': 2,
    '15:11': 0.5,
    '15:8': 0.5,
    '0:7': 0,
};
const chart: TypeEffectivenessChart = {
    types: typeIds.map((typeId) => ({ typeId, name: String(typeId), iconFile: null })),
    matchups: typeIds.flatMap((attackingTypeId) =>
        typeIds.map((defendingTypeId) => ({
            attackingTypeId,
            defendingTypeId,
            multiplier: multipliers[`${attackingTypeId}:${defendingTypeId}`] ?? 1,
        })),
    ),
};
const shellder: DamageSimulationInput = {
    level: 18,
    stats: { attack: 31, spAttack: 24, defense: 45 },
    typeIds: [11],
    enemyStats: { hp: 69, defense: 41, spDefense: 42 },
    enemyTypeIds: [12, 3],
    attackerSpeciesId: 90,
    chart,
};

function available(
    input: DamageSimulationInput,
): Extract<DamageSimulation, { status: 'available' }> {
    const result = simulateMoveDamage(input);
    ok(result.status === 'available', `${input.move?.name}: ${result.status}`);
    return result;
}

void test('the Shellder screenshot shows 8–10 per hit, 16–50 normally and 40–50 with Skill Link', () => {
    equal(abilities.abilities.find((ability) => ability.name === 'Skill Link')?.abilityId, 92);
    const move = moveNamed('Icicle Spear');
    const ordinary = available({ ...shellder, move });
    deepStrictEqual(
        ordinary.perHit,
        Array.from({ length: 5 }, () => ({ min: 8, max: 10 })),
    );
    deepStrictEqual(
        [ordinary.min, ordinary.max, ordinary.hits, ordinary.appliedAbility],
        [16, 50, { min: 2, max: 5 }, null],
    );
    for (const abilityId of [undefined, 0, 93, 999]) {
        deepStrictEqual(available({ ...shellder, move, abilityId }), ordinary);
    }
    const skillLink = available({ ...shellder, move, abilityId: 92 });
    deepStrictEqual(
        [skillLink.min, skillLink.max, skillLink.hits, skillLink.appliedAbility],
        [40, 50, { min: 5, max: 5 }, 'skill-link'],
    );
    equal(skillLink.minPercent, (40 * 100) / 69);
    equal(skillLink.maxPercent, (50 * 100) / 69);
});

void test('every ROM 2–5-hit move uses total damage, and Skill Link selects five hits', () => {
    const names = [
        'Double Slap',
        'Comet Punch',
        'Fury Attack',
        'Pin Missile',
        'Spike Cannon',
        'Barrage',
        'Fury Swipes',
        'Bone Rush',
        'Arm Thrust',
        'Bullet Seed',
        'Icicle Spear',
        'Rock Blast',
        'Tail Slap',
        'WatrShuriken',
        'Scale Shot',
    ];
    // New members of the ROM effect family must be audited, too.
    deepStrictEqual(
        rom.moves.filter((move) => move.effectId === 25).map((move) => move.name),
        names,
    );
    for (const name of names) {
        const move = moveNamed(name);
        const ordinary = available({ ...shellder, move });
        const linked = available({ ...shellder, move, abilityId: 92 });
        deepStrictEqual(ordinary.hits, { min: 2, max: 5 }, name);
        deepStrictEqual(linked.hits, { min: 5, max: 5 }, name);
        equal(ordinary.min, ordinary.perHit[0].min * 2, name);
        equal(ordinary.max, ordinary.perHit[0].max * 5, name);
        equal(linked.min, ordinary.perHit[0].min * 5, name);
        equal(linked.max, ordinary.max, name);
        equal(linked.appliedAbility, 'skill-link', name);
    }
});

void test('fixed two-hit and three-hit ROM moves retain their counts with Skill Link', () => {
    const twoHitNames = [
        'Double Kick',
        'Twineedle',
        'Bonemerang',
        'Double Hit',
        'Dual Chop',
        'Gear Grind',
        'DublIronBash',
        'Dragon Darts',
        'DualWingbeat',
        'Twin Beam',
        'TachyonCuttr',
    ];
    for (const name of [...twoHitNames, 'Triple Dive']) {
        const move = moveNamed(name);
        const count = name === 'Triple Dive' ? 3 : 2;
        const result = available({ ...shellder, move });
        equal(move.effectId, 1, name);
        deepStrictEqual(result.hits, { min: count, max: count }, name);
        equal(result.perHit.length, count, name);
        equal(result.min, result.perHit[0].min * count, name);
        equal(result.max, result.perHit[0].max * count, name);
        deepStrictEqual(available({ ...shellder, move, abilityId: 92 }), result, name);
    }
});

void test('hit damage is rounded before summing instead of multiplying base power', () => {
    const move = moveNamed('Icicle Spear');
    const linked = available({ ...shellder, move, abilityId: 92 });
    // One hypothetical 125-power Ice hit produces 32–38 here, not five 8–10 hits.
    const combinedPower = available({
        ...shellder,
        move: { ...move, moveId: 1, effectId: 1, power: 125 },
    });
    deepStrictEqual([combinedPower.min, combinedPower.max], [32, 38]);
    notDeepStrictEqual([linked.min, linked.max], [combinedPower.min, combinedPower.max]);
});

void test('immunity stays zero and minimum damage applies separately to every hit', () => {
    const immune = available({
        ...shellder,
        move: moveNamed('Double Slap'),
        enemyTypeIds: [7],
        abilityId: 92,
    });
    deepStrictEqual([immune.min, immune.max], [0, 0]);
    ok(immune.perHit.every((hit) => hit.min === 0 && hit.max === 0));
    const weak = {
        ...shellder,
        move: moveNamed('Icicle Spear'),
        level: 1,
        stats: { attack: 1 },
        enemyStats: { defense: 9999 },
        enemyTypeIds: [11, 8],
    };
    const ordinary = available(weak);
    deepStrictEqual([ordinary.min, ordinary.max], [2, 5]);
    const linked = available({ ...weak, abilityId: 92 });
    deepStrictEqual([linked.min, linked.max], [5, 5]);
    ok(linked.perHit.every((hit) => hit.min === 1 && hit.max === 1));
});

void test('Triple Kick and Triple Axel sum independently rounded escalating hits', () => {
    const cases = [
        {
            name: 'Triple Kick',
            perHit: [
                { min: 2, max: 3 },
                { min: 3, max: 4 },
                { min: 5, max: 6 },
            ],
            min: 10,
            max: 13,
        },
        {
            name: 'Triple Axel',
            perHit: [
                { min: 6, max: 8 },
                { min: 10, max: 14 },
                { min: 16, max: 20 },
            ],
            min: 32,
            max: 42,
        },
    ];
    for (const expected of cases) {
        const move = moveNamed(expected.name);
        equal(move.effectId, 81);
        const ordinary = available({ ...shellder, move });
        deepStrictEqual(ordinary.hits, { min: 1, max: 3 });
        deepStrictEqual(ordinary.perHit, expected.perHit);
        deepStrictEqual([ordinary.min, ordinary.max], [expected.perHit[0].min, expected.max]);
        const linked = available({ ...shellder, move, abilityId: 92 });
        deepStrictEqual(linked.hits, { min: 3, max: 3 });
        deepStrictEqual([linked.min, linked.max], [expected.min, expected.max]);
        equal(linked.appliedAbility, 'skill-link');
    }
});

void test('Population Bomb ranges over one to ten hits and Skill Link keeps all ten', () => {
    const move = moveNamed('PoplatinBomb');
    equal(move.effectId, 330);
    const ordinary = available({ ...shellder, move });
    deepStrictEqual(ordinary.hits, { min: 1, max: 10 });
    deepStrictEqual([ordinary.min, ordinary.max], [3, 40]);
    const linked = available({ ...shellder, move, abilityId: 92 });
    deepStrictEqual(linked.hits, { min: 10, max: 10 });
    deepStrictEqual([linked.min, linked.max], [30, 40]);
    equal(linked.appliedAbility, 'skill-link');
});

void test('special critical, party-dependent and Battle Bond totals are not guessed', () => {
    for (const name of ['SurgngStrkes', 'Beat Up']) {
        equal(
            simulateMoveDamage({ ...shellder, move: moveNamed(name) }).status,
            'unsupported',
            name,
        );
    }
    const move = moveNamed('WatrShuriken');
    for (const exceptional of [{ abilityId: 210 }, { attackerSpeciesId: 1113 }]) {
        equal(simulateMoveDamage({ ...shellder, move, ...exceptional }).status, 'unsupported');
    }
    deepStrictEqual(available({ ...shellder, move, attackerSpeciesId: 658 }).hits, {
        min: 2,
        max: 5,
    });
});

void test('unknown or changed multi-hit effects fail closed while ordinary single hits stay unchanged', () => {
    const move = moveNamed('Icicle Spear');
    equal(
        simulateMoveDamage({ ...shellder, move: { ...move, effectId: 1 } }).status,
        'unsupported',
    );
    for (const effectId of [25, 81, 330]) {
        equal(
            simulateMoveDamage({ ...shellder, move: { ...move, moveId: 9999, effectId } }).status,
            'unsupported',
        );
    }
    const single = { ...shellder, move: moveNamed('Water Gun') };
    const result = available(single);
    deepStrictEqual(result.hits, { min: 1, max: 1 });
    deepStrictEqual(available({ ...single, abilityId: 92 }), result);
});
