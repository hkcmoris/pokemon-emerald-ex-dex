import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

function renderHeader(overrides: Partial<ComponentProps<typeof SpeciesDetailHeader>> = {}): string {
    return renderToStaticMarkup(
        createElement(SpeciesDetailHeader, {
            entry,
            datasetId: 'emerald-ex-1.0.4',
            shiny: true,
            onShinyChange: () => {},
            onFormChange: () => {},
            ...overrides,
        }),
    );
}

void test('appearance selection renders one matching sprite and distinct IDs for identically named forms', () => {
    const markup = renderHeader();
    match(markup, /alt="Zen Darmanitan shiny front sprite"/);
    doesNotMatch(markup, /alt="Zen Darmanitan standard front sprite"/);
    strictEqual((markup.match(/class="species-sprite"/g) ?? []).length, 1);
    match(markup, /<button type="button" aria-pressed="false">Standard<\/button>/);
    match(
        markup,
        /<button type="button" aria-pressed="true"><span aria-hidden="true">✦<\/span> Shiny/,
    );
    match(markup, /<option value="1092">Zen Darmanitan · #1092<\/option>/);
    match(markup, /<option value="1093" selected="">Zen Darmanitan · #1093<\/option>/);

    const standard = renderHeader({ shiny: false });
    match(standard, /alt="Zen Darmanitan standard front sprite"/);
    match(standard, /<button type="button" aria-pressed="true">Standard<\/button>/);
    match(standard, /<option value="1093" selected="">/);
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
