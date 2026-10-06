import { doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TypeBadges } from './TypeBadges.js';

void test('type icons follow SQL filenames and slot order, retaining accessible names and missing-icon labels', () => {
    const markup = renderToStaticMarkup(
        createElement(TypeBadges, {
            types: ['Electric', 'Dark', 'Mystery'],
            iconFiles: ['new lightning & v2.png', '48px-Darkness.png', null],
        }),
    );
    match(markup, /src="\/api\/icons\/types\/new%20lightning%20%26%20v2.png"/);
    match(markup, /alt="Electric" title="Electric"/);
    match(markup, /src="\/api\/icons\/types\/48px-Darkness.png"/);
    match(markup, /alt="Dark" title="Dark"/);
    doesNotMatch(markup, />Electric<|>Dark</);
    match(markup, /data-type="Mystery">Mystery<\/span>/);
});
