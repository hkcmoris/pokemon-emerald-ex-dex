import { deepStrictEqual, strictEqual, match, doesNotMatch } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PageResponse, Pokemon } from '@pokemon-emerald-ex-dex/shared';

import { nextBrowsePage, orderedBrowseResults, previousBrowsePage } from './dexBrowseResults.js';
import { PokemonSpriteRail } from './PokemonSpriteRail.js';

function pokemon(speciesId: number, name = `Species ${speciesId}`): Pokemon {
    return {
        speciesId,
        name,
        types: ['Normal'],
        typeIds: [0],
        typeIconFiles: [null],
        stats: { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
        baseStatTotal: 300,
        sprites: null,
    };
}

function page(pageNumber: number, data: Pokemon[], totalPages = 4): PageResponse<Pokemon> {
    return { data, meta: { page: pageNumber, pageSize: 40, total: totalPages * 40, totalPages } };
}

void test('browse pages retain both directions when entering from a later list page', () => {
    strictEqual(previousBrowsePage(page(3, [])), 2);
    strictEqual(nextBrowsePage(page(3, [])), 4);
    strictEqual(previousBrowsePage(page(1, [])), undefined);
    strictEqual(nextBrowsePage(page(4, [])), undefined);
    strictEqual(nextBrowsePage(page(1, [], 0)), undefined);
});

void test('browse results preserve server sort order across chunks and deduplicate boundaries', () => {
    const pages = [
        page(3, [pokemon(9), pokemon(4)]),
        page(1, [pokemon(7), pokemon(2)]),
        page(2, [pokemon(2), pokemon(8)]),
    ];
    deepStrictEqual(
        orderedBrowseResults(pages).map((entry) => entry.speciesId),
        [7, 2, 8, 9, 4],
    );
    deepStrictEqual(
        pages.map((entry) => entry.meta.page),
        [3, 1, 2],
    );
});

function renderRail(
    initialData: PageResponse<Pokemon>,
    selectedSpeciesId: number,
    initialPage = 2,
): string {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const markup = renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(PokemonSpriteRail, {
                filters: { q: 'form', type: 'Fire', sort: 'speed' },
                datasetId: 'test-dataset',
                selectedSpeciesId,
                initialPage,
                initialData,
            }),
        ),
    );
    client.clear();
    return markup;
}

void test('rail uses accessible native links, a current marker, fallback IDs, and both paging controls', () => {
    const markup = renderRail(page(2, [pokemon(52, 'Meowth'), pokemon(53, 'Persian')]), 53);
    match(markup, /aria-label="Matching Pokémon"/);
    match(markup, /href="#\/species\/52" aria-label="Meowth #0052"/);
    match(markup, /href="#\/species\/53" aria-label="Persian #0053" aria-current="page"/);
    match(markup, /pokemon-sprite-fallback[^>]*>#0052/);
    match(markup, /Load previous Pokémon/);
    match(markup, /Load more Pokémon/);
});

void test('the selected detail outside loaded matches is not inserted into the filtered rail', () => {
    const markup = renderRail(page(2, [pokemon(52, 'Meowth')]), 99);
    doesNotMatch(markup, /aria-current/);
    doesNotMatch(markup, /species\/99/);
    match(markup, /Meowth/);
});

void test('wrong-page initial data cannot become the rail seed', () => {
    const markup = renderRail(page(1, [pokemon(52, 'Meowth')]), 52, 3);
    doesNotMatch(markup, /Meowth/);
    match(markup, /Loading…/);
});

void test('an empty filtered rail explains the empty state without paging controls', () => {
    const markup = renderRail(page(1, [], 0), 52, 1);
    match(markup, /No matches\./);
    doesNotMatch(markup, /Load previous Pokémon|Load more Pokémon/);
});
