import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { MyPokemonWishlist } from './MyPokemonWishlist.js';
import { LanguageProvider } from './language.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';

const family = Object.values(loadCollectionSpeciesFixture([255, 256, 257]));
const wanted = (name: string) => {
    const move = family
        .flatMap((species) => species.learnset)
        .find((entry) => entry.name === name)!;
    return { moveId: move.moveId, name: move.name };
};
const pokemon: OwnedPokemon = {
    id: 'torchic',
    playthroughId: 'run',
    nickname: '',
    deleted: false,
    createdAt: '2026-10-14T10:00:00.000Z',
    state: { speciesId: 255, level: 11, moves: [], formEpoch: 'first' },
    moveWishlist: {
        moves: [wanted('Flamethrower'), wanted('Brave Bird')],
        learnedMoveIds: [],
        targetSpeciesId: null,
    },
};
function render(
    owned = pokemon,
    relatives: SpeciesDetails[] = family,
    language: 'en' | 'cs' = 'en',
    paused = false,
): string {
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(MyPokemonWishlist, {
                    pokemon: owned,
                    family: relatives,
                    paused,
                    onUpdate: async () => {},
                }),
            ),
        ),
    );
}

void test('wishlist explains the Torchic learning and evolution order without making recorded moves change', () => {
    const html = render();
    match(html, /Wanted moves/);
    match(html, /Learn Flamethrower/);
    match(html, /Lv\. 46/);
    match(html, /Learn Brave Bird/);
    match(html, /Lv\. 50/);
    match(html, /Evolve.*Torchic.*Combusken/);
    match(html, /Move Reminder alternatives are disabled/);
    strictEqual(pokemon.state.moves?.length, 0);
});

void test('completed wishes remain visibly learned even when absent from current moves', () => {
    const html = render({
        ...pokemon,
        moveWishlist: { ...pokemon.moveWishlist!, learnedMoveIds: [wanted('Flamethrower').moveId] },
    });
    match(html, /data-status="learned"/);
    match(html, /1 \/ 2 learned/);
    doesNotMatch(html, /Learn Flamethrower/);
});

void test('offline missing reference data retains saved wish names and avoids a false timeline', () => {
    const html = render(pokemon, []);
    match(html, /Flamethrower/);
    match(html, /Brave Bird/);
    match(html, /Not yet confirmed/);
    doesNotMatch(html, /Learning &amp; evolution plan/);
});

void test('wishlist sync conflicts pause planning and selection', () => {
    const html = render(pokemon, family, 'en', true);
    match(html, /Resolve conflicting Pokémon or wishlist changes/);
    doesNotMatch(html, /Learning &amp; evolution plan|type="checkbox"/);
});

void test('Czech wishlist translates planner controls, status and timeline', () => {
    const html = render(pokemon, family, 'cs');
    match(html, /Požadované útoky/);
    match(html, /Naučit Flamethrower/);
    match(html, /Přidat požadované útoky/);
    match(html, /Naučení za úrovně/);
    doesNotMatch(html, /Wanted moves|Add wanted moves|Level-up route/);
});

void test('branching evolutions require an explicit target before selecting new wishes', () => {
    const relatives = Object.values(
        loadCollectionSpeciesFixture([133, 134, 135, 136, 196, 197, 470, 471, 700]),
    );
    const html = render(
        { ...pokemon, state: { ...pokemon.state, speciesId: 133 }, moveWishlist: undefined },
        relatives,
    );
    match(html, /Choose an evolution branch/);
    match(html, /Choose a branch before adding moves/);
    match(html, /type="checkbox"[^>]*disabled=""/);
    doesNotMatch(html, /Learning &amp; evolution plan/);
});

void test('the wishlist labels Double Kick as an evolution move and orders it after evolving', () => {
    const owned = {
        ...pokemon,
        state: { ...pokemon.state, level: 14 },
        moveWishlist: { ...pokemon.moveWishlist!, moves: [wanted('Double Kick')] },
    };
    const html = render(owned);
    match(html, /data-status="natural"/);
    match(html, /Combusken · on evolution at Lv\. 16/);
    match(html, /On evolution/);
    strictEqual(html.indexOf('Evolve:') < html.indexOf('Learn Double Kick'), true);
    const czech = render(owned, family, 'cs');
    match(czech, /Combusken · při vývoji na Lv\. 16/);
    match(czech, /Při vývoji/);
    doesNotMatch(czech, /on evolution|On evolution/);
});
