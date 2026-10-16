import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import { ObservationForm } from './MyPokemonHistory.js';

const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 1, level: 12, moves: null, formEpoch: 'current-form' },
    deleted: false,
    createdAt: '2026-10-13T10:00:00.000Z',
};
const observations: StatObservation[] = [10, 11].map((level) => ({
    id: `observation-${level}`,
    pokemonId: pokemon.id,
    speciesId: pokemon.state.speciesId,
    formEpoch: pokemon.state.formEpoch,
    level,
    recordedAt: `2026-10-13T${level}:00:00.000Z`,
    stats: {
        hp: level * 3,
        attack: level * 2,
        defense: level * 2,
        spAttack: level * 2,
        spDefense: level * 2,
        speed: level * 2,
    },
    deleted: false,
}));

function render(
    options: {
        pokemon?: OwnedPokemon;
        observations?: readonly StatObservation[];
        observation?: StatObservation;
        predictionsEnabled?: boolean;
        language?: 'en' | 'cs';
        onSave?: (value: StatObservation) => Promise<void>;
    } = {},
): string {
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: options.language ?? 'en' },
            createElement(ObservationForm, {
                pokemon: options.pokemon ?? pokemon,
                observations: options.observations ?? observations,
                observation: options.observation,
                predictionsEnabled: options.predictionsEnabled,
                onSave: options.onSave ?? (async () => {}),
                onCancel: () => {},
            }),
        ),
    );
}

function fieldValues(html: string): string[] {
    return [...html.matchAll(/<input\b(?=[^>]*max="65535")[^>]*value="([^"]*)"[^>]*>/g)].map(
        (entry) => entry[1],
    );
}

void test('new stat entries prefill estimates for the raised level without saving them', () => {
    let saves = 0;
    const html = render({
        onSave: () => {
            saves++;
            return Promise.resolve();
        },
    });
    deepStrictEqual(fieldValues(html), ['36', '24', '24', '24', '24', '24']);
    strictEqual((html.match(/>Estimate<\/small>/g) ?? []).length, 6);
    strictEqual((html.match(/aria-describedby=/g) ?? []).length, 6);
    match(html, /last two recorded levels in this form/);
    match(html, /Check them against the game before saving/);
    strictEqual(saves, 0);
});

void test('missing latest stats remain blank while supported stats get prefilled', () => {
    const partial = observations.map((entry) => ({ ...entry, stats: { hp: entry.stats.hp } }));
    const html = render({ observations: partial });
    deepStrictEqual(fieldValues(html), ['36', '', '', '', '', '']);
    strictEqual((html.match(/>Estimate<\/small>/g) ?? []).length, 1);
});

void test('short history, new forms and unresolved conflicts leave new entries blank', () => {
    for (const options of [
        { observations: observations.slice(1) },
        { pokemon: { ...pokemon, state: { ...pokemon.state, formEpoch: 'new-form' } } },
        { predictionsEnabled: false },
    ]) {
        const html = render(options);
        deepStrictEqual(fieldValues(html), ['', '', '', '', '', '']);
        doesNotMatch(html, /Prefilled values|>Estimate<\/small>/);
    }
});

void test('corrections preserve the recorded fields and never fill previously unknown values', () => {
    const html = render({ observation: { ...observations[0], stats: { hp: 31 } } });
    deepStrictEqual(fieldValues(html), ['31', '', '', '', '', '']);
    match(html, /Correct observation/);
    doesNotMatch(html, /Prefilled values|>Estimate<\/small>/);
});

void test('prediction guidance and field labels follow the Czech interface language', () => {
    const html = render({ language: 'cs' });
    match(html, /Předvyplněné hodnoty jsou odhady/);
    match(html, /Před uložením je ověřte ve hře/);
    strictEqual((html.match(/>Odhad<\/small>/g) ?? []).length, 6);
    doesNotMatch(html, /Prefilled|Estimate|Check them against/);
});

void test('current nature marks newly recorded stats without applying a second stat multiplier', () => {
    const html = render({ pokemon: { ...pokemon, natureId: 15 } });
    match(html, /data-nature-effect="increased"/);
    match(html, /data-nature-effect="decreased"/);
    deepStrictEqual(fieldValues(html), ['36', '24', '24', '24', '24', '24']);
    doesNotMatch(
        render({ pokemon: { ...pokemon, natureId: 15 }, observation: observations[0] }),
        /data-nature-effect/,
    );
    doesNotMatch(render({ pokemon: { ...pokemon, natureId: 0 } }), /data-nature-effect/);
});
