import { doesNotMatch, match } from 'node:assert/strict';
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

function mobileMarkup(sort: DexSort): string {
    return renderToStaticMarkup(
        createElement(PokemonResults, { entries: [species], datasetId: undefined, sort }),
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
    doesNotMatch(markup, /pokemon-card-stat/);
});

void test('mobile rows show the stat relevant to the selected comparison order', () => {
    const total = mobileMarkup('total');
    match(total, /<strong>520<\/strong><span>BST<\/span>/);
    doesNotMatch(total, /<span>Speed<\/span>/);

    const speed = mobileMarkup('speed');
    match(speed, /<strong>55<\/strong><span>Speed<\/span>/);
    doesNotMatch(speed, /<span>BST<\/span>/);
    doesNotMatch(mobileMarkup('id'), /pokemon-card-stat/);
});
