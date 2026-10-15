import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import {
    getTypeDefenses,
    isTypeEffectivenessChart,
    type TypeEffectivenessChart,
} from '../src/typeEffectiveness.js';

const types = [
    { typeId: 2, name: 'Flying', iconFile: null },
    { typeId: 3, name: 'Poison', iconFile: null },
    { typeId: 4, name: 'Ground', iconFile: null },
    { typeId: 6, name: 'Bug', iconFile: null },
    { typeId: 11, name: 'Water', iconFile: null },
    { typeId: 12, name: 'Grass', iconFile: 'grass.png' },
    { typeId: 13, name: 'Electric', iconFile: null },
];
const chart: TypeEffectivenessChart = {
    types,
    matchups: types.flatMap((attack) =>
        types.map((defense) => ({
            attackingTypeId: attack.typeId,
            defendingTypeId: defense.typeId,
            multiplier:
                (
                    {
                        '12:11': 2,
                        '12:4': 2,
                        '12:6': 0.5,
                        '12:3': 0.5,
                        '13:4': 0,
                        '13:2': 2,
                    } as Record<string, number>
                )[`${attack.typeId}:${defense.typeId}`] ?? 1,
        })),
    ),
};

void test('dual types multiply weaknesses, resistances, and immunities using defending columns', () => {
    strictEqual(getTypeDefenses([11, 4], chart)?.find((type) => type.typeId === 12)?.multiplier, 4);
    strictEqual(
        getTypeDefenses([6, 3], chart)?.find((type) => type.typeId === 12)?.multiplier,
        0.25,
    );
    strictEqual(getTypeDefenses([4, 2], chart)?.find((type) => type.typeId === 13)?.multiplier, 0);
    strictEqual(getTypeDefenses([11, 3], chart)?.find((type) => type.typeId === 12)?.multiplier, 1);
    deepStrictEqual(getTypeDefenses([11], chart), getTypeDefenses([11, 11], chart));
    deepStrictEqual(
        getTypeDefenses([11], chart)?.find((type) => type.typeId === 12),
        {
            typeId: 12,
            name: 'Grass',
            iconFile: 'grass.png',
            multiplier: 2,
        },
    );
});

void test('unknown defensive types and unavailable or malformed charts never imply neutrality', () => {
    strictEqual(getTypeDefenses([], chart), null);
    strictEqual(getTypeDefenses([9], chart), null);
    strictEqual(getTypeDefenses([11, 999], chart), null);
    strictEqual(getTypeDefenses([11], { types: [], matchups: [] }), null);
    strictEqual(getTypeDefenses([11], { ...chart, matchups: chart.matchups.slice(1) }), null);
    for (const invalid of [
        undefined,
        {},
        { ...chart, types: [null] },
        { ...chart, types: chart.types.map(() => chart.types[0]) },
        { ...chart, matchups: chart.matchups.map(() => chart.matchups[0]) },
        { ...chart, matchups: chart.matchups.map((row) => ({ ...row, multiplier: -1 })) },
        { ...chart, matchups: chart.matchups.map((row) => ({ ...row, multiplier: '0.5' })) },
    ])
        strictEqual(isTypeEffectivenessChart(invalid), false);
});
