import { doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Pokemon, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import { MyPokemonTypeDefenses } from './MyPokemonTypeDefenses.js';

const types = [
    { typeId: 11, name: 'Water', iconFile: null },
    { typeId: 4, name: 'Ground', iconFile: null },
    { typeId: 12, name: 'Grass', iconFile: null },
    { typeId: 13, name: 'Electric', iconFile: null },
];
const chart: TypeEffectivenessChart = {
    types,
    matchups: types.flatMap((attacker) =>
        types.map((defender) => ({
            attackingTypeId: attacker.typeId,
            defendingTypeId: defender.typeId,
            multiplier:
                attacker.name === 'Grass' && ['Water', 'Ground'].includes(defender.name)
                    ? 2
                    : attacker.name === 'Electric' && defender.name === 'Ground'
                      ? 0
                      : attacker.name === 'Electric' && defender.name === 'Water'
                        ? 2
                        : attacker.name === 'Water' && defender.name === 'Water'
                          ? 0.5
                          : attacker.name === 'Water' && defender.name === 'Ground'
                            ? 2
                            : 1,
        })),
    ),
};
const species: Pokemon = {
    speciesId: 260,
    name: 'Swampert',
    types: ['Water', 'Ground'],
    typeIds: [11, 4],
    typeIconFiles: [null, null],
    stats: { hp: 100, attack: 110, defense: 90, spAttack: 85, spDefense: 90, speed: 60 },
    baseStatTotal: 535,
    sprites: null,
};

function render(
    mode: 'weaknesses' | 'resistances',
    options: {
        language?: 'en' | 'cs';
        chart?: TypeEffectivenessChart;
        species?: Pokemon;
        conflict?: boolean;
        unavailable?: boolean;
    } = {},
): string {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (!options.unavailable) {
        client.setQueryData(['collection-type-effectiveness', 'test'], options.chart ?? chart);
    }
    return renderToStaticMarkup(
        createElement(
            QueryClientProvider,
            { client },
            createElement(
                LanguageProvider,
                { initialLanguage: options.language ?? 'en' },
                createElement(MyPokemonTypeDefenses, {
                    species: options.species ?? species,
                    datasetId: options.unavailable ? undefined : 'test',
                    mode,
                    conflict: options.conflict ?? false,
                }),
            ),
        ),
    );
}

void test('weakness view shows multiplied incoming damage and excludes neutral matchups', () => {
    const html = render('weaknesses');
    match(html, /data-multiplier="4"[\s\S]*?<strong>4×<\/strong>[\s\S]*?Grass/);
    doesNotMatch(html, /data-type="Water"|data-type="Electric"|data-multiplier="1"/);
    match(html, /Abilities, held items and battle effects are not included/);
});

void test('resistance view includes zero damage after multiplying immunity and weakness', () => {
    const html = render('resistances');
    match(html, /data-multiplier="0"[\s\S]*?<strong>0×<\/strong>[\s\S]*?Immune[\s\S]*?Electric/);
    doesNotMatch(html, /data-type="Grass"|data-type="Water"/);
});

void test('quarter resistance renders separately from half resistance with localized labels', () => {
    const resistant = {
        ...chart,
        matchups: chart.matchups.map((entry) => ({
            ...entry,
            multiplier: entry.attackingTypeId === 12 ? 0.5 : entry.multiplier,
        })),
    };
    const html = render('resistances', { chart: resistant, language: 'cs' });
    match(html, /Odolnosti a imunity/);
    match(html, /data-multiplier="0.25"[\s\S]*?<strong>¼×<\/strong>[\s\S]*?Travní/);
    match(html, /Imunita/);
    doesNotMatch(html, /Damage taken|Both types|Resistances|>Grass</);
});

void test('unknown or unavailable data and conflicts never claim there are no weaknesses', () => {
    for (const options of [
        { unavailable: true },
        { species: { ...species, typeIds: [9] } },
        { chart: { ...chart, matchups: chart.matchups.slice(1) } },
    ]) {
        const html = render('weaknesses', options);
        match(html, /Type matchups are unavailable/);
        doesNotMatch(html, /No type weaknesses|data-multiplier=/);
    }
    const conflict = render('weaknesses', { conflict: true });
    match(conflict, /Resolve conflicting species updates/);
    doesNotMatch(conflict, /data-multiplier=/);
});

void test('a known neutral chart can truthfully show an empty weakness group', () => {
    const neutral = {
        ...chart,
        matchups: chart.matchups.map((entry) => ({ ...entry, multiplier: 1 })),
    };
    match(render('weaknesses', { chart: neutral }), /No type weaknesses/);
    match(render('resistances', { chart: neutral }), /No type resistances or immunities/);
});
