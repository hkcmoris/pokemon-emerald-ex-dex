import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import { LanguageProvider } from './language.js';
import { MyPokemonMilestones } from './MyPokemonMilestones.js';

const species = loadCollectionSpeciesFixture([255, 256, 257]);
const torchic = species[255];
const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: 'Tamago',
    deleted: false,
    createdAt: '2026-10-13T00:00:00.000Z',
    state: { speciesId: 255, level: 11, moves: null, formEpoch: 'stage' },
};

function renderMilestones(
    details: SpeciesDetails = torchic,
    level: number = 11,
    language: 'en' | 'cs' = 'en',
): string {
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client: new QueryClient() },
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(MyPokemonMilestones, {
                    pokemon: { ...pokemon, state: { ...pokemon.state, level } },
                    details,
                }),
            ),
        ),
    );
}

void test('shows the next move and evolution together before later moves', () => {
    const markup = renderMilestones();
    assert.equal((markup.match(/<li\b/g) ?? []).length, 2);
    assert.match(markup, /Lv\. 14<\/span>.*Peck/);
    assert.match(markup, /Lv\. 16<\/span>.*evolution-dna\.svg.*Combusken/);
    assert.ok(markup.indexOf('Peck') < markup.indexOf('Combusken'));
    assert.doesNotMatch(markup, /Fire Spin|Quick Attack|Blaziken/);
});

void test('retains a reached evolution level until the owned species changes', () => {
    const markup = renderMilestones(torchic, 16);
    assert.match(markup, /Combusken/);
    assert.match(markup, /Fire Spin/);
    assert.ok(markup.indexOf('Combusken') < markup.indexOf('Fire Spin'));
    assert.doesNotMatch(markup, /Peck/);
});

void test('deduplicates moves and places moves before evolution at the same level', () => {
    const peck = torchic.learnset.find((entry) => entry.name === 'Peck')!;
    const markup = renderMilestones({
        ...torchic,
        learnset: [
            { ...peck, level: 16 },
            { ...peck, level: 16, entryOrder: peck.entryOrder + 1 },
        ],
    });
    assert.equal((markup.match(/<li\b/g) ?? []).length, 2);
    assert.equal((markup.match(/>Peck</g) ?? []).length, 1);
    assert.ok(markup.indexOf('Peck') < markup.indexOf('Combusken'));
});

void test('excludes special move entries, internal evolutions and other species links', () => {
    const peck = torchic.learnset.find((entry) => entry.name === 'Peck')!;
    const evolution = torchic.evolutionLinks.find((entry) => entry.toSpeciesId === 256)!;
    const markup = renderMilestones({
        ...torchic,
        learnset: [{ ...peck, name: 'Special move', level: 0 }, peck],
        evolutionLinks: [
            { ...evolution, toName: 'Internal form', internalOnly: true, level: 1 },
            { ...evolution, toName: 'Other species', fromSpeciesId: 256, level: 1 },
            evolution,
        ],
    });
    assert.match(markup, /Peck/);
    assert.match(markup, /Combusken/);
    assert.doesNotMatch(markup, /Special move|Internal form|Other species/);
});

void test('places non-level evolution after known levels and preserves its condition', () => {
    const peck = torchic.learnset.find((entry) => entry.name === 'Peck')!;
    const evolution = torchic.evolutionLinks.find((entry) => entry.toSpeciesId === 256)!;
    const markup = renderMilestones({
        ...torchic,
        learnset: [peck],
        evolutionLinks: [
            {
                ...evolution,
                method: 'item',
                level: null,
                conditions: { item: 'Fire Stone' },
                summary: 'Use a Fire Stone.',
            },
        ],
    });
    assert.ok(markup.indexOf('Peck') < markup.indexOf('Combusken'));
    assert.match(markup, /aria-label="Evolution: Combusken — Use a Fire Stone\."/);
    assert.equal((markup.match(/my-level-badge/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /ready|level.met/i);
});

void test('localizes milestone labels without repeating plain level conditions', () => {
    const markup = renderMilestones(torchic, 11, 'cs');
    assert.match(markup, /Co vás čeká/);
    assert.match(markup, /aria-label="Vývoj: Combusken \(Lv\. 16\)"/);
    assert.doesNotMatch(markup, /Reach level|Dosáhnout úrovně/);
    assert.match(
        renderMilestones({ ...torchic, learnset: [], evolutionLinks: [] }, 11, 'cs'),
        /Žádné další milníky/,
    );
});

void test('keeps additional evolution conditions when its required level is reached', () => {
    const evolution = torchic.evolutionLinks.find((entry) => entry.toSpeciesId === 256)!;
    const markup = renderMilestones(
        {
            ...torchic,
            learnset: [],
            evolutionLinks: [
                {
                    ...evolution,
                    conditions: { timeOfDay: 'night' },
                    summary: 'Reach level 16 at night.',
                },
            ],
        },
        16,
    );
    assert.match(markup, /aria-label="Evolution: Combusken — Reach level 16 at night\."/);
    assert.doesNotMatch(markup, /ready|level.met/i);
});
