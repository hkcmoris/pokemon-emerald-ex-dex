import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Pokemon } from '@pokemon-emerald-ex-dex/shared';

import { LanguageProvider } from './language.js';
import { StatsPanel } from './SpeciesPage.js';

function renderPanel(stats: Pokemon['stats'], language: 'en' | 'cs' = 'en'): string {
    const entry: Pokemon = {
        speciesId: 25,
        name: 'Pikachu',
        types: ['Electric'],
        typeIds: [13],
        typeIconFiles: [null],
        sprites: null,
        stats,
        baseStatTotal:
            stats.hp +
            stats.attack +
            stats.defense +
            stats.spAttack +
            stats.spDefense +
            stats.speed,
    };
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: language },
            createElement(StatsPanel, { entry, version: '1.0.4' }),
        ),
    );
}

function statRows(markup: string): { attributes: string; content: string }[] {
    return Array.from(
        markup.matchAll(/<div class="stat-row"([^>]*)>([\s\S]*?)<\/dd><\/div>/g),
        ([, attributes, content]) => ({ attributes, content }),
    );
}

for (const { attack, spAttack, label, files } of [
    {
        attack: 100,
        spAttack: 80,
        label: 'Attack is higher than Sp. Attack',
        files: ['physical.svg'],
    },
    {
        attack: 80,
        spAttack: 100,
        label: 'Sp. Attack is higher than Attack',
        files: ['special.svg'],
    },
    {
        attack: 90,
        spAttack: 90,
        label: 'Attack and Sp. Attack are equal',
        files: ['physical-special.svg'],
    },
]) {
    void test(`offensive category communicates ${label.toLowerCase()}`, () => {
        const markup = renderPanel({
            hp: 255,
            attack,
            defense: 70,
            spAttack,
            spDefense: 60,
            speed: 50,
        });
        const group = markup.match(/<[^>]*class="stat-offense"[^>]*>/)?.[0] ?? '';
        match(group, /role="img"/);
        match(group, new RegExp(`aria-label="${label.replaceAll('.', '\\.')}"`));
        match(group, new RegExp(`title="${label.replaceAll('.', '\\.')}"`));
        const icons = Array.from(markup.matchAll(/<img\b[^>]*>/g), ([icon]) => icon);
        strictEqual(icons.length, files.length);
        for (const [index, file] of files.entries()) {
            match(
                icons[index],
                new RegExp(`src="/api/icons/move-categories/${file.replace('.', '\\.')}"`),
            );
            match(icons[index], /alt=""/);
        }
    });
}

void test('all six stats retain their order, total and 0-255 bar scale while every maximum is highlighted', () => {
    const markup = renderPanel({
        hp: 0,
        attack: 102,
        defense: 255,
        spAttack: 51,
        spDefense: 255,
        speed: 153,
    });
    const rows = statRows(markup);
    strictEqual(rows.length, 6);
    deepStrictEqual(
        rows.map(({ content }) =>
            content.match(/<dt\b[^>]*>([\s\S]*?)<\/dt>/)?.[1].replace(/<[^>]*>/g, ''),
        ),
        ['HP', 'Attack', 'Defense', 'Sp. Attack', 'Sp. Defense', 'Speed'],
    );
    deepStrictEqual(
        rows.map(({ attributes }) => attributes.includes('data-highest="true"')),
        [false, false, true, false, true, false],
    );
    for (const [index, { content }] of rows.entries()) {
        match(content, new RegExp(`style="width:${[0, 40, 100, 20, 100, 60][index]}%"`));
        if (index === 2 || index === 4) match(content, /class="sr-only">\s*Highest stat<\/span>/);
        else doesNotMatch(content, /Highest stat/);
    }
    match(markup, />816<\/span>/);
    match(markup, /Bars use a 0–255 scale/);
});

void test('equal base stats all receive the maximum indicator', () => {
    const markup = renderPanel({
        hp: 60,
        attack: 60,
        defense: 60,
        spAttack: 60,
        spDefense: 60,
        speed: 60,
    });
    const rows = statRows(markup);
    strictEqual(rows.length, 6);
    for (const row of rows) {
        match(row.attributes, /data-highest="true"/);
        match(row.content, /class="sr-only">\s*Highest stat<\/span>/);
    }
});

void test('Czech special-stat abbreviations retain full names and localized maximum and offense labels', () => {
    const markup = renderPanel(
        { hp: 60, attack: 60, defense: 60, spAttack: 60, spDefense: 60, speed: 60 },
        'cs',
    );
    match(markup, /<abbr title="Speciální útok">Sp\. útok<\/abbr>/);
    match(markup, /<abbr title="Speciální obrana">Sp\. obrana<\/abbr>/);
    strictEqual((markup.match(/class="sr-only">\s*Nejvyšší statistika<\/span>/g) ?? []).length, 6);
    match(markup, /aria-label="Útok a speciální útok jsou stejné"/);
    doesNotMatch(markup, /Highest stat|Attack and Sp\. Attack are equal/);
});
