import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DexNavigation, type DexSection } from './DexNavigation.js';
import { LanguageProvider } from './language.js';

function render(active: DexSection, language: 'en' | 'cs' = 'en'): string {
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: language },
            createElement(DexNavigation, { active }),
        ),
    );
}

void test('Simulator is always available in main navigation and owns its active state', () => {
    const html = render('simulator');
    match(html, /<a href="#\/simulator" aria-current="page">/);
    match(html, /<span>Simulator<\/span>/);
    strictEqual([...html.matchAll(/aria-current="page"/g)].length, 1);
    doesNotMatch(html, /href="#\/my-pokemon" aria-current/);
    match(render('my-pokemon'), /href="#\/my-pokemon" aria-current="page"/);
    doesNotMatch(render('my-pokemon'), /href="#\/simulator" aria-current/);
    match(render('simulator', 'cs'), /<span>Simulátor<\/span>/);
});
