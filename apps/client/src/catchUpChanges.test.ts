import { deepStrictEqual, notStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';
import { applyCatchUpChanges } from './catchUpChanges.js';

const spearow: OwnedPokemon = {
    id: 'bird',
    playthroughId: 'run',
    nickname: 'Beak',
    deleted: false,
    createdAt: '2026-10-17T12:00:00Z',
    natureId: 3,
    ability: { speciesId: 21, abilityId: 51 },
    state: { speciesId: 21, formEpoch: 'spearow-stage', level: 20, moves: null },
};

void test('recording Fearow starts a new form stage while preserving unknown moves, level and identity', () => {
    const before = structuredClone(spearow);
    const result = applyCatchUpChanges(spearow, spearow.state, { evolutionSpeciesId: 22 });
    strictEqual(result.state.speciesId, 22);
    notStrictEqual(result.state.formEpoch, spearow.state.formEpoch);
    deepStrictEqual({ ...result, state: spearow.state }, spearow);
    strictEqual(result.state.level, 20);
    strictEqual(result.state.moves, null);
    deepStrictEqual(spearow, before);
});

void test('evolution and edited moves save together; evolution alone keeps the latest current moves', () => {
    const moves = [{ moveId: 64, name: 'Peck' }];
    const current = { ...spearow, state: { ...spearow.state, moves } };
    const evolved = applyCatchUpChanges(current, spearow.state, { evolutionSpeciesId: 22 });
    deepStrictEqual(evolved.state.moves, moves);
    const changed = applyCatchUpChanges(current, current.state, {
        evolutionSpeciesId: 22,
        moves: [],
    });
    strictEqual(changed.state.speciesId, 22);
    deepStrictEqual(changed.state.moves, []);
    const onlyMoves = applyCatchUpChanges(spearow, spearow.state, { moves });
    strictEqual(onlyMoves.state.formEpoch, spearow.state.formEpoch);
    strictEqual(onlyMoves.state.speciesId, 21);
});

void test('a stale recap cannot overwrite a new form, stage, level or released Pokémon', () => {
    const alternatives: OwnedPokemon[] = [
        { ...spearow, deleted: true },
        { ...spearow, state: { ...spearow.state, speciesId: 22 } },
        { ...spearow, state: { ...spearow.state, formEpoch: 'new-stage' } },
        { ...spearow, state: { ...spearow.state, level: 21 } },
    ];
    for (const current of alternatives) {
        const before = structuredClone(current);
        throws(() => applyCatchUpChanges(current, spearow.state, { evolutionSpeciesId: 22 }));
        deepStrictEqual(current, before);
    }
});
