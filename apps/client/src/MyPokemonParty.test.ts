import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type CollectionDocument,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { PartyOverview, PartyRoster } from './MyPokemonParty.js';
import { LanguageProvider } from './language.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import {
    clearObservationDraft,
    observationDraftKey,
    setObservationDraft,
} from './observationDrafts.js';

const owned: OwnedPokemon = {
    id: 'torchic',
    playthroughId: 'run',
    nickname: 'Ember',
    state: { speciesId: 255, level: 12, moves: null, formEpoch: 'first' },
    deleted: false,
    createdAt: '2026-10-12T12:00:00.000Z',
};
const other: OwnedPokemon = {
    ...owned,
    id: 'combusken',
    nickname: 'Flare',
    state: { ...owned.state, speciesId: 256, level: 18 },
};
const observation: StatObservation = {
    id: 'stats',
    pokemonId: owned.id,
    speciesId: owned.state.speciesId,
    level: owned.state.level,
    formEpoch: owned.state.formEpoch,
    recordedAt: '2026-10-12T13:00:00.000Z',
    stats: { hp: 38, attack: 24, defense: 18, spAttack: 27, spDefense: 22, speed: 21 },
    deleted: false,
};
const document: CollectionDocument = {
    ...emptyCollection(),
    pokemon: { [owned.id]: owned, [other.id]: other },
    observations: { [observation.id]: observation },
};

function render(content: ReactNode, language: 'en' | 'cs' = 'en'): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    for (const species of Object.values(loadCollectionSpeciesFixture([255, 256]))) {
        client.setQueryData(['collection-species', species.speciesId], species);
    }
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(LanguageProvider, { initialLanguage: language }, content),
        ),
    );
}

void test('party roster keeps every member directly reachable and identifies the selected member and unfinished entries', () => {
    const key = observationDraftKey(owned);
    setObservationDraft(key, owned.id, {
        speciesId: owned.state.speciesId,
        formEpoch: owned.state.formEpoch,
        level: '13',
        recordedAt: '2026-10-12T13:00',
        stats: { hp: '41' },
    });
    try {
        const html = render(
            createElement(PartyRoster, {
                party: [owned, other],
                selectedPokemonId: other.id,
                conflicts: [],
                onSelect: () => {},
                onOverview: () => {},
            }),
        );
        match(html, /href="#\/my-pokemon\/torchic"/);
        match(html, /href="#\/my-pokemon\/combusken" aria-current="true"/);
        strictEqual((html.match(/aria-current="true"/g) ?? []).length, 1);
        match(html, /Ember/);
        match(html.replace(/<[^>]+>/g, ''), /Torchic · Lv\. 12/);
        match(html, /Unfinished stats/);
        match(html, /href="#\/my-pokemon"/);
    } finally {
        clearObservationDraft(key);
    }
});

void test('party overview exposes all six current measured values and leaves missing member stats unknown', () => {
    const html = render(
        createElement(PartyOverview, {
            party: [owned, other],
            document,
            conflicts: [],
            onSelect: () => {},
        }),
    );
    for (const value of [38, 24, 18, 27, 22, 21]) match(html, new RegExp(`<td>${value}</td>`));
    strictEqual((html.match(/<td>—<\/td>/g) ?? []).length, 6);
    for (const stat of ['HP', 'Attack', 'Defense', 'Sp. Attack', 'Sp. Defense', 'Speed'])
        match(html, new RegExp(`>${stat}</th>`));
    match(html, /href="#\/my-pokemon\/combusken"/);
    doesNotMatch(html, /≈/);
});

void test('party overview does not present conflicted measurements as current facts', () => {
    const conflict: CollectionConflict = {
        id: 'conflict',
        entity: 'observations',
        entityId: observation.id,
        field: '$entity',
        kind: 'field',
        base: { ...observation },
        local: { ...observation },
        remote: { ...observation, stats: { hp: 50 } },
    };
    const html = render(
        createElement(PartyOverview, {
            party: [owned],
            document,
            conflicts: [conflict],
            onSelect: () => {},
        }),
    );
    strictEqual((html.match(/<td>—<\/td>/g) ?? []).length, 6);
    doesNotMatch(html, /<td>38<\/td>/);
});

void test('party overview shows no older-level or older-form measurements in the current comparison', () => {
    const oldDocument = {
        ...document,
        observations: {
            stats: { ...observation, level: 11 },
            evolved: { ...observation, id: 'evolved', formEpoch: 'previous' },
        },
    };
    const html = render(
        createElement(PartyOverview, {
            party: [owned],
            document: oldDocument,
            conflicts: [],
            onSelect: () => {},
        }),
        'cs',
    );
    strictEqual((html.match(/<td>—<\/td>/g) ?? []).length, 6);
    match(html, /Přehled týmu/);
    match(html, /Spec\. útok/);
    doesNotMatch(html, /Party overview|<td>38<\/td>/);
});
