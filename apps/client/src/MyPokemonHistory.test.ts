import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import {
    ObservationForm,
    MyPokemonHistory,
    getObservationStages,
    observedStatValues,
    latestObservedComparison,
} from './MyPokemonHistory.js';
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

void test('new stat entries show suggestions beside empty measured fields', () => {
    let saves = 0;
    const html = render({
        onSave: () => {
            saves++;
            return Promise.resolve();
        },
    });
    deepStrictEqual(fieldValues(html), ['', '', '', '', '', '']);
    strictEqual((html.match(/>Estimate: /g) ?? []).length, 6);
    strictEqual((html.match(/aria-describedby=/g) ?? []).length, 6);
    match(html, /last two recorded levels/);
    match(html, /Only values you enter or explicitly copy/);
    strictEqual(saves, 0);
});

void test('missing latest stats stay blank and supported stats receive suggestions only', () => {
    const partial = observations.map((entry) => ({ ...entry, stats: { hp: entry.stats.hp } }));
    const html = render({ observations: partial });
    deepStrictEqual(fieldValues(html), ['', '', '', '', '', '']);
    strictEqual((html.match(/>Estimate: /g) ?? []).length, 1);
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
    match(html, /U polí jsou odhady/);
    match(html, /výslovně zkopírované hodnoty/);
    strictEqual((html.match(/>Odhad: /g) ?? []).length, 6);
    doesNotMatch(html, /Prefilled|Estimate|Check them against/);
});

void test('current nature marks newly recorded stats without applying a second stat multiplier', () => {
    const html = render({ pokemon: { ...pokemon, natureId: 15 } });
    match(html, /data-nature-effect="increased"/);
    match(html, /data-nature-effect="decreased"/);
    deepStrictEqual(fieldValues(html), ['', '', '', '', '', '']);
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
        deepStrictEqual(fieldValues(html), ['43', '', '', '', '', '']);
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
        deepStrictEqual(fieldValues(render()), ['', '', '', '', '', '']);
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
        match(html, /entry belongs to a different form/);
        match(html, /Save to history/);
        doesNotMatch(html, /data-nature-effect|>Estimate<\/small>/);
        deepStrictEqual(getObservationDraft(key), draft);
    } finally {
        clearObservationDraft(key);
    }
});

void test('saving measured stats never implicitly includes prediction values', () => {
    deepStrictEqual(
        observedStatValues({
            speciesId: 1,
            formEpoch: 'stage',
            level: '13',
            recordedAt: '2026-10-17T12:00',
            stats: { hp: '40', speed: '' },
        }),
        { hp: 40 },
    );
});

void test('historical stages are scoped to this Pokémon and preserve repeated species stages', () => {
    const previous = { ...observations[0], speciesId: 2, formEpoch: 'old-stage' };
    const foreign = { ...previous, pokemonId: 'other', formEpoch: 'foreign-stage' };
    const result = getObservationStages(pokemon, [...observations, previous, foreign]);
    deepStrictEqual(result, [
        { speciesId: 1, formEpoch: 'current-form' },
        { speciesId: 2, formEpoch: 'old-stage' },
    ]);
    match(render({ observations: [...observations, previous] }), /value="old-stage"/);
});

void test('a previous family species without recorded stats gets a separate stable historical stage', () => {
    const first = getObservationStages(pokemon, [], [{ speciesId: 1 }, { speciesId: 2 }]);
    const second = getObservationStages(pokemon, [], [{ speciesId: 1 }, { speciesId: 2 }]);
    deepStrictEqual(first, second);
    strictEqual(first.length, 2);
    strictEqual(first[1].speciesId, 2);
    strictEqual(first[1].formEpoch === pokemon.state.formEpoch, false);
});

void test('recent history shows the latest three measurements newest first without estimates', () => {
    const entries = [10, 11, 12, 13].map((level) => ({
        ...observations[0],
        id: `recent-${level}`,
        level,
        recordedAt: `2026-10-17T${level}:00:00.000Z`,
    }));
    const html = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'en' },
            createElement(MyPokemonHistory, {
                pokemon,
                observations: entries,
                family: [],
                recentOnly: true,
                saveObservation: async () => {},
            }),
        ),
    );
    deepStrictEqual(
        [...html.matchAll(/<th scope="row">(\d+)<\/th>/g)].map((entry) => entry[1]),
        ['13', '12', '11'],
    );
    match(html, /Recent observations/);
    doesNotMatch(html, /Show estimates between observations|Table estimates fill gaps/);
});

void test('same-level observations offer explicit copying without filling unknown stats', () => {
    const sameLevel = { ...observations[1], level: 12, stats: { hp: 40, speed: 31 } };
    const html = render({ observations: [sameLevel] });
    match(html, /Use last observed values at this level/);
    deepStrictEqual(fieldValues(html), ['', '', '', '', '', '']);
    match(html, /Save &amp; add another/);
    doesNotMatch(html, /Save &amp; next member/);
});

void test('comparison deltas omit contradictory or missing stats in tied latest observations', () => {
    const first = { ...observations[1], stats: { hp: 40, speed: 30, attack: 20 } };
    const tied = { ...first, id: 'tied', stats: { hp: 40, speed: 31 } };
    deepStrictEqual(latestObservedComparison([observations[0], first, tied]), { hp: 40 });
    deepStrictEqual(latestObservedComparison([]), {});
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
