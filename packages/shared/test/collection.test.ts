import { deepStrictEqual, equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';
import {
    applyConflictChoice,
    emptyCollection,
    interpolateStats,
    mergeCollections,
    readConflictValue,
    recordLearnedWishlistMoves,
    validateCollectionDocument,
    type CollectionDocument,
    type StatObservation,
} from '../src/collection.js';

function fixture(): CollectionDocument {
    return {
        version: 1,
        playthroughs: { run: { id: 'run', name: 'Emerald run', party: ['mon'], deleted: false } },
        pokemon: {
            mon: {
                id: 'mon',
                playthroughId: 'run',
                nickname: 'Leaf',
                state: { speciesId: 1, level: 24, moves: null, formEpoch: 'form1' },
                deleted: false,
                createdAt: '2026-10-12T12:00:00.000Z',
            },
        },
        observations: {},
    };
}

function observation(
    id: string,
    level: number,
    attack: number,
    overrides: Partial<StatObservation> = {},
): StatObservation {
    return {
        id,
        pokemonId: 'mon',
        level,
        speciesId: 1,
        formEpoch: 'form1',
        stats: { attack },
        recordedAt: '2026-10-12T12:00:00.000Z',
        deleted: false,
        ...overrides,
    };
}

void test('validation allows unknown moves and partial observed stats, rejects unsafe or incoherent documents', () => {
    const valid = fixture();
    valid.observations.a = observation('a', 20, 35);
    ok(validateCollectionDocument(valid));
    ok(validateCollectionDocument(emptyCollection()));
    const invalids: unknown[] = [
        { ...valid, version: 2 },
        { ...valid, extra: true },
        {
            ...valid,
            pokemon: {
                ...valid.pokemon,
                mon: { ...valid.pokemon.mon, state: { ...valid.pokemon.mon.state, level: 101 } },
            },
        },
        { ...valid, observations: { a: observation('a', 20, Number.NaN) } },
        { ...valid, observations: { a: observation('a', 20, 35, { pokemonId: 'missing' }) } },
        { ...valid, playthroughs: { run: { ...valid.playthroughs.run, party: ['mon', 'mon'] } } },
        { ...valid, pokemon: { mon: { ...valid.pokemon.mon, deleted: true } } },
        {
            ...valid,
            pokemon: {
                mon: {
                    ...valid.pokemon.mon,
                    state: { ...valid.pokemon.mon.state, formEpoch: '__proto__' },
                },
            },
        },
        { ...valid, observations: { a: observation('a', 20, 35, { stats: {} }) } },
        JSON.parse(
            '{"version":1,"playthroughs":{"__proto__":{}},"pokemon":{},"observations":{}}',
        ) as unknown,
    ];
    for (const invalid of invalids) equal(validateCollectionDocument(invalid), false);
});

void test('independent fields, separate Pokémon and separate observations merge without conflicts', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.nickname = 'Sprout';
    local.observations.pc = observation('pc', 25, 40);
    remote.pokemon.mon.state.level = 26;
    remote.observations.phone = observation('phone', 26, 42);
    const result = mergeCollections(base, local, remote);
    equal(result.conflicts.length, 0);
    equal(result.document.pokemon.mon.nickname, 'Sprout');
    equal(result.document.pokemon.mon.state.level, 26);
    deepStrictEqual(Object.keys(result.document.observations), ['pc', 'phone']);
    ok(validateCollectionDocument(result.document));
    equal(base.pokemon.mon.state.level, 24);
});

void test('conflicting lower-level correction is retained and no hybrid evolution state is invented', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.state = {
        speciesId: 2,
        level: 26,
        moves: [{ moveId: 10, name: 'New move' }],
        formEpoch: 'form2',
    };
    remote.pokemon.mon.state.level = 23;
    const result = mergeCollections(base, local, remote);
    equal(result.conflicts.length, 1);
    equal(result.conflicts[0].field, 'state');
    deepStrictEqual(result.document.pokemon.mon.state, local.pokemon.mon.state);
    const resolved = applyConflictChoice(result.document, result.conflicts[0], 'remote');
    deepStrictEqual(resolved.pokemon.mon.state, remote.pokemon.mon.state);
    deepStrictEqual(readConflictValue(resolved, result.conflicts[0]), remote.pokemon.mon.state);
    ok(validateCollectionDocument(resolved));
});

void test('the same changes on both devices do not conflict even with different object property order', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.state.level = 27;
    remote.pokemon.mon.state = { formEpoch: 'form1', moves: null, level: 27, speciesId: 1 };
    equal(mergeCollections(base, local, remote).conflicts.length, 0);
});

void test('a removal concurrent with an edit preserves recoverable data and a valid visible party', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.deleted = true;
    local.playthroughs.run.party = [];
    remote.pokemon.mon.nickname = 'Renamed on phone';
    const result = mergeCollections(base, local, remote);
    const removal = result.conflicts.find((item) => item.kind === 'delete-edit')!;
    ok(removal);
    equal(result.document.pokemon.mon.deleted, true);
    equal(result.document.pokemon.mon.nickname, 'Renamed on phone');
    deepStrictEqual(result.document.playthroughs.run.party, []);
    equal(applyConflictChoice(result.document, removal, 'remote').pokemon.mon.deleted, false);
    ok(validateCollectionDocument(result.document));
});

void test('playthrough removal conflicts with a child edit or new observation and never destroys descendants', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.playthroughs.run.deleted = true;
    remote.observations.new = observation('new', 25, 40);
    const result = mergeCollections(base, local, remote);
    const removal = result.conflicts.find((item) => item.kind === 'delete-edit')!;
    equal(removal.entity, 'playthroughs');
    const restored = applyConflictChoice(result.document, removal, 'remote');
    equal(restored.playthroughs.run.deleted, false);
    equal(restored.observations.new.stats.attack, 40);
    const removed = applyConflictChoice(result.document, removal, 'local');
    equal(removed.observations.new.stats.attack, 40);
    ok(validateCollectionDocument(restored));
    ok(validateCollectionDocument(removed));
});

void test('edits made before removing an entry are preserved as part of the removal alternative', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.nickname = 'Local name';
    local.pokemon.mon.deleted = true;
    local.playthroughs.run.party = [];
    remote.pokemon.mon.nickname = 'Remote name';
    remote.pokemon.mon.state.level = 26;
    const merged = mergeCollections(base, local, remote);
    const removal = merged.conflicts.find((entry) => entry.kind === 'delete-edit')!;
    equal(merged.document.pokemon.mon.nickname, 'Local name');
    equal(merged.document.pokemon.mon.state.level, 26);
    const selected = applyConflictChoice(merged.document, removal, 'remote');
    equal(selected.pokemon.mon.nickname, 'Remote name');
    equal(selected.pokemon.mon.deleted, false);
});

void test('concurrent lineup reordering requires a choice; no member is lost from the collection', () => {
    const base = fixture();
    for (const member of ['b', 'c'])
        base.pokemon[member] = { ...structuredClone(base.pokemon.mon), id: member };
    base.playthroughs.run.party = ['mon', 'b', 'c'];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.playthroughs.run.party = ['b', 'mon', 'c'];
    remote.playthroughs.run.party = ['c', 'b', 'mon'];
    const result = mergeCollections(base, local, remote);
    equal(result.conflicts[0].kind, 'party');
    deepStrictEqual(
        applyConflictChoice(result.document, result.conflicts[0], 'remote').playthroughs.run.party,
        ['c', 'b', 'mon'],
    );
    equal(Object.keys(result.document.pokemon).length, 3);
});

void test('party selection waits for its removed Pokémon conflict instead of silently dropping the chosen member', () => {
    const base = fixture();
    base.pokemon.b = { ...structuredClone(base.pokemon.mon), id: 'b' };
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.deleted = true;
    local.playthroughs.run.party = [];
    remote.playthroughs.run.party = ['mon', 'b'];
    const merged = mergeCollections(base, local, remote);
    const party = merged.conflicts.find((item) => item.kind === 'party')!;
    const removal = merged.conflicts.find(
        (item) => item.entity === 'pokemon' && item.kind === 'delete-edit',
    )!;
    ok(party);
    ok(removal, 'a concurrent party edit also counts as use of the removed Pokémon');
    throws(
        () => applyConflictChoice(merged.document, party, 'remote'),
        /Resolve related removed Pokémon first/,
    );
    deepStrictEqual(merged.document.playthroughs.run.party, []);
    deepStrictEqual(party.remote, ['mon', 'b']);
    const restored = applyConflictChoice(merged.document, removal, 'remote');
    const resolved = applyConflictChoice(restored, party, 'remote');
    deepStrictEqual(resolved.playthroughs.run.party, ['mon', 'b']);
    ok(validateCollectionDocument(resolved));
});

void test('a local party addition against a remote removal retains a coherent local Pokémon and lineup', () => {
    const base = fixture();
    base.playthroughs.run.party = [];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.playthroughs.run.party = ['mon'];
    remote.pokemon.mon.deleted = true;
    const merged = mergeCollections(base, local, remote);
    const removal = merged.conflicts.find(
        (item) => item.entity === 'pokemon' && item.kind === 'delete-edit',
    )!;
    ok(removal);
    equal(merged.document.pokemon.mon.deleted, false);
    deepStrictEqual(merged.document.playthroughs.run.party, ['mon']);
    ok(validateCollectionDocument(merged.document));
    const removed = applyConflictChoice(merged.document, removal, 'remote');
    equal(removed.pokemon.mon.deleted, true);
    deepStrictEqual(removed.playthroughs.run.party, []);
    const restored = applyConflictChoice(merged.document, removal, 'local');
    deepStrictEqual(restored.playthroughs.run.party, ['mon']);
});

void test('a whole-playthrough alternative cannot silently normalize away a selected party member', () => {
    const base = fixture();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.playthroughs.run.deleted = true;
    local.playthroughs.run.party = [];
    local.pokemon.mon.deleted = true;
    remote.playthroughs.run.name = 'Renamed remotely';
    remote.pokemon.mon.nickname = 'Keep me';
    const merged = mergeCollections(base, local, remote);
    const runConflict = merged.conflicts.find(
        (item) => item.entity === 'playthroughs' && item.field === '$entity',
    )!;
    const removal = merged.conflicts.find((item) => item.entity === 'pokemon')!;
    const withOriginalParty = { ...runConflict, remote: { ...remote.playthroughs.run } };
    throws(
        () => applyConflictChoice(merged.document, withOriginalParty, 'remote'),
        /Resolve related removed Pokémon first/,
    );
    equal(merged.document.playthroughs.run.deleted, true);
    const restored = applyConflictChoice(merged.document, removal, 'remote');
    const resolved = applyConflictChoice(restored, withOriginalParty, 'remote');
    equal(resolved.playthroughs.run.deleted, false);
    deepStrictEqual(resolved.playthroughs.run.party, ['mon']);
    ok(validateCollectionDocument(resolved));
});

void test('concurrent corrections of one observation remain whole alternatives', () => {
    const base = fixture();
    base.observations.a = observation('a', 20, 35);
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.observations.a.level = 19;
    remote.observations.a.stats.attack = 36;
    const result = mergeCollections(base, local, remote);
    equal(result.conflicts[0].entity, 'observations');
    deepStrictEqual(result.document.observations.a, local.observations.a);
});

void test('partial stat interpolation is bounded, labeled, and never crosses individuals or form epochs', () => {
    const observations = [
        observation('a', 20, 30, { stats: { attack: 30, hp: 50 } }),
        observation('b', 22, 34, { stats: { attack: 34 } }),
        observation('c', 24, 38, { stats: { hp: 58 } }),
        observation('d', 28, 50, { speciesId: 2, formEpoch: 'form2' }),
        observation('e', 30, 54, { speciesId: 1, formEpoch: 'form3' }),
        observation('f', 32, 70, { pokemonId: 'another' }),
    ];
    const estimates = interpolateStats(observations);
    equal(estimates.length, 3);
    deepStrictEqual(
        estimates.map((estimate) => estimate.level),
        [21, 22, 23],
    );
    deepStrictEqual(estimates[0].stats, { hp: 52, attack: 32 });
    deepStrictEqual(estimates[1].stats, { hp: 54 });
    ok(estimates.every((estimate) => estimate.estimated && estimate.formEpoch === 'form1'));
});

void test('different observed values at the same level are retained, with no arbitrary estimate endpoint', () => {
    const estimates = interpolateStats([
        observation('a', 20, 30),
        observation('b', 20, 33),
        observation('c', 23, 39),
        observation('d', 25, 43),
        observation('removed', 24, 999, { deleted: true }),
    ]);
    deepStrictEqual(
        estimates.map((estimate) => [estimate.level, estimate.stats.attack]),
        [[24, 41]],
    );
});

void test('legacy collections remain valid and wishlist data is strictly validated', () => {
    const document = fixture();
    ok(validateCollectionDocument(document));
    const moves = Array.from({ length: 6 }, (_, index) => ({ moveId: index + 1, name: 'Move' }));
    const wishlist = { moves, learnedMoveIds: [1, 20], targetSpeciesId: null };
    document.pokemon.mon.moveWishlist = wishlist;
    ok(validateCollectionDocument(document));
    for (const invalid of [
        null,
        {},
        { ...wishlist, unexpected: true },
        { ...wishlist, targetSpeciesId: 0 },
        { ...wishlist, moves: [...moves, moves[0]] },
        { ...wishlist, moves: [{ moveId: 1, name: '' }] },
        { ...wishlist, learnedMoveIds: [1, 1] },
        { ...wishlist, learnedMoveIds: [0] },
    ]) {
        equal(
            validateCollectionDocument({
                ...document,
                pokemon: {
                    mon: { ...document.pokemon.mon, moveWishlist: invalid },
                },
            }),
            false,
        );
    }
});

void test('wishlist learning survives replacement, evolution, and removing then readding the wish', () => {
    const pokemon = fixture().pokemon.mon;
    pokemon.moveWishlist = {
        moves: [{ moveId: 1, name: 'Move' }],
        learnedMoveIds: [],
        targetSpeciesId: null,
    };
    pokemon.state.moves = [{ moveId: 1, name: 'Move' }];
    const learned = recordLearnedWishlistMoves(pokemon);
    deepStrictEqual(learned.moveWishlist?.learnedMoveIds, [1]);
    deepStrictEqual(pokemon.moveWishlist.learnedMoveIds, []);
    const removed = recordLearnedWishlistMoves({
        ...learned,
        state: { ...learned.state, speciesId: 2, moves: [], formEpoch: 'evolved' },
        moveWishlist: { ...learned.moveWishlist, moves: [] },
    });
    const restored = recordLearnedWishlistMoves({
        ...removed,
        moveWishlist: { ...removed.moveWishlist!, moves: [{ moveId: 1, name: 'Move' }] },
    });
    deepStrictEqual(restored.moveWishlist?.learnedMoveIds, [1]);
});

void test('optional wishlist additions merge from either device and survive deletion conflicts', () => {
    const base = fixture();
    const withWishlist = structuredClone(base);
    withWishlist.pokemon.mon.moveWishlist = {
        moves: [{ moveId: 1, name: 'Move' }],
        learnedMoveIds: [],
        targetSpeciesId: 2,
    };
    for (const [local, remote] of [
        [base, withWishlist],
        [withWishlist, base],
    ]) {
        const merged = mergeCollections(base, local, remote);
        equal(merged.conflicts.length, 0);
        deepStrictEqual(
            merged.document.pokemon.mon.moveWishlist,
            withWishlist.pokemon.mon.moveWishlist,
        );
        ok(validateCollectionDocument(merged.document));
    }
    const deleted = structuredClone(base);
    deleted.pokemon.mon.deleted = true;
    deleted.playthroughs.run.party = [];
    for (const [local, remote] of [
        [deleted, withWishlist],
        [withWishlist, deleted],
    ]) {
        const merged = mergeCollections(base, local, remote);
        const conflict = merged.conflicts.find((item) => item.kind === 'delete-edit')!;
        ok(conflict);
        for (const choice of ['local', 'remote'] as const) {
            const resolved = applyConflictChoice(merged.document, conflict, choice);
            deepStrictEqual(
                resolved.pokemon.mon.moveWishlist,
                withWishlist.pokemon.mon.moveWishlist,
            );
            ok(validateCollectionDocument(resolved));
        }
    }
});

void test('conflicting wishlist choices retain both alternatives and combine permanent learning', () => {
    const base = fixture();
    base.pokemon.mon.moveWishlist = {
        moves: [{ moveId: 1, name: 'One' }],
        learnedMoveIds: [],
        targetSpeciesId: null,
    };
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.moveWishlist!.moves.push({ moveId: 2, name: 'Two' });
    local.pokemon.mon.moveWishlist!.learnedMoveIds = [1];
    remote.pokemon.mon.moveWishlist!.targetSpeciesId = 2;
    remote.pokemon.mon.moveWishlist!.learnedMoveIds = [2];
    const merged = mergeCollections(base, local, remote);
    equal(merged.conflicts.length, 1);
    equal(merged.conflicts[0].field, 'moveWishlist');
    merged.document.pokemon.mon.moveWishlist!.learnedMoveIds.push(3);
    for (const choice of ['local', 'remote'] as const) {
        const resolved = applyConflictChoice(merged.document, merged.conflicts[0], choice);
        deepStrictEqual(resolved.pokemon.mon.moveWishlist!.learnedMoveIds, [1, 2, 3]);
        ok(validateCollectionDocument(resolved));
    }
    deepStrictEqual(base.pokemon.mon.moveWishlist.learnedMoveIds, []);
    deepStrictEqual(local.pokemon.mon.moveWishlist!.learnedMoveIds, [1]);
});

void test('an absent optional wishlist conflict choice removes the property instead of storing null', () => {
    const base = fixture();
    base.pokemon.mon.moveWishlist = { moves: [], learnedMoveIds: [], targetSpeciesId: null };
    const local = structuredClone(base);
    delete local.pokemon.mon.moveWishlist;
    const remote = structuredClone(base);
    remote.pokemon.mon.moveWishlist!.targetSpeciesId = 2;
    const merged = mergeCollections(base, local, remote);
    equal(merged.conflicts.length, 1);
    const resolved = applyConflictChoice(merged.document, merged.conflicts[0], 'local');
    equal(Object.hasOwn(resolved.pokemon.mon, 'moveWishlist'), false);
    ok(validateCollectionDocument(resolved));
});

void test('recorded traits preserve legacy collections and strictly validate unknown and explicit values', () => {
    const document = fixture();
    ok(validateCollectionDocument(document));
    for (const natureId of [null, 0, 3, 24]) {
        for (const ability of [
            null,
            { speciesId: 1, abilityId: 65 },
            { speciesId: 2, abilityId: 100000 },
        ]) {
            const recorded = {
                ...document,
                pokemon: { mon: { ...document.pokemon.mon, natureId, ability } },
            };
            ok(validateCollectionDocument(recorded));
            deepStrictEqual(JSON.parse(JSON.stringify(recorded)), recorded);
        }
    }
    for (const natureId of [undefined, -1, 25, 3.5, Number.NaN, '3', {}, false]) {
        equal(
            validateCollectionDocument({
                ...document,
                pokemon: { mon: { ...document.pokemon.mon, natureId } },
            }),
            false,
        );
    }
    for (const ability of [
        undefined,
        [],
        {},
        65,
        '65',
        false,
        { speciesId: 1 },
        { abilityId: 65 },
        { speciesId: 0, abilityId: 65 },
        { speciesId: 100001, abilityId: 65 },
        { speciesId: 1.5, abilityId: 65 },
        { speciesId: '1', abilityId: 65 },
        { speciesId: 1, abilityId: 0 },
        { speciesId: 1, abilityId: 100001 },
        { speciesId: 1, abilityId: 65.5 },
        { speciesId: 1, abilityId: '65' },
        { speciesId: 1, abilityId: 65, extra: true },
    ]) {
        equal(
            validateCollectionDocument({
                ...document,
                pokemon: { mon: { ...document.pokemon.mon, ability } },
            }),
            false,
        );
    }
});

void test('nature and species-scoped ability merge independently without changing observations or moves', () => {
    const base = fixture();
    base.observations.a = observation('a', 24, 35);
    base.pokemon.mon.moveWishlist = {
        moves: [{ moveId: 10, name: 'Move' }],
        learnedMoveIds: [],
        targetSpeciesId: null,
    };
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.natureId = 0;
    remote.pokemon.mon.ability = { speciesId: 1, abilityId: 65 };
    for (const [ours, theirs] of [
        [local, remote],
        [remote, local],
    ]) {
        const merged = mergeCollections(base, ours, theirs);
        equal(merged.conflicts.length, 0);
        equal(merged.document.pokemon.mon.natureId, 0);
        deepStrictEqual(merged.document.pokemon.mon.ability, remote.pokemon.mon.ability);
        deepStrictEqual(merged.document.pokemon.mon.state, base.pokemon.mon.state);
        deepStrictEqual(merged.document.pokemon.mon.moveWishlist, base.pokemon.mon.moveWishlist);
        deepStrictEqual(merged.document.observations, base.observations);
        ok(validateCollectionDocument(merged.document));
    }
    equal(Object.hasOwn(base.pokemon.mon, 'natureId'), false);
    equal(Object.hasOwn(base.pokemon.mon, 'ability'), false);
});

void test('concurrent trait choices retain full alternatives and can be resolved or explicitly cleared', () => {
    const base = fixture();
    base.pokemon.mon.natureId = 0;
    base.pokemon.mon.ability = { speciesId: 1, abilityId: 65 };
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.pokemon.mon.natureId = 3;
    local.pokemon.mon.ability = { speciesId: 1, abilityId: 34 };
    remote.pokemon.mon.natureId = 15;
    remote.pokemon.mon.ability = { speciesId: 2, abilityId: 65 };
    const merged = mergeCollections(base, local, remote);
    deepStrictEqual(merged.conflicts.map(({ field }) => field).sort(), ['ability', 'natureId']);
    for (const choice of ['local', 'remote'] as const) {
        const resolved = merged.conflicts.reduce(
            (document, conflict) => applyConflictChoice(document, conflict, choice),
            merged.document,
        );
        equal(resolved.pokemon.mon.natureId, choice === 'local' ? 3 : 15);
        deepStrictEqual(
            resolved.pokemon.mon.ability,
            choice === 'local' ? local.pokemon.mon.ability : remote.pokemon.mon.ability,
        );
        ok(validateCollectionDocument(resolved));
    }
    const cleared = structuredClone(base);
    cleared.pokemon.mon.natureId = null;
    cleared.pokemon.mon.ability = null;
    const clearMerge = mergeCollections(base, cleared, remote);
    equal(clearMerge.conflicts.length, 2);
    const clearResolved = clearMerge.conflicts.reduce(
        (document, conflict) => applyConflictChoice(document, conflict, 'local'),
        clearMerge.document,
    );
    equal(clearResolved.pokemon.mon.natureId, null);
    equal(clearResolved.pokemon.mon.ability, null);
    ok(validateCollectionDocument(clearResolved));
});

void test('absent trait conflict alternatives resolve to valid unknown values', () => {
    const base = fixture();
    base.pokemon.mon.natureId = 0;
    base.pokemon.mon.ability = { speciesId: 1, abilityId: 65 };
    const local = structuredClone(base);
    const remote = structuredClone(base);
    delete local.pokemon.mon.natureId;
    delete local.pokemon.mon.ability;
    remote.pokemon.mon.natureId = 3;
    remote.pokemon.mon.ability = { speciesId: 1, abilityId: 34 };
    const merged = mergeCollections(base, local, remote);
    equal(merged.conflicts.length, 2);
    const resolved = merged.conflicts.reduce(
        (document, conflict) => applyConflictChoice(document, conflict, 'local'),
        merged.document,
    );
    // Conflict snapshots encode absence as null; both representations mean unknown.
    equal(resolved.pokemon.mon.natureId, null);
    equal(resolved.pokemon.mon.ability, null);
    ok(validateCollectionDocument(resolved));
});

void test('trait additions survive deletion conflicts in both recoverable alternatives', () => {
    const base = fixture();
    const local = structuredClone(base);
    local.pokemon.mon.deleted = true;
    local.playthroughs.run.party = [];
    const remote = structuredClone(base);
    remote.pokemon.mon.natureId = 15;
    remote.pokemon.mon.ability = { speciesId: 1, abilityId: 65 };
    const merged = mergeCollections(base, local, remote);
    const removal = merged.conflicts.find(({ kind }) => kind === 'delete-edit')!;
    for (const choice of ['local', 'remote'] as const) {
        const resolved = applyConflictChoice(merged.document, removal, choice);
        equal(resolved.pokemon.mon.natureId, 15);
        deepStrictEqual(resolved.pokemon.mon.ability, remote.pokemon.mon.ability);
        ok(validateCollectionDocument(resolved));
    }
});
