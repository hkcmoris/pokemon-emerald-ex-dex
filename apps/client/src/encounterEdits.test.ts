import { deepStrictEqual, notStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import {
    emptyCollection,
    validateCollectionDocument,
    type CollectionConflict,
    type CollectionDocument,
    type KnownMove,
} from '@pokemon-emerald-ex-dex/shared';

import {
    addEncounterOpponent,
    createEncounter,
    duplicateEncounter,
    encounterHasConflict,
    getEncounterOpponents,
    opponentHasConflict,
    recordEncounterMove,
    rematchEncounterName,
    removeEncounterOpponent,
    renameEncounter,
    restoreEncounterOpponent,
    setEncounterOpponentLevel,
    setEncounterOpponentMoves,
} from './encounterEdits.js';

const createdAt = '2026-10-18T09:00:00.000Z';
const iceBeam: KnownMove = { moveId: 58, name: 'Ice Beam' };
const tackle: KnownMove = { moveId: 33, name: 'Tackle' };

function collection(): CollectionDocument {
    const document = {
        ...emptyCollection(),
        playthroughs: { emerald: { id: 'emerald', name: 'Emerald', party: [], deleted: false } },
    };
    return addEncounterOpponent(
        createEncounter(document, 'emerald', 'rival-110', 'Rival · Route 110', createdAt),
        'rival-110',
        'foe',
        258,
        20,
    );
}

void test('encounters retain playthrough identity and new opponents start with unknown moves', () => {
    const source = collection();
    strictEqual(validateCollectionDocument(source), true);
    strictEqual(source.encounters?.['rival-110'].playthroughId, 'emerald');
    deepStrictEqual(source.opponents?.foe.moves, []);
    const duplicateSpecies = addEncounterOpponent(source, 'rival-110', 'foe-two', 258, 25);
    deepStrictEqual(duplicateSpecies.encounters?.['rival-110'].party, ['foe', 'foe-two']);
    strictEqual(duplicateSpecies.opponents?.foe.level, 20);
    strictEqual(duplicateSpecies.opponents?.['foe-two'].level, 25);
    strictEqual(source.encounters?.['rival-110'].party.length, 1);
});

void test('level autosave preserves moves recorded after the editor opened and rejects stale levels', () => {
    const source = collection();
    const expected = source.opponents!.foe;
    const withMove = setEncounterOpponentMoves(source, expected, [iceBeam]);
    const updated = setEncounterOpponentLevel(withMove, expected, 21);
    deepStrictEqual(updated.opponents?.foe.moves, [iceBeam]);
    strictEqual(updated.opponents?.foe.level, 21);
    strictEqual(updated.encounters, withMove.encounters);
    strictEqual(updated.pokemon, source.pokemon);
    throws(() => setEncounterOpponentLevel(updated, expected, 22));
    for (const level of [0, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
        throws(() => setEncounterOpponentLevel(source, expected, level));
    strictEqual(setEncounterOpponentLevel(source, expected, 20), source);
});

void test('revealed-move edits preserve newer levels and cannot overwrite another move edit', () => {
    const source = collection();
    const expected = source.opponents!.foe;
    const withLevel = setEncounterOpponentLevel(source, expected, 23);
    const withMove = setEncounterOpponentMoves(withLevel, expected, [iceBeam]);
    strictEqual(withMove.opponents?.foe.level, 23);
    deepStrictEqual(withMove.opponents?.foe.moves, [iceBeam]);
    throws(() => setEncounterOpponentMoves(withMove, expected, [tackle]));
    throws(() => setEncounterOpponentMoves(source, expected, [iceBeam, iceBeam]));
    throws(() =>
        setEncounterOpponentMoves(
            source,
            expected,
            Array.from({ length: 5 }, (_, index) => ({ moveId: index + 1, name: 'Move' })),
        ),
    );
    throws(() =>
        setEncounterOpponentMoves(source, expected, [{ moveId: 1, name: 'X'.repeat(81) }]),
    );
});

void test('rematches copy current levels and revealed moves into independent opponents', () => {
    let source = collection();
    const expectedEncounter = source.encounters!['rival-110'];
    const opponent = source.opponents!.foe;
    source = setEncounterOpponentLevel(source, opponent, 21);
    source = setEncounterOpponentMoves(source, opponent, [iceBeam]);
    const copied = duplicateEncounter(
        source,
        expectedEncounter,
        'rival-119',
        ['rematch-foe'],
        'Rival · Route 119',
        createdAt,
    );
    strictEqual(validateCollectionDocument(copied), true);
    deepStrictEqual(copied.encounters?.['rival-119'].party, ['rematch-foe']);
    deepStrictEqual(copied.opponents?.['rematch-foe'], {
        ...source.opponents!.foe,
        id: 'rematch-foe',
        encounterId: 'rival-119',
    });
    notStrictEqual(copied.opponents?.['rematch-foe'].moves, source.opponents!.foe.moves);
    notStrictEqual(copied.opponents?.['rematch-foe'].moves[0], source.opponents!.foe.moves[0]);
    const changedRematch = setEncounterOpponentMoves(copied, copied.opponents['rematch-foe'], [
        tackle,
    ]);
    deepStrictEqual(changedRematch.opponents?.foe.moves, [iceBeam]);
    throws(() =>
        duplicateEncounter(
            addEncounterOpponent(source, 'rival-110', 'new-foe', 255, 20),
            expectedEncounter,
            'stale-copy',
            ['copy-foe'],
            'Rematch',
            createdAt,
        ),
    );
    throws(() =>
        duplicateEncounter(source, expectedEncounter, 'rival-119', ['foe'], 'Rematch', createdAt),
    );
});

void test('recording a revealed move rejects a removed replacement target instead of a silent no-op', () => {
    const source = collection();
    throws(() => recordEncounterMove(source, source.opponents!.foe, iceBeam, tackle.moveId));
    const withTackle = recordEncounterMove(source, source.opponents!.foe, tackle);
    const expected = withTackle.opponents!.foe;
    const replaced = recordEncounterMove(withTackle, expected, iceBeam, tackle.moveId);
    deepStrictEqual(replaced.opponents!.foe.moves, [iceBeam]);
    const removed = setEncounterOpponentMoves(withTackle, expected, []);
    throws(() => recordEncounterMove(removed, expected, iceBeam, tackle.moveId));
});

void test('maximum-length names remain valid when duplicated for rematches', () => {
    const source = collection();
    const named = renameEncounter(source, source.encounters!['rival-110'], 'R'.repeat(80));
    for (const suffix of [' · rematch', ' · odveta']) {
        const name = rematchEncounterName(named.encounters!['rival-110'].name, suffix);
        strictEqual(name.length, 80);
        strictEqual(name.endsWith(suffix), true);
        strictEqual(
            validateCollectionDocument(
                duplicateEncounter(
                    named,
                    named.encounters!['rival-110'],
                    'copy',
                    ['copy-foe'],
                    name,
                    createdAt,
                ),
            ),
            true,
        );
    }
    throws(() => renameEncounter(source, source.encounters!['rival-110'], 'X'.repeat(81)));
    throws(() => createEncounter(source, 'emerald', 'empty', '  ', createdAt));
    throws(() => createEncounter(source, 'emerald', 'invalid-date', 'Rival', 'not-a-date'));
});

void test('renaming preserves newer party edits and refuses a changed saved name', () => {
    const source = collection();
    const expected = source.encounters!['rival-110'];
    const added = addEncounterOpponent(source, expected.id, 'second', 255, 20);
    const renamed = renameEncounter(added, expected, '  Rival · Route 119  ');
    strictEqual(renamed.encounters?.[expected.id].name, 'Rival · Route 119');
    deepStrictEqual(renamed.encounters?.[expected.id].party, ['foe', 'second']);
    throws(() => renameEncounter(renamed, expected, 'Another name'));
});

void test('removing and undoing an opponent preserves party order and recorded details', () => {
    let source = collection();
    source = setEncounterOpponentMoves(source, source.opponents!.foe, [iceBeam]);
    source = addEncounterOpponent(source, 'rival-110', 'second', 255, 19);
    const expected = source.opponents!.foe;
    const removed = removeEncounterOpponent(source, expected);
    strictEqual(validateCollectionDocument(removed), true);
    strictEqual(removed.opponents?.foe.deleted, true);
    deepStrictEqual(removed.encounters?.['rival-110'].party, ['second']);
    const restored = restoreEncounterOpponent(removed, expected, 0);
    strictEqual(validateCollectionDocument(restored), true);
    deepStrictEqual(restored.encounters?.['rival-110'].party, ['foe', 'second']);
    deepStrictEqual(restored.opponents?.foe, expected);
    throws(() => restoreEncounterOpponent(restored, expected, 0));
    throws(() =>
        removeEncounterOpponent(setEncounterOpponentLevel(source, expected, 21), expected),
    );
    throws(() => setEncounterOpponentMoves(removed, expected, [tackle]));
});

void test('party size is bounded and undo cannot silently displace a newer opponent', () => {
    let source = collection();
    const expected = source.opponents!.foe;
    source = removeEncounterOpponent(source, expected);
    for (let index = 0; index < 6; index++)
        source = addEncounterOpponent(source, 'rival-110', `enemy-${index}`, 258, 20);
    throws(() => addEncounterOpponent(source, 'rival-110', 'seventh', 258, 20));
    throws(() => restoreEncounterOpponent(source, expected, 0));
    strictEqual(getEncounterOpponents(source, source.encounters!['rival-110']).length, 6);
    throws(() => addEncounterOpponent(source, 'missing', 'invalid', 258, 20));
});

void test('deleted encounters and playthroughs reject stale writes', () => {
    const source = collection();
    const expected = source.opponents!.foe;
    const removedEncounter = {
        ...source,
        encounters: {
            ...source.encounters,
            'rival-110': { ...source.encounters!['rival-110'], deleted: true },
        },
    };
    throws(() => setEncounterOpponentLevel(removedEncounter, expected, 21));
    const removedRun = {
        ...source,
        playthroughs: { emerald: { ...source.playthroughs.emerald, deleted: true } },
    };
    throws(() => setEncounterOpponentMoves(removedRun, expected, [iceBeam]));
    throws(() => createEncounter(removedRun, 'emerald', 'new', 'Rematch', createdAt));
});

void test('conflict guards isolate unrelated opponents while blocking affected encounters', () => {
    const source = collection();
    const conflict: CollectionConflict = {
        id: 'conflict',
        kind: 'field',
        entity: 'opponents',
        entityId: 'foe',
        field: 'level',
        base: 20,
        local: 21,
        remote: 22,
    };
    strictEqual(opponentHasConflict(source, [conflict], source.opponents!.foe), true);
    strictEqual(encounterHasConflict(source, [conflict], 'rival-110'), false);
    strictEqual(
        opponentHasConflict(source, [{ ...conflict, entityId: 'other' }], source.opponents!.foe),
        false,
    );
    strictEqual(
        encounterHasConflict(
            source,
            [{ ...conflict, entity: 'encounters', entityId: 'rival-110', field: 'party' }],
            'rival-110',
        ),
        true,
    );
    strictEqual(
        opponentHasConflict(
            source,
            [{ ...conflict, entity: 'playthroughs', entityId: 'emerald', field: 'deleted' }],
            source.opponents!.foe,
        ),
        true,
    );
});
