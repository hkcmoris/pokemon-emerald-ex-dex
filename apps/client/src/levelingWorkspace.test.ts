import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';
import {
    attackerFingerprint,
    readSimulatorAttacker,
    rememberSimulatorAttacker,
    readSimulatorOpponent,
    rememberSimulatorOpponent,
    emptyEnemySetup,
    resetSimulatorSession,
} from './simulatorSession.js';
import { clearLevelReview, readLevelReview, rememberLevelReview } from './levelingSession.js';
import { getPreviousObservedStats } from './MyPokemonCurrentStats.js';

const pokemon: OwnedPokemon = {
    id: 'leveling-test',
    playthroughId: 'test-run',
    nickname: '',
    state: { speciesId: 256, level: 22, moves: [], formEpoch: 'combusken' },
    deleted: false,
    createdAt: '2026-10-17T00:00:00Z',
};
const observation = (id: string, time: string, speed: number): StatObservation => ({
    id,
    pokemonId: pokemon.id,
    speciesId: 256,
    formEpoch: 'combusken',
    level: 22,
    stats: { speed },
    recordedAt: time,
    deleted: false,
});

void test('stat differences compare same-level Carbos entries and do not cross evolution stages', () => {
    const first = observation('before', '2026-10-17T10:21:00Z', 30);
    const second = observation('after', '2026-10-17T18:13:00Z', 31);
    deepStrictEqual(getPreviousObservedStats(pokemon, [second, first]), { speed: 30 });
    deepStrictEqual(
        getPreviousObservedStats(pokemon, [
            second,
            { ...first, formEpoch: 'torchic', speciesId: 255 },
        ]),
        {},
    );
    deepStrictEqual(
        getPreviousObservedStats(pokemon, [
            second,
            first,
            { ...first, id: 'conflict', stats: { speed: 29 } },
        ]),
        {},
    );
});

void test('simulator context survives navigation but newer measured stats invalidate temporary attacker values', () => {
    const key = 'test-dataset:leveling-test';
    const fingerprint = attackerFingerprint(pokemon, { speed: 30 });
    rememberSimulatorAttacker(key, fingerprint, {
        overrides: { attack: '99', spAttack: '', defense: '' },
        previewIds: [33],
        search: 'tackle',
    });
    strictEqual(readSimulatorAttacker(key, fingerprint).overrides.attack, '99');
    deepStrictEqual(
        readSimulatorAttacker(key, attackerFingerprint(pokemon, { speed: 31 })).previewIds,
        [],
    );
    strictEqual(
        readSimulatorAttacker(
            key,
            attackerFingerprint(
                { ...pokemon, state: { ...pokemon.state, level: 23 } },
                { speed: 30 },
            ),
        ).overrides.attack,
        '',
    );
    const copy = readSimulatorAttacker(key, fingerprint);
    copy.previewIds.push(99);
    deepStrictEqual(readSimulatorAttacker(key, fingerprint).previewIds, [33]);
    rememberSimulatorOpponent('test-dataset', { ...emptyEnemySetup(), level: '35' });
    strictEqual(readSimulatorOpponent('test-dataset').level, '35');
    strictEqual(readSimulatorOpponent('another-dataset').level, '');
    resetSimulatorSession('test-dataset');
    strictEqual(readSimulatorOpponent('test-dataset').level, '');
    deepStrictEqual(readSimulatorAttacker(key, fingerprint).previewIds, []);
});

void test('pending level-up decisions merge successive entries without losing the earliest unreviewed level', () => {
    clearLevelReview(pokemon.id);
    rememberLevelReview(pokemon.id, {
        speciesId: 256,
        formEpoch: 'combusken',
        oldLevel: 18,
        newLevel: 20,
    });
    rememberLevelReview(pokemon.id, {
        speciesId: 256,
        formEpoch: 'combusken',
        oldLevel: 20,
        newLevel: 22,
    });
    deepStrictEqual(readLevelReview(pokemon), {
        speciesId: 256,
        formEpoch: 'combusken',
        oldLevel: 18,
        newLevel: 22,
    });
    strictEqual(
        readLevelReview({ ...pokemon, state: { ...pokemon.state, formEpoch: 'new-stage' } }),
        null,
    );
    strictEqual(readLevelReview({ ...pokemon, state: { ...pokemon.state, level: 19 } }), null);
    clearLevelReview(pokemon.id);
    strictEqual(readLevelReview(pokemon), null);
});
