import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionConflict,
    type CollectionDocument,
    type Move,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { DamageSimulatorView, getDefaultSimulatorPokemonId } from './DamageSimulatorPage.js';
import { LanguageProvider } from './language.js';

const waterGun: Move = {
    moveId: 55,
    name: 'Water Gun',
    description: '',
    descriptionCs: null,
    typeId: 11,
    type: 'Water',
    typeIconFile: null,
    categoryId: 1,
    category: 'Special',
    categoryIconFile: null,
    power: 40,
    accuracy: 100,
    pp: 25,
    priority: 0,
    effectId: 0,
    targetId: 0,
};
const tackle: Move = {
    ...waterGun,
    moveId: 33,
    name: 'Tackle',
    typeId: 0,
    type: 'Normal',
    categoryId: 0,
    category: 'Physical',
};
const bubbleBeam: Move = { ...waterGun, moveId: 61, name: 'Bubble Beam', power: 65 };
const surf: Move = { ...waterGun, moveId: 57, name: 'Surf', power: 90 };
const darkPulse: Move = {
    ...waterGun,
    moveId: 399,
    name: 'Dark Pulse',
    typeId: 17,
    type: 'Dark',
    power: 80,
};
const species: SpeciesDetails = {
    speciesId: 692,
    name: 'Clauncher',
    types: ['Water'],
    typeIds: [11],
    typeIconFiles: [null],
    stats: { hp: 50, attack: 53, defense: 62, spAttack: 58, spDefense: 63, speed: 44 },
    baseStatTotal: 330,
    sprites: {
        front: 'clauncher/front.png',
        back: 'clauncher/back.png',
        shinyFront: null,
        shinyBack: null,
        frontFrame2: null,
        shinyFrontFrame2: null,
        frontFrameCount: 1,
        missingReason: null,
    },
    abilities: [],
    learnset: [
        { ...waterGun, entryOrder: 0, level: 1 },
        { ...bubbleBeam, entryOrder: 1, level: 20 },
    ],
    machines: [{ ...surf, machine: 'HM03', kind: 'HM', number: 3 }],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 692,
    formInfo: null,
    forms: null,
    formChanges: [],
};
const nextForm: SpeciesDetails = {
    ...species,
    speciesId: 693,
    name: 'Clawitzer',
    learnset: [{ ...darkPulse, entryOrder: 0, level: 1 }],
    machines: [],
};
const pokemon: OwnedPokemon = {
    id: 'pinchy',
    playthroughId: 'run',
    nickname: 'Pinchy',
    state: {
        speciesId: species.speciesId,
        level: 17,
        moves: [waterGun, tackle].map(({ moveId, name }) => ({ moveId, name })),
        formEpoch: 'first-form',
    },
    deleted: false,
    createdAt: '2026-10-12T12:00:00.000Z',
};
const observation: StatObservation = {
    id: 'current-stats',
    pokemonId: pokemon.id,
    speciesId: species.speciesId,
    level: 17,
    formEpoch: pokemon.state.formEpoch,
    recordedAt: '2026-10-16T12:00:00.000Z',
    stats: { attack: 27, spAttack: 39, defense: 32 },
    deleted: false,
};

function collection(
    owned: OwnedPokemon = pokemon,
    observations: readonly StatObservation[] = [observation],
): CollectionDocument {
    return {
        ...emptyCollection(),
        playthroughs: {
            run: { id: 'run', name: 'Emerald', party: [owned.id], deleted: false },
        },
        pokemon: { [owned.id]: owned },
        observations: Object.fromEntries(observations.map((entry) => [entry.id, entry])),
    };
}

function freeze<T>(value: T): T {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) freeze(child);
        Object.freeze(value);
    }
    return value;
}

function render(
    options: {
        document?: CollectionDocument;
        conflicts?: readonly CollectionConflict[];
        ready?: boolean;
        language?: 'en' | 'cs';
        speciesAvailable?: boolean;
        pokemonId?: string | null;
        references?: readonly SpeciesDetails[];
        moves?: readonly Move[];
        chart?: TypeEffectivenessChart;
    } = {},
): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    if (options.speciesAvailable !== false) {
        client.setQueryData(['collection-species', species.speciesId], species);
    }
    client.setQueryData(['collection-family', species.speciesId], [species, nextForm]);
    client.setQueryData(['collection-move', tackle.moveId], tackle);
    client.setQueryData(['collection-move', waterGun.moveId], waterGun);
    client.setQueryData(['collection-search', ''], []);
    for (const reference of options.references ?? []) {
        client.setQueryData(['collection-species', reference.speciesId], reference);
    }
    for (const move of options.moves ?? []) {
        client.setQueryData(['collection-move', move.moveId], move);
    }
    if (options.chart)
        client.setQueryData(['collection-type-effectiveness', 'test'], options.chart);
    try {
        return renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    LanguageProvider,
                    { initialLanguage: options.language ?? 'en' },
                    createElement(DamageSimulatorView, {
                        pokemonId:
                            options.pokemonId === null
                                ? undefined
                                : (options.pokemonId ?? pokemon.id),
                        version: '1.0.4',
                        datasetId: 'test',
                        document: options.document ?? collection(),
                        conflicts: options.conflicts ?? [],
                        ready: options.ready ?? true,
                        onSaveLevel: () => Promise.resolve(),
                        onUpdateCollection: () => Promise.resolve(),
                    }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('simulator renders the owned back sprite and keeps current and inherited moves without mutating the collection', () => {
    const document = freeze(collection());
    const before = structuredClone(document);
    const html = render({ document });
    match(html, /Pinchy/);
    match(html, /src="[^"]*clauncher\/back\.png"/);
    match(html, /Clauncher standard back sprite/);
    match(html, /Water Gun/);
    match(html, /Tackle/);
    doesNotMatch(html, /Dark Pulse/);
    deepStrictEqual(document, before);
});

void test('saved encounters drive the selected opponent and incoming moves without mutating the collection', () => {
    const document: CollectionDocument = {
        ...collection(),
        encounters: {
            rival: {
                id: 'rival',
                name: 'Rival · Route 110',
                playthroughId: 'run',
                party: ['enemy'],
                deleted: false,
                createdAt: '2026-10-18T10:00:00Z',
            },
        },
        opponents: {
            enemy: {
                id: 'enemy',
                encounterId: 'rival',
                speciesId: species.speciesId,
                level: 21,
                moves: [{ moveId: waterGun.moveId, name: waterGun.name }],
                deleted: false,
            },
        },
    };
    const before = structuredClone(document);
    const html = render({ document: freeze(document) });
    match(html, /Rival · Route 110/);
    match(html, /aria-label="Estimated incoming damage"/);
    match(html, /Clauncher → Pinchy/);
    match(html, /Opponent estimates/);
    doesNotMatch(html, /Change species/);
    deepStrictEqual(document, before);
    const blocked = render({
        document,
        conflicts: [
            {
                id: 'enemy-level-conflict',
                kind: 'field',
                entity: 'opponents',
                entityId: 'enemy',
                field: 'level',
                base: 20,
                local: 21,
                remote: 22,
            },
        ],
    });
    match(blocked, /Resolve the encounter conflict before using its matchup or damage estimates/);
    doesNotMatch(blocked, /Clauncher → Pinchy/);
});

function input(html: string, label: string): string {
    return (
        [...html.matchAll(/<input\b[^>]*>/g)].find((entry) =>
            entry[0].includes(`aria-label="${label}"`),
        )?.[0] ?? ''
    );
}

void test('simulator exposes saved level controls with a one-click increase and caps leveling at 100', () => {
    const html = render();
    match(html, /aria-label="Saved Pokémon level"/);
    match(input(html, 'Level'), /value="17"/);
    match(html, /Level up \+1/);
    match(html, /Level changes save to your collection/);
    match(html, /older measurements stay in history/);
    doesNotMatch(
        html,
        /Your saved collection stays untouched|No changes are saved to your collection/,
    );
    const maximum = render({
        document: collection({ ...pokemon, state: { ...pokemon.state, level: 100 } }),
    });
    match(maximum, /<button[^>]*disabled=""[^>]*>Level up \+1<\/button>/);
    match(maximum, /aria-label="Increase level"[^>]*disabled=""/);
});

void test('the preview catalogue includes future current-form and HM moves, with clear acquisition labels', () => {
    const html = render();
    match(html, /Bubble Beam/);
    match(html, /Lv\. 20 · future/);
    match(html, /Surf/);
    match(html, /HM03/);
    match(html, /Recorded \/ inherited/);
    match(html, /Level labels describe the learnset, not immediate availability/);
    match(html, /Future moves use today’s recorded level, stats and types/);
    doesNotMatch(html, /Dark Pulse/);
    match(html, /Base power <b>40<\/b>/);
    match(html, /Choose an opponent/);
    doesNotMatch(html, /[0-9]–[0-9]+ <span>HP<\/span>/);
});

void test('attacking inputs use the latest current observation and never fill gaps with older or base stats', () => {
    const html = render();
    match(input(html, 'Your Pokémon: Attack'), /placeholder="27"/);
    match(input(html, 'Your Pokémon: Sp. Atk'), /placeholder="39"/);
    match(input(html, 'Your Pokémon: Defense'), /placeholder="32"/);
    match(html, /Blank fields use recorded stats; entered values apply only here/);

    const partial = render({
        document: collection(pokemon, [
            { ...observation, id: 'older', recordedAt: '2026-10-15T12:00:00.000Z' },
            { ...observation, stats: { spAttack: 39 } },
        ]),
    });
    match(input(partial, 'Your Pokémon: Attack'), /placeholder="—"/);
    match(input(partial, 'Your Pokémon: Sp. Atk'), /placeholder="39"/);
    match(input(partial, 'Your Pokémon: Defense'), /placeholder="—"/);
    match(partial, /Missing · enter value/);

    for (const stale of [
        { ...observation, deleted: true },
        { ...observation, level: 16 },
        { ...observation, formEpoch: 'earlier-form' },
        { ...observation, speciesId: nextForm.speciesId },
        { ...observation, pokemonId: 'another-pokemon' },
    ]) {
        const unavailable = render({ document: collection(pokemon, [stale]) });
        for (const stat of ['Attack', 'Sp. Atk', 'Defense']) {
            match(input(unavailable, `Your Pokémon: ${stat}`), /placeholder="—"/);
        }
    }
});

void test('loading, missing or released owners and missing species data do not start a battle scenario', () => {
    const loading = render({ ready: false });
    match(loading, /Loading collection…/);
    doesNotMatch(loading, /Clauncher standard back sprite|Attacking stats|Current moves/);
    const noSpecies = render({ speciesAvailable: false });
    match(noSpecies, /Loading Pokémon data…/);
    doesNotMatch(noSpecies, /Clauncher standard back sprite|Attacking stats/);

    const releasedRun = collection();
    releasedRun.playthroughs = {
        run: { ...releasedRun.playthroughs.run, deleted: true },
    };
    for (const document of [
        emptyCollection(),
        collection({ ...pokemon, deleted: true }),
        { ...collection(), playthroughs: {} },
        releasedRun,
    ]) {
        const unavailable = render({ document });
        match(unavailable, /This Pokémon or its playthrough is unavailable/);
        doesNotMatch(unavailable, /Clauncher standard back sprite|Attacking stats|Current moves/);
    }
});

void test('ownership conflicts block simulation, while observation conflicts require temporary stat inputs', () => {
    for (const { entity, entityId, field } of [
        { entity: 'pokemon', entityId: pokemon.id, field: 'state' },
        { entity: 'pokemon', entityId: pokemon.id, field: '$entity' },
        { entity: 'playthroughs', entityId: 'run', field: 'deleted' },
    ] as const) {
        const html = render({
            conflicts: [
                {
                    id: 'conflict',
                    kind: 'field',
                    entity,
                    entityId,
                    field,
                    base: null,
                    local: null,
                    remote: null,
                },
            ],
        });
        match(html, /Resolve this Pokémon’s collection conflict before simulating/);
        doesNotMatch(html, /Clauncher standard back sprite|Attacking stats|Current moves/);
        doesNotMatch(html, /Saved Pokémon level|Level up \+1/);
    }

    for (const conflict of [
        {
            id: 'stats',
            kind: 'field',
            entity: 'observations',
            entityId: observation.id,
            field: 'stats',
            base: null,
            local: null,
            remote: null,
        },
        {
            id: 'stats',
            kind: 'delete-edit',
            entity: 'observations',
            entityId: 'removed-observation',
            field: '$entity',
            base: null,
            local: null,
            remote: { pokemonId: pokemon.id },
        },
        {
            id: 'observation-owner',
            kind: 'field',
            entity: 'observations',
            entityId: 'another-observation',
            field: 'pokemonId',
            base: 'another-member',
            local: 'another-member',
            remote: pokemon.id,
        },
    ] satisfies CollectionConflict[]) {
        const html = render({ conflicts: [conflict] });
        match(html, /Recorded stats have a sync conflict. Enter temporary values to simulate/);
        for (const stat of ['Attack', 'Sp. Atk', 'Defense']) {
            match(input(html, `Your Pokémon: ${stat}`), /placeholder="—"/);
        }
        match(html, /Clauncher standard back sprite/);
    }
});

void test('unknown and empty saved movesets still allow previews without populating the saved moves', () => {
    for (const moves of [null, []]) {
        const document = freeze(collection({ ...pokemon, state: { ...pokemon.state, moves } }));
        const before = structuredClone(document);
        const html = render({ document });
        match(html, /No moves are recorded. Preview a learnable move below/);
        match(html, /Bubble Beam/);
        match(html, /Surf/);
        doesNotMatch(html, /Recorded \/ inherited/);
        deepStrictEqual(document, before);
    }
});

void test('Czech simulator labels explain future moves, temporary inputs and omitted battle modifiers', () => {
    const html = render({ language: 'cs' });
    match(html, /Simulátor poškození/);
    match(html, /Zadní obrázek Clauncher/);
    match(input(html, 'Váš Pokémon: Útok'), /placeholder="27"/);
    match(input(html, 'Váš Pokémon: Sp. útok'), /placeholder="39"/);
    match(html, /Aktuální útoky/);
    match(html, /Náhledy útoků/);
    match(html, /Lv\. 20 · později/);
    match(html, /Zaznamenaný \/ zděděný/);
    match(html, /Základní síla/);
    match(html, /Pouze dočasně/);
    match(html, /Změny úrovně se ukládají do sbírky/);
    match(html, /Zvýšit úroveň \+1/);
    match(
        html,
        /Ostatní schopnosti, držené předměty, počasí, kritické zásahy, stavové podmínky a změny statistik nejsou zahrnuté/,
    );
    doesNotMatch(
        html,
        /Damage simulator|Current moves|Move previews|Choose an opponent|Base power|Recorded \/ inherited/,
    );
});

void test('simulator reflects saved nature without altering recorded stats and suppresses conflicting nature', () => {
    const owned = { ...pokemon, natureId: 15 };
    const document = freeze(collection(owned));
    const before = structuredClone(document);
    const html = render({ document });
    match(html, /Nature: Modest/);
    match(html, /aria-label="Your Pokémon: Attack"[^>]*data-nature-effect="decreased"/);
    match(html, /aria-label="Your Pokémon: Sp\. Atk"[^>]*data-nature-effect="increased"/);
    match(html, /placeholder="39"/);
    match(html, /Recorded values already include nature/);
    const conflict: CollectionConflict = {
        id: 'nature-choice',
        kind: 'field',
        entity: 'pokemon',
        entityId: pokemon.id,
        field: 'natureId',
        base: null,
        local: 15,
        remote: 3,
    };
    doesNotMatch(render({ document, conflicts: [conflict] }), /data-nature-effect/);
    deepStrictEqual(document, before);
});

void test('simulator totals Icicle Spear hits using the selected ability without applying it to the enemy', () => {
    const icicleSpear: Move = {
        ...tackle,
        moveId: 333,
        name: 'Icicle Spear',
        typeId: 15,
        type: 'Ice',
        power: 25,
        effectId: 25,
    };
    const shellder: SpeciesDetails = {
        ...species,
        speciesId: 90,
        name: 'Shellder',
        abilities: [75, 92].map((abilityId, index) => ({
            slot: index === 0 ? 1 : 2,
            kind: 'normal',
            ability: {
                abilityId,
                name: abilityId === 92 ? 'Skill Link' : 'Shell Armor',
                description: '',
                descriptionCs: null,
                aiRating: 0,
                flags: {
                    cantBeCopied: false,
                    cantBeSwapped: false,
                    cantBeTraced: false,
                    cantBeSuppressed: false,
                    cantBeOverwritten: false,
                    breakable: false,
                    failsOnImposter: false,
                },
            },
        })),
        learnset: [{ ...icicleSpear, level: 13, entryOrder: 0 }],
        machines: [],
    };
    const venusaur: SpeciesDetails = {
        ...species,
        speciesId: 3,
        name: 'Venusaur',
        types: ['Grass'],
        typeIds: [12],
        stats: { ...species.stats, hp: 100, attack: 82, defense: 85 },
    };
    const owned: OwnedPokemon = {
        ...pokemon,
        nickname: 'Milan',
        ability: { speciesId: shellder.speciesId, abilityId: 92 },
        state: { ...pokemon.state, speciesId: shellder.speciesId, level: 18, moves: [icicleSpear] },
    };
    const document: CollectionDocument = {
        ...collection(owned, [
            {
                ...observation,
                speciesId: shellder.speciesId,
                level: 18,
                stats: { hp: 50, attack: 31, defense: 45, spAttack: 24 },
            },
        ]),
        encounters: {
            rival: {
                id: 'rival',
                name: 'Rival',
                playthroughId: 'run',
                party: ['enemy'],
                deleted: false,
                createdAt: '2026-10-18T10:00:00Z',
            },
        },
        opponents: {
            enemy: {
                id: 'enemy',
                encounterId: 'rival',
                speciesId: venusaur.speciesId,
                level: 18,
                moves: [icicleSpear],
                deleted: false,
            },
        },
    };
    const typeIds = [0, 11, 12, 15];
    const chart: TypeEffectivenessChart = {
        types: typeIds.map((typeId) => ({ typeId, name: String(typeId), iconFile: null })),
        matchups: typeIds.flatMap((attackingTypeId) =>
            typeIds.map((defendingTypeId) => ({
                attackingTypeId,
                defendingTypeId,
                multiplier:
                    attackingTypeId === 15
                        ? defendingTypeId === 12
                            ? 2
                            : defendingTypeId === 11
                              ? 0.5
                              : 1
                        : 1,
            })),
        ),
    };
    const options = { document, references: [shellder, venusaur], moves: [icicleSpear], chart };
    const html = render(options);
    match(html, /Total · 5 hits · Skill Link/);
    match(html, /40–50 <span>HP<\/span>/);
    match(html, /58–72\.5% of enemy HP/);
    match(html, /Per hit: 8–10 HP/);
    const incoming =
        html.match(/<section[^>]*aria-label="Estimated incoming damage"[\s\S]*?<\/section>/)?.[0] ??
        '';
    match(incoming, /Total · 2–5 hits/);
    match(incoming, /4–15 HP/);
    doesNotMatch(incoming, /Total · 5 hits · Skill Link/);
    match(html, /Total HP damage \/ move use/);
    doesNotMatch(html, /Damage per successful hit|HP damage \/ successful hit/);

    const czech = render({ ...options, language: 'cs' });
    match(czech, /Celkem · 5 zásahů · Skill Link/);
    match(czech, /Za jeden zásah: 8–10 HP/);
    for (const ability of [
        null,
        { speciesId: 90, abilityId: 75 },
        { speciesId: 91, abilityId: 92 },
    ]) {
        const normal = render({
            ...options,
            document: { ...document, pokemon: { [owned.id]: { ...owned, ability } } },
        });
        match(normal, /Total · 2–5 hits/);
        match(normal, /16–50 <span>HP<\/span>/);
        doesNotMatch(normal, /Total · 5 hits · Skill Link/);
    }
    const conflicting = render({
        ...options,
        conflicts: [
            {
                id: 'ability-conflict',
                kind: 'field',
                entity: 'pokemon',
                entityId: owned.id,
                field: 'ability',
                base: null,
                local: owned.ability ? { ...owned.ability } : null,
                remote: null,
            },
        ],
    });
    match(conflicting, /16–50 <span>HP<\/span>/);
    doesNotMatch(conflicting, /Total · 5 hits · Skill Link/);
});

void test('global simulator entry selects the last member of the active playthrough, then party, then collection', () => {
    const reserve = { ...pokemon, id: 'reserve', playthroughId: 'active' };
    const first = { ...pokemon, id: 'first', playthroughId: 'active' };
    const second = { ...pokemon, id: 'second', playthroughId: 'active' };
    const deleted = { ...pokemon, id: 'deleted', playthroughId: 'active', deleted: true };
    const document: CollectionDocument = {
        ...collection(),
        playthroughs: {
            ...collection().playthroughs,
            active: {
                id: 'active',
                name: 'Active run',
                party: ['missing', pokemon.id, deleted.id, first.id, second.id],
                deleted: false,
            },
        },
        pokemon: {
            [pokemon.id]: pokemon,
            [reserve.id]: reserve,
            [first.id]: first,
            [second.id]: second,
            [deleted.id]: deleted,
        },
    };
    const before = structuredClone(document);
    strictEqual(
        getDefaultSimulatorPokemonId(document, [], {
            playthroughId: 'active',
            pokemonId: second.id,
        }),
        second.id,
    );
    // The last selected member can be in storage rather than the party.
    strictEqual(
        getDefaultSimulatorPokemonId(document, [], {
            playthroughId: 'active',
            pokemonId: reserve.id,
        }),
        reserve.id,
    );
    for (const pokemonId of [undefined, 'missing', pokemon.id, deleted.id]) {
        strictEqual(
            getDefaultSimulatorPokemonId(document, [], {
                playthroughId: 'active',
                pokemonId,
            }),
            first.id,
        );
    }
    strictEqual(getDefaultSimulatorPokemonId(document, [], null), pokemon.id);
    strictEqual(
        getDefaultSimulatorPokemonId(document, [], {
            playthroughId: 'removed',
            pokemonId: first.id,
        }),
        pokemon.id,
    );
    const emptyParty: CollectionDocument = {
        ...document,
        playthroughs: {
            ...document.playthroughs,
            active: { ...document.playthroughs.active, party: [] },
        },
    };
    strictEqual(
        getDefaultSimulatorPokemonId(emptyParty, [], {
            playthroughId: 'active',
        }),
        reserve.id,
    );
    // A conflicting party cannot determine the default attacker; collection order is still safe.
    strictEqual(
        getDefaultSimulatorPokemonId(
            document,
            [
                {
                    id: 'party-conflict',
                    kind: 'field',
                    entity: 'playthroughs',
                    entityId: 'active',
                    field: 'party',
                    base: [],
                    local: [],
                    remote: [],
                },
            ],
            { playthroughId: 'active' },
        ),
        reserve.id,
    );
    deepStrictEqual(document, before);
});

void test('standalone simulator supports first-party entry, loading, empty playthroughs and missing playthroughs', () => {
    const html = render({ pokemonId: null });
    match(html, /Clauncher standard back sprite/);
    match(html, /href="#\/simulator" aria-current="page"/);
    match(html, /href="#\/simulator\/pinchy"/);
    doesNotMatch(html, /This Pokémon or its playthrough is unavailable/);

    const loading = render({ pokemonId: null, ready: false });
    match(loading, /Loading collection…/);
    doesNotMatch(loading, /Clauncher standard back sprite|Attacking stats|Current moves/);

    const emptyRun = collection();
    emptyRun.pokemon = {};
    const empty = render({ pokemonId: null, document: emptyRun });
    match(empty, /Add a Pokémon to your active playthrough/);
    match(empty, /href="#\/my-pokemon"[^>]*>Open My Pokémon/);
    doesNotMatch(empty, /Attacking stats|Current moves/);
    match(
        render({ pokemonId: null, document: emptyCollection() }),
        /Create a playthrough and add your first Pokémon/,
    );
    const removed = collection();
    removed.playthroughs.run.deleted = true;
    match(
        render({ pokemonId: null, document: removed }),
        /Create a playthrough and add your first Pokémon/,
    );
});

void test('global simulator never silently leaves an empty active playthrough', () => {
    const document = collection();
    document.playthroughs.empty = { id: 'empty', name: 'Empty run', party: [], deleted: false };
    strictEqual(
        getDefaultSimulatorPokemonId(document, [], {
            playthroughId: 'empty',
            pokemonId: pokemon.id,
        }),
        undefined,
    );
    strictEqual(getDefaultSimulatorPokemonId(emptyCollection(), [], null), undefined);
});
