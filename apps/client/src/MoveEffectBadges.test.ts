import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Move } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import { MoveEffectBadges } from './MoveEffectBadges.js';
import { MoveAffinityProvider } from './MoveAffinity.js';
import { MyPokemonMove } from './MyPokemonMove.js';

function move(overrides: Partial<Move> = {}): Move {
    return {
        moveId: 40,
        name: 'Poison Sting',
        description: 'A toxic attack that may poison.',
        descriptionCs: null,
        typeId: 3,
        type: 'Poison',
        typeIconFile: null,
        categoryId: 0,
        category: 'Physical',
        categoryIconFile: null,
        power: 15,
        accuracy: 100,
        pp: 35,
        priority: 0,
        effectId: 1,
        targetId: 0,
        ...overrides,
    };
}

function render(content: ReactNode, language: 'en' | 'cs' = 'en'): string {
    return renderToStaticMarkup(
        createElement(LanguageProvider, { initialLanguage: language }, content),
    );
}

void test('effect icons keep an accessible name while their text is hidden until the hint opens', () => {
    const html = render(createElement(MoveEffectBadges, { move: move() }));
    match(html, /role="list" aria-label="Move effects"/);
    match(html, /data-effect="poison"/);
    match(html, /May: Target: Poison/);
    match(html, /<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">/);
    match(html, /<button[^>]*type="button"[^>]*aria-label="May: Target: Poison"/);
    doesNotMatch(html, /<input|<img|\d+%|role="tooltip"/);
    strictEqual(html.replace(/<[^>]*>/g, ''), '');
});

void test('accuracy reduction and self boosts have distinct labels and arrows', () => {
    const accuracy = render(
        createElement(MoveEffectBadges, {
            move: move({ moveId: 28, name: 'Sand Attack', effectId: 20, categoryId: 2 }),
        }),
    );
    match(accuracy, /Target: Accuracy ↓/);
    const boost = render(
        createElement(MoveEffectBadges, {
            move: move({
                moveId: 14,
                name: 'Swords Dance',
                effectId: 40,
                targetId: 16,
                categoryId: 2,
            }),
        }),
    );
    match(boost, /Self: Attack ↑/);
});

void test('self-inflicted sleep stays distinct from putting the target to sleep', () => {
    const html = render(
        createElement(MoveEffectBadges, {
            move: move({ moveId: 156, name: 'Rest', effectId: 30, targetId: 16, categoryId: 2 }),
        }),
    );
    match(html, /Self: Sleep/);
    match(html, /Self: Healing/);
    doesNotMatch(html, /Target: Sleep/);
});

void test('draining describes recovery for the user rather than self-inflicted damage', () => {
    const html = render(
        createElement(MoveEffectBadges, {
            move: move({ moveId: 71, name: 'Absorb', effectId: 3, categoryId: 1 }),
        }),
    );
    match(html, /Self: Drain healing/);
    doesNotMatch(html, /Recoil|Self: HP drain/);
});

void test('Czech icons retain localized accessible labels and unknown references invent no badges', () => {
    const html = render(createElement(MoveEffectBadges, { move: move() }), 'cs');
    match(html, /Účinky útoku/);
    match(html, /Může: Cíl: Otrava/);
    strictEqual(render(createElement(MoveEffectBadges)), '');
    strictEqual(
        render(createElement(MoveEffectBadges, { move: move({ moveId: 99999, effectId: 99999 }) })),
        '',
    );
});

void test('damaging move cards combine effects and affinity without nested interactive controls', () => {
    const client = new QueryClient();
    const reference = move();
    try {
        const html = render(
            createElement(
                QueryClientProvider,
                { client },
                createElement(MoveAffinityProvider, {
                    stats: { attack: 70, spAttack: 40 },
                    children: createElement(MyPokemonMove, {
                        move: reference,
                        reference,
                        as: 'button',
                        showStats: true,
                    }),
                }),
            ),
        );
        match(html, /class="[^"]*my-move-affinity/);
        match(html, /data-affinity="physical"/);
        match(html, /May: Target: Poison/);
        strictEqual((html.match(/<button/g) ?? []).length, 2);
        for (const [, contents] of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g))
            doesNotMatch(contents, /<button/);
        match(html, /aria-label="Remove Poison Sting"/);
        strictEqual(html.indexOf('my-move-name') < html.indexOf('move-effects'), true);
        strictEqual(html.indexOf('move-effects') < html.indexOf('my-move-stats'), true);
    } finally {
        client.clear();
    }
});

void test('effect hint buttons are outside the checkbox selection label', () => {
    const client = new QueryClient();
    const reference = move();
    try {
        const html = render(
            createElement(
                QueryClientProvider,
                { client },
                createElement(MyPokemonMove, {
                    move: reference,
                    reference,
                    as: 'label',
                    prefix: createElement('input', { type: 'checkbox', disabled: true }),
                }),
            ),
        );
        const selection = html.match(/<label\b[^>]*>([\s\S]*?)<\/label>/)?.[1] ?? '';
        match(selection, /type="checkbox" disabled=""/);
        match(selection, /Poison Sting/);
        doesNotMatch(selection, /<button/);
        match(html, /<button[^>]*aria-label="May: Target: Poison"/);
    } finally {
        client.clear();
    }
});

void test('status effects stay visible without receiving an offensive-category border', () => {
    const client = new QueryClient();
    const reference = move({ moveId: 28, name: 'Sand Attack', effectId: 20, categoryId: 2 });
    try {
        const html = render(
            createElement(
                QueryClientProvider,
                { client },
                createElement(MoveAffinityProvider, {
                    stats: { attack: 70, spAttack: 70 },
                    children: createElement(MyPokemonMove, { move: reference, reference }),
                }),
            ),
        );
        match(html, /Target: Accuracy ↓/);
        doesNotMatch(html, /my-move-affinity|data-affinity/);
    } finally {
        client.clear();
    }
});
