import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider } from './language.js';
import { SpeciesDetailHeader } from './SpeciesDetailHeader.js';

const entry: ComponentProps<typeof SpeciesDetailHeader>['entry'] = {
    speciesId: 1093,
    name: 'Darmanitan',
    formInfo: {
        formGroupId: 115,
        baseSpeciesId: 555,
        isBaseForm: false,
        formKind: 'alternate',
        formLabel: 'Zen',
    },
    types: ['Ice', 'Fire'],
    typeIconFiles: ['Ice.png', '48px-Fire.png'],
    sprites: {
        front: 'front/1093_Darmanitan.png',
        shinyFront: 'shiny_front/1093_Darmanitan.png',
        frontFrame2: null,
        shinyFrontFrame2: null,
        back: null,
        shinyBack: null,
        frontFrameCount: 1,
        missingReason: null,
    },
    forms: {
        formGroupId: 115,
        baseSpeciesId: 555,
        baseName: 'Darmanitan',
        members: [1092, 1093].map((speciesId) => ({
            speciesId,
            name: 'Darmanitan',
            formLabel: 'Zen',
            formKind: 'alternate',
            isBaseForm: false,
            sprite: null,
        })),
        changes: [],
    },
};

function renderHeader(
    overrides: Partial<ComponentProps<typeof SpeciesDetailHeader>> = {},
    language: 'en' | 'cs' = 'en',
): string {
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: language },
            createElement(SpeciesDetailHeader, {
                entry,
                datasetId: 'emerald-ex-1.0.4',
                shiny: true,
                onShinyChange: () => {},
                ...overrides,
            }),
        ),
    );
}

void test('appearance selection renders one matching sprite and retains the displayed form identity', () => {
    const markup = renderHeader();
    match(markup, /alt="Zen Darmanitan shiny front sprite"/);
    doesNotMatch(markup, /alt="Zen Darmanitan standard front sprite"/);
    strictEqual((markup.match(/class="species-sprite"/g) ?? []).length, 1);
    match(markup, /<button type="button" aria-pressed="false">Standard<\/button>/);
    match(
        markup,
        /<button type="button" aria-pressed="true"><span aria-hidden="true">✦<\/span> Shiny/,
    );

    match(markup, /<p class="eyebrow">#1093<\/p>/);
    match(markup, />Zen Darmanitan<\/h1>/);
    doesNotMatch(markup, /<select|<option/);

    const standard = renderHeader({ shiny: false });
    match(standard, /alt="Zen Darmanitan standard front sprite"/);
    match(standard, /<button type="button" aria-pressed="true">Standard<\/button>/);
});

void test('missing sprites retain the full form name and a disabled shiny control without a broken sprite request', () => {
    const markup = renderHeader({
        entry: {
            ...entry,
            name: 'Dudunsprce',
            formInfo: { ...entry.formInfo!, formLabel: 'Three-Segment' },
            forms: null,
            sprites: null,
        },
    });
    match(markup, />Three-Segment Dudunsprce<\/h1>/);
    match(markup, /Three-Segment Dudunsprce standard front sprite unavailable/);
    match(markup, /aria-pressed="false" disabled=""/);
    match(markup, /No sprite has been imported for this form/);
    doesNotMatch(markup, /\/api\/sprites\/|<select/);
});

for (const count of [0, 1, 2, 5]) {
    void test(`header form counter handles ${count} forms in English and Czech`, () => {
        const countEntry: ComponentProps<typeof SpeciesDetailHeader>['entry'] = {
            ...entry,
            forms: {
                formGroupId: 115,
                baseSpeciesId: 555,
                baseName: 'Darmanitan',
                members: Array.from({ length: count }, (_, index) => ({
                    speciesId: 1092 + index,
                    name: 'Darmanitan',
                    formLabel: 'Zen',
                    formKind: 'alternate',
                    isBaseForm: false,
                    sprite: null,
                })),
                changes: [],
            },
        };
        for (const language of ['en', 'cs'] as const) {
            const markup = renderHeader({ entry: countEntry }, language);
            if (count > 1) {
                const label = language === 'en' ? 'Forms' : count < 5 ? 'Formy' : 'Forem';
                match(markup, new RegExp(`<span\\b[^>]*>${count} ${label}</span>`));
            } else {
                doesNotMatch(markup, /Forms|Formy|Forem/);
            }
            doesNotMatch(markup, /<select|<option/);
        }
    });
}
