import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Move } from '@pokemon-emerald-ex-dex/shared';

import { MoveDisplay } from './MoveDisplay.js';
import { MovePowerProvider } from './MovePower.js';
import { LanguageProvider } from './language.js';

const move: Move = {
    moveId: 40,
    name: 'Poison Sting',
    description: 'A toxic attack that may poison.',
    descriptionCs: 'Jedový útok, který může otrávit.',
    typeId: 3,
    type: 'Poison',
    typeIconFile: 'Poison.png',
    categoryId: 0,
    category: 'Physical',
    categoryIconFile: 'physical.png',
    power: 15,
    accuracy: 100,
    pp: 35,
    priority: 0,
    effectId: 1,
    targetId: 0,
};

function render(content: ReactNode, language: 'en' | 'cs' = 'en'): string {
    return renderToStaticMarkup(
        createElement(LanguageProvider, { initialLanguage: language }, content),
    );
}

void test('move sizes share identity while configurable fields preserve ROM values and localization', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
        const html = render(createElement(MoveDisplay, { move, size }));
        match(html, /data-move-id="40"/);
        match(html, /class="move-display-name">Poison Sting/);
        match(html, /data-effect="poison"/);
        if (size === 'small') doesNotMatch(html, /move-display-stat"/);
        else match(html, /<span>Power<\/span><strong>15<\/strong>/);
    }
    const detailed = render(
        createElement(MoveDisplay, {
            move: { ...move, power: 0, accuracy: 0, priority: 1 },
            size: 'small',
            show: {
                description: true,
                power: true,
                accuracy: true,
                pp: true,
                priority: true,
                effects: false,
            },
        }),
        'cs',
    );
    match(detailed, /Jedový útok, který může otrávit/);
    match(detailed, /<span>Síla<\/span><strong>—<\/strong>/);
    match(detailed, /<span>Přesnost<\/span><strong>—<\/strong>/);
    match(detailed, /<span>PP<\/span><strong>35<\/strong>/);
    match(detailed, /<span>Priorita<\/span><strong>\+1<\/strong>/);
    doesNotMatch(detailed, /class="move-effects"/);
});

void test('unresolved references keep the recorded name and unknown stats without inventing typing', () => {
    const html = render(
        createElement(MoveDisplay, { move: { moveId: 999, name: 'Recorded move' } }),
    );
    match(html, /Recorded move/);
    match(html, /<span>Power<\/span><strong>\?<\/strong>/);
    doesNotMatch(html, /type-surface|type-icon|move-effects|move-category-icon/);
});

void test('passive moves are safe inside navigation and preserve accessible effect descriptions', () => {
    const html = render(
        createElement(
            'a',
            { href: '#matchup' },
            createElement(MovePowerProvider, {
                stats: { attack: 50 },
                typeIds: [3],
                children: createElement(MoveDisplay, { move, passive: true }),
            }),
        ),
    );
    doesNotMatch(html, /<button|<label|popoverTarget/);
    match(html, /aria-label="May: Target: Poison"/);
    match(html, /Poison Sting/);
});

void test('selecting a move and inspecting its effects are separate controls', () => {
    const html = render(
        createElement(MoveDisplay, {
            move,
            interaction: { kind: 'button', label: 'Record Poison Sting', onClick: () => {} },
            actions: createElement('button', { type: 'button' }, 'Another action'),
        }),
    );
    const selection = html.match(
        /<button[^>]*aria-label="Record Poison Sting"[^>]*>(.*?)<\/button>/,
    )?.[1];
    strictEqual(typeof selection, 'string');
    match(selection!, /Poison Sting/);
    doesNotMatch(selection!, /<button|move-effects/);
    match(html, /aria-label="May: Target: Poison"/);
    match(html, /Another action/);
});

void test('total damage replaces the comparison headline while base power remains a separate value', () => {
    const html = render(
        createElement(MovePowerProvider, {
            stats: { attack: 50 },
            typeIds: [3],
            children: createElement(MoveDisplay, {
                move,
                metric: {
                    label: 'Total · 5 hits · Skill Link',
                    value: '40–50 HP',
                    detail: '58–72.5% of enemy HP',
                },
            }),
        }),
    );
    match(html, /Total · 5 hits · Skill Link/);
    match(html, /40–50 HP/);
    match(html, /58–72.5% of enemy HP/);
    match(html, /<span>Base power<\/span><strong>15<\/strong>/);
    doesNotMatch(html, /my-move-effective-power|Comparison score/);
});
