import { deepStrictEqual, match, doesNotMatch, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Ability, SpeciesAbilitySlot } from '@pokemon-emerald-ex-dex/shared';

import { AbilitiesSection } from './AbilitiesSection.js';
import { AbilityDetails, AbilitiesPage } from './AbilitiesPage.js';
import { abilityHref, parseRoute } from './navigation.js';

const ability: Ability = {
    abilityId: 23,
    name: 'Shadow Tag',
    description: 'Prevents the foe from escaping.',
    aiRating: 10,
    flags: {
        cantBeCopied: false,
        cantBeSwapped: false,
        cantBeTraced: false,
        cantBeSuppressed: false,
        cantBeOverwritten: false,
        breakable: false,
        failsOnImposter: false,
    },
};

void test('ability routes preserve zero and reject malformed identifiers', () => {
    deepStrictEqual(parseRoute('#/abilities'), { kind: 'abilities' });
    for (const id of [0, 23, 310])
        deepStrictEqual(parseRoute(abilityHref(id)), { kind: 'ability', id });
    for (const hash of [
        '#/abilities/-1',
        '#/abilities/1.2',
        '#/abilities/65536',
        '#/abilities/1/extra',
    ])
        deepStrictEqual(parseRoute(hash), { kind: 'not-found' });
});

void test('species ability slots label hidden abilities, preserve duplicates and render null as None', () => {
    const slots: SpeciesAbilitySlot[] = [
        { slot: 1, kind: 'normal', ability },
        { slot: 2, kind: 'normal', ability: null },
        { slot: 3, kind: 'hidden', ability },
    ];
    const html = renderToStaticMarkup(createElement(AbilitiesSection, { slots }));
    match(html, /Normal ability 1/);
    match(html, /Normal ability 2/);
    match(html, /Hidden ability/);
    match(html, />None</);
    match(html, /Prevents the foe from escaping/);
    strictEqual([...html.matchAll(/href="#\/abilities\/23"/g)].length, 2);
    doesNotMatch(html, /href="#\/abilities\/0"/);
    match(
        renderToStaticMarkup(createElement(AbilitiesSection, { slots: [] })),
        /No ability data recorded/,
    );
});

void test('ability details expose signed AI rating and every boolean flag without invented descriptions', () => {
    const html = renderToStaticMarkup(
        createElement(AbilityDetails, {
            ability: { ...ability, aiRating: -2, flags: { ...ability.flags, cantBeCopied: true } },
        }),
    );
    match(html, /Shadow Tag/);
    match(html, /Prevents the foe from escaping/);
    match(html, />-2</);
    match(html, /Cannot be copied/);
    match(html, />Yes</);
    match(html, />No</);
    match(html, /Fails on Imposter/);
    match(
        renderToStaticMarkup(
            createElement(AbilityDetails, { ability: { ...ability, abilityId: 0 } }),
        ),
        /Empty species slots are recorded separately/,
    );
});

void test('ability catalog links to detail pages and preserves pagination and search controls', () => {
    const client = new QueryClient();
    client.setQueryData(['abilities', '', 1], {
        data: [ability],
        meta: { total: 311, page: 1, pageSize: 40, totalPages: 8 },
    });
    const html = renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(AbilitiesPage, { abilityId: undefined, version: '1.0.4' }),
        ),
    );
    match(html, /Find an ability/);
    match(html, /311 matching abilities/);
    match(html, /href="#\/abilities\/23"/);
    match(html, /Page 1 of 8/);
    match(html, /Next/);
    match(html, /href="#\/items"/);
    client.setQueryData(['ability', 23], ability);
    const detail = renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(AbilitiesPage, { abilityId: 23, version: '1.0.4' }),
        ),
    );
    match(detail, /All abilities/);
    match(detail, /ROM mechanics/);
    doesNotMatch(detail, /Find an ability/);
    client.clear();
});
