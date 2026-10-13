import { deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { getDefaultMoves } from '../src/index.js';
import type { LearnsetEntry } from '../src/dex.js';
import { loadCollectionSpeciesFixture } from './fixtures/collectionSpecies.js';

function move(moveId: number, level: number, entryOrder = moveId): LearnsetEntry {
    return {
        moveId,
        name: `Move ${moveId}`,
        level,
        entryOrder,
        description: '',
        descriptionCs: null,
        typeId: 1,
        type: 'Normal',
        typeIconFile: null,
        categoryId: 1,
        category: 'Physical',
        categoryIconFile: null,
        power: 40,
        accuracy: 100,
        pp: 20,
        priority: 0,
        effectId: 0,
        targetId: 0,
    };
}

void test('default moves exclude special entries and future levels, including the current level', () => {
    const learnset = [move(1, 0), move(2, 1), move(3, 10), move(4, 11)];
    deepStrictEqual(getDefaultMoves(learnset, 10), [
        { moveId: 2, name: 'Move 2' },
        { moveId: 3, name: 'Move 3' },
    ]);
});

void test('default moves select the last four in learn order without mutating unsorted input', () => {
    const learnset = Object.freeze([
        Object.freeze(move(5, 20)),
        Object.freeze(move(1, 1)),
        Object.freeze(move(4, 15)),
        Object.freeze(move(2, 5)),
        Object.freeze(move(3, 10)),
    ]);
    deepStrictEqual(getDefaultMoves(learnset, 20), [
        { moveId: 2, name: 'Move 2' },
        { moveId: 3, name: 'Move 3' },
        { moveId: 4, name: 'Move 4' },
        { moveId: 5, name: 'Move 5' },
    ]);
    deepStrictEqual(
        learnset.map((entry) => entry.moveId),
        [5, 1, 4, 2, 3],
    );
});

void test('same-level defaults use entry order to choose the most recent four moves', () => {
    const learnset = [move(5, 1, 0), move(3, 1, 4), move(1, 1, 3), move(2, 1, 2), move(4, 1, 1)];
    deepStrictEqual(getDefaultMoves(learnset, 1), [
        { moveId: 4, name: 'Move 4' },
        { moveId: 2, name: 'Move 2' },
        { moveId: 1, name: 'Move 1' },
        { moveId: 3, name: 'Move 3' },
    ]);
});

void test('repeated moves use their latest eligible occurrence without consuming another slot', () => {
    const learnset = [move(1, 1), move(2, 5), move(3, 10), move(4, 15), move(2, 20), move(2, 25)];
    deepStrictEqual(getDefaultMoves(learnset, 20), [
        { moveId: 1, name: 'Move 1' },
        { moveId: 3, name: 'Move 3' },
        { moveId: 4, name: 'Move 4' },
        { moveId: 2, name: 'Move 2' },
    ]);
});

void test('default moves remain empty when no ordinary move is available', () => {
    deepStrictEqual(getDefaultMoves([], 20), []);
    deepStrictEqual(getDefaultMoves([move(1, 0), move(2, 5)], 1), []);
});

void test('real Torchic defaults match its current learnset at levels 11 and 20', () => {
    const torchic = loadCollectionSpeciesFixture([255])[255];
    deepStrictEqual(getDefaultMoves(torchic.learnset, 11), [
        { moveId: 10, name: 'Scratch' },
        { moveId: 45, name: 'Growl' },
        { moveId: 52, name: 'Ember' },
        { moveId: 28, name: 'Sand Attack' },
    ]);
    deepStrictEqual(getDefaultMoves(torchic.learnset, 20), [
        { moveId: 52, name: 'Ember' },
        { moveId: 28, name: 'Sand Attack' },
        { moveId: 64, name: 'Peck' },
        { moveId: 83, name: 'Fire Spin' },
    ]);
});
