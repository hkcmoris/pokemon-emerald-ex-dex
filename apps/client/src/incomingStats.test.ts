import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import type { Pokemon } from '@pokemon-emerald-ex-dex/shared';
import { getIncomingStats } from './incomingStats.js';

const species: Pokemon = {
    speciesId: 1,
    name: 'Bulbasaur',
    types: ['Grass', 'Poison'],
    typeIds: [12, 3],
    typeIconFiles: [null, null],
    sprites: null,
    stats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    baseStatTotal: 318,
};

void test('incoming defense estimates fill only missing measurements and apply nature once', () => {
    const neutral = getIncomingStats(species, 50, {});
    deepStrictEqual(neutral.stats, { hp: 120, defense: 69, spDefense: 85 });
    strictEqual(neutral.estimated, true);
    // Bold raises Defense and lowers Attack; HP and Sp. Defense stay neutral.
    const bold = getIncomingStats(species, 50, { spDefense: 92 }, 5);
    deepStrictEqual(bold.stats, { hp: 120, defense: 75, spDefense: 92 });
    const measured = getIncomingStats(species, 50, { hp: 130, defense: 80, spDefense: 92 }, 5);
    deepStrictEqual(measured, { stats: { hp: 130, defense: 80, spDefense: 92 }, estimated: false });
});

void test('invalid levels cannot produce fallback defenses', () => {
    deepStrictEqual(getIncomingStats(species, 0, {}), { stats: {}, estimated: false });
});
