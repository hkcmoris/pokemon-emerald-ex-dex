import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type CollectionDocument,
    type KnownMove,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import {
    addEncounterOpponent,
    createEncounter,
    setEncounterOpponentMoves,
} from './encounterEdits.js';
import { LanguageProvider } from './language.js';
import { SimulatorEncounters, SimulatorOpponentStrip } from './SimulatorEncounters.js';

const species = loadCollectionSpeciesFixture([258])[258];
const reference = species.learnset.find((move) => move.power > 0)!;

function fixture(moves: KnownMove[] = [reference]): CollectionDocument {
    const initial = addEncounterOpponent(
        createEncounter(
            {
                ...emptyCollection(),
                playthroughs: { run: { id: 'run', name: 'Emerald', party: [], deleted: false } },
            },
            'run',
            'rival',
            'Rival',
            '2026-10-18T09:00:00.000Z',
        ),
        'rival',
        'foe',
        species.speciesId,
        20,
    );
    return setEncounterOpponentMoves(initial, initial.opponents!.foe, moves);
}

function render({
    moves = [reference],
    conflicts = [],
    language = 'en',
}: {
    moves?: KnownMove[];
    conflicts?: CollectionConflict[];
    language?: 'en' | 'cs';
} = {}): string {
    const document = fixture(moves);
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(['collection-species', species.speciesId], species);
    client.setQueryData(['collection-move', reference.moveId], reference);
    try {
        return renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    LanguageProvider,
                    { initialLanguage: language },
                    createElement(SimulatorEncounters, {
                        document,
                        conflicts,
                        runId: 'run',
                        defaultLevel: 20,
                        selectedEncounterId: 'rival',
                        selectedOpponentId: 'foe',
                        onSelect: () => {},
                        onUpdate: async () => {},
                    }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('revealed moves use the shared display with their type, category and edit actions', () => {
    const html = render();
    match(html, /sim-revealed-moves"><li[^>]*move-display/);
    strictEqual(html.includes(reference.name), true);
    strictEqual(html.includes(`data-type="${reference.type}"`), true);
    match(html, /aria-label="Replace /);
    match(html, /aria-label="Remove /);
    strictEqual((html.match(/sim-unknown-move/g) ?? []).length, 3);
    for (const [, contents] of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g))
        doesNotMatch(contents, /<button/);
});

function renderStrip({
    document = fixture(),
    selectedOpponentId = 'foe',
    conflicts = [],
    language = 'en',
}: {
    document?: CollectionDocument;
    selectedOpponentId?: string;
    conflicts?: CollectionConflict[];
    language?: 'en' | 'cs';
} = {}): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(['collection-species', species.speciesId], species);
    try {
        return renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    LanguageProvider,
                    { initialLanguage: language },
                    createElement(SimulatorOpponentStrip, {
                        document,
                        encounter: document.encounters!.rival,
                        selectedOpponentId,
                        conflicts,
                        datasetId: 'emerald-ex',
                        onSelect: () => {},
                    }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('the opponent strip keeps encounter order and selection, excluding stale roster entries', () => {
    const initial = addEncounterOpponent(fixture(), 'rival', 'second', species.speciesId, 25);
    const document: CollectionDocument = {
        ...initial,
        encounters: {
            ...initial.encounters,
            rival: {
                ...initial.encounters!.rival,
                party: ['second', 'foe', 'second', 'missing', 'deleted', 'foreign'],
            },
        },
        opponents: {
            ...initial.opponents,
            deleted: { ...initial.opponents!.foe, id: 'deleted', deleted: true },
            foreign: { ...initial.opponents!.foe, id: 'foreign', encounterId: 'another' },
        },
    };
    const html = renderStrip({ document, selectedOpponentId: 'second' });
    match(html, /aria-label="Switch opponent"/);
    strictEqual((html.match(/<button\b/g) ?? []).length, 2);
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(([button]) => button);
    match(buttons[0], /aria-pressed="true"/);
    match(buttons[0], /aria-label="Mudkip · Lv\. 25"/);
    match(buttons[1], /aria-pressed="false"/);
    match(buttons[1], /title="Mudkip · Lv\. 20"/);
    doesNotMatch(html, /<strong|<small|Replace|Remove|sim-revealed-moves/);
});

void test('the opponent strip labels individual sync conflicts without hiding switching controls', () => {
    const document = addEncounterOpponent(fixture(), 'rival', 'second', species.speciesId, 25);
    const html = renderStrip({
        document,
        language: 'cs',
        conflicts: [
            {
                id: 'foe-level',
                entity: 'opponents',
                entityId: 'foe',
                kind: 'field',
                field: 'level',
                base: null,
                local: null,
                remote: null,
            },
        ],
    });
    match(html, /aria-label="Přepnout soupeře"/);
    match(html, /aria-label="Mudkip · Lv\. 20 · Konflikt synchronizace"/);
    strictEqual((html.match(/data-warning="true"/g) ?? []).length, 1);
    doesNotMatch(html, /disabled/);
});

void test('the opponent strip marks inherited encounter conflicts and omits deleted encounters', () => {
    const document = addEncounterOpponent(fixture(), 'rival', 'second', species.speciesId, 25);
    const html = renderStrip({
        document,
        conflicts: [
            {
                id: 'rival-party',
                entity: 'encounters',
                entityId: 'rival',
                kind: 'field',
                field: 'party',
                base: null,
                local: null,
                remote: null,
            },
        ],
    });
    strictEqual((html.match(/data-warning="true"/g) ?? []).length, 2);
    doesNotMatch(
        renderStrip({
            document: {
                ...document,
                encounters: {
                    ...document.encounters,
                    rival: { ...document.encounters!.rival, deleted: true },
                },
            },
        }),
        /<button\b/,
    );
});

void test('a revealed move with unavailable reference data keeps its name and removal action', () => {
    const html = render({ moves: [{ moveId: 9999, name: 'Unavailable move' }] });
    match(html, /move-display/);
    match(html, />Unavailable move</);
    match(html, /aria-label="Remove Unavailable move"/);
    doesNotMatch(html, /NaN|undefined/);
});

void test('sync conflicts keep revealed move edit actions disabled and localized', () => {
    const html = render({
        language: 'cs',
        conflicts: [
            {
                id: 'foe-moves',
                entity: 'opponents',
                entityId: 'foe',
                kind: 'field',
                field: 'moves',
                base: null,
                local: null,
                remote: null,
            },
        ],
    });
    match(html, /disabled="" aria-label="Nahradit /);
    match(html, /disabled="" aria-label="Odebrat /);
    match(html, /konflikt synchronizace/);
});
