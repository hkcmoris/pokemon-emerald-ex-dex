import { doesNotMatch, match, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import { CatchUpRecap } from './MyPokemonCard.js';
import { LanguageProvider, type Language } from './language.js';

const fixtures = loadCollectionSpeciesFixture([21, 22, 133]);
const spearow: SpeciesDetails = {
    ...fixtures[21],
    learnset: [],
    evolutionLinks: fixtures[21].evolutionLinks.map((edge) => ({
        ...edge,
        toSprite: 'front/22.png',
    })),
};
const owned: OwnedPokemon = {
    id: 'owned-spearow',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 21, level: 20, moves: null, formEpoch: 'spearow-stage' },
    deleted: false,
    createdAt: '2026-10-17T10:00:00.000Z',
};

function render(
    overrides: Partial<ComponentProps<typeof CatchUpRecap>> = {},
    language: Language = 'en',
): string {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(CatchUpRecap, {
                    pokemon: owned,
                    details: spearow,
                    datasetId: 'emerald-ex-1.0.4',
                    oldLevel: 19,
                    newLevel: 20,
                    moves: null,
                    onSave: async () => {},
                    saveObservation: async () => {},
                    onClose: () => {},
                    ...overrides,
                }),
            ),
        ),
    );
}

function checkboxLabels(html: string): string[] {
    return [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/g)]
        .map(([label]) => label)
        .filter((label) => label.includes('type="checkbox"'));
}

void test('a Fearow evolution opportunity has its target sprite, DNA icon and an unchecked labeled checkbox', () => {
    const html = render();
    match(html, /src="\/api\/sprites\/emerald-ex-1\.0\.4\/front\/22\.png"/);
    match(html, /alt="Fearow standard front sprite"/);
    match(html, /<img(?=[^>]*evolution-dna\.svg)(?=[^>]*alt="")(?=[^>]*aria-hidden="true")[^>]*>/);
    const labels = checkboxLabels(html);
    strictEqual(labels.length, 1);
    match(labels[0], /aria-label="Evolved into Fearow"/);
    doesNotMatch(labels[0], /checked=""/);
    match(html, /Reach level 20/);
    match(html, /Level requirement reached/);
    doesNotMatch(html, /use “Record evolution \/ form”/);
});

void test('an evolution with no sprite keeps an accessible placeholder and a selectable target', () => {
    const html = render({
        details: {
            ...spearow,
            evolutionLinks: spearow.evolutionLinks.map((edge) => ({ ...edge, toSprite: null })),
        },
    });
    match(
        html,
        /class="sprite-placeholder" role="img" aria-label="Fearow standard front sprite unavailable"/,
    );
    match(checkboxLabels(html)[0], /Fearow/);
    doesNotMatch(html, /src="null"/);
});

void test('Czech evolution recap translates its choice and retains the Fearow species name', () => {
    const html = render({}, 'cs');
    const labels = checkboxLabels(html);
    strictEqual(labels.length, 1);
    match(labels[0], /aria-label="Vyvinul se na Fearow"/);
    match(html, /Dosáhnout úrovně 20/);
    match(html, /Požadované úrovně dosaženo/);
    match(html, /Přední obrázek Fearow/);
    doesNotMatch(
        html,
        /Evolved|Record evolution|Save changes|Level requirement reached|Reach level/,
    );
});

void test('branched evolution opportunities each have an unchecked choice without selecting a branch automatically', () => {
    const eevee = { ...fixtures[133], learnset: [] };
    const html = render({
        pokemon: { ...owned, state: { ...owned.state, speciesId: 133 } },
        details: eevee,
    });
    const labels = checkboxLabels(html);
    const targets = eevee.evolutionLinks.filter((edge) => !edge.internalOnly);
    ok(targets.length > 1);
    strictEqual(labels.length, targets.length);
    for (const target of targets) {
        ok(labels.some((label) => label.includes(target.toName)));
    }
    doesNotMatch(html, /checked=""/);
    match(html, /Other conditions need checking/);
});

void test('an untouched evolution-only recap writes nothing and cannot save until a choice is made', () => {
    let saves = 0;
    let observations = 0;
    let closes = 0;
    const html = render({
        onSave: () => {
            saves++;
            return Promise.resolve();
        },
        saveObservation: () => {
            observations++;
            return Promise.resolve();
        },
        onClose: () => {
            closes++;
        },
    });
    const saveButton = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
        .map(([button]) => button)
        .find((button) => />Save[^<]*<\/button>/.test(button));
    ok(saveButton);
    match(saveButton, /disabled=""/);
    match(html, /Skip recap/);
    strictEqual(saves, 0);
    strictEqual(observations, 0);
    strictEqual(closes, 0);
});

void test('a recap with moves and evolution keeps Save changes disabled while unknown moves and evolution are untouched', () => {
    const move = fixtures[21].learnset.find((entry) => entry.level > 1 && entry.level <= 20);
    ok(move);
    const html = render({
        details: { ...spearow, learnset: [move] },
        oldLevel: 1,
        moves: null,
    });
    match(html, /Did you learn any of these/);
    match(html, /aria-label="Evolved into Fearow"/);
    doesNotMatch(html, /checked=""/);
    match(html, /<button(?=[^>]*disabled="")[^>]*>Save changes<\/button>/);
});
