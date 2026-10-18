import { deepStrictEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import type { KnownMove, Move, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { getRecordedMoveMatchups } from './recordedMoveMatchups.js';

const typeIds = [0, 7, 10, 11, 15];
const multipliers: Record<string, number> = { '0:7': 0, '11:10': 2, '15:10': 0.5 };
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
const icicleSpear: Move = {
    moveId: 333,
    name: 'Icicle Spear',
    description: '',
    descriptionCs: null,
    typeId: 15,
    type: 'Ice',
    typeIconFile: null,
    categoryId: 0,
    category: 'Physical',
    categoryIconFile: null,
    power: 25,
    accuracy: 100,
    pp: 30,
    priority: 0,
    effectId: 25,
    targetId: 0,
};
const waterGun: Move = {
    ...icicleSpear,
    moveId: 55,
    name: 'Water Gun',
    typeId: 11,
    type: 'Water',
    categoryId: 1,
    category: 'Special',
    power: 40,
    effectId: 0,
};
const statusMoves: Move[] = [
    { ...waterGun, moveId: 110, name: 'Withdraw', categoryId: 2, power: 0 },
    { ...waterGun, moveId: 48, name: 'Supersonic', typeId: 0, categoryId: 2, power: 0 },
    { ...waterGun, moveId: 182, name: 'Protect', typeId: 0, categoryId: 2, power: 0 },
];

function recorded(moves: readonly Move[]): KnownMove[] {
    return moves.map(({ moveId, name }) => ({ moveId, name }));
}

function details(moves: readonly Move[]): ReadonlyMap<number, Move> {
    return new Map(moves.map((move) => [move.moveId, move]));
}

void test('Shellder with Icicle Spear and three status moves is resisted by Fire', () => {
    const moves = [icicleSpear, ...statusMoves];
    deepStrictEqual(getRecordedMoveMatchups(recorded(moves), details(moves), [10], chart), {
        status: 'available',
        moves: [{ move: icicleSpear, multiplier: 0.5 }],
    });
});

void test('a recorded damaging Water move is effective regardless of the attacker species', () => {
    const moves = [icicleSpear, waterGun];
    deepStrictEqual(getRecordedMoveMatchups(recorded(moves), details(moves), [10], chart), {
        status: 'available',
        moves: [
            { move: icicleSpear, multiplier: 0.5 },
            { move: waterGun, multiplier: 2 },
        ],
    });
});

void test('unknown moves, an empty moveset and only status moves remain distinct', () => {
    equal(getRecordedMoveMatchups(null, new Map(), [10], chart).status, 'unknown-moves');
    equal(getRecordedMoveMatchups([], new Map(), [], undefined).status, 'no-damaging-moves');
    equal(
        getRecordedMoveMatchups(recorded(statusMoves), details(statusMoves), [], undefined).status,
        'no-damaging-moves',
    );
    const zeroPower = { ...waterGun, power: 0 };
    equal(
        getRecordedMoveMatchups(recorded([zeroPower]), details([zeroPower]), [10], chart).status,
        'no-damaging-moves',
    );
});

void test('every recorded move must resolve before any partial recommendation is offered', () => {
    const moves = [icicleSpear, waterGun, ...statusMoves];
    for (const missing of moves) {
        const partial = details(moves.filter((move) => move.moveId !== missing.moveId));
        equal(
            getRecordedMoveMatchups(recorded(moves), partial, [10], chart).status,
            'missing-data',
        );
    }
    equal(
        getRecordedMoveMatchups(
            recorded([icicleSpear]),
            new Map([[icicleSpear.moveId, waterGun]]),
            [10],
            chart,
        ).status,
        'missing-data',
    );
});

void test('missing or invalid chart and defending types cannot produce recommendations', () => {
    for (const [defenders, reference] of [
        [[10], undefined],
        [[10], { ...chart, matchups: chart.matchups.slice(1) }],
        [[], chart],
        [[999], chart],
    ] as const)
        equal(
            getRecordedMoveMatchups(recorded([waterGun]), details([waterGun]), defenders, reference)
                .status,
            'missing-data',
        );
});

void test('unmodeled attacks block recommendations even when another move is understood', () => {
    for (const unsupported of [
        { ...waterGun, power: 1 },
        { ...waterGun, moveId: 237, name: 'Hidden Power' },
        { ...icicleSpear, moveId: 573, name: 'Freeze-Dry' },
    ]) {
        const moves = [icicleSpear, unsupported];
        equal(
            getRecordedMoveMatchups(recorded(moves), details(moves), [10], chart).status,
            'unsupported',
        );
    }
    const unsupported = { ...waterGun, moveId: 237 };
    equal(
        getRecordedMoveMatchups(
            recorded([unsupported, icicleSpear]),
            details([unsupported]),
            [10],
            chart,
        ).status,
        'missing-data',
    );
});

void test('Struggle retains its exception to Ghost immunity', () => {
    const struggle = { ...icicleSpear, moveId: 165, name: 'Struggle', typeId: 0 };
    deepStrictEqual(
        getRecordedMoveMatchups(recorded([struggle]), details([struggle]), [7], chart),
        { status: 'available', moves: [{ move: struggle, multiplier: 1 }] },
    );
    const tackle = { ...struggle, moveId: 33, name: 'Tackle' };
    deepStrictEqual(getRecordedMoveMatchups(recorded([tackle]), details([tackle]), [7], chart), {
        status: 'available',
        moves: [{ move: tackle, multiplier: 0 }],
    });
});

void test('duplicate saved move IDs are removed while equal matchups retain recorded order', () => {
    const surf = { ...waterGun, moveId: 57, name: 'Surf', power: 90 };
    const moves = [surf, waterGun, surf, waterGun];
    deepStrictEqual(getRecordedMoveMatchups(recorded(moves), details(moves), [10], chart), {
        status: 'available',
        moves: [
            { move: surf, multiplier: 2 },
            { move: waterGun, multiplier: 2 },
        ],
    });
});
