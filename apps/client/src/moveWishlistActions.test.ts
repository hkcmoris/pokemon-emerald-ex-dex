import { deepStrictEqual, doesNotMatch, match, strictEqual, throws } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    planMoveWishlist,
    type KnownMove,
    type OwnedPokemon,
} from '@pokemon-emerald-ex-dex/shared';

import { EvolutionAdvice } from './MyPokemonCard.js';
import { MyPokemonWishlistAction } from './MyPokemonWishlistAction.js';
import { LanguageProvider, type Translate } from './language.js';
import { setWishlistMove } from './moveWishlistActions.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';

const details = loadCollectionSpeciesFixture([255, 256, 257]);
const family = Object.values(details);
const english: Translate = (en) => en;
const czech: Translate = (_en, cs) => cs;

function move(name: string): KnownMove {
    const found = family
        .flatMap((species) => species.learnset)
        .find((entry) => entry.name === name);
    if (!found) throw new Error(`Missing fixture move: ${name}`);
    return { moveId: found.moveId, name: found.name };
}

function owned(names: string[] = []): OwnedPokemon {
    return {
        id: 'torchic',
        playthroughId: 'run',
        nickname: '',
        deleted: false,
        createdAt: '2026-10-14T10:00:00.000Z',
        state: { speciesId: 255, level: 11, moves: [], formEpoch: 'first' },
        ...(names.length
            ? {
                  moveWishlist: {
                      moves: names.map(move),
                      learnedMoveIds: [],
                      targetSpeciesId: null,
                  },
              }
            : {}),
    };
}

function render(content: ReactNode, language: 'en' | 'cs' = 'en'): string {
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
            createElement(LanguageProvider, { initialLanguage: language }, content),
        ),
    );
}

function panel(html: string, label: string): string {
    const result = html.match(
        new RegExp(`<section[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</section>`),
    );
    if (!result) throw new Error(`Missing advice panel: ${label}`);
    return result[1];
}

function wishButton(html: string, label: string): string {
    const result = html.match(
        new RegExp(`<button[^>]*aria-label="${label}"[^>]*>[\\s\\S]*?</button>`),
    );
    if (!result) throw new Error(`Missing wishlist button: ${label}`);
    return result[0];
}

void test('successive panel selections keep both Torchic wishes and delay evolution until 46', () => {
    const original = owned();
    let current = setWishlistMove(original, details, move('Flame Burst'), true, english);
    current = setWishlistMove(current, details, move('Flamethrower'), true, english);

    deepStrictEqual(
        current.moveWishlist?.moves.map((entry) => entry.name),
        ['Flame Burst', 'Flamethrower'],
    );
    strictEqual(original.moveWishlist, undefined);
    const plan = planMoveWishlist(current, details);
    deepStrictEqual(
        plan.steps.filter((step) => step.kind === 'learn').map((step) => [step.name, step.level]),
        [
            ['Flame Burst', 28],
            ['Flamethrower', 46],
        ],
    );
    strictEqual(plan.steps.find((step) => step.kind === 'evolve')?.level, 46);
});

void test('an incompatible panel selection names the conflicting wish and leaves saved wishes intact', () => {
    const current = owned(['Flame Burst', 'Flamethrower']);
    const before = structuredClone(current);

    throws(
        () => setWishlistMove(current, details, move('Flame Charge'), true, czech),
        /Konflikt s útoky Flame Burst/,
    );
    deepStrictEqual(current, before);
});

void test('a panel selection can use a conditional machine route instead of claiming a timing conflict', () => {
    const current = setWishlistMove(
        owned(['Flamethrower']),
        details,
        move('Flame Charge'),
        true,
        english,
    );
    const plan = planMoveWishlist(current, details);
    const flamethrower = plan.moves.find((entry) => entry.name === 'Flamethrower');

    strictEqual(plan.status, 'ready');
    strictEqual(flamethrower?.status, 'conditional');
    strictEqual(flamethrower?.source?.machine, 'TM35');
    match(flamethrower?.reason ?? '', /Requires access to TM35/);
    strictEqual(plan.moves.find((entry) => entry.name === 'Flame Charge')?.status, 'natural');
});

void test('selection revalidates the latest form and level instead of saving a now-missed opportunity', () => {
    const candidate = move('Flame Charge');
    strictEqual(
        setWishlistMove(owned(), details, candidate, true, english).moveWishlist?.moves.length,
        1,
    );
    const current = owned();
    current.state = { ...current.state, speciesId: 256, level: 21, formEpoch: 'evolved' };
    const before = structuredClone(current);

    throws(
        () => setWishlistMove(current, details, candidate, true, english),
        /no verified learning route/i,
    );
    deepStrictEqual(current, before);
});

void test('removing and later tracking a currently learned wish preserves its acquisition history', () => {
    const current = owned(['Flamethrower', 'Brave Bird']);
    current.state.moves = [move('Flamethrower')];
    current.moveWishlist!.targetSpeciesId = 257;
    const removed = setWishlistMove(current, details, move('Flamethrower'), false, english);

    deepStrictEqual(removed.moveWishlist?.moves, [move('Brave Bird')]);
    deepStrictEqual(removed.moveWishlist?.learnedMoveIds, [move('Flamethrower').moveId]);
    strictEqual(removed.moveWishlist?.targetSpeciesId, 257);
    const replaced: OwnedPokemon = { ...removed, state: { ...removed.state, moves: [] } };
    const restored = setWishlistMove(replaced, details, move('Flamethrower'), true, english);
    strictEqual(
        planMoveWishlist(restored, details).moves.find((entry) => entry.name === 'Flamethrower')
            ?.status,
        'learned',
    );
});

void test('tracking a current move discovers that it was already learned, even if its level-up opportunity is past', () => {
    const current = owned();
    current.state.moves = [move('Scratch')];
    const selected = setWishlistMove(current, details, move('Scratch'), true, english);
    const replaced: OwnedPokemon = { ...selected, state: { ...selected.state, moves: [] } };

    deepStrictEqual(selected.moveWishlist?.learnedMoveIds, [move('Scratch').moveId]);
    strictEqual(planMoveWishlist(replaced, details).moves[0].status, 'learned');
});

void test('both evolution trade-off panels expose Czech tracking actions and checkmarks for saved wishes', () => {
    const html = render(
        createElement(EvolutionAdvice, {
            pokemon: owned(['Flamethrower', 'Brave Bird']),
            family,
            onUpdate: async () => {},
        }),
        'cs',
    );
    const before = panel(html, 'Naučit před vývojem');
    const after = panel(html, 'Nové útoky za úrovně po vývoji');
    for (const [markup, name] of [
        [before, 'Flamethrower'],
        [after, 'Brave Bird'],
    ]) {
        const button = wishButton(markup, `Odebrat ${name} z požadovaných útoků`);
        match(button, /aria-pressed="true"/);
        match(button, /<path d="m5 12 4 4L19 6"/);
    }
    match(wishButton(before, 'Sledovat Flame Burst'), /aria-pressed="false"/);
    match(wishButton(after, 'Sledovat Flame Charge'), /aria-pressed="false"/);
    doesNotMatch(before + after, /aria-label="(?:Track|Remove) /);
});

void test('paused advice keeps tracked status visible and disables edits in both panels', () => {
    const html = render(
        createElement(EvolutionAdvice, {
            pokemon: owned(['Flamethrower', 'Brave Bird']),
            family,
            wishlistPaused: true,
            onUpdate: async () => {},
        }),
    );
    const before = panel(html, 'Learn before evolving');
    const after = panel(html, 'New level-up moves after evolving');
    for (const [markup, name] of [
        [before, 'Flamethrower'],
        [after, 'Brave Bird'],
    ]) {
        const button = wishButton(markup, `Remove ${name} from wishlist`);
        match(button, /aria-pressed="true"/);
        match(button, /disabled=""/);
        match(button, /Resolve wishlist conflicts before editing/);
    }
    match(wishButton(before, 'Track Flame Burst'), /disabled=""/);
    match(wishButton(after, 'Track Flame Charge'), /disabled=""/);
});

void test('read-only wishlist actions show a labelled checkmark for tracked moves without offering edits', () => {
    const pokemon = owned(['Flamethrower']);
    const tracked = render(
        createElement(MyPokemonWishlistAction, { pokemon, family, move: move('Flamethrower') }),
        'cs',
    );
    match(tracked, /role="img" aria-label="Flamethrower je v požadovaných útocích"/);
    match(tracked, /<path d="m5 12 4 4L19 6"/);
    doesNotMatch(tracked, /<button/);
    const untracked = render(
        createElement(MyPokemonWishlistAction, { pokemon, family, move: move('Flame Charge') }),
    );
    strictEqual(untracked, '');
});
