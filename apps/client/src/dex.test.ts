import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import statsTypes from '../../../docs/pokemon_emerald_ex_1.0.4_stats_types.json' with { type: 'json' };
import { statLabels } from './dex.js';

const dexMetadata = statsTypes.metadata;
const pokemon = statsTypes.species;
const pokemonTypes = [...new Set(pokemon.flatMap((entry) => entry.types))];

void test('the ROM export includes every species/form with consistent stats and types', () => {
    strictEqual(pokemon.length, dexMetadata.speciesFormCount);
    strictEqual(pokemon.length, 1523);
    strictEqual(new Set(pokemon.map((entry) => entry.speciesId)).size, pokemon.length);
    const typeMapping: Readonly<Record<string, string>> = dexMetadata.typeIdMapping;

    for (const entry of pokemon) {
        strictEqual(
            statLabels.reduce((sum, { key }) => sum + entry.stats[key], 0),
            entry.baseStatTotal,
        );
        deepStrictEqual(
            entry.types,
            entry.typeIds.map((id) => typeMapping[String(id)]),
        );
    }
    strictEqual(pokemon.at(-1)?.speciesId, 1523);
    strictEqual(pokemonTypes.includes('Fairy'), true);
});
