import { deepStrictEqual, doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { DexSort, Pokemon } from './dex.js';
import { PokemonResults } from './PokemonResults.js';

const species: Pokemon = {
    speciesId: 1374,
    name: 'Three-Segment Dudunsprce',
    types: ['Normal', 'Flying'],
    typeIds: [0, 2],
    typeIconFiles: [null, null],
    stats: { hp: 125, attack: 100, defense: 80, spAttack: 85, spDefense: 75, speed: 55 },
    baseStatTotal: 520,
    sprites: null,
};

function mobileMarkup(sort: DexSort, entry: Pokemon = species): string {
    return renderToStaticMarkup(
        createElement(PokemonResults, { entries: [entry], datasetId: undefined, sort }),
    ).split('</ul>')[0];
}

void test('mobile Pokémon rows retain long names, species identity, and both type labels', () => {
    const markup = mobileMarkup('name');
    match(markup, /href="#\/species\/1374"/);
    match(markup, /#1374/);
    match(markup, />Three-Segment Dudunsprce</);
    match(markup, />Normal</);
    match(markup, />Flying</);
    match(markup, /standard front sprite unavailable/);
    match(markup, /<strong>520<\/strong><span>BST<\/span>/);
});

void test('mobile rows show the stat relevant to the selected comparison order', () => {
    for (const sort of ['id', 'name', 'total'] as const) {
        const markup = mobileMarkup(sort);
        match(markup, /<strong>520<\/strong><span>BST<\/span>/);
        doesNotMatch(markup, /<span>Speed<\/span>/);
    }

    const speed = mobileMarkup('speed');
    match(speed, /<strong>55<\/strong><span>Speed<\/span>/);
    doesNotMatch(speed, /<span>BST<\/span>/);
});

void test('mobile rows put the matching offensive category before the comparison value', () => {
    for (const [spAttack, expected] of [
        [85, ['physical.svg']],
        [120, ['special.svg']],
        [100, ['physical-special.svg']],
    ] as const) {
        const markup = mobileMarkup('id', {
            ...species,
            stats: { ...species.stats, spAttack },
        });
        const indicator =
            markup.match(/class="pokemon-card-stat">([\s\S]*?)<strong>520<\/strong>/)?.[1] ?? '';
        match(indicator, /class="stat-offense" role="img" aria-label="[^"]+"/);
        deepStrictEqual(
            Array.from(
                indicator.matchAll(/<img[^>]*src="[^"]*move-categories\/([^"]+)"/g),
                ([, file]) => file,
            ),
            [...expected],
        );
    }
});
