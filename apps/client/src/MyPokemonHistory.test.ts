import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import { ObservationForm } from './MyPokemonHistory.js';
import {
    clearObservationDraft,
    getObservationDraft,
    hasObservationDraft,
    observationDraftKey,
    runObservationDraftSave,
    setObservationDraft,
} from './observationDrafts.js';

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
        draftKey?: string;
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
                draftKey: options.draftKey,
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

void test('unfinished entries survive remounts without copying values to another Pokémon or form', () => {
    const key = observationDraftKey(pokemon);
    const draft = {
        speciesId: pokemon.state.speciesId,
        formEpoch: pokemon.state.formEpoch,
        level: '14',
        recordedAt: '2026-10-17T12:30',
        stats: { hp: '43', attack: '' },
    };
    setObservationDraft(key, pokemon.id, draft);
    try {
        const html = render();
        match(html, /value="14"/);
        match(html, /value="2026-10-17T12:30"/);
        deepStrictEqual(fieldValues(html), ['43', '', '28', '28', '28', '28']);
        strictEqual(hasObservationDraft(pokemon.id), true);
        deepStrictEqual(getObservationDraft(key), draft);
        const other = { ...pokemon, id: 'another' };
        strictEqual(hasObservationDraft(other.id), false);
        deepStrictEqual(fieldValues(render({ pokemon: other, observations: [] })), [
            '',
            '',
            '',
            '',
            '',
            '',
        ]);
        const evolved = { ...pokemon, state: { ...pokemon.state, formEpoch: 'evolved' } };
        deepStrictEqual(fieldValues(render({ pokemon: evolved })), ['', '', '', '', '', '']);
    } finally {
        clearObservationDraft(key);
    }
    strictEqual(hasObservationDraft(pokemon.id), false);
});

void test('correction drafts remain separate from a new observation and its estimates', () => {
    const correction = observations[0];
    const key = observationDraftKey(pokemon, correction);
    setObservationDraft(key, pokemon.id, {
        speciesId: correction.speciesId,
        formEpoch: correction.formEpoch,
        observationId: correction.id,
        level: '10',
        recordedAt: '2026-10-13T10:00',
        stats: { hp: '32', speed: '' },
    });
    try {
        deepStrictEqual(fieldValues(render({ observation: correction })), [
            '32',
            '',
            '',
            '',
            '',
            '',
        ]);
        deepStrictEqual(fieldValues(render()), ['36', '24', '24', '24', '24', '24']);
    } finally {
        clearObservationDraft(key);
    }
});

void test('an earlier-form draft can be resumed as history after evolution without current-form predictions', () => {
    const key = observationDraftKey(pokemon);
    const draft = {
        speciesId: pokemon.state.speciesId,
        formEpoch: pokemon.state.formEpoch,
        level: '14',
        recordedAt: '2026-10-17T12:30',
        stats: { hp: '43' },
    };
    setObservationDraft(key, pokemon.id, draft);
    try {
        const evolved = {
            ...pokemon,
            natureId: 15,
            state: { ...pokemon.state, speciesId: 2, formEpoch: 'evolved' },
        };
        const html = render({ pokemon: evolved, draftKey: key });
        deepStrictEqual(fieldValues(html), ['43', '', '', '', '', '']);
        match(html, /unfinished entry belongs to an earlier form/);
        match(html, /Save to history/);
        doesNotMatch(html, /data-nature-effect|>Estimate<\/small>/);
        deepStrictEqual(getObservationDraft(key), draft);
    } finally {
        clearObservationDraft(key);
    }
});

void test('a remounted entry form keeps inputs and save/cancel disabled while its prior save is pending', async () => {
    const key = observationDraftKey(pokemon);
    setObservationDraft(key, pokemon.id, {
        speciesId: pokemon.state.speciesId,
        formEpoch: pokemon.state.formEpoch,
        level: '14',
        recordedAt: '2026-10-17T12:30',
        stats: { hp: '43' },
    });
    let finish!: () => void;
    const saving = runObservationDraftSave(
        key,
        () =>
            new Promise<void>((resolve) => {
                finish = resolve;
            }),
    );
    try {
        const html = render();
        const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((entry) => entry[0]);
        strictEqual(inputs.length, 8);
        for (const input of inputs) match(input, /disabled=""/);
        match(html, /<button[^>]*disabled=""[^>]*>Save observation<\/button>/);
        match(html, /<button[^>]*disabled=""[^>]*>Cancel<\/button>/);
    } finally {
        finish();
        await saving;
    }
});
