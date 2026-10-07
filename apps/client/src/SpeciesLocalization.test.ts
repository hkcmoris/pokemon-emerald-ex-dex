import { doesNotMatch, match } from 'node:assert/strict';
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

void test('Czech species UI preserves game names and imported descriptions', () => {
    const client = new QueryClient();
    client.setQueryData(['species-details', 25], entry);
    try {
        const html = renderToStaticMarkup(
            createElement(
                LanguageProvider,
                { initialLanguage: 'cs' },
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

        for (const label of ['Základní statistiky', 'Vzhled', 'Běžná schopnost 1', 'Naučené útoky'])
            match(html, new RegExp(label));
        for (const data of [
            entry.name,
            entry.types[0],
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
        doesNotMatch(html, /Base stats|Normal ability 1|Moves learned/);
    } finally {
        client.clear();
    }
});
