import { doesNotMatch, match, rejects } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError } from './api.js';
import { LanguageProvider } from './language.js';
import { SpeciesPage } from './SpeciesPage.js';

const entry: SpeciesDetails = {
    speciesId: 1,
    name: 'Bulbasaur',
    types: ['Grass', 'Poison'],
    typeIds: [12, 3],
    typeIconFiles: [null, null],
    stats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    baseStatTotal: 318,
    sprites: null,
    abilities: [],
    learnset: [],
    machines: [],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 1,
    formInfo: null,
    forms: null,
    formChanges: [],
};

function renderPage(client: QueryClient, embedded: boolean): string {
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(
                LanguageProvider,
                { initialLanguage: 'en' },
                createElement(SpeciesPage, {
                    speciesId: entry.speciesId,
                    version: '1.0.4',
                    datasetId: undefined,
                    embedded,
                }),
            ),
        ),
    );
}

void test('embedded species content leaves navigation and main landmarks to the workspace', () => {
    const client = new QueryClient();
    client.setQueryData(['species-details', entry.speciesId], entry);
    try {
        const embedded = renderPage(client, true);
        match(embedded, /class="species-workspace-detail"/);
        match(embedded, /<h1[^>]*>Bulbasaur<\/h1>/);
        match(embedded, /role="tablist"/);
        doesNotMatch(embedded, /<main|<footer|class="dex-header/);

        const standalone = renderPage(client, false);
        match(standalone, /<main/);
        match(standalone, /<footer/);
        match(standalone, /All Pokémon/);
    } finally {
        client.clear();
    }
});

void test('embedded species loading retains its accessible status', () => {
    const client = new QueryClient();
    try {
        const markup = renderPage(client, true);
        match(markup, /role="status">Loading species details…/);
        doesNotMatch(markup, /<main|<footer/);
    } finally {
        client.clear();
    }
});

for (const status of [404, 500]) {
    void test(`embedded species errors retain alerts and appropriate retry behavior (${status})`, async () => {
        const client = new QueryClient({
            defaultOptions: { queries: { retry: false, retryOnMount: false } },
        });
        try {
            await rejects(
                client.query({
                    queryKey: ['species-details', entry.speciesId],
                    queryFn: () => Promise.reject(new ApiRequestError(status)),
                }),
                ApiRequestError,
            );
            const markup = renderPage(client, true);
            match(markup, /role="alert"/);
            if (status === 404) {
                match(markup, /No species with this ID/);
                doesNotMatch(markup, /Try again<\/button>/);
            } else {
                match(markup, /Couldn’t load species details/);
                match(markup, /Try again<\/button>/);
            }
            doesNotMatch(markup, /<main|<footer/);
        } finally {
            client.clear();
        }
    });
}
