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
                descriptionCs: 'Kontakt s tímto Pokémonem může způsobit ochromení.',
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
            descriptionCs: 'Elektrický výboj, který může cíl ochromit.',
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

function renderSpecies(language: 'en' | 'cs', details: SpeciesDetails = entry): string {
    const client = new QueryClient();
    client.setQueryData(['species-details', 25], details);
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

void test('Czech species UI translates types, ability and move descriptions while preserving game names', () => {
    const html = renderSpecies('cs');
    for (const label of ['Základní statistiky', 'Vzhled', 'Běžná schopnost 1', 'Naučené útoky'])
        match(html, new RegExp(label));
    for (const data of [
        entry.name,
        entry.abilities[0].ability!.name,
        entry.abilities[0].ability!.descriptionCs!,
        entry.learnset[0].name,
        entry.learnset[0].descriptionCs!,
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

void test('species learnset and machine tables show effects and only matching damaging categories glow', () => {
    const details: SpeciesDetails = {
        ...entry,
        stats: { ...entry.stats, attack: 40, spAttack: 70 },
        learnset: [{ ...entry.learnset[0], effectId: 1 }],
        machines: [
            {
                ...entry.learnset[0],
                machine: 'TM01',
                kind: 'TM',
                number: 1,
                moveId: 28,
                name: 'Sand Attack',
                effectId: 20,
                categoryId: 2,
                category: 'Status',
                power: 0,
            },
        ],
    };
    const html = renderSpecies('en', details);
    match(html, /May: Target: Paralysis/);
    match(html, /Target: Accuracy ↓/);
    strictEqual((html.match(/data-affinity="special"/g) ?? []).length, 1);
    doesNotMatch(html, /data-affinity="physical"/);
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

for (const language of ['en', 'cs'] as const) {
    void test(`move descriptions follow language in both level-up and machine tables (${language})`, () => {
        const move = entry.learnset[0];
        const details: SpeciesDetails = {
            ...entry,
            machines: [{ ...move, machine: 'TM01', kind: 'TM', number: 1 }],
        };
        const html = renderSpecies(language, details);
        const descriptions = Array.from(
            html.matchAll(/<span class="move-display-description">([^<]*)<\/span>/g),
            ([, description]) => description,
        );
        deepStrictEqual(descriptions, [
            language === 'cs' ? move.descriptionCs : move.description,
            language === 'cs' ? move.descriptionCs : move.description,
        ]);
    });
}

for (const descriptionCs of [null, '']) {
    void test(`Czech move descriptions fall back to English for ${String(descriptionCs)}`, () => {
        const html = renderSpecies('cs', {
            ...entry,
            learnset: [{ ...entry.learnset[0], descriptionCs }],
        });
        match(html, /An electric shock that may paralyze the foe\./);
    });
}

void test('moves without either description use the localized empty message', () => {
    const details: SpeciesDetails = {
        ...entry,
        learnset: [{ ...entry.learnset[0], description: '', descriptionCs: null }],
    };
    match(renderSpecies('cs', details), /Popis není uveden\./);
    match(renderSpecies('en', details), /No description recorded\./);
});

for (const language of ['en', 'cs'] as const) {
    void test(`species pages distinguish evolution entries from level-one moves (${language})`, () => {
        const move = entry.learnset[0];
        const html = renderSpecies(language, {
            ...entry,
            learnset: [{ ...move, entryOrder: 0, level: 0 }, move],
        });
        const labels = Array.from(
            html.matchAll(/<span class="move-display-metadata">([^<]*)<\/span>/g),
            ([, label]) => label,
        );
        deepStrictEqual(
            labels,
            language === 'cs' ? ['Při vývoji', 'Úroveň 1'] : ['On evolution', 'Level 1'],
        );
        match(
            html,
            language === 'cs' ? /Úroveň naučení v ROM<\/dt><dd>0/ : /Raw learning level<\/dt><dd>0/,
        );
        doesNotMatch(html, /class="move-display-metadata">(?:Level|Úroveň) 0/);
    });
}
