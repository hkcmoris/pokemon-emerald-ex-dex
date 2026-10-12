import { doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    emptyCollection,
    type CollectionDocument,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { MyPokemonCard, CatchUpRecap, EvolutionAdvice } from './MyPokemonCard.js';
import { AddPokemonForm } from './MyPokemonForms.js';
import { GrowthTable, ObservationForm } from './MyPokemonHistory.js';
import { MyPokemonConflicts, conflictValueLabel } from './MyPokemonConflicts.js';
import { LanguageProvider } from './language.js';
import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';

const species: SpeciesDetails = {
    speciesId: 1,
    name: 'Bulbasaur',
    types: ['Grass'],
    typeIds: [12],
    typeIconFiles: [null],
    stats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
    baseStatTotal: 318,
    sprites: null,
    abilities: [],
    learnset: [],
    machines: [],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 1,
    formInfo: null,
    forms: null,
    formChanges: [],
};
const owned: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: 'Sprout',
    state: { speciesId: 1, level: 12, moves: null, formEpoch: 'stage-one' },
    deleted: false,
    createdAt: '2026-10-12T12:00:00.000Z',
};

function render(content: ReactNode, language: 'en' | 'cs' = 'en'): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(['collection-species', 1], species);
    client.setQueryData(['collection-family', 1], [species]);
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(LanguageProvider, { initialLanguage: language }, content),
        ),
    );
}

function card(pokemon = owned, stateConflict = false) {
    return createElement(MyPokemonCard, {
        pokemon,
        observations: [],
        partyIndex: 0,
        partySize: 1,
        stateConflict,
        onUpdate: async () => {},
        onParty: async () => {},
        onMove: async () => {},
        saveObservation: async () => {},
        onRemove: async () => {},
    });
}

void test('owned cards distinguish unknown moves from an intentionally empty moveset and preserve identity nickname', () => {
    const unknown = render(card());
    match(unknown, /Sprout/);
    match(unknown, /Bulbasaur/);
    match(unknown, /Not recorded/);
    doesNotMatch(unknown, /No moves recorded as known/);
    const empty = render(card({ ...owned, state: { ...owned.state, moves: [] } }));
    match(empty, /No moves recorded as known/);
    match(empty, /Remove from party/);
    match(empty, /min="1" max="100"/);
});

void test('a conflicting species state suspends advice instead of mixing alternatives', () => {
    const html = render(card(owned, true));
    match(html, /guidance is paused/);
    doesNotMatch(html, /aria-label="Upcoming opportunities"/);
    match(html, /<input(?=[^>]*value="12")(?=[^>]*disabled="")[^>]*>/);
    match(html, /name|Nickname/);
});

void test('catch-up recap saves nothing automatically and keeps the recap skippable', () => {
    let saves = 0;
    const move = {
        moveId: 22,
        name: 'Vine Whip',
        description: '',
        descriptionCs: null,
        typeId: 12,
        type: 'Grass',
        typeIconFile: null,
        categoryId: 0,
        category: 'Physical',
        categoryIconFile: null,
        power: 45,
        accuracy: 100,
        pp: 25,
        priority: 0,
        effectId: 0,
        targetId: 0,
        entryOrder: 1,
        level: 13,
    };
    const html = render(
        createElement(CatchUpRecap, {
            details: { ...species, learnset: [move] },
            oldLevel: 12,
            newLevel: 15,
            moves: null,
            onSaveMoves: () => {
                saves++;
                return Promise.resolve();
            },
            onClose: () => {},
        }),
    );
    match(html, /Level saved/);
    match(html, /Skip recap/);
    match(html, /Vine Whip/);
    match(html, /Save chosen current moves/);
    doesNotMatch(html, /checked=""/);
    match(html, /If you evolved during it, check the timing/);
    strictEqual(saves, 0);
});

void test('growth view labels estimates and never bridges distinct form periods', () => {
    const observation = (
        id: string,
        level: number,
        hp: number,
        epoch = 'stage-one',
    ): StatObservation => ({
        id,
        pokemonId: owned.id,
        speciesId: 1,
        level,
        formEpoch: epoch,
        recordedAt: `2026-10-${String(level).padStart(2, '0')}T12:00:00.000Z`,
        stats: { hp },
        deleted: false,
    });
    const observations = [
        observation('first', 10, 30),
        observation('second', 12, 36),
        observation('third', 14, 80, 'stage-two'),
    ];
    const html = render(
        createElement(GrowthTable, {
            observations,
            family: [species],
            showEstimates: true,
            onEdit: () => {},
            onDelete: () => {},
        }),
    );
    match(html, /≈33/);
    match(html, /Estimate/);
    match(html, /Observed/);
    doesNotMatch(html, /≈58/);
    strictEqual((html.match(/class="my-history-heading"/g) ?? []).length, 2);
    strictEqual((html.match(/class="my-estimate"/g) ?? []).length, 1);
    const measured = render(
        createElement(GrowthTable, {
            observations,
            family: [species],
            showEstimates: false,
            onEdit: () => {},
            onDelete: () => {},
        }),
    );
    doesNotMatch(measured, /class="my-estimate"/);
});

void test('optional nickname and stat fields are not required while level and observation date are', () => {
    const add = render(
        createElement(AddPokemonForm, {
            selected: species,
            onSave: async () => {},
            onCancel: () => {},
        }),
    );
    strictEqual((add.match(/required=""/g) ?? []).length, 1);
    match(add, /Nickname \(optional\)/);
    match(add, /maxLength="40"/);
    const stats = render(
        createElement(ObservationForm, {
            pokemon: owned,
            onSave: async () => {},
            onCancel: () => {},
        }),
    );
    strictEqual((stats.match(/required=""/g) ?? []).length, 2);
    strictEqual((stats.match(/max="65535"/g) ?? []).length, 6);
    match(stats, /Leave unknown stats blank/);
});

void test('conflicts show readable alternatives, retain removal choices and hide implementation IDs', () => {
    const document: CollectionDocument = {
        ...emptyCollection(),
        playthroughs: { run: { id: 'run', name: 'Emerald', party: [owned.id], deleted: false } },
        pokemon: { [owned.id]: owned },
    };
    const t = (english: string) => english;
    strictEqual(conflictValueLabel(['owned'], 'party', document, t), 'Sprout');
    const html = render(
        createElement(MyPokemonConflicts, {
            document,
            conflicts: [
                {
                    id: 'conflict',
                    entity: 'pokemon',
                    entityId: owned.id,
                    kind: 'delete-edit',
                    field: '$entity',
                    base: { ...owned, state: { ...owned.state, moves: null } },
                    local: { ...owned, state: { ...owned.state, moves: null }, deleted: true },
                    remote: { ...owned, state: { ...owned.state, moves: null, level: 20 } },
                },
            ],
            resolve: async () => {},
        }),
    );
    match(html, /Removed Pokémon/);
    match(html, /Kept Pokémon/);
    match(html, /Level: 20/);
    match(html, /Keep this device’s version/);
    match(html, /Keep synced version/);
    doesNotMatch(html, /formEpoch|stage-one|playthroughId|\[object Object\]/);
});

void test('collection UI translates its user actions in Czech', () => {
    const html = render(card(), 'cs');
    match(html, /Aktuální útoky/);
    match(html, /Nezaznamenány/);
    match(html, /Zapsat vývoj \/ formu/);
    match(html, /Odebrat z týmu/);
    doesNotMatch(html, /Remove from party|Record evolution/);
});

void test('evolution condition evidence distinguishes recorded facts from unknown requirements', () => {
    const evolution = {
        edgeOrder: 0,
        fromSpeciesId: 1,
        toSpeciesId: 2,
        fromName: 'Bulbasaur',
        toName: 'Ivysaur',
        methodId: 4,
        method: 'level',
        trigger: 'level_up',
        level: 16,
        conditions: {},
        summary: 'Level 16',
        rawParam: 16,
        items: [],
        internalOnly: false,
        fromSprite: null,
        toSprite: null,
    };
    const html = render(
        createElement(EvolutionAdvice, {
            pokemon: owned,
            family: [{ ...species, evolutionLinks: [evolution] }],
        }),
    );
    match(html, /Not met in recorded data/);
    match(html, /level alone does not confirm readiness/);
    doesNotMatch(html, /Ready to evolve/);
});

void test('real Torchic guidance visibly compares waiting for Flamethrower with evolution gains and their deadlines', () => {
    const family = Object.values(loadCollectionSpeciesFixture([255, 256, 257]));
    const torchic = {
        ...owned,
        nickname: '',
        state: { ...owned.state, speciesId: 255, level: 11 },
    };
    const html = render(createElement(EvolutionAdvice, { pokemon: torchic, family }));
    const delay =
        html.match(
            /<section class="my-tradeoff-group my-tradeoff-delay"[\s\S]*?<ul class="my-tradeoff-list">([\s\S]*?)<\/ul>/,
        )?.[1] ?? '';
    const gain =
        html.match(
            /<section class="my-tradeoff-group my-tradeoff-gain"[\s\S]*?<ul class="my-tradeoff-list">([\s\S]*?)<\/ul>/,
        )?.[1] ?? '';
    for (const name of ['Fire Spin', 'Flame Burst', 'Flamethrower']) match(delay, new RegExp(name));
    match(delay, /Torchic · Lv\. 46/);
    match(delay, /Combusken \/ Blaziken can also learn it via TM35, if you have the machine/);
    doesNotMatch(delay, /Peck|Mirror Move|permanent/);
    match(gain, /Flame Charge/);
    match(gain, /Combusken · Lv\. 20/);
    doesNotMatch(gain, /Peck|Flamethrower|Lv\. 0/);
    match(html, /Torchic does not learn these by leveling up/);
    match(html, /delaying evolution can skip these opportunities/);
    match(html, /class="my-upcoming"[\s\S]*?Peck/);
    match(html, /Tutors and move reminders are excluded/);
    const czech = render(createElement(EvolutionAdvice, { pokemon: torchic, family }), 'cs');
    match(czech, /Naučit před vývojem/);
    match(czech, /Nové útoky za úrovně po vývoji/);
    match(czech, /TM35, pokud tento přístroj máte/);
    match(czech, /při odkladu vývoje můžete tyto možnosti přeskočit/);
});
