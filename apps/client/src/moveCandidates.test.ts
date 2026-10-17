import { strictEqual, ok } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import { getMoveCandidates } from './moveCandidates.js';

const family = Object.values(loadCollectionSpeciesFixture([255, 256, 257]));
const species = family.find((entry) => entry.speciesId === 255)!;
const reached = species.learnset.find((move) => move.level > 10 && move.level < 30)!;
const later = species.learnset.find(
    (move) => move.level > reached.level && move.moveId !== reached.moveId,
)!;
const pokemon: OwnedPokemon = {
    id: 'torchic',
    playthroughId: 'run',
    nickname: '',
    deleted: false,
    createdAt: '',
    state: { speciesId: 255, formEpoch: 'first', level: reached.level, moves: [] },
    moveWishlist: { targetSpeciesId: null, learnedMoveIds: [], moves: [later] },
};

void test('moves reached at the latest level precede wanted moves and older learning opportunities', () => {
    const candidates = getMoveCandidates(pokemon, family);
    const now = candidates.find((move) => move.moveId === reached.moveId)!;
    const wish = candidates.find((move) => move.moveId === later.moveId)!;
    strictEqual(now.group, 'reached');
    strictEqual(wish.group, 'wanted');
    ok(candidates.indexOf(now) < candidates.indexOf(wish));
    strictEqual(wish.source?.level, later.level);
    strictEqual(wish.source?.currentForm, true);
});

void test('catch-up ranking includes all newly reached levels and retains machine provenance', () => {
    const candidates = getMoveCandidates(pokemon, family, [], 1);
    for (const move of species.learnset.filter(
        (entry) => entry.level > 1 && entry.level <= reached.level,
    ))
        strictEqual(candidates.find((entry) => entry.moveId === move.moveId)?.group, 'reached');
    ok(candidates.some((entry) => entry.source?.machine));
    strictEqual(new Set(candidates.map((entry) => entry.moveId)).size, candidates.length);
});
