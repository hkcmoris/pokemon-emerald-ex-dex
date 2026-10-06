import { deepStrictEqual, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import type { Pokemon, SpeciesEvolution } from '@pokemon-emerald-ex-dex/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EvolutionLine } from './EvolutionLine.js';

function species(speciesId: number, name: string): Pokemon {
    return {
        speciesId,
        name,
        types: [],
        typeIds: [],
        typeIconFiles: [],
        sprites: null,
        stats: { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
        baseStatTotal: 300,
    };
}

function edge(edgeOrder: number, from: Pokemon, to: Pokemon, summary: string): SpeciesEvolution {
    return {
        edgeOrder,
        fromSpeciesId: from.speciesId,
        fromName: from.name,
        toSpeciesId: to.speciesId,
        toName: to.name,
        fromSprite: `front/${from.speciesId}.png`,
        toSprite: `front/${to.speciesId}.png`,
        methodId: 4,
        method: 'level',
        trigger: 'level_up',
        level: 25,
        conditions: {},
        summary,
        rawParam: 25,
        internalOnly: false,
    };
}

function render(
    entry: Pokemon,
    links: SpeciesEvolution[],
): { html: string; ids: number[]; current: number[] } {
    const html = renderToStaticMarkup(
        createElement(EvolutionLine, {
            entry,
            links,
            datasetId: 'emerald-ex-1.0.4',
        }),
    );
    const anchors = [
        ...html.matchAll(/<a class="evolution-species" href="#\/species\/(\d+)"([^>]*)>/g),
    ];
    return {
        html,
        ids: anchors.map((anchor) => Number(anchor[1])),
        current: anchors
            .filter((anchor) => anchor[2].includes('aria-current="page"'))
            .map((anchor) => Number(anchor[1])),
    };
}

void test('the complete line stays in evolution order and highlights any viewed stage once', () => {
    const gastly = species(92, 'Gastly');
    const haunter = species(93, 'Haunter');
    const gengar = species(94, 'Gengar');
    const links = [
        edge(2, haunter, gengar, 'Trade the Pokémon.'),
        edge(3, haunter, gengar, 'Use Linking Cord.'),
        edge(1, gastly, haunter, 'Reach level 25.'),
    ];
    for (const entry of [gastly, haunter, gengar]) {
        const result = render(entry, links);
        deepStrictEqual(result.ids, [92, 93, 94]);
        deepStrictEqual(result.current, [entry.speciesId]);
        strictEqual(result.html.match(/Current stage/g)?.length, 1);
        strictEqual(result.html.match(/<summary>Rule details<\/summary>/g)?.length, 3);
        match(result.html, /Use Linking Cord/);
        match(result.html, /Trade the Pokémon/);
        for (const id of [92, 93, 94]) match(result.html, new RegExp(`/front/${id}\\.png`));
    }
});

void test('all branches remain visible and duplicate names are highlighted by species ID', () => {
    const root = species(236, 'Tyrogue');
    const branches = [
        species(106, 'Shared name'),
        species(107, 'Shared name'),
        species(237, 'Hitmontop'),
    ];
    const links = branches.map((branch, index) => edge(index + 1, root, branch, 'Reach level 20.'));
    const result = render(branches[1], links);
    deepStrictEqual(result.ids, [236, 106, 107, 237]);
    deepStrictEqual(result.current, [107]);
});

void test('species without evolutions retain their highlighted stage and missing-sprite fallback', () => {
    const result = render(species(151, 'Mew'), []);
    deepStrictEqual(result.ids, [151]);
    deepStrictEqual(result.current, [151]);
    match(result.html, /No evolution recorded/);
    match(result.html, /Mew standard front sprite unavailable/);
});

void test('internal markers do not become evolution stages and cyclic data renders without duplicate nodes', () => {
    const first = species(1, 'First');
    const second = species(2, 'Second');
    const form = species(3, 'Form');
    const result = render(first, [
        edge(1, first, second, 'Forward.'),
        edge(2, second, first, 'Reverse.'),
        { ...edge(3, first, form, 'Internal.'), internalOnly: true },
    ]);
    deepStrictEqual(result.ids, [1, 2]);
    deepStrictEqual(result.current, [1]);
});
