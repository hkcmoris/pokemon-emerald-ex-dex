import { deepStrictEqual, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';
import {
    applyMoveChoice,
    clearMoveChoice,
    getMoveChoice,
    moveChoiceContext,
    moveChoiceIsCurrent,
    parseMoveChoices,
    replaceKnownMove,
    requestMoveLearning,
    runMoveChoiceSave,
    setMoveChoice,
    takeAutomaticMoveChoice,
    writeMoveChoiceRecord,
} from './moveChoices.js';

const pokemon: OwnedPokemon = {
    id: 'moves-test',
    playthroughId: 'run',
    nickname: '',
    deleted: false,
    createdAt: '2026-10-17T10:00:00.000Z',
    state: {
        speciesId: 255,
        formEpoch: 'torchic',
        level: 15,
        moves: [
            { moveId: 1, name: 'First' },
            { moveId: 2, name: 'Second' },
            { moveId: 3, name: 'Third' },
            { moveId: 4, name: 'Fourth' },
        ],
    },
};
const learned = { moveId: 5, name: 'Learned' };

void test('direct replacement preserves the targeted slot and needs no temporary empty slot', () => {
    const context = moveChoiceContext(pokemon);
    const next = replaceKnownMove(context, learned, 2);
    deepStrictEqual(
        next.map((move) => move.moveId),
        [1, 5, 3, 4],
    );
    deepStrictEqual(
        pokemon.state.moves?.map((move) => move.moveId),
        [1, 2, 3, 4],
    );
    throws(() => replaceKnownMove(context, learned), /choose-replacement/);
    throws(() => replaceKnownMove(context, pokemon.state.moves![0], 2), /move-already-known/);
});

void test('adding a first known move explicitly converts unknown moves to a recorded list', () => {
    const context = moveChoiceContext({ ...pokemon, state: { ...pokemon.state, moves: null } });
    deepStrictEqual(replaceKnownMove(context, learned), [learned]);
});

void test('ranked candidate metadata is never written into the strict collection moves schema', () => {
    const context = moveChoiceContext(pokemon);
    const candidate = {
        ...learned,
        group: 'wanted',
        source: { level: 15 },
        reference: { type: 'Fire' },
    };
    const next = replaceKnownMove(context, candidate, 1);
    deepStrictEqual(next[0], learned);
    deepStrictEqual(applyMoveChoice(pokemon, context, [candidate]).state.moves, [learned]);
});

void test('reorder and undo preserve a newer level, nickname, and wishlist', () => {
    const context = moveChoiceContext(pokemon);
    const current = { ...pokemon, nickname: 'Tamago', state: { ...pokemon.state, level: 16 } };
    const nextMoves = [...pokemon.state.moves!].reverse();
    const next = applyMoveChoice(current, context, nextMoves);
    strictEqual(next.state.level, 16);
    strictEqual(next.nickname, 'Tamago');
    const restored = applyMoveChoice(next, { ...context, moves: nextMoves }, context.moves);
    deepStrictEqual(restored.state.moves, pokemon.state.moves);
    strictEqual(restored.state.level, 16);
});

void test('stale reorder, evolution, release and member changes cannot overwrite current moves', () => {
    const context = moveChoiceContext(pokemon);
    for (const current of [
        { ...pokemon, deleted: true },
        { ...pokemon, playthroughId: 'another-run' },
        { ...pokemon, state: { ...pokemon.state, formEpoch: 'evolved' } },
        { ...pokemon, state: { ...pokemon.state, moves: [...pokemon.state.moves!].reverse() } },
    ]) {
        strictEqual(moveChoiceIsCurrent(current, context), false);
        throws(() => applyMoveChoice(current, context, [learned]), /moves-changed/);
    }
});

void test('pending choices survive serialization and invalid browser records are ignored', () => {
    const choice = { ...moveChoiceContext(pokemon), candidate: learned, query: 'new' };
    deepStrictEqual(parseMoveChoices(JSON.stringify([choice])), [choice]);
    deepStrictEqual(parseMoveChoices('broken json'), []);
    deepStrictEqual(
        parseMoveChoices(
            JSON.stringify([
                { ...choice, moves: [learned, learned] },
                { ...choice, candidate: { name: 'bad' } },
            ]),
        ),
        [],
    );
});

void test('a completed old submission does not erase a newer pending choice', () => {
    requestMoveLearning(pokemon, learned);
    const submitted = getMoveChoice(pokemon.id)!;
    const newer = { ...submitted, query: 'another move' };
    setMoveChoice(newer);
    clearMoveChoice(pokemon.id, submitted);
    strictEqual(getMoveChoice(pokemon.id), newer);
    clearMoveChoice(pokemon.id);
    strictEqual(getMoveChoice(pokemon.id), undefined);
});

void test('one-click learning submits only once and restoring a draft never submits automatically', () => {
    const empty = { ...pokemon, state: { ...pokemon.state, moves: [] } };
    requestMoveLearning(empty, learned);
    const choice = getMoveChoice(pokemon.id)!;
    strictEqual(takeAutomaticMoveChoice(choice), true);
    strictEqual(takeAutomaticMoveChoice(choice), false);
    const restored = parseMoveChoices(JSON.stringify([choice]))[0];
    strictEqual(takeAutomaticMoveChoice(restored), false);
    clearMoveChoice(pokemon.id);
});

void test('navigation while a save is pending cannot submit it twice', async () => {
    let finish!: () => void;
    let writes = 0;
    const first = runMoveChoiceSave(pokemon.id, () => {
        writes++;
        return new Promise<void>((resolve) => {
            finish = resolve;
        });
    });
    strictEqual(
        await runMoveChoiceSave(pokemon.id, () => {
            writes++;
            return Promise.resolve();
        }),
        false,
    );
    finish();
    strictEqual(await first, true);
    strictEqual(writes, 1);
});

void test('saving and clearing one member does not overwrite another tab’s draft', () => {
    const records = new Map<string, string>();
    const storage = {
        setItem: (key: string, value: string) => {
            records.set(key, value);
        },
        removeItem: (key: string) => {
            records.delete(key);
        },
    };
    const first = moveChoiceContext(pokemon);
    const second = { ...first, pokemonId: 'other-member', query: 'ember' };
    writeMoveChoiceRecord(storage, first.pokemonId, first);
    writeMoveChoiceRecord(storage, second.pokemonId, second);
    writeMoveChoiceRecord(storage, first.pokemonId, { ...first, query: 'peck' });
    strictEqual(records.size, 2);
    writeMoveChoiceRecord(storage, first.pokemonId);
    deepStrictEqual(
        [...records.values()].flatMap((raw) => parseMoveChoices(raw)),
        [second],
    );
});
