import { deepStrictEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';
import { statKeys } from '../src/collection.js';
import { getNatureStatEffect, pokemonNatures } from '../src/pokemonNatures.js';

void test('the canonical 25 nature IDs retain neutral and directional stat effects', () => {
    deepStrictEqual(
        pokemonNatures.map(({ id }) => id),
        Array.from({ length: 25 }, (_, id) => id),
    );
    deepStrictEqual(
        pokemonNatures
            .filter(({ increasedStat }) => increasedStat === null)
            .map(({ name }) => name),
        ['Hardy', 'Docile', 'Serious', 'Bashful', 'Quirky'],
    );
    deepStrictEqual(pokemonNatures[3], {
        id: 3,
        name: 'Adamant',
        increasedStat: 'attack',
        decreasedStat: 'spAttack',
    });
    deepStrictEqual(pokemonNatures[15], {
        id: 15,
        name: 'Modest',
        increasedStat: 'spAttack',
        decreasedStat: 'attack',
    });
    deepStrictEqual(pokemonNatures[13], {
        id: 13,
        name: 'Jolly',
        increasedStat: 'speed',
        decreasedStat: 'spAttack',
    });
    deepStrictEqual(pokemonNatures[23], {
        id: 23,
        name: 'Careful',
        increasedStat: 'spDefense',
        decreasedStat: 'spAttack',
    });
    // Every ordered pair of distinct non-HP stats has exactly one nature.
    const pairs = pokemonNatures
        .filter(({ increasedStat }) => increasedStat !== null)
        .map(({ increasedStat, decreasedStat }) => `${increasedStat}:${decreasedStat}`);
    equal(new Set(pairs).size, 20);
    equal(pairs.length, 20);
    for (const nature of pokemonNatures) {
        equal(getNatureStatEffect(nature.id, 'hp'), null);
        if (nature.increasedStat !== null) {
            equal(getNatureStatEffect(nature.id, nature.increasedStat), 'increased');
            equal(getNatureStatEffect(nature.id, nature.decreasedStat!), 'decreased');
        }
    }
});

void test('neutral, unknown and invalid natures never mark a stat as affected', () => {
    for (const natureId of [undefined, null, 0, 6, 12, 18, 24, -1, 25, 3.5, Number.NaN]) {
        for (const stat of statKeys) equal(getNatureStatEffect(natureId, stat), null);
    }
    equal(getNatureStatEffect(3, 'defense'), null);
    equal(getNatureStatEffect(15, 'speed'), null);
});
