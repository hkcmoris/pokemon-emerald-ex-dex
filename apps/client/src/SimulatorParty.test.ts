import { deepStrictEqual, doesNotMatch, match, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type CollectionDocument,
    type OwnedPokemon,
    type Pokemon,
    type SpeciesDetails,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { getPartyTypeMatchup, getSimulatorParty, SimulatorParty } from './SimulatorParty.js';
import { LanguageProvider } from './language.js';

const types = [
    { typeId: 0, name: 'Normal', iconFile: 'normal.png' },
    { typeId: 2, name: 'Flying', iconFile: 'flying.png' },
    { typeId: 3, name: 'Poison', iconFile: 'poison.png' },
    { typeId: 4, name: 'Ground', iconFile: 'ground.png' },
    { typeId: 5, name: 'Rock', iconFile: 'rock.png' },
    { typeId: 6, name: 'Bug', iconFile: 'bug.png' },
    { typeId: 7, name: 'Ghost', iconFile: 'ghost.png' },
    { typeId: 12, name: 'Grass', iconFile: 'grass.png' },
];
const multipliers = new Map<string, number>([
    ['2:6', 2],
    ['6:2', 0.5],
    ['5:6', 2],
    ['5:2', 2],
    ['12:6', 0.5],
    ['12:3', 0.5],
    ['0:7', 0],
    ['4:2', 0],
    ['4:12', 0.5],
    ['4:3', 2],
]);
const chart: TypeEffectivenessChart = {
    types,
    matchups: types.flatMap((attack) =>
        types.map((defense) => ({
            attackingTypeId: attack.typeId,
            defendingTypeId: defense.typeId,
            multiplier: multipliers.get(`${attack.typeId}:${defense.typeId}`) ?? 1,
        })),
    ),
};

void test('party guidance uses the best own attack type against both enemy types', () => {
    const effective = getPartyTypeMatchup([12, 5], [6, 2], chart);
    strictEqual(effective?.kind, 'effective');
    strictEqual(effective?.multiplier, 4);
    deepStrictEqual(
        effective?.types.map((type) => type.typeId),
        [5],
    );
    const resisted = getPartyTypeMatchup([12], [6, 3], chart);
    strictEqual(resisted?.kind, 'ineffective');
    strictEqual(resisted?.multiplier, 0.25);
});

void test('a neutral own type prevents a resisted or immune alternative marking the Pokemon ineffective', () => {
    strictEqual(getPartyTypeMatchup([0, 6], [2], chart)?.kind, 'neutral');
    strictEqual(getPartyTypeMatchup([0, 4], [2], chart)?.multiplier, 1);
    strictEqual(getPartyTypeMatchup([4], [12, 3], chart)?.kind, 'neutral');
    const immune = getPartyTypeMatchup([0, 4], [7, 2], chart);
    strictEqual(immune?.kind, 'immune');
    strictEqual(immune?.multiplier, 0);
    deepStrictEqual(
        immune?.types.map((type) => type.typeId),
        [0, 4],
    );
});

void test('duplicate own and enemy types are counted once and all best ties are preserved', () => {
    const result = getPartyTypeMatchup([2, 2, 5], [6, 6], chart);
    strictEqual(result?.multiplier, 2);
    deepStrictEqual(
        result?.types.map((type) => type.typeId),
        [2, 5],
    );
});

void test('unknown, incomplete or absent data cannot produce party recommendations', () => {
    for (const [attackers, defenders, reference] of [
        [[2], [6], undefined],
        [[2], [6], { ...chart, matchups: chart.matchups.slice(1) }],
        [[], [6], chart],
        [[2], [], chart],
        [[999], [6], chart],
        [[2, 999], [6], chart],
        [[2], [999], chart],
    ] as const)
        strictEqual(getPartyTypeMatchup(attackers, defenders, reference), null);
});

const species: SpeciesDetails = {
    speciesId: 21,
    name: 'Spearow',
    types: ['Flying'],
    typeIds: [2],
    typeIconFiles: ['flying.png'],
    stats: { hp: 40, attack: 60, defense: 30, spAttack: 31, spDefense: 31, speed: 70 },
    baseStatTotal: 262,
    sprites: {
        front: 'spearow/front.png',
        back: 'spearow/back.png',
        shinyFront: null,
        shinyBack: null,
        frontFrame2: null,
        shinyFrontFrame2: null,
        frontFrameCount: 1,
        missingReason: null,
    },
    abilities: [],
    learnset: [],
    machines: [],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 21,
    formInfo: null,
    forms: null,
    formChanges: [],
};
const enemy: Pokemon = {
    ...species,
    speciesId: 12,
    name: 'Butterfree',
    typeIds: [6, 3],
    types: ['Bug', 'Poison'],
};
function owned(id: string, options: Partial<OwnedPokemon> = {}): OwnedPokemon {
    return {
        id,
        playthroughId: 'run',
        nickname: id,
        state: { speciesId: 21, level: 16, moves: null, formEpoch: 'form' },
        deleted: false,
        createdAt: '2026-10-16T12:00:00.000Z',
        ...options,
    };
}
function collection(): CollectionDocument {
    const members = [
        owned('first'),
        owned('second'),
        owned('deleted', { deleted: true }),
        owned('other-run', { playthroughId: 'other' }),
    ];
    return {
        ...emptyCollection(),
        playthroughs: {
            run: {
                id: 'run',
                name: 'Emerald',
                party: ['second', 'missing', 'deleted', 'first', 'other-run'],
                deleted: false,
            },
        },
        pokemon: Object.fromEntries(members.map((member) => [member.id, member])),
    };
}
function conflict(
    entity: 'playthroughs' | 'pokemon',
    entityId: string,
    field: string,
): CollectionConflict {
    return {
        id: `${entityId}:${field}`,
        kind: field === 'party' ? 'party' : 'field',
        entity,
        entityId,
        field,
        base: null,
        local: null,
        remote: null,
    };
}
function render(
    options: {
        document?: CollectionDocument;
        conflicts?: CollectionConflict[];
        enemy?: Pokemon | null;
        speciesAvailable?: boolean;
        language?: 'en' | 'cs';
    } = {},
): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    if (options.speciesAvailable !== false)
        client.setQueryData(['collection-species', species.speciesId], species);
    const document = options.document ?? collection();
    try {
        return renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    LanguageProvider,
                    { initialLanguage: options.language ?? 'en' },
                    createElement(SimulatorParty, {
                        document,
                        run: document.playthroughs.run,
                        selectedPokemonId: 'first',
                        enemy: options.enemy === undefined ? enemy : options.enemy,
                        chart,
                        conflicts: options.conflicts ?? [],
                        datasetId: 'test',
                    }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('party uses recorded order and filters missing, deleted and other-run members without writes', () => {
    const document = collection();
    const before = structuredClone(document);
    deepStrictEqual(
        getSimulatorParty(document, document.playthroughs.run, [])?.map((member) => member.id),
        ['second', 'first'],
    );
    const html = render({ document });
    ok(
        html.indexOf('simulator/second') < html.indexOf('simulator/first') ||
            html.indexOf('second/simulator') < html.indexOf('first/simulator'),
    );
    doesNotMatch(html, /missing|other-run|>deleted</);
    deepStrictEqual(document, before);
    const empty = collection();
    empty.playthroughs.run.party = [];
    strictEqual(render({ document: empty }), '');
});

void test('party links show selected state, sprite and explicit outgoing effectiveness', () => {
    const html = render();
    match(html, /aria-current="page"/);
    match(html, /spearow\/front\.png/);
    match(html, /data-matchup="effective"/);
    match(html, /flying\.png/);
    match(html, /2×/);
    match(html, /Effective/);
    match(html, /Best own type against the opponent/);
    const czech = render({ language: 'cs' });
    match(czech, /Váš tým/);
    match(czech, /Účinný/);
    match(czech, /Létající/);
});

void test('uncertain party lineup is replaced with a localized notice', () => {
    for (const field of ['party', '$entity', 'deleted']) {
        const conflicts = [conflict('playthroughs', 'run', field)];
        strictEqual(
            getSimulatorParty(collection(), collection().playthroughs.run, conflicts),
            null,
        );
        const html = render({ conflicts });
        match(html, /Resolve the party sync conflict/);
        doesNotMatch(html, /sim-party-member|data-matchup/);
    }
    match(
        render({ conflicts: [conflict('playthroughs', 'run', 'party')], language: 'cs' }),
        /konflikt synchronizace sestavy/,
    );
});

void test('uncertain member form or identity suppresses its recommendation but unrelated conflicts do not', () => {
    for (const field of ['state', '$entity', 'deleted', 'playthroughId']) {
        const html = render({ conflicts: [conflict('pokemon', 'first', field)] });
        match(html, /aria-current="page" data-matchup="unknown"/);
        match(html, /Sync conflict/);
    }
    match(
        render({ conflicts: [conflict('pokemon', 'first', 'natureId')] }),
        /aria-current="page" data-matchup="effective"/,
    );
    doesNotMatch(render({ speciesAvailable: false }), /data-matchup="effective"/);
    const noEnemy = render({ enemy: null });
    doesNotMatch(noEnemy, /data-matchup="effective"/);
    match(noEnemy, /Choose an opponent/);
});
