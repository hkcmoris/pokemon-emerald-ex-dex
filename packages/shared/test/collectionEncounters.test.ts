import { deepStrictEqual, equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyConflictChoice,
    emptyCollection,
    mergeCollections,
    readConflictValue,
    validateCollectionDocument,
    type CollectionDocument,
} from '../src/collection.js';

function fixture(): CollectionDocument {
    return {
        ...emptyCollection(),
        playthroughs: { run: { id: 'run', name: 'Emerald', party: [], deleted: false } },
        encounters: {
            rival: {
                id: 'rival',
                playthroughId: 'run',
                name: 'Rival · Route 110',
                party: ['a', 'b'],
                deleted: false,
                createdAt: '2026-10-18T10:00:00.000Z',
            },
        },
        opponents: {
            a: {
                id: 'a',
                encounterId: 'rival',
                speciesId: 1,
                level: 20,
                moves: [],
                deleted: false,
            },
            b: {
                id: 'b',
                encounterId: 'rival',
                speciesId: 1,
                level: 22,
                moves: [],
                deleted: false,
            },
        },
    };
}

void test('encounters validate old documents, repeated species, empty rosters and recoverable deleted parents', () => {
    ok(validateCollectionDocument(emptyCollection()));
    const value = fixture();
    ok(validateCollectionDocument(value));
    value.encounters!.rival.deleted = true;
    value.playthroughs.run.deleted = true;
    ok(validateCollectionDocument(value));
    value.encounters!.rival.party = [];
    ok(validateCollectionDocument(value));
});

void test('encounter validation rejects orphaned, cross-encounter, duplicate or oversized membership and invalid moves', () => {
    const changes: ((document: CollectionDocument) => void)[] = [
        (d) => {
            d.encounters!.rival.playthroughId = 'missing';
        },
        (d) => {
            d.opponents!.a.encounterId = 'missing';
        },
        (d) => {
            d.encounters!.rival.party = ['missing'];
        },
        (d) => {
            d.encounters!.rival.party = ['a', 'a'];
        },
        (d) => {
            d.opponents!.a.deleted = true;
        },
        (d) => {
            d.opponents!.a.level = 101;
        },
        (d) => {
            d.opponents!.a.speciesId = 0;
        },
        (d) => {
            d.encounters!.rival.name = ' ';
        },
        (d) => {
            d.encounters!.rival.createdAt = 'yesterday';
        },
        (d) => {
            d.opponents!.a.id = 'wrong';
        },
        (d) => {
            d.opponents!.a.moves = [{ moveId: 1, name: '' }];
        },
        (d) => {
            d.opponents!.a.moves = [
                { moveId: 1, name: 'Pound' },
                { moveId: 1, name: 'Pound' },
            ];
        },
        (d) => {
            d.opponents!.a.moves = Array.from({ length: 5 }, (_, i) => ({
                moveId: i + 1,
                name: 'Move',
            }));
        },
        (d) => {
            d.encounters!.gym = { ...d.encounters!.rival, id: 'gym', party: ['a'] };
        },
        (d) => {
            d.encounters!.rival.party = Array.from({ length: 7 }, (_, i) => `opponent${i}`);
            for (const id of d.encounters!.rival.party)
                d.opponents![id] = { ...d.opponents!.a, id };
        },
    ];
    for (const change of changes) {
        const value = fixture();
        change(value);
        equal(validateCollectionDocument(value), false);
    }
    for (const badMap of [null, [], false, { __proto__: null, constructor: {} }]) {
        equal(validateCollectionDocument({ ...fixture(), encounters: badMap }), false);
        equal(validateCollectionDocument({ ...fixture(), opponents: badMap }), false);
    }
});

void test('independent opponents and different fields on the same opponent merge', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.opponents!.a.level = 21;
    local.encounters!.rival.name = 'Rival · first battle';
    remote.opponents!.a.moves = [{ moveId: 58, name: 'Ice Beam' }];
    remote.opponents!.b.level = 23;
    const merged = mergeCollections(base, local, remote);
    equal(merged.conflicts.length, 0);
    equal(merged.document.opponents!.a.level, 21);
    deepStrictEqual(merged.document.opponents!.a.moves, remote.opponents!.a.moves);
    equal(merged.document.opponents!.b.level, 23);
    equal(merged.document.encounters!.rival.name, 'Rival · first battle');
    ok(validateCollectionDocument(merged.document));
});

void test('same opponent field corrections retain both choices', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.opponents!.a.level = 21;
    remote.opponents!.a.level = 19;
    const merged = mergeCollections(base, local, remote);
    equal(merged.conflicts.length, 1);
    const item = merged.conflicts[0];
    equal(item.entity, 'opponents');
    equal(item.field, 'level');
    equal(readConflictValue(merged.document, item), 21);
    const resolved = applyConflictChoice(merged.document, item, 'remote');
    equal(resolved.opponents!.a.level, 19);
    ok(validateCollectionDocument(resolved));
});

void test('opponent removal against a revealed move retains the move and a restorable party choice', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.opponents!.a.deleted = true;
    local.encounters!.rival.party = ['b'];
    remote.opponents!.a.moves = [{ moveId: 58, name: 'Ice Beam' }];
    remote.encounters!.rival.party = ['b', 'a'];
    const merged = mergeCollections(base, local, remote);
    const removal = merged.conflicts.find((item) => item.entity === 'opponents')!;
    const party = merged.conflicts.find((item) => item.entity === 'encounters')!;
    equal(removal.kind, 'delete-edit');
    equal(party.kind, 'party');
    deepStrictEqual(merged.document.opponents!.a.moves, remote.opponents!.a.moves);
    deepStrictEqual(merged.document.encounters!.rival.party, ['b']);
    ok(validateCollectionDocument(merged.document));
    throws(() => applyConflictChoice(merged.document, party, 'remote'), /removed opponents/);
    const restored = applyConflictChoice(merged.document, removal, 'remote');
    const resolved = applyConflictChoice(restored, party, 'remote');
    deepStrictEqual(resolved.encounters!.rival.party, ['b', 'a']);
    ok(validateCollectionDocument(resolved));
});

void test('removing an encounter or playthrough conflicts with changes to its opponent', () => {
    for (const entity of ['encounters', 'playthroughs'] as const) {
        const base = fixture();
        const local = structuredClone(base);
        const remote = structuredClone(base);
        const id = entity === 'encounters' ? 'rival' : 'run';
        local[entity]![id].deleted = true;
        remote.opponents!.a.level = 21;
        const merged = mergeCollections(base, local, remote);
        const removal = merged.conflicts.find((item) => item.entity === entity)!;
        equal(removal.kind, 'delete-edit');
        equal(merged.document.opponents!.a.level, 21);
        ok(validateCollectionDocument(merged.document));
        equal(applyConflictChoice(merged.document, removal, 'remote')[entity]![id].deleted, false);
    }
});

void test('absent optional maps preserve base and remote encounters without spurious deletion conflicts', () => {
    const base = fixture();
    const old = structuredClone(base);
    delete old.encounters;
    delete old.opponents;
    const remote = structuredClone(base);
    remote.opponents!.a.level = 21;
    for (const [local, other] of [
        [old, remote],
        [remote, old],
    ]) {
        const merged = mergeCollections(base, local, other);
        equal(merged.conflicts.length, 0);
        equal(merged.document.opponents!.a.level, 21);
        ok(validateCollectionDocument(merged.document));
    }
    const added = mergeCollections(old, old, base);
    equal(added.conflicts.length, 0);
    deepStrictEqual(added.document, base);
    deepStrictEqual(mergeCollections(old, old, old).document, old);
});
