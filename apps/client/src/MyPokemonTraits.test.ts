import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Ability, OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider, type Language } from './language.js';
import { MyPokemonTraits } from './MyPokemonTraits.js';
import { NatureStat } from './NatureStat.js';
import { getAbilityChoices, getSelectedAbility } from './pokemonTraits.js';

const ability = (abilityId: number, name: string): Ability => ({
    abilityId,
    name,
    description: `${name} description.`,
    descriptionCs: `Popis: ${name}.`,
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
});
const species: SpeciesDetails = {
    speciesId: 255,
    name: 'Torchic',
    types: ['Fire'],
    typeIds: [10],
    typeIconFiles: [null],
    stats: { hp: 45, attack: 60, defense: 40, spAttack: 70, spDefense: 50, speed: 45 },
    baseStatTotal: 310,
    sprites: null,
    abilities: [
        { slot: 1, kind: 'normal', ability: ability(66, 'Blaze') },
        { slot: 2, kind: 'normal', ability: null },
        { slot: 3, kind: 'hidden', ability: ability(3, 'Speed Boost') },
    ],
    learnset: [],
    machines: [],
    evolutionLinks: [],
    evolutionFamily: [],
    evolutionBaseSpeciesId: 255,
    formInfo: null,
    forms: null,
    formChanges: [],
};
const owned: OwnedPokemon = {
    id: 'torchic',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 255, level: 10, moves: [], formEpoch: 'first' },
    deleted: false,
    createdAt: '2026-10-16T10:00:00.000Z',
};
function render(child: ReactNode, language: Language = 'en'): string {
    return renderToStaticMarkup(
        createElement(LanguageProvider, { initialLanguage: language }, child),
    );
}
function traits(
    overrides: Partial<Parameters<typeof MyPokemonTraits>[0]> = {},
    language: Language = 'en',
): string {
    return render(
        createElement(MyPokemonTraits, {
            pokemon: owned,
            species,
            onUpdate: async () => {},
            ...overrides,
        }),
        language,
    );
}

void test('old collection entries offer all 25 natures plus unknown and do not infer a hidden ability', () => {
    const before = structuredClone(owned);
    const html = traits();
    const natureSelect = html.match(/<select[^>]*>[\s\S]*?<\/select>/)?.[0] ?? '';
    strictEqual((natureSelect.match(/<option /g) ?? []).length, 26);
    match(natureSelect, /value="" selected="">Unknown/);
    match(html, /Speed Boost · Hidden/);
    match(html, /Select the ability shown in game/);
    doesNotMatch(html, /value="3" selected/);
    deepStrictEqual(owned, before);
});

void test('saved nature highlights its affected stats while neutral and HP values keep their original markup', () => {
    const adamant = traits({ pokemon: { ...owned, natureId: 3 } });
    match(adamant, /value="3" selected="">Adamant/);
    match(adamant, /data-nature-effect="increased"[^>]*>Attack \+10 %/);
    match(adamant, /data-nature-effect="decreased"[^>]*>Sp\. Attack −10 %/);
    match(adamant, /Recorded stats already include nature/);
    const increased = render(createElement(NatureStat, { stat: 'attack', natureId: 3 }, '42'));
    match(increased, /Nature increases this stat by 10%/);
    match(increased, /aria-hidden="true">↑/);
    match(increased, />42</);
    strictEqual(render(createElement(NatureStat, { stat: 'hp', natureId: 3 }, '42')), '42');
    strictEqual(render(createElement(NatureStat, { stat: 'attack', natureId: 0 }, '42')), '42');
    strictEqual(render(createElement(NatureStat, { stat: 'attack' }, '42')), '42');
});

void test('nature and ability conflict gates remain independent and state conflicts pause both', () => {
    const onlyNature = traits({ natureConflict: true }).match(/<select[^>]*>/g) ?? [];
    strictEqual(onlyNature.length, 2);
    match(onlyNature[0] ?? '', /disabled=""/);
    doesNotMatch(onlyNature[1] ?? '', /disabled=/);
    const onlyAbility = traits({ abilityConflict: true }).match(/<select[^>]*>/g) ?? [];
    strictEqual(onlyAbility.length, 2);
    doesNotMatch(onlyAbility[0] ?? '', /disabled=/);
    match(onlyAbility[1] ?? '', /disabled=""/);
    const state = traits({ stateConflict: true }).match(/<select[^>]*>/g) ?? [];
    strictEqual(state.filter((select) => select.includes('disabled=""')).length, 2);
});

void test('ability choices deduplicate IDs and stale form selections never become active', () => {
    const duplicateSpecies: SpeciesDetails = {
        ...species,
        abilities: [
            { slot: 1, kind: 'normal', ability: ability(66, 'Blaze') },
            { slot: 2, kind: 'normal', ability: ability(66, 'Blaze') },
            { slot: 3, kind: 'hidden', ability: ability(66, 'Blaze') },
        ],
    };
    const choices = getAbilityChoices(duplicateSpecies);
    strictEqual(choices.length, 1);
    strictEqual(choices[0].hidden, false);
    const staticAbility = traits({ species: duplicateSpecies });
    strictEqual((staticAbility.match(/<select/g) ?? []).length, 1);
    match(staticAbility, /Only ability available for this form/);
    doesNotMatch(staticAbility, /Blaze · Hidden/);
    const selected: OwnedPokemon = { ...owned, ability: { speciesId: 255, abilityId: 3 } };
    strictEqual(getSelectedAbility(selected, species)?.ability.name, 'Speed Boost');
    const stale = { ...selected, ability: { speciesId: 256, abilityId: 3 } };
    strictEqual(getSelectedAbility(stale, species), null);
    strictEqual(
        getSelectedAbility({ ...selected, ability: { speciesId: 255, abilityId: 999 } }, species),
        null,
    );
    strictEqual(getSelectedAbility(owned, species), null);
    match(traits({ pokemon: stale }), /Select the ability for this form again/);
    match(traits({ pokemon: selected }), /value="3" selected="">Speed Boost · Hidden/);
});

void test('Czech labels and missing species data stay actionable without invented choices', () => {
    const czech = traits(
        { pokemon: { ...owned, natureId: 3, ability: { speciesId: 255, abilityId: 3 } } },
        'cs',
    );
    match(czech, /Povaha a schopnost/);
    match(czech, /Speed Boost · Skrytá/);
    match(czech, /Popis: Speed Boost/);
    match(czech, /Povaha zvyšuje tuto statistiku o 10 %/);
    const missing = traits({ species: undefined });
    match(missing, /Ability data is unavailable/);
    strictEqual((missing.match(/<select/g) ?? []).length, 1);
});
