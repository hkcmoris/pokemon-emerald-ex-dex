import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyCollection, type CollectionConflict } from '@pokemon-emerald-ex-dex/shared';

import { conflictValueLabel, MyPokemonConflicts } from './MyPokemonConflicts.js';
import { LanguageProvider, type Translate } from './language.js';

const document = {
    ...emptyCollection(),
    playthroughs: { run: { id: 'run', name: 'Emerald', party: ['owned'], deleted: false } },
    pokemon: {
        owned: {
            id: 'owned',
            playthroughId: 'run',
            nickname: 'Sprout',
            state: { speciesId: 1, level: 12, moves: null, formEpoch: 'stage-one' },
            deleted: false,
            createdAt: '2026-10-12T12:00:00.000Z',
        },
    },
};
const english: Translate = (en) => en;
const czech: Translate = (_en, cs) => cs;

void test('trait conflict labels distinguish neutral nature, unrecorded choices and species-scoped abilities', () => {
    strictEqual(conflictValueLabel(0, 'natureId', document, english), 'Hardy');
    strictEqual(conflictValueLabel(3, 'natureId', document, czech), 'Adamant');
    strictEqual(conflictValueLabel(null, 'natureId', document, english), 'Not recorded');
    strictEqual(conflictValueLabel(null, 'ability', document, czech), 'Nezaznamenáno');
    strictEqual(
        conflictValueLabel({ speciesId: 2, abilityId: 65 }, 'ability', document, english),
        'Species: #2 · Ability: #65',
    );
    strictEqual(
        conflictValueLabel({ speciesId: 2, abilityId: 65 }, 'ability', document, czech),
        'Druh: #2 · Schopnost: #65',
    );
});

void test('whole Pokémon conflict alternatives include recorded and missing trait values', () => {
    const recorded = conflictValueLabel(
        { ...document.pokemon.owned, natureId: 3, ability: { speciesId: 2, abilityId: 65 } },
        '$entity',
        document,
        english,
    );
    match(recorded, /Nature: Adamant/);
    match(recorded, /Ability: Species: #2 · Ability: #65/);
    doesNotMatch(recorded, /formEpoch|playthroughId|stage-one|\[object Object\]/);
    const missing = conflictValueLabel(document.pokemon.owned, '$entity', document, czech);
    match(missing, /Povaha: Nezaznamenáno/);
    match(missing, /Schopnost: Nezaznamenáno/);
});

void test('trait conflict choices have localized headings and visible independent alternatives', () => {
    const conflicts: CollectionConflict[] = [
        {
            id: 'nature',
            entity: 'pokemon',
            entityId: 'owned',
            kind: 'field',
            field: 'natureId',
            base: null,
            local: 3,
            remote: 15,
        },
        {
            id: 'ability',
            entity: 'pokemon',
            entityId: 'owned',
            kind: 'field',
            field: 'ability',
            base: null,
            local: { speciesId: 1, abilityId: 65 },
            remote: { speciesId: 2, abilityId: 34 },
        },
    ];
    for (const language of ['en', 'cs'] as const) {
        const html = renderToStaticMarkup(
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(MyPokemonConflicts, { document, conflicts, resolve: async () => {} }),
            ),
        );
        match(html, language === 'en' ? /Sprout · Nature/ : /Sprout · Povaha/);
        match(html, language === 'en' ? /Sprout · Ability/ : /Sprout · Schopnost/);
        match(html, /Adamant/);
        match(html, /Modest/);
        match(html, language === 'en' ? /Species: #1 · Ability: #65/ : /Druh: #1 · Schopnost: #65/);
        match(html, language === 'en' ? /Species: #2 · Ability: #34/ : /Druh: #2 · Schopnost: #34/);
    }
});
