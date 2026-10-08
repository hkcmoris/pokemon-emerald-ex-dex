import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import { SpeciesPage } from './SpeciesPage.js';

const entry: SpeciesDetails = {
    speciesId: 25,
    name: 'Pikachu',
    types: ['Electric'],
    typeIds: [13],
    typeIconFiles: [null],
    stats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
    baseStatTotal: 320,
    sprites: {
        front: null,
        shinyFront: null,
        frontFrame2: null,
        shinyFrontFrame2: null,
        back: null,
        shinyBack: null,
        frontFrameCount: 0,
        missingReason: 'Sprite unavailable in the imported source.',
    },
    abilities: [
        {
            slot: 1,
            kind: 'normal',
            ability: {
                abilityId: 9,
                name: 'Static',
                description: 'Contact with the Pokémon may cause paralysis.',
                aiRating: 0,
                flags: {
                    cantBeCopied: false,
                    cantBeSwapped: false,
                    cantBeTraced: false,
                    cantBeSuppressed: false,
                    cantBeOverwritten: false,
                    breakable: false,
                    failsOnImposter: false,
                },
            },
        },
    ],
    learnset: [
        {
            moveId: 84,
            name: 'Thunder Shock',
            description: 'An electric shock that may paralyze the foe.',
            typeId: 13,
            type: 'Electric',
            typeIconFile: null,
            categoryId: 1,
            category: 'Special',
            categoryIconFile: null,
            power: 40,
            accuracy: 100,
            pp: 30,
            priority: 0,
            effectId: 6,
            targetId: 0,
            entryOrder: 1,
            level: 1,
        },
    ],
    machines: [],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 25,
    formInfo: null,
    forms: null,
    formChanges: [],
};

function renderSpecies(language: 'en' | 'cs'): string {
    const client = new QueryClient();
    client.setQueryData(['species-details', 25], entry);
    try {
        return renderToStaticMarkup(
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(
                    QueryClientProvider,
                    { client },
                    createElement(SpeciesPage, {
                        speciesId: 25,
                        version: '1.0.4',
                        datasetId: undefined,
                    }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('Czech species UI translates types and preserves other game names and imported descriptions', () => {
    const html = renderSpecies('cs');
    for (const label of ['Základní statistiky', 'Vzhled', 'Běžná schopnost 1', 'Naučené útoky'])
        match(html, new RegExp(label));
    for (const data of [
        entry.name,
        entry.abilities[0].ability!.name,
        entry.abilities[0].ability!.description,
        entry.learnset[0].name,
        entry.learnset[0].description,
        entry.learnset[0].category,
        entry.sprites!.missingReason!,
        'Shiny',
        'Technical Machines',
        'Hidden Machines',
    ])
        match(html, new RegExp(data));
    match(html, /data-type="Electric"/);
    match(html, /class="type-badge-label">Elektrický<\/span>/);
    doesNotMatch(html, /class="type-badge-label">Electric<\/span>/);
    doesNotMatch(html, /Base stats|Normal ability 1|Moves learned/);
});

for (const { language, labels } of [
    { language: 'en', labels: ['Stats', 'Abilities', 'Evolutions', 'Moves'] },
    { language: 'cs', labels: ['Statistiky', 'Schopnosti', 'Evoluce', 'Útoky'] },
] as const) {
    void test(`species tabs localize labels and keep inactive content in its own panel (${language})`, () => {
        const html = renderSpecies(language);
        const tabs = Array.from(
            html.matchAll(/<div([^>]*data-slot="tabs-tab"[^>]*)>([\s\S]*?)<\/div>/g),
        );
        deepStrictEqual(
            tabs.map(([, attributes, content]) => [
                attributes.match(/data-key="([^"]+)"/)?.[1],
                content.replace(/<[^>]*>/g, '').trim(),
            ]),
            ['stats', 'abilities', 'evolutions', 'moves'].map((key, index) => [key, labels[index]]),
        );
        deepStrictEqual(
            tabs.map(([, attributes]) => attributes.includes('aria-selected="true"')),
            [true, false, false, false],
        );

        const panels = Array.from(html.matchAll(/<div([^>]*data-slot="tabs-panel"[^>]*)>/g));
        strictEqual(panels.length, 4);
        const sectionTitles = [
            'stats-title',
            'abilities-title',
            'evolution-title',
            'learnset-title',
        ];
        for (const [index, panel] of panels.entries()) {
            const attributes = panel[1];
            if (index === 0) {
                match(attributes, /role="tabpanel"/);
                doesNotMatch(attributes, /\sinert=|\sdata-inert=/);
            } else {
                match(attributes, /\sinert=""/);
                match(attributes, /data-inert="true"/);
            }
            const content = html.slice(panel.index + panel[0].length, panels[index + 1]?.index);
            for (const [sectionIndex, title] of sectionTitles.entries()) {
                const heading = new RegExp(`id="${title}"`);
                if (sectionIndex === index) match(content, heading);
                else doesNotMatch(content, heading);
            }
            if (index === 0) match(content, />320<\/span>/);
            if (index === 1) match(content, /Static/);
            if (index === 3) {
                match(content, /Thunder Shock/);
                match(content, /id="machines-title"/);
            }
        }
    });
}

for (const { language, typeName } of [
    { language: 'en', typeName: 'Electric' },
    { language: 'cs', typeName: 'Elektrický' },
] as const) {
    void test(`species header, data, and learned moves show localized type names (${language})`, () => {
        const html = renderSpecies(language);
        const labels = Array.from(
            html.matchAll(/class="type-badge-label">([^<]+)<\/span>/g),
            ([, label]) => label,
        );
        deepStrictEqual(labels, [typeName, typeName, typeName]);
        strictEqual(Array.from(html.matchAll(/data-type="Electric"/g)).length, 3);
    });
}
