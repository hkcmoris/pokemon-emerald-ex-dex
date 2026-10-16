import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
    Move,
    OwnedPokemon,
    SpeciesDetails,
    StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { MyPokemonCard } from './MyPokemonCard.js';
import { MyPokemonMove } from './MyPokemonMove.js';
import { MovePowerProvider } from './MovePower.js';
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
const viceGrip: Move = {
    ...waterGun,
    moveId: 11,
    name: 'Vice Grip',
    typeId: 0,
    type: 'Normal',
    categoryId: 0,
    category: 'Physical',
    power: 55,
};
const waterSport: Move = {
    ...waterGun,
    moveId: 346,
    name: 'Water Sport',
    categoryId: 2,
    category: 'Status',
    power: 0,
};
const bubbleBeam: Move = { ...waterGun, moveId: 61, name: 'Bubble Beam', power: 65 };
const species: SpeciesDetails = {
    speciesId: 692,
    name: 'Clauncher',
    types: ['Water'],
    typeIds: [11],
    typeIconFiles: [null],
    stats: { hp: 50, attack: 53, defense: 62, spAttack: 58, spDefense: 63, speed: 44 },
    baseStatTotal: 330,
    sprites: null,
    abilities: [],
    learnset: [waterGun, viceGrip, waterSport, bubbleBeam].map((move, index) => ({
        ...move,
        level: index === 3 ? 20 : 1,
        entryOrder: index,
    })),
    machines: [],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 692,
    formInfo: null,
    forms: null,
    formChanges: [],
};
const owned: OwnedPokemon = {
    id: 'pinchy',
    playthroughId: 'run',
    nickname: 'Pinchy',
    state: {
        speciesId: species.speciesId,
        level: 17,
        moves: [waterGun, viceGrip, waterSport],
        formEpoch: 'first-form',
    },
    deleted: false,
    createdAt: '2026-10-12T12:00:00.000Z',
};
const observation: StatObservation = {
    id: 'measured',
    pokemonId: owned.id,
    speciesId: species.speciesId,
    level: 17,
    formEpoch: 'first-form',
    recordedAt: '2026-10-16T12:00:00.000Z',
    stats: { attack: 20, spAttack: 40 },
    deleted: false,
};

function render(content: ReactNode, language: 'en' | 'cs' = 'en'): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(['collection-species', species.speciesId], species);
    client.setQueryData(['collection-family', species.speciesId], [species]);
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(LanguageProvider, { initialLanguage: language }, content),
        ),
    );
}

function card(
    observations: readonly StatObservation[],
    pokemon: OwnedPokemon = owned,
    conflicts: { stateConflict?: boolean; observationConflict?: boolean } = {},
) {
    return createElement(MyPokemonCard, {
        pokemon,
        observations,
        partyIndex: 0,
        partySize: 1,
        stateConflict: false,
        ...conflicts,
        onUpdate: async () => {},
        onParty: async () => {},
        onMove: async () => {},
        saveObservation: async () => {},
        onRemove: async () => {},
    });
}

function effectivePowers(html: string): string[] {
    return [...html.matchAll(/aria-label="Effective power: ([^"]+)"/g)].map((entry) => entry[1]);
}

void test('owned moves use recorded Attack or Sp. Atk and STAB; upcoming moves use the same current stats', () => {
    const html = render(card([observation]));
    deepStrictEqual(effectivePowers(html), ['2,400', '1,100', '—', '3,900']);
    match(html, /40 base power × 40 Sp\. Atk × 1\.5 STAB/);
    match(html, /55 base power × 20 Attack × 1 STAB/);
    match(html, /Uses current recorded stats and types, including for future moves/);
    match(html, /Comparison score, not HP damage/);
    match(html, /<span>Power<\/span><strong>40<\/strong>/);
    match(html, /<span>Power<\/span><strong>55<\/strong>/);
    match(html, /<span>Power<\/span><strong>65<\/strong>/);
    match(html, /<span>Power<\/span><strong>—<\/strong>/);
    match(html, /This move has no ordinary fixed-power damage to compare/);
});

void test('missing, deleted, stale-level and previous-form observations never substitute species base stats', () => {
    for (const observations of [
        [],
        [{ ...observation, deleted: true }],
        [{ ...observation, level: 16 }],
        [{ ...observation, formEpoch: 'previous-form' }],
        [{ ...observation, speciesId: 693 }],
        [{ ...observation, pokemonId: 'another-pokemon' }],
    ]) {
        const html = render(card(observations));
        deepStrictEqual(effectivePowers(html), ['—', '—', '—', '—']);
        match(html, /Record the required battle stat at the current level and form/);
    }
});

void test('missing current offensive stats do not borrow older observations and tied conflicts suppress only the conflicting stat', () => {
    const older = { ...observation, id: 'older', recordedAt: '2026-10-15T12:00:00.000Z' };
    const partial = { ...observation, stats: { attack: 20 } };
    deepStrictEqual(effectivePowers(render(card([older, partial]))), ['—', '1,100', '—', '—']);
    const conflicting = { ...observation, id: 'conflicting', stats: { attack: 30, spAttack: 40 } };
    deepStrictEqual(effectivePowers(render(card([observation, conflicting]))), [
        '2,400',
        '—',
        '—',
        '3,900',
    ]);
});

void test('unresolved owned-state or observation conflicts hide calculated powers', () => {
    deepStrictEqual(
        effectivePowers(render(card([observation], owned, { observationConflict: true }))),
        ['—', '—', '—', '—'],
    );
    deepStrictEqual(effectivePowers(render(card([observation], owned, { stateConflict: true }))), [
        '—',
        '—',
        '—',
    ]);
});

void test('two owned Pokemon with the same species keep their own measured power values', () => {
    const other = { ...owned, id: 'other', nickname: 'Other' };
    const otherObservation = {
        ...observation,
        id: 'other-measurement',
        pokemonId: other.id,
        stats: { attack: 30, spAttack: 50 },
    };
    const observations = [observation, otherObservation];
    const html = render(createElement('div', null, card(observations), card(observations, other)));
    deepStrictEqual(effectivePowers(html), [
        '2,400',
        '1,100',
        '—',
        '3,900',
        '3,000',
        '1,650',
        '—',
        '4,875',
    ]);
});

void test('the effective-power number has a localized accessible label and native explanation popover', () => {
    const english = render(card([observation]));
    const popoverTarget = english.match(
        /<button type="button" class="my-move-effective-power" aria-label="Effective power: 2,400" popoverTarget="([^"]+)"/,
    )?.[1];
    strictEqual(typeof popoverTarget, 'string');
    match(english, new RegExp(`<span id="${popoverTarget}" popover="auto"`));
    match(english, /title="Effective power: 2,400\. 40 base power/);
    const czech = render(card([observation], owned), 'cs');
    match(czech, /aria-label="Efektivní síla: 2\u00a0400"/);
    match(czech, /40 základní síla × 40 Sp\. útok × 1\.5 STAB/);
    match(czech, /Srovnávací skóre, nikoli poškození HP/);
    match(czech, /<span>Síla<\/span><strong>40<\/strong>/);
});

void test('moves without an owned context retain base power without an individual comparison score', () => {
    const move = createElement(MyPokemonMove, {
        move: waterGun,
        reference: waterGun,
        showStats: true,
    });
    const standalone = render(move);
    doesNotMatch(standalone, /my-move-effective-power/);
    match(standalone, /<span>Power<\/span><strong>40<\/strong>/);
    const missingTypes = render(
        createElement(MovePowerProvider, { stats: observation.stats, children: move }),
    );
    deepStrictEqual(effectivePowers(missingTypes), ['—']);
});
