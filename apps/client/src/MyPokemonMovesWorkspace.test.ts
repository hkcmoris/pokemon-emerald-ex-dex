import { match, doesNotMatch } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';
import { MyPokemonMovesWorkspace } from './MyPokemonMovesWorkspace.js';
import { LanguageProvider } from './language.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';

const family = Object.values(loadCollectionSpeciesFixture([255]));
const pokemon: OwnedPokemon = {
    id: 'workspace-moves',
    playthroughId: 'run',
    nickname: '',
    deleted: false,
    createdAt: '',
    state: {
        speciesId: 255,
        formEpoch: 'initial',
        level: 11,
        moves: family[0].learnset.slice(0, 2),
    },
};
function render(owned = pokemon, paused = false, language: 'en' | 'cs' = 'en'): string {
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(MyPokemonMovesWorkspace, {
                    pokemon: owned,
                    family,
                    paused,
                    onUpdate: async () => {},
                }),
            ),
        ),
    );
}

void test('move slots expose replacement and drag controls without an edit mode', () => {
    const html = render();
    match(html, /Current move order/);
    match(html, /reorder-handle/);
    match(html, /Replace /);
    match(html, /Add move/);
    doesNotMatch(html, /Save moves|Deselect a move/);
});

void test('unknown moves remain explicitly unknown until the player adds a move', () => {
    const html = render({ ...pokemon, state: { ...pokemon.state, moves: null } });
    match(html, /Moves have not been recorded yet/);
    match(html, /Add move/);
});

void test('Czech labels and conflict-disabled controls remain accessible', () => {
    const html = render(pokemon, true, 'cs');
    match(html, /Pořadí aktuálních útoků/);
    match(html, /Přidat útok/);
    match(html, /disabled="" aria-label="Nahradit/);
});
