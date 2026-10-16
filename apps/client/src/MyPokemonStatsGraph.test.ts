import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { OwnedPokemon, StatObservation } from '@pokemon-emerald-ex-dex/shared';

import { MyPokemonStatsGraph } from './MyPokemonStatsGraph.js';
import { LanguageProvider } from './language.js';

const pokemon: OwnedPokemon = {
    id: 'owned',
    playthroughId: 'run',
    nickname: '',
    state: { speciesId: 1, level: 20, moves: null, formEpoch: 'current-form' },
    deleted: false,
    createdAt: '2026-10-13T10:00:00.000Z',
};

function observation(
    id: string,
    level: number,
    overrides: Partial<StatObservation> = {},
): StatObservation {
    return {
        id,
        pokemonId: pokemon.id,
        speciesId: pokemon.state.speciesId,
        level,
        formEpoch: pokemon.state.formEpoch,
        recordedAt: '2026-10-13T12:00:00.000Z',
        stats: { hp: level * 3 },
        deleted: false,
        ...overrides,
    };
}

function render(
    observations: readonly StatObservation[],
    language: 'en' | 'cs' = 'en',
    natureId?: number | null,
): string {
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: language },
            createElement(MyPokemonStatsGraph, { pokemon, observations, family: [], natureId }),
        ),
    );
}

function plot(markup: string): string {
    return markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>') + 6);
}

void test('progression renders observed points and lines without changing measurement order', () => {
    const observations = Object.freeze([
        observation('later', 20, { stats: { hp: 60, attack: 40 } }),
        observation('earlier', 10, { stats: { hp: 30, attack: 20 } }),
    ]);
    const before = structuredClone(observations);
    const html = render(observations);
    const svg = plot(html);
    strictEqual((svg.match(/<circle /g) ?? []).length, 4);
    strictEqual((svg.match(/<polyline /g) ?? []).length, 2);
    match(svg, /HP: 30 · Level 10 · #1/);
    match(svg, /Attack: 40 · Level 20 · #1/);
    match(svg, />Level<\/text>/);
    match(svg, />Stat value<\/text>/);
    match(html, /<div class="sr-only"><table>/);
    strictEqual((html.match(/<li data-stat=/g) ?? []).length, 6);
    match(html, /<span>HP<\/span><strong>60<\/strong>/);
    match(html, /<span>Attack<\/span><strong>40<\/strong>/);
    match(html, /<span>Defense<\/span><strong>—<\/strong>/);
    deepStrictEqual(observations, before);
});

void test('progression ignores deleted and other individual records and explains empty history', () => {
    const irrelevant = [
        observation('deleted', 10, { deleted: true }),
        observation('another', 15, { pokemonId: 'another' }),
    ];
    const empty = render(irrelevant);
    match(empty, /No battle stats recorded/);
    doesNotMatch(empty, /<svg/);

    const html = plot(render([...irrelevant, observation('current', 20)]));
    strictEqual((html.match(/<circle /g) ?? []).length, 1);
    doesNotMatch(html, /Level 10|Level 15/);
});

void test('progression separates species and continuous form periods including a return to a species', () => {
    const html = plot(
        render([
            observation('first-a', 5, { formEpoch: 'first' }),
            observation('first-b', 6, { formEpoch: 'first' }),
            observation('second-a', 7, { speciesId: 2, formEpoch: 'second' }),
            observation('second-b', 8, { speciesId: 2, formEpoch: 'second' }),
            observation('return-a', 9),
            observation('return-b', 10),
        ]),
    );
    strictEqual((html.match(/<polyline /g) ?? []).length, 3);
    strictEqual((html.match(/<circle /g) ?? []).length, 6);
    match(html, /data-species-id="1" data-form-epoch="first"/);
    match(html, /data-species-id="2" data-form-epoch="second"/);
    match(html, /data-species-id="1" data-form-epoch="current-form"/);
    for (const points of html.matchAll(/<polyline points="([^"]+)"/g)) {
        strictEqual(points[1].split(' ').length, 2);
    }
});

void test('contradictory same-level stats retain all measured points and break adjacent lines', () => {
    const html = plot(
        render([
            observation('a', 5),
            observation('b', 6),
            observation('conflict-a', 7),
            observation('conflict-b', 7, { stats: { hp: 90 } }),
            observation('c', 8),
            observation('d', 9),
        ]),
    );
    strictEqual((html.match(/<circle /g) ?? []).length, 6);
    strictEqual((html.match(/<polyline /g) ?? []).length, 2);
    match(html, /HP: 21 · Level 7/);
    match(html, /HP: 90 · Level 7/);
    for (const points of html.matchAll(/<polyline points="([^"]+)"/g)) {
        strictEqual(points[1].split(' ').length, 2);
    }
});

void test('partial measurements omit unknown stat points and break lines at unknown levels', () => {
    const html = plot(
        render([
            observation('a', 5),
            observation('b', 6, { stats: { attack: 20 } }),
            observation('c', 7),
        ]),
    );
    strictEqual((html.match(/<circle /g) ?? []).length, 3);
    doesNotMatch(html, /<polyline /);
    doesNotMatch(html, /HP: 0|Attack: 0|HP: 18/);
});

void test('a single recorded level has finite coordinates and an accessible localized description', () => {
    const html = render([observation('one', 20, { stats: { attack: 40 } })], 'cs');
    const svg = plot(html);
    strictEqual((svg.match(/<circle /g) ?? []).length, 1);
    doesNotMatch(svg, /NaN|Infinity|<polyline /);
    match(svg, /role="group" aria-labelledby="[^"]+-title" aria-describedby="[^"]+-description"/);
    match(svg, /Průběh statistik podle úrovně/);
    match(svg, /Útok: 40 · Úroveň 20/);
    match(svg, />Hodnota statistiky<\/text>/);
    match(html, /Zaznamenaný průběh statistik/);
});

void test('each recorded point is keyboard reachable and names its exact observation', () => {
    const svg = plot(
        render([
            observation('a', 10, { stats: { hp: 30, attack: 20 } }),
            observation('b', 10, { stats: { hp: 31 } }),
        ]),
    );
    strictEqual((svg.match(/role="button" tabindex="0"/g) ?? []).length, 3);
    match(svg, /aria-label="HP: 30 · Level 10 · #1 · [^"]+"/);
    match(svg, /aria-label="HP: 31 · Level 10 · #1 · [^"]+"/);
    match(svg, /aria-label="Attack: 20 · Level 10 · #1 · [^"]+"/);
    doesNotMatch(svg, /data-active|role="tooltip"/);
});

void test('nature colors current stat labels and values without changing measured numbers or chart series', () => {
    const entries = [observation('current', 20, { stats: { attack: 40, spAttack: 80, hp: 60 } })];
    const html = render(entries, 'en', 15);
    match(
        html,
        /data-stat="attack">[\s\S]*?data-nature-effect="decreased"[\s\S]*?<strong data-nature-effect="decreased">40<\/strong>/,
    );
    match(
        html,
        /data-stat="spAttack">[\s\S]*?data-nature-effect="increased"[\s\S]*?<strong data-nature-effect="increased">80<\/strong>/,
    );
    strictEqual(plot(html), plot(render(entries)));
    doesNotMatch(render(entries, 'en', 0), /data-nature-effect/);
});
