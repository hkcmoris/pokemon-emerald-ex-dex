import { doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MoveCategory } from './MoveCategory.js';

void test('category icons use the API filename, including replacements, and retain accessible labels', () => {
    const replacement = renderToStaticMarkup(
        createElement(MoveCategory, { category: 'Physical', iconFile: 'new physical & v2.png' }),
    );
    match(replacement, /src="\/api\/icons\/move-categories\/new%20physical%20%26%20v2.png"/);
    match(replacement, /alt=""/);
    match(replacement, /<span>Physical<\/span>/);
    const missing = renderToStaticMarkup(
        createElement(MoveCategory, { category: 'Special', iconFile: null }),
    );
    doesNotMatch(missing, /<img/);
    match(missing, /<span>Special<\/span>/);
});
