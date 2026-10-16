import { deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { BaseStats, Move } from '@pokemon-emerald-ex-dex/shared';

import { calculateMovePower } from './collectionMovePower.js';

type PowerMove = Pick<Move, 'moveId' | 'power' | 'categoryId' | 'typeId'>;

const waterGun: PowerMove = { moveId: 55, power: 40, categoryId: 1, typeId: 11 };
const viceGrip: PowerMove = { moveId: 11, power: 55, categoryId: 0, typeId: 0 };
const stats: Partial<BaseStats> = { attack: 25, spAttack: 31, defense: 40 };

void test('special moves use recorded Special Attack and matching-type STAB', () => {
    deepStrictEqual(calculateMovePower(waterGun, stats, [11]), {
        status: 'available',
        value: 1860,
        stat: 'spAttack',
        statValue: 31,
        stab: 1.5,
    });
});

void test('physical moves use recorded Attack, without STAB for a different type', () => {
    deepStrictEqual(calculateMovePower(viceGrip, stats, [11]), {
        status: 'available',
        value: 1375,
        stat: 'attack',
        statValue: 25,
        stab: 1,
    });
});

void test('STAB matches either type slot only once and supports Normal type zero', () => {
    for (const typeIds of [
        [0, 11],
        [11, 0],
        [0, 0],
    ])
        deepStrictEqual(calculateMovePower(viceGrip, stats, typeIds), {
            status: 'available',
            value: 2063,
            stat: 'attack',
            statValue: 25,
            stab: 1.5,
        });
});

void test('calculation only needs the relevant recorded stat', () => {
    deepStrictEqual(calculateMovePower(waterGun, { spAttack: 31 }, [11]), {
        status: 'available',
        value: 1860,
        stat: 'spAttack',
        statValue: 31,
        stab: 1.5,
    });
    deepStrictEqual(calculateMovePower(waterGun, { attack: 100 }, [11]), {
        status: 'missing-data',
    });
    deepStrictEqual(calculateMovePower(viceGrip, { spAttack: 100 }, [11]), {
        status: 'missing-data',
    });
});

void test('missing move or species types never produces a guessed score', () => {
    deepStrictEqual(calculateMovePower(undefined, stats, [11]), { status: 'missing-data' });
    deepStrictEqual(calculateMovePower(waterGun, stats, undefined), { status: 'missing-data' });
    deepStrictEqual(calculateMovePower(waterGun, stats, []), { status: 'missing-data' });
});

void test('status moves and zero-power moves have no score even without measurements', () => {
    const waterSport: PowerMove = { moveId: 346, power: 0, categoryId: 2, typeId: 11 };
    deepStrictEqual(calculateMovePower(waterSport, {}, undefined), { status: 'not-applicable' });
    deepStrictEqual(calculateMovePower({ ...waterGun, power: 0 }, stats, [11]), {
        status: 'not-applicable',
    });
});

void test('placeholder power does not misrepresent fixed damage, OHKO or variable-power moves', () => {
    for (const moveId of [12, 49, 67, 69, 216, 515])
        deepStrictEqual(calculateMovePower({ ...viceGrip, moveId, power: 1 }, stats, [0]), {
            status: 'unsupported',
        });
});

void test('Body Press uses Defense instead of Attack', () => {
    const bodyPress: PowerMove = { moveId: 704, power: 80, categoryId: 0, typeId: 1 };
    deepStrictEqual(calculateMovePower(bodyPress, stats, [1]), {
        status: 'available',
        value: 4800,
        stat: 'defense',
        statValue: 40,
        stab: 1.5,
    });
    deepStrictEqual(calculateMovePower(bodyPress, { attack: 25 }, [1]), {
        status: 'missing-data',
    });
});

void test('Struggle never receives Normal-type STAB', () => {
    deepStrictEqual(calculateMovePower({ ...viceGrip, moveId: 165, power: 50 }, stats, [0]), {
        status: 'available',
        value: 1250,
        stat: 'attack',
        statValue: 25,
        stab: 1,
    });
});

void test('target-dependent stats and dynamic categories/types are explicitly unsupported', () => {
    for (const moveId of [
        237, 311, 449, 492, 546, 649, 672, 675, 711, 729, 733, 779, 801, 832, 834, 881,
    ])
        deepStrictEqual(calculateMovePower({ ...waterGun, moveId }, stats, [11]), {
            status: 'unsupported',
        });
    deepStrictEqual(calculateMovePower({ ...waterGun, categoryId: 3 }, stats, [11]), {
        status: 'unsupported',
    });
});

void test('invalid numbers do not become zero, NaN or infinite display values', () => {
    for (const spAttack of [0, -1, 1.5, NaN, Infinity])
        deepStrictEqual(calculateMovePower(waterGun, { spAttack }, [11]), {
            status: 'missing-data',
        });
    for (const power of [NaN, Infinity, 40.5])
        deepStrictEqual(calculateMovePower({ ...waterGun, power }, stats, [11]), {
            status: 'missing-data',
        });
    for (const typeId of [-1, NaN, Infinity, 1.5]) {
        deepStrictEqual(calculateMovePower({ ...waterGun, typeId }, stats, [11]), {
            status: 'missing-data',
        });
        deepStrictEqual(calculateMovePower(waterGun, stats, [11, typeId]), {
            status: 'missing-data',
        });
    }
});
