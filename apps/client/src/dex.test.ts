import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import { dexMetadata, filterPokemon, pokemon, pokemonTypes, statLabels } from './dex.js';

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

void test('search supports names and exact internal IDs, including padded IDs', () => {
    deepStrictEqual(
        filterPokemon(pokemon, ' BULBASAUR ', '', 'id').map((entry) => entry.speciesId),
        [1],
    );
    deepStrictEqual(
        filterPokemon(pokemon, '#0001', '', 'id').map((entry) => entry.speciesId),
        [1],
    );
    deepStrictEqual(
        filterPokemon(pokemon, '1523', '', 'id').map((entry) => entry.speciesId),
        [1523],
    );
    strictEqual(filterPokemon(pokemon, 'not a pokemon', '', 'id').length, 0);
});

void test('duplicate names preserve form IDs and their distinct stats', () => {
    const entries = pokemon.filter((entry) => entry.name === 'Mimikyu');
    strictEqual(entries.length > 1, true);
    deepStrictEqual(filterPokemon(pokemon, 'Mimikyu', '', 'id'), entries);
});

void test('type filters match either slot and combine with search', () => {
    strictEqual(filterPokemon(pokemon, 'Bulbasaur', 'Poison', 'id').length, 1);
    strictEqual(filterPokemon(pokemon, 'Bulbasaur', 'Water', 'id').length, 0);
    const fairy = filterPokemon(pokemon, '', 'Fairy', 'id');
    strictEqual(fairy.length > 0, true);
    strictEqual(
        fairy.every((entry) => entry.types.includes('Fairy')),
        true,
    );
});

void test('sorting is descending for stats, keeps ties stable, and does not mutate source data', () => {
    const ids = pokemon.map((entry) => entry.speciesId);
    for (const sort of ['total', 'speed'] as const) {
        const entries = filterPokemon(pokemon, '', '', sort);
        for (let index = 1; index < entries.length; index++) {
            const previous = entries[index - 1];
            const current = entries[index];
            const previousValue = sort === 'total' ? previous.baseStatTotal : previous.stats.speed;
            const currentValue = sort === 'total' ? current.baseStatTotal : current.stats.speed;
            strictEqual(previousValue >= currentValue, true);
            if (previousValue === currentValue)
                strictEqual(previous.speciesId < current.speciesId, true);
        }
    }
    const alphabetical = filterPokemon(pokemon, '', '', 'name');
    strictEqual(alphabetical[0].name.localeCompare(alphabetical.at(-1)!.name) < 0, true);
    deepStrictEqual(
        pokemon.map((entry) => entry.speciesId),
        ids,
    );
});
