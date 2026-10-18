import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type KnownMove,
} from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import {
    addEncounterOpponent,
    createEncounter,
    setEncounterOpponentMoves,
} from './encounterEdits.js';
import { LanguageProvider } from './language.js';
import { SimulatorEncounters } from './SimulatorEncounters.js';

const species = loadCollectionSpeciesFixture([258])[258];
const reference = species.learnset.find((move) => move.power > 0)!;

function render({
    moves = [reference],
    conflicts = [],
    language = 'en',
}: {
    moves?: KnownMove[];
    conflicts?: CollectionConflict[];
    language?: 'en' | 'cs';
} = {}): string {
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
    const document = setEncounterOpponentMoves(initial, initial.opponents!.foe, moves);
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
