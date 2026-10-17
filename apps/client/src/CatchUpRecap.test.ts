import { doesNotMatch, match, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

import { loadCollectionSpeciesFixture } from '../../../packages/shared/test/fixtures/collectionSpecies.js';
import { CatchUpRecap } from './CatchUpRecap.js';
import { LanguageProvider, type Language } from './language.js';
import { clearLevelReview, rememberLevelReview } from './levelingSession.js';
import { getMoveChoice } from './moveChoices.js';

const fixtures = loadCollectionSpeciesFixture([21, 22, 133]);
const spearow: SpeciesDetails = {
    ...fixtures[21],
    learnset: [],
    evolutionLinks: fixtures[21].evolutionLinks.map((edge) => ({
        ...edge,
        toSprite: 'front/22.png',
    })),
};
const owned: OwnedPokemon = {
    id: 'owned-spearow',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 21, level: 20, moves: null, formEpoch: 'spearow-stage' },
    deleted: false,
    createdAt: '2026-10-17T10:00:00.000Z',
};

function render(
    overrides: Partial<ComponentProps<typeof CatchUpRecap>> = {},
    language: Language = 'en',
): string {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(
                LanguageProvider,
                { initialLanguage: language },
                createElement(CatchUpRecap, {
                    pokemon: owned,
                    details: spearow,
                    datasetId: 'emerald-ex-1.0.4',
                    oldLevel: 19,
                    newLevel: 20,
                    moves: null,
                    onSave: async () => {},
                    saveObservation: async () => {},
                    onClose: () => {},
                    ...overrides,
                }),
            ),
        ),
    );
}

function evolutionChoices(html: string): string[] {
    return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
        .map(([button]) => button)
        .filter((button) => button.includes('aria-pressed='));
}

void test('a Fearow evolution opportunity has its target sprite and an explicit unselected action', () => {
    const html = render();
    match(html, /src="\/api\/sprites\/emerald-ex-1\.0\.4\/front\/22\.png"/);
    match(html, /alt="Fearow standard front sprite"/);
    const choices = evolutionChoices(html);
    strictEqual(choices.length, 1);
    match(choices[0], /Record evolution to Fearow/);
    match(choices[0], /aria-pressed="false"/);
    doesNotMatch(html, /Confirm evolution/);
    match(html, /Reach level 20/);
    match(html, /Level requirement reached/);
    doesNotMatch(html, /use “Record evolution \/ form”/);
});

void test('an evolution with no sprite keeps an accessible placeholder and a selectable target', () => {
    const html = render({
        details: {
            ...spearow,
            evolutionLinks: spearow.evolutionLinks.map((edge) => ({ ...edge, toSprite: null })),
        },
    });
    match(
        html,
        /class="sprite-placeholder" role="img" aria-label="Fearow standard front sprite unavailable"/,
    );
    match(evolutionChoices(html)[0], /Record evolution to Fearow/);
    doesNotMatch(html, /src="null"/);
});

void test('Czech evolution recap translates its choice and retains the Fearow species name', () => {
    const html = render({}, 'cs');
    const choices = evolutionChoices(html);
    strictEqual(choices.length, 1);
    match(choices[0], /Zapsat vývoj na Fearow/);
    match(choices[0], /aria-pressed="false"/);
    match(html, /Dosáhnout úrovně 20/);
    match(html, /Požadované úrovně dosaženo/);
    match(html, /Přední obrázek Fearow/);
    doesNotMatch(
        html,
        /Evolved|Record evolution|Save changes|Level requirement reached|Reach level/,
    );
});

void test('branched evolution opportunities each have an unselected action without choosing automatically', () => {
    const eevee = { ...fixtures[133], learnset: [] };
    const html = render({
        pokemon: { ...owned, state: { ...owned.state, speciesId: 133 } },
        details: eevee,
    });
    const choices = evolutionChoices(html);
    const targets = eevee.evolutionLinks.filter((edge) => !edge.internalOnly);
    ok(targets.length > 1);
    strictEqual(choices.length, targets.length);
    for (const target of targets) {
        ok(choices.some((choice) => choice.includes(target.toName)));
    }
    doesNotMatch(html, /aria-pressed="true"|Confirm evolution/);
    match(html, /Other conditions need checking/);
});

void test('an untouched evolution-only recap writes nothing and offers no confirmation before a choice', () => {
    let saves = 0;
    let observations = 0;
    let closes = 0;
    const html = render({
        onSave: () => {
            saves++;
            return Promise.resolve();
        },
        saveObservation: () => {
            observations++;
            return Promise.resolve();
        },
        onClose: () => {
            closes++;
        },
    });
    doesNotMatch(html, /Confirm evolution|Save changes/);
    match(html, /Done reviewing/);
    match(html, /Nothing is learned or evolved automatically/);
    strictEqual(saves, 0);
    strictEqual(observations, 0);
    strictEqual(closes, 0);
});

void test('move and evolution choices stay separate and leave unknown moves untouched', () => {
    const move = fixtures[21].learnset.find((entry) => entry.level > 1 && entry.level <= 20);
    ok(move);
    const html = render({
        details: { ...spearow, learnset: [move] },
        oldLevel: 1,
        moves: null,
    });
    match(html, /Did you learn any of these/);
    match(html, /Record evolution to Fearow/);
    match(html, new RegExp(`aria-label="Learn or replace ${move.name}"`));
    doesNotMatch(html, /aria-label="Remove |Confirm evolution|Save changes/);
    strictEqual(getMoveChoice(owned.id), undefined);
});

void test('a restored branch choice selects only that branch and still requires explicit confirmation', () => {
    const eevee = { ...fixtures[133], learnset: [] };
    const targets = eevee.evolutionLinks.filter((edge) => !edge.internalOnly);
    const selected = targets[1];
    ok(selected);
    const pokemon = {
        ...owned,
        id: 'restored-eevee-choice',
        state: { ...owned.state, speciesId: 133 },
    };
    let saves = 0;
    rememberLevelReview(pokemon.id, {
        speciesId: 133,
        formEpoch: pokemon.state.formEpoch,
        oldLevel: 19,
        newLevel: 20,
        evolutionSpeciesId: selected.toSpeciesId,
    });
    try {
        const html = render({
            pokemon,
            details: eevee,
            onSave: () => {
                saves++;
                return Promise.resolve();
            },
        });
        const choices = evolutionChoices(html);
        const pressed = choices.filter((choice) => choice.includes('aria-pressed="true"'));
        strictEqual(pressed.length, 1);
        ok(pressed[0].includes(`Record evolution to ${selected.toName}`));
        match(html, /Confirm evolution/);
        match(html, /Earlier stats keep their original form; current moves stay unchanged/);
        strictEqual(saves, 0);
        const czech = render({ pokemon, details: eevee }, 'cs');
        match(czech, /Potvrdit vývoj/);
        match(
            czech,
            /Starší statistiky zůstanou u původní formy; aktuální útoky zůstanou zachované/,
        );
        doesNotMatch(czech, /Confirm evolution|Record evolution to/);
    } finally {
        clearLevelReview(pokemon.id);
    }
});

void test('an already recorded move is disabled and never announced as a removal action', () => {
    const move = fixtures[21].learnset.find((entry) => entry.level > 1 && entry.level <= 20);
    ok(move);
    const options = { details: { ...spearow, learnset: [move] }, oldLevel: 1, moves: [move] };
    const html = render(options);
    match(
        html,
        new RegExp(`<button[^>]*aria-label="${move.name} already recorded"[^>]*disabled=""`),
    );
    doesNotMatch(html, /aria-label="Remove /);
    const czech = render(options, 'cs');
    match(czech, new RegExp(`aria-label="Útok ${move.name} už je zaznamenán"`));
    doesNotMatch(czech, /aria-label="Odebrat /);
});
