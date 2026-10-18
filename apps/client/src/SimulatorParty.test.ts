import { deepStrictEqual, doesNotMatch, match, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type CollectionDocument,
    type KnownMove,
    type Move,
    type OwnedPokemon,
    type Pokemon,
    type SpeciesDetails,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { getPartyMoveMatchup, getSimulatorParty, SimulatorParty } from './SimulatorParty.js';
import { getRecordedMoveMatchups } from './recordedMoveMatchups.js';
import { LanguageProvider } from './language.js';

const types = [
    { typeId: 0, name: 'Normal', iconFile: 'normal.png' },
    { typeId: 2, name: 'Flying', iconFile: 'flying.png' },
    { typeId: 3, name: 'Poison', iconFile: 'poison.png' },
    { typeId: 4, name: 'Ground', iconFile: 'ground.png' },
    { typeId: 5, name: 'Rock', iconFile: 'rock.png' },
    { typeId: 6, name: 'Bug', iconFile: 'bug.png' },
    { typeId: 7, name: 'Ghost', iconFile: 'ghost.png' },
    { typeId: 10, name: 'Fire', iconFile: 'fire.png' },
    { typeId: 11, name: 'Water', iconFile: 'water.png' },
    { typeId: 12, name: 'Grass', iconFile: 'grass.png' },
    { typeId: 15, name: 'Ice', iconFile: 'ice.png' },
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
    ['11:10', 2],
    ['15:10', 0.5],
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

function matchupForMoves(
    attackingTypeIds: readonly number[],
    defendingTypeIds: readonly number[],
    reference: TypeEffectivenessChart | undefined,
) {
    const moves = attackingTypeIds.map((typeId) => ({
        ...rockSlide,
        moveId: 1000 + typeId,
        typeId,
    }));
    return getPartyMoveMatchup(
        getRecordedMoveMatchups(
            moves,
            new Map(moves.map((move) => [move.moveId, move])),
            defendingTypeIds,
            reference,
        ),
    );
}

void test('party guidance uses the best recorded attack type against both enemy types', () => {
    const effective = matchupForMoves([12, 5], [6, 2], chart);
    strictEqual(effective?.kind, 'effective');
    strictEqual(effective?.multiplier, 4);
    deepStrictEqual(
        effective?.moves.map((move) => move.typeId),
        [5],
    );
    const resisted = matchupForMoves([12], [6, 3], chart);
    strictEqual(resisted?.kind, 'ineffective');
    strictEqual(resisted?.multiplier, 0.25);
});

void test('a neutral damaging move prevents a resisted or immune alternative marking the Pokemon ineffective', () => {
    strictEqual(matchupForMoves([0, 6], [2], chart)?.kind, 'neutral');
    strictEqual(matchupForMoves([0, 4], [2], chart)?.multiplier, 1);
    strictEqual(matchupForMoves([4], [12, 3], chart)?.kind, 'neutral');
    const immune = matchupForMoves([0, 4], [7, 2], chart);
    strictEqual(immune?.kind, 'immune');
    strictEqual(immune?.multiplier, 0);
    deepStrictEqual(
        immune?.moves.map((move) => move.typeId),
        [0, 4],
    );
});

void test('duplicate moves and enemy types are counted once and all best ties are preserved', () => {
    const result = matchupForMoves([2, 2, 5], [6, 6], chart);
    strictEqual(result?.multiplier, 2);
    deepStrictEqual(
        result?.moves.map((move) => move.typeId),
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
        strictEqual(matchupForMoves(attackers, defenders, reference), null);
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
const rockSlide: Move = {
    moveId: 157,
    name: 'Rock Slide',
    description: '',
    descriptionCs: null,
    typeId: 5,
    type: 'Rock',
    typeIconFile: 'rock.png',
    categoryId: 0,
    category: 'Physical',
    categoryIconFile: null,
    power: 75,
    accuracy: 90,
    pp: 10,
    priority: 0,
    effectId: 0,
    targetId: 0,
};
const peck: Move = {
    ...rockSlide,
    moveId: 64,
    name: 'Peck',
    typeId: 2,
    type: 'Flying',
    typeIconFile: 'flying.png',
    power: 35,
};
function owned(id: string, options: Partial<OwnedPokemon> = {}): OwnedPokemon {
    return {
        id,
        playthroughId: 'run',
        nickname: id,
        state: {
            speciesId: 21,
            level: 16,
            moves: [{ moveId: peck.moveId, name: peck.name }],
            formEpoch: 'form',
        },
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
        enemyMoves?: readonly KnownMove[];
        moveDetails?: readonly Move[];
        references?: readonly SpeciesDetails[];
    } = {},
): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    if (options.speciesAvailable !== false)
        client.setQueryData(['collection-species', species.speciesId], species);
    client.setQueryData(['collection-move', peck.moveId], peck);
    for (const reference of options.references ?? [])
        client.setQueryData(['collection-species', reference.speciesId], reference);
    for (const move of options.moveDetails ?? [])
        client.setQueryData(['collection-move', move.moveId], move);
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
                        enemyMoves: options.enemyMoves,
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
    match(html, /Best type matchup among recorded damaging moves/);
    match(html, /sim-party-move">Peck/);
    const czech = render({ language: 'cs' });
    match(czech, /Váš tým/);
    match(czech, /Účinný/);
    match(czech, /Létající/);
});

function selectedCard(html: string): string {
    const card = html.match(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0];
    ok(card, 'selected party member is rendered');
    return card;
}

void test('Shellder needs a recorded damaging Water move before it is effective against Slugma', () => {
    const icicleSpear: Move = {
        ...rockSlide,
        moveId: 333,
        name: 'Icicle Spear',
        typeId: 15,
        type: 'Ice',
        typeIconFile: 'ice.png',
        power: 25,
        effectId: 25,
    };
    const withdraw: Move = {
        ...rockSlide,
        moveId: 110,
        name: 'Withdraw',
        typeId: 11,
        type: 'Water',
        typeIconFile: 'water.png',
        categoryId: 2,
        power: 0,
    };
    const supersonic: Move = {
        ...withdraw,
        moveId: 48,
        name: 'Supersonic',
        typeId: 0,
        type: 'Normal',
    };
    const protect: Move = { ...supersonic, moveId: 182, name: 'Protect' };
    const waterGun: Move = { ...withdraw, moveId: 55, name: 'Water Gun', categoryId: 1, power: 40 };
    const shellder: SpeciesDetails = {
        ...species,
        speciesId: 90,
        name: 'Shellder',
        typeIds: [11],
        types: ['Water'],
    };
    const slugma: Pokemon = {
        ...enemy,
        speciesId: 218,
        name: 'Slugma',
        typeIds: [10],
        types: ['Fire'],
    };
    const moves = [icicleSpear, withdraw, supersonic, protect];
    const document = collection();
    document.pokemon.first = {
        ...owned('first'),
        nickname: 'Milan',
        state: { ...owned('first').state, speciesId: 90, moves },
    };
    const before = structuredClone(document);
    const options = {
        document,
        references: [shellder],
        enemy: slugma,
        moveDetails: [...moves, waterGun],
    };
    const card = selectedCard(render(options));
    match(card, /data-matchup="ineffective"/);
    match(card, /ice\.png/);
    match(card, /½×/);
    match(card, /Ineffective/);
    match(card, /sim-party-move">Icicle Spear/);
    doesNotMatch(card, /water\.png|2×|Withdraw|Supersonic|Protect/);
    const czech = selectedCard(render({ ...options, language: 'cs' }));
    match(czech, /Málo účinný/);
    deepStrictEqual(document, before);

    // A loaded move (or a learnset preview) is not coverage until it is recorded.
    document.pokemon.first.state.moves = [icicleSpear, waterGun];
    const water = selectedCard(render(options));
    match(water, /data-matchup="effective"/);
    match(water, /water\.png/);
    match(water, /2×/);
    match(water, /sim-party-move">Water Gun/);
    doesNotMatch(water, /ice\.png/);
});

void test('missing, empty, status-only and unsupported recorded moves never imply type coverage', () => {
    const growl: Move = { ...peck, moveId: 45, name: 'Growl', categoryId: 2, power: 0 };
    const unknown: KnownMove = { moveId: 9999, name: 'Missing move' };
    const unsupported: Move = { ...peck, moveId: 573, name: 'Freeze-Dry' };
    for (const { moves, message } of [
        { moves: null, message: /Moves not recorded/ },
        { moves: [], message: /No damaging moves/ },
        { moves: [growl], message: /No damaging moves/ },
        { moves: [peck, unknown], message: /Move or type data unavailable/ },
        { moves: [peck, unsupported], message: /Moves not fully modeled/ },
    ]) {
        const document = collection();
        document.pokemon.first.state.moves = moves;
        const card = selectedCard(render({ document, moveDetails: [growl, unsupported] }));
        match(card, /data-matchup="unknown"/);
        match(card, message);
        doesNotMatch(card, /sim-party-types|sim-party-move|data-matchup="effective"/);
    }
});

void test('known enemy coverage warns a member even when its recorded attack is effective', () => {
    const html = render({ enemyMoves: [rockSlide], moveDetails: [rockSlide] });
    match(html, /data-matchup="effective"/);
    match(html, /<details class="sim-party-threats" data-warning="true"/);
    match(html, /Known move weaknesses for first/);
    match(html, /Rock Slide · <strong>2× weakness/);
    // Native disclosure is outside the party navigation link, so it can be opened without switching.
    match(html, /<\/a><details class="sim-party-threats"/);
    match(html, /unrevealed moves and abilities remain unknown/);
    match(
        render({ enemyMoves: [rockSlide], moveDetails: [rockSlide], language: 'cs' }),
        /2× slabina/,
    );
});

void test('unrevealed, unavailable and unsupported enemy moves never imply a safe party member', () => {
    match(render(), /Enemy moves unknown/);
    const unavailable = render({ enemyMoves: [rockSlide] });
    match(unavailable, /Moves not fully modeled/);
    doesNotMatch(unavailable, /data-warning="true"|No known type weakness/);
    for (const special of [
        { ...rockSlide, moveId: 573, name: 'Freeze-Dry' },
        { ...rockSlide, power: 1 },
        { ...rockSlide, categoryId: 2 },
    ]) {
        const html = render({ enemyMoves: [special], moveDetails: [special] });
        match(html, /Moves not fully modeled/);
        doesNotMatch(html, /data-warning="true"|No known type weakness/);
    }
    const neutral = { ...rockSlide, typeId: 0, type: 'Normal' };
    match(render({ enemyMoves: [neutral], moveDetails: [neutral] }), /No known type weakness/);
    doesNotMatch(
        render({ enemyMoves: [rockSlide], moveDetails: [rockSlide], enemy: null }),
        /data-warning/,
    );
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
