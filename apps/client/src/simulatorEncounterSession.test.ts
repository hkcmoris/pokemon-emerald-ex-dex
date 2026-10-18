import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { emptyCollection, type CollectionDocument } from '@pokemon-emerald-ex-dex/shared';
import {
    readEncounterSelection,
    rememberEncounterSelection,
    resolveEncounterSelection,
} from './simulatorEncounterSession.js';

const document: CollectionDocument = {
    ...emptyCollection(),
    playthroughs: {
        run: { id: 'run', name: 'Emerald', party: [], deleted: false },
        other: { id: 'other', name: 'Other run', party: [], deleted: false },
    },
    encounters: {
        rival: {
            id: 'rival',
            playthroughId: 'run',
            name: 'Rival',
            party: ['a', 'b'],
            deleted: false,
            createdAt: '2026-10-18T10:00:00Z',
        },
        gym: {
            id: 'gym',
            playthroughId: 'other',
            name: 'Gym',
            party: ['c'],
            deleted: false,
            createdAt: '2026-10-18T11:00:00Z',
        },
    },
    opponents: {
        a: { id: 'a', encounterId: 'rival', speciesId: 1, level: 10, moves: [], deleted: false },
        b: { id: 'b', encounterId: 'rival', speciesId: 4, level: 12, moves: [], deleted: false },
        c: { id: 'c', encounterId: 'gym', speciesId: 7, level: 20, moves: [], deleted: false },
    },
};

void test('encounter selection respects playthroughs, explicit quick matchups and removed opponents', () => {
    strictEqual(resolveEncounterSelection(document, 'run', null).opponent?.id, 'a');
    strictEqual(
        resolveEncounterSelection(document, 'run', { encounterId: 'rival', opponentId: 'b' })
            .opponent?.id,
        'b',
    );
    deepStrictEqual(resolveEncounterSelection(document, 'run', {}), {});
    deepStrictEqual(resolveEncounterSelection(document, 'run', { encounterId: 'gym' }), {});
    const updated = structuredClone(document);
    updated.opponents!.b.deleted = true;
    strictEqual(
        resolveEncounterSelection(updated, 'run', { encounterId: 'rival', opponentId: 'b' })
            .opponent?.id,
        'a',
    );
    updated.encounters!.rival.deleted = true;
    deepStrictEqual(resolveEncounterSelection(updated, 'run', { encounterId: 'rival' }), {});
});

void test('selected encounters survive navigation without leaking mutable preferences across runs', () => {
    const selection = { encounterId: 'rival', opponentId: 'b' };
    rememberEncounterSelection('selection-test:run', selection);
    selection.opponentId = 'a';
    strictEqual(readEncounterSelection('selection-test:run')?.opponentId, 'b');
    const read = readEncounterSelection('selection-test:run')!;
    read.opponentId = 'a';
    strictEqual(readEncounterSelection('selection-test:run')?.opponentId, 'b');
    strictEqual(readEncounterSelection('selection-test:other'), null);
});
