import { deepStrictEqual, doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TypeBadges } from './TypeBadges.js';
import { LanguageProvider, type Language } from './language.js';

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

void test('Czech type badges translate every imported type and preserve canonical attributes', () => {
    const types = [
        'Normal',
        'Fighting',
        'Flying',
        'Poison',
        'Ground',
        'Rock',
        'Bug',
        'Ghost',
        'Steel',
        'Mystery',
        'Fire',
        'Water',
        'Grass',
        'Electric',
        'Psychic',
        'Ice',
        'Dragon',
        'Dark',
        'Fairy',
        'Stellar',
        'toString',
    ];
    const markup = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'cs' },
            createElement(TypeBadges, { types, iconFiles: [] }),
        ),
    );
    deepStrictEqual(
        Array.from(markup.matchAll(/data-type="([^"]+)"/g), ([, name]) => name),
        types,
    );
    deepStrictEqual(
        Array.from(
            markup.matchAll(/class="type-badge-label">([^<]+)<\/span>/g),
            ([, name]) => name,
        ),
        [
            'Normální',
            'Bojový',
            'Létající',
            'Jedový',
            'Zemní',
            'Kamenný',
            'Hmyzí',
            'Duchový',
            'Ocelový',
            'Neznámý',
            'Ohnivý',
            'Vodní',
            'Travní',
            'Elektrický',
            'Psychický',
            'Ledový',
            'Dračí',
            'Temný',
            'Vílí',
            'Stellar',
            'toString',
        ],
    );
});

for (const { language, electric, mystery } of [
    { language: 'en', electric: 'Electric', mystery: 'Mystery' },
    { language: 'cs', electric: 'Elektrický', mystery: 'Neznámý' },
] satisfies { language: Language; electric: string; mystery: string }[]) {
    void test(`icon-only type badges localize accessible names and missing-icon labels (${language})`, () => {
        const markup = renderToStaticMarkup(
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(TypeBadges, {
                    types: ['Electric', 'Mystery', 'Stellar'],
                    iconFiles: ['lightning.png', null, null],
                    iconOnly: true,
                }),
            ),
        );
        match(markup, new RegExp(`data-type="Electric" title="${electric}"`));
        match(markup, new RegExp(`src="/api/icons/types/lightning.png" alt="${electric}"`));
        doesNotMatch(markup, new RegExp(`class="type-badge-label">${electric}<`));
        match(
            markup,
            new RegExp(
                `data-type="Mystery" title="${mystery}"><span class="type-badge-label">${mystery}</span>`,
            ),
        );
        match(
            markup,
            /data-type="Stellar" title="Stellar"><span class="type-badge-label">Stellar<\/span>/,
        );
    });
}
