import { match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Ability, Item } from '@pokemon-emerald-ex-dex/shared';

import { AbilityDetails, AbilitiesPage } from './AbilitiesPage.js';
import { ItemDetails, ItemsPage } from './ItemsPage.js';
import { LanguageProvider } from './language.js';

const item: Item = {
    itemId: 300,
    name: 'Gengarite',
    pluralName: 'Gengarites',
    description: 'This stone enables Gengar to Mega Evolve in battle.',
    price: 1200,
    pocketId: 1,
    pocket: 'Items',
    secondaryId: 0,
    holdEffectId: 140,
    holdEffectParam: 0,
    importance: 0,
    notConsumed: false,
    itemUseTypeId: 4,
    battleUsageId: 0,
    flingPower: 80,
    iconFile: '0300_Gengarite.png',
    rom: { effectPointer: null },
};

const ability: Ability = {
    abilityId: 23,
    name: 'Shadow Tag',
    description: 'Prevents the foe from escaping.',
    aiRating: -2,
    flags: {
        cantBeCopied: true,
        cantBeSwapped: false,
        cantBeTraced: false,
        cantBeSuppressed: false,
        cantBeOverwritten: false,
        breakable: false,
        failsOnImposter: false,
    },
};

void test('Czech item details translate UI while preserving database strings and ROM diagnostics', () => {
    const html = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'cs' },
            createElement(ItemDetails, { item }),
        ),
    );
    match(html, /Podrobnosti předmětu/);
    match(html, /Název v množném čísle/);
    match(html, /<h2[^>]*>[\s\S]*Gengarite<\/h2>/);
    match(html, /This stone enables Gengar to Mega Evolve in battle\./);
    match(html, /<dd>Gengarites<\/dd>/);
    match(html, /<dt>Kapsa<\/dt><dd>Items<\/dd>/);
    match(html, /<dt>Cena<\/dt><dd>1\s200<\/dd>/);
    match(html, /<dt>Nespotřebuje se<\/dt><dd>Ne<\/dd>/);
    match(html, /<dt>Síla Fling<\/dt><dd>80<\/dd>/);
    match(html, /Diagnostika ROM/);
    match(html, /&quot;effectPointer&quot;: null/);
});

void test('Czech ability details retain names and descriptions while translating flags and booleans', () => {
    const html = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'cs' },
            createElement(AbilityDetails, { ability }),
        ),
    );
    match(html, /Podrobnosti schopnosti/);
    match(html, /<h2>Shadow Tag<\/h2>/);
    match(html, /Prevents the foe from escaping\./);
    match(html, /<dt>Hodnocení AI<\/dt><dd>-2<\/dd>/);
    match(html, /<dt>Nelze zkopírovat<\/dt><dd>Ano<\/dd>/);
    match(html, /<dt>Selže při Imposter<\/dt><dd>Ne<\/dd>/);
});

void test('Czech catalogs preserve filter values and detail routes', () => {
    const client = new QueryClient();
    client.setQueryData(['items', '', '', 1], {
        data: [item],
        meta: { total: 828, page: 1, pageSize: 40, totalPages: 21 },
    });
    client.setQueryData(['item-pockets'], [{ pocketId: 1, name: 'Items' }]);
    client.setQueryData(['abilities', '', 1], {
        data: [ability],
        meta: { total: 311, page: 1, pageSize: 40, totalPages: 8 },
    });
    const renderCatalog = (page: ReturnType<typeof createElement>) =>
        renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(LanguageProvider, { initialLanguage: 'cs' }, page),
            ),
        );
    const items = renderCatalog(createElement(ItemsPage, { itemId: undefined, version: '1.0.4' }));
    match(items, /Najít předmět/);
    match(items, /<option value="Items">Items<\/option>/);
    match(items, /Nalezené předměty: 828/);
    match(items, /Strana 1 z 21/);
    match(items, /href="#\/items\/300"/);
    const abilities = renderCatalog(
        createElement(AbilitiesPage, { abilityId: undefined, version: '1.0.4' }),
    );
    match(abilities, /Najít schopnost/);
    match(abilities, /Nalezené schopnosti: 311/);
    match(abilities, /Strana 1 z 8/);
    match(abilities, /href="#\/abilities\/23"/);
    match(abilities, /Prevents the foe from escaping\./);
    client.clear();
});
