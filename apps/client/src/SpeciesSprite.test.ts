import { strictEqual, match, doesNotMatch } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SpeciesSprite, spriteUrl } from './SpeciesSprite.js';

void test('sprite URLs preserve the dataset, ID and filename, including special characters', () => {
    strictEqual(
        spriteUrl('emerald-ex-1.0.4', 'shiny_front/0029_Nidoran♀.png'),
        '/api/sprites/emerald-ex-1.0.4/shiny_front/0029_Nidoran%E2%99%80.png',
    );
    strictEqual(spriteUrl(undefined, 'front/0001_Bulbasaur.png'), null);
    strictEqual(spriteUrl('emerald-ex-1.0.4', null), null);
});

void test('sprites use descriptive alternatives and missing references produce no broken image request', () => {
    const standard = renderToStaticMarkup(
        createElement(SpeciesSprite, {
            datasetId: 'emerald-ex-1.0.4',
            file: 'front/0001_Bulbasaur.png',
            name: 'Bulbasaur',
        }),
    );
    match(standard, /alt="Bulbasaur standard front sprite"/);
    match(standard, /loading="lazy"/);
    const shiny = renderToStaticMarkup(
        createElement(SpeciesSprite, {
            datasetId: 'emerald-ex-1.0.4',
            file: 'shiny_front/0001_Bulbasaur.png',
            name: 'Bulbasaur',
            shiny: true,
            size: 128,
        }),
    );
    match(shiny, /alt="Bulbasaur shiny front sprite"/);
    match(shiny, /width="128"/);
    const missing = renderToStaticMarkup(
        createElement(SpeciesSprite, {
            datasetId: 'emerald-ex-1.0.4',
            file: null,
            name: 'Terapagos',
        }),
    );
    doesNotMatch(missing, /<img/);
    match(missing, /Terapagos standard front sprite unavailable/);
});
