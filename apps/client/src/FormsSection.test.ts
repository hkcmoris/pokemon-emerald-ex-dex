import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import type { FormChange, SpeciesDetails, SpeciesFormGroup } from '@pokemon-emerald-ex-dex/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { FormsSection } from './FormsSection.js';
import { formDisplayName } from './forms.js';
import { SpeciesPage } from './SpeciesPage.js';
import { LanguageProvider } from './language.js';

const mega: FormChange = {
    items: [{ role: 'megaStone', itemId: 300, name: 'Gengarite', iconFile: '0300_Gengarite.png' }],
    sourceSpeciesId: 94,
    sourceName: 'Gengar',
    sourceSprite: 'front/0094_Gengar.png',
    targetSpeciesId: 914,
    rawTargetSpeciesId: 914,
    targetName: 'Gengar',
    targetSprite: 'front/0914_Gengar.png',
    changeOrder: 0,
    restorePreviousForm: false,
    methodId: 11,
    method: 'mega_evolution_item',
    formKind: 'mega',
    battleOnly: true,
    details: { megaStone: { itemId: 300, name: 'Gengarite', constant: 'ITEM_GENGARITE' } },
    summary: 'Mega Evolve using Gengarite',
    rawParams: { param1: 300, param2: 0, param3: 0 },
};
const forms: SpeciesFormGroup = {
    formGroupId: 33,
    baseSpeciesId: 94,
    baseName: 'Gengar',
    members: [
        { speciesId: 94, formKind: 'base', formLabel: 'Base', isBaseForm: true },
        { speciesId: 914, formKind: 'mega', formLabel: 'Mega', isBaseForm: false },
        { speciesId: 1496, formKind: 'gigantamax', formLabel: 'Gigantamax', isBaseForm: false },
    ].map((member) => ({
        ...member,
        name: 'Gengar',
        sprite: `front/${String(member.speciesId).padStart(4, '0')}_Gengar.png`,
    })),
    changes: [
        mega,
        {
            ...mega,
            targetSpeciesId: 1496,
            rawTargetSpeciesId: 1496,
            targetSprite: 'front/1496_Gengar.png',
            changeOrder: 1,
            methodId: 17,
            method: 'gigantamax',
            formKind: 'gigantamax',
            items: [],
            details: {},
            summary: 'Gigantamax when Dynamax is activated',
        },
    ],
};

void test('form cards retain raw names while displaying labels, sprites and navigation for any member', () => {
    for (const speciesId of [94, 914, 1496]) {
        const html = renderToStaticMarkup(
            createElement(FormsSection, {
                forms,
                changes: [],
                speciesId,
                datasetId: 'emerald-ex-1.0.4',
            }),
        );
        match(html, /<h2 id="forms-title">Forms<\/h2>/);
        match(html, />Gengar<\/span>/);
        match(html, />Base<\/span>/);
        match(html, />Mega Gengar<\/span>/);
        match(html, />Gigantamax Gengar<\/span>/);
        match(html, /Mega Evolve using Gengarite/);
        match(html, /Gigantamax when Dynamax is activated/);
        const cards = [
            ...html.matchAll(/<a class="evolution-species" href="#\/species\/(\d+)"([^>]*)>/g),
        ];
        deepStrictEqual(
            cards.map((card) => Number(card[1])),
            [94, 914, 1496],
        );
        deepStrictEqual(
            cards
                .filter((card) => card[2].includes('aria-current="page"'))
                .map((card) => Number(card[1])),
            [speciesId],
        );
        for (const member of forms.members) match(html, new RegExp(member.sprite ?? 'missing'));
    }
    strictEqual(forms.members[1].name, 'Gengar');
});

void test('Czech form UI keeps database form labels, methods, item names and summaries unchanged', () => {
    const html = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'cs' },
            createElement(FormsSection, {
                forms,
                changes: [],
                speciesId: 914,
                datasetId: 'emerald-ex-1.0.4',
            }),
        ),
    );
    match(html, /<h2 id="forms-title">Formy<\/h2>/);
    match(html, /Aktuální forma/);
    match(html, /Pravidla změn formy/);
    match(html, /<dt>Pouze v boji<\/dt><dd>Ano<\/dd>/);
    match(html, />Base<\/span>/);
    match(html, />Mega Gengar<\/span>/);
    match(html, />Gigantamax Gengar<\/span>/);
    match(html, /<dd>mega evolution item<\/dd>/);
    match(html, /Mega Evolve using Gengarite/);
    match(html, /Gigantamax when Dynamax is activated/);
    match(html, /alt="Ikona předmětu Gengarite"/);
    match(html, />Gengarite<\/span>/);
});

void test('display names distinguish Mega X/Y and regional forms and safely fall back without a label', () => {
    const alternate = { isBaseForm: false, formLabel: null as string | null };
    strictEqual(formDisplayName('Gengar', null), 'Gengar');
    strictEqual(formDisplayName('Gengar', alternate), 'Gengar');
    strictEqual(formDisplayName('Gengar', { isBaseForm: true, formLabel: 'Base' }), 'Gengar');
    strictEqual(
        formDisplayName('Charizard', { ...alternate, formLabel: 'Mega X' }),
        'Mega Charizard X',
    );
    strictEqual(
        formDisplayName('Charizard', { ...alternate, formLabel: 'Mega Y' }),
        'Mega Charizard Y',
    );
    strictEqual(formDisplayName('Raichu', { ...alternate, formLabel: 'Alolan' }), 'Alolan Raichu');
    const html = renderToStaticMarkup(
        createElement(FormsSection, {
            forms: { ...forms, members: [{ ...forms.members[1], formLabel: null, sprite: null }] },
            changes: [],
            speciesId: 914,
            datasetId: undefined,
        }),
    );
    match(html, />Gengar<\/span>/);
    match(html, />Mega<\/span>/);
    match(html, /Gengar standard front sprite unavailable/);
});

void test('ungrouped changes and restoration rules are available without inventing a group or species zero', () => {
    strictEqual(
        renderToStaticMarkup(
            createElement(FormsSection, {
                forms: null,
                changes: [],
                speciesId: 1,
                datasetId: undefined,
            }),
        ),
        '',
    );
    const html = renderToStaticMarkup(
        createElement(FormsSection, {
            forms: null,
            changes: [
                {
                    ...mega,
                    targetSpeciesId: null,
                    rawTargetSpeciesId: 0,
                    targetName: null,
                    targetSprite: null,
                    restorePreviousForm: true,
                    summary: 'Restore the previously saved form',
                },
            ],
            speciesId: 94,
            datasetId: undefined,
        }),
    );
    match(html, /<h2 id="forms-title">Form changes<\/h2>/);
    match(html, /Previously saved form/);
    doesNotMatch(html, /href="#\/species\/0"/);
    doesNotMatch(html, /class="form-members/);
});

function detail(speciesId: number): SpeciesDetails {
    const member = forms.members.find((form) => form.speciesId === speciesId);
    return {
        speciesId,
        name: member?.name ?? 'Bulbasaur',
        types: [],
        typeIds: [],
        typeIconFiles: [],
        sprites: null,
        stats: { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
        baseStatTotal: 300,
        abilities: [],
        learnset: [],
        machines: [],
        evolutionLinks: [],
        evolutionBaseSpeciesId: member ? 94 : speciesId,
        evolutionFamily: member
            ? [
                  {
                      edgeOrder: 1,
                      fromSpeciesId: 93,
                      fromName: 'Haunter',
                      toSpeciesId: 94,
                      toName: 'Gengar',
                      fromSprite: null,
                      toSprite: forms.members[0].sprite,
                      methodId: 5,
                      method: 'trade',
                      trigger: 'trade',
                      level: null,
                      conditions: {},
                      summary: 'Trade',
                      rawParam: 0,
                      internalOnly: false,
                      items: [],
                  },
              ]
            : [],
        forms: member ? forms : null,
        formInfo: member ? { ...member, formGroupId: 33, baseSpeciesId: 94 } : null,
        formChanges: [],
    };
}

void test('detail pages keep normal Evolution separate from Forms and use the supplied base family', () => {
    for (const speciesId of [94, 914, 1496, 1]) {
        const client = new QueryClient();
        const entry = detail(speciesId);
        client.setQueryData(['species-details', speciesId], entry);
        const html = renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(SpeciesPage, {
                    speciesId,
                    version: '1.0.4',
                    datasetId: 'emerald-ex-1.0.4',
                }),
            ),
        );
        client.clear();
        const evolution =
            /<section[^>]*aria-labelledby="evolution-title"[\s\S]*?<\/section>/.exec(html)?.[0] ??
            '';
        match(evolution, /<h2 id="evolution-title">Evolution<\/h2>/);
        doesNotMatch(evolution, /href="#\/species\/(914|1496)"/);
        if (speciesId === 1) {
            doesNotMatch(html, /id="forms-title"/);
        } else {
            match(evolution, /Haunter/);
            match(evolution, /Gengar/);
            match(html, /id="forms-title">Forms/);
            match(html, new RegExp(`<h1[^>]*>${formDisplayName(entry.name, entry.formInfo)}</h1>`));
            match(evolution, speciesId === 94 ? /Current stage/ : /Base species/);
            if (speciesId !== 94) doesNotMatch(evolution, /aria-current="page"/);
        }
    }
});
