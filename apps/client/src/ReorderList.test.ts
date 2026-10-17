import { deepStrictEqual, strictEqual, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { moveToPosition, sameOrder, ReorderList } from './ReorderList.js';
import { LanguageProvider } from './language.js';

void test('reordering preserves all members while moving directly to either end', () => {
    const ids = ['a', 'b', 'c', 'd'];
    deepStrictEqual(moveToPosition(ids, 'd', 0), ['d', 'a', 'b', 'c']);
    deepStrictEqual(moveToPosition(ids, 'a', 99), ['b', 'c', 'd', 'a']);
    deepStrictEqual(moveToPosition(ids, 'missing', 1), ids);
    deepStrictEqual(ids, ['a', 'b', 'c', 'd']);
});
void test('external membership and order changes invalidate a pending reorder or undo', () => {
    strictEqual(sameOrder(['a', 'b'], ['a', 'b']), true);
    strictEqual(sameOrder(['a', 'b'], ['b', 'a']), false);
    strictEqual(sameOrder(['a', 'b'], ['a', 'c']), false);
    strictEqual(sameOrder(['a', 'b'], ['a']), false);
});
void test('each item offers a named keyboard handle and direct position selection', () => {
    const html = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'en' },
            createElement(ReorderList, {
                items: [
                    { id: 'a', label: 'Ember' },
                    { id: 'b', label: 'Flare' },
                ],
                label: 'Party order',
                onReorder: async () => {},
                renderItem: (item, controls) => createElement('div', null, controls, item.label),
            }),
        ),
    );
    match(html, /aria-label="Reorder Ember"/);
    match(html, /aria-label="Position of Flare"/);
    match(html, /Escape cancels/);
});
