import { deepStrictEqual, doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Item } from '@pokemon-emerald-ex-dex/shared';

import { ItemDetails, ItemsPage } from './ItemsPage.js';
import { ItemIcon, RuleItems } from './ItemIcon.js';
import { itemHref, parseRoute } from './navigation.js';

const item: Item = {
    itemId: 300,
    name: 'Gengarite',
    pluralName: null,
    description: 'This stone enables Gengar to Mega Evolve in battle.',
    price: 0,
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

void test('item routes include ROM item zero and reject malformed identifiers', () => {
    deepStrictEqual(parseRoute('#/items'), { kind: 'items' });
    for (const id of [0, 300, 827]) deepStrictEqual(parseRoute(itemHref(id)), { kind: 'item', id });
    for (const hash of ['#/items/-1', '#/items/65536', '#/items/1.2', '#/items/1/extra'])
        deepStrictEqual(parseRoute(hash), { kind: 'not-found' });
});

void test('item details preserve ROM fields and display the database filename', () => {
    const html = renderToStaticMarkup(createElement(ItemDetails, { item }));
    match(html, /Gengarite item icon/);
    match(html, /\/api\/icons\/items\/0300_Gengarite.png/);
    match(html, /Held effect ID/);
    match(html, />140</);
    match(html, /Fling power/);
    match(html, />80</);
    match(html, /ROM diagnostics/);
    match(html, /effectPointer/);
    const missing = renderToStaticMarkup(createElement(ItemIcon, { file: null, name: item.name }));
    match(missing, /Gengarite icon unavailable/);
    doesNotMatch(missing, /<img/);
});

void test('rule item icons link to their own item detail page, with empty rules omitted', () => {
    const html = renderToStaticMarkup(
        createElement(RuleItems, {
            items: [
                {
                    itemId: 213,
                    name: 'Thunder Stone',
                    role: 'item',
                    iconFile: '0213_Thunder_Stone.png',
                },
            ],
        }),
    );
    match(html, /href="#\/items\/213"/);
    match(html, /Thunder Stone item icon/);
    match(html, /0213_Thunder_Stone.png/);
    doesNotMatch(renderToStaticMarkup(createElement(RuleItems, { items: [] })), /<ul/);
});

void test('the item catalog renders search, pocket filters, metadata and detail navigation', () => {
    const client = new QueryClient();
    client.setQueryData(['items', '', '', 1], {
        data: [item],
        meta: { total: 828, page: 1, pageSize: 40, totalPages: 21 },
    });
    client.setQueryData(
        ['item-pockets'],
        [
            { pocketId: 1, name: 'Items' },
            { pocketId: 4, name: 'Berries' },
        ],
    );
    const html = renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(ItemsPage, { itemId: undefined, version: '1.0.4' }),
        ),
    );
    match(html, /Find an item/);
    match(html, /All pockets/);
    match(html, /Berries/);
    match(html, /828 matching items/);
    match(html, /href="#\/items\/300"/);
    match(html, /Gengarite item icon/);
    match(html, /Next/);
    client.clear();
});
