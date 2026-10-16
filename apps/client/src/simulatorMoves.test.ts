import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import { getSimulatorMoveOptions } from './simulatorMoves.js';

const family = loadCollectionSpeciesFixture([255, 256, 257]);
const torchic = family[255];

void test('previews include future current-form moves and TM/HM sources without evolution-family moves', () => {
    const options = getSimulatorMoveOptions(torchic, []);
    const flamethrower = options.find((entry) => entry.move.moveId === 53);
    ok(flamethrower);
    ok(flamethrower.levels.includes(46));
    ok(flamethrower.machines.includes('TM35'));
    strictEqual(flamethrower.recorded, false);
    const evolutionOnly = family[257].learnset.find(
        (entry) =>
            !torchic.learnset.some((own) => own.moveId === entry.moveId) &&
            !torchic.machines.some((own) => own.moveId === entry.moveId),
    );
    ok(evolutionOnly);
    strictEqual(
        options.some((entry) => entry.move.moveId === evolutionOnly.moveId),
        false,
    );
});

void test('recorded moves outside the current form remain available without invented acquisition details', () => {
    const known = [
        { moveId: 57, name: 'Surf' },
        { moveId: 53, name: 'Flamethrower' },
    ];
    const before = structuredClone({ torchic, known });
    const options = getSimulatorMoveOptions(torchic, known);
    const surf = options.find((entry) => entry.move.moveId === 57);
    ok(surf);
    strictEqual(surf.recorded, true);
    strictEqual(surf.reference, undefined);
    deepStrictEqual(surf.levels, []);
    deepStrictEqual(surf.machines, []);
    strictEqual(options.filter((entry) => entry.move.moveId === 53).length, 1);
    strictEqual(options.find((entry) => entry.move.moveId === 53)?.recorded, true);
    deepStrictEqual({ torchic, known }, before);
});

void test('duplicate sources are collapsed while level-zero conditional entries remain distinct', () => {
    const move = torchic.learnset[0];
    const species = {
        ...torchic,
        learnset: [
            { ...move, level: 0 },
            { ...move, level: 10 },
            { ...move, level: 10 },
        ],
        machines: [],
    };
    const options = getSimulatorMoveOptions(species, []);
    strictEqual(options.length, 1);
    deepStrictEqual(options[0].levels, [0, 10]);
});
