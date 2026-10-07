import { doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TypeBadges } from './TypeBadges.js';

void test('types retain visible names beside decorative SQL-backed icons and without an icon', () => {
    const markup = renderToStaticMarkup(
        createElement(TypeBadges, {
            types: ['Electric', 'Dark', 'Mystery'],
            iconFiles: ['new lightning & v2.png', '48px-Darkness.png', null],
        }),
    );
    match(markup, /src="\/api\/icons\/types\/new%20lightning%20%26%20v2.png"/);
    match(markup, /alt=""/);
    match(markup, /src="\/api\/icons\/types\/48px-Darkness.png"/);
    match(markup, />Electric<\/span>/);
    match(markup, />Dark<\/span>/);
    match(markup, /data-type="Mystery"><span class="type-badge-label">Mystery<\/span>/);
    doesNotMatch(markup, /alt="Electric"|alt="Dark"|alt="Mystery"/);
});
