import { match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
    getMoveAffinity,
    MoveAffinityProvider,
    moveAffinityLabel,
    useMoveAffinity,
} from './MoveAffinity.js';

void test('move affinity matches the stronger base attacking stat and both categories on a tie', () => {
    const physical = { attack: 90, spAttack: 60 };
    const special = { attack: 60, spAttack: 90 };
    const equal = { attack: 75, spAttack: 75 };
    strictEqual(getMoveAffinity(physical, { categoryId: 0 }), 'physical');
    strictEqual(getMoveAffinity(physical, { categoryId: 1 }), null);
    strictEqual(getMoveAffinity(special, { categoryId: 0 }), null);
    strictEqual(getMoveAffinity(special, { categoryId: 1 }), 'special');
    strictEqual(getMoveAffinity(equal, { categoryId: 0 }), 'physical');
    strictEqual(getMoveAffinity(equal, { categoryId: 1 }), 'special');
    for (const stats of [physical, special, equal]) {
        strictEqual(getMoveAffinity(stats, { categoryId: 2 }), null);
        strictEqual(getMoveAffinity(stats, { categoryId: 99 }), null);
        strictEqual(getMoveAffinity(stats, undefined), null);
    }
    strictEqual(getMoveAffinity(undefined, { categoryId: 0 }), null);
});

function AffinityProbe({ id, categoryId }: { id: string; categoryId: number }) {
    const affinity = useMoveAffinity({ categoryId });
    return createElement('span', { id, 'data-affinity': affinity ?? 'none' });
}

void test('affinity context remains scoped to its Pokémon and unavailable stats disable matching', () => {
    const html = renderToStaticMarkup(
        createElement(
            'div',
            null,
            createElement(AffinityProbe, { id: 'outside', categoryId: 0 }),
            createElement(MoveAffinityProvider, {
                stats: { attack: 90, spAttack: 60 },
                children: [
                    createElement(AffinityProbe, { key: 'before', id: 'before', categoryId: 0 }),
                    createElement(MoveAffinityProvider, {
                        key: 'special',
                        stats: { attack: 60, spAttack: 90 },
                        children: createElement(AffinityProbe, { id: 'nested', categoryId: 1 }),
                    }),
                    createElement(MoveAffinityProvider, {
                        key: 'unknown',
                        children: createElement(AffinityProbe, { id: 'unknown', categoryId: 0 }),
                    }),
                    createElement(AffinityProbe, { key: 'after', id: 'after', categoryId: 0 }),
                ],
            }),
        ),
    );
    match(html, /id="outside" data-affinity="none"/);
    match(html, /id="before" data-affinity="physical"/);
    match(html, /id="nested" data-affinity="special"/);
    match(html, /id="unknown" data-affinity="none"/);
    match(html, /id="after" data-affinity="physical"/);
});

void test('affinity descriptions identify the category in each language and omit nonmatches', () => {
    const english = (en: string) => en;
    const czech = (_en: string, cs: string) => cs;
    match(moveAffinityLabel('physical', english) ?? '', /Physical move.*base offensive stats/);
    match(moveAffinityLabel('special', english) ?? '', /Special move.*base offensive stats/);
    match(moveAffinityLabel('physical', czech) ?? '', /Fyzický útok.*tohoto Pokémona/);
    match(moveAffinityLabel('special', czech) ?? '', /Speciální útok.*tohoto Pokémona/);
    strictEqual(moveAffinityLabel(null, english), undefined);
});
