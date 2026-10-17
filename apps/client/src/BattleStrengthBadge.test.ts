import { doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BattleStrengthBadge } from './BattleStrengthBadge.js';
import type { BattleStrengthResult } from './battleStrength.js';
import { LanguageProvider, type Language } from './language.js';

const available: BattleStrengthResult = {
    status: 'available',
    value: 63,
    parts: { stats: 30, moves: 24.5, typing: 8.25 },
    estimatedStats: [],
    unsupportedMoves: [],
    reason: null,
};

function render(
    result: BattleStrengthResult,
    language: Language = 'en',
    loading = false,
    onRetry?: () => void,
    compact = false,
): string {
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: language },
            createElement(BattleStrengthBadge, { result, loading, onRetry, compact }),
        ),
    );
}

void test('strength uses a native keyboard-accessible disclosure with the score in its summary', () => {
    const html = render(available);
    match(
        html,
        /<details[^>]*><summary[^>]*>.*Battle strength.*<strong>63<\/strong>.*\/100.*<\/summary>/,
    );
    doesNotMatch(html, /<summary[^>]*(?:role=|tabindex=|aria-expanded=)/);
    match(html, /<dt>Stats<\/dt><dd>30 pts<\/dd>/);
    match(html, /<dt>Moves<\/dt><dd>24.5 pts<\/dd>/);
    match(html, /<dt>Typing<\/dt><dd>8.3 pts<\/dd>/);
    match(html, /fixed scale/);
    match(html, /Abilities, held items, and temporary battle effects are excluded/);
    doesNotMatch(html, /Estimated|Retry calculation/);
});

void test('estimated stats and unsupported move effects are disclosed in both languages', () => {
    const result: BattleStrengthResult = {
        ...available,
        estimatedStats: ['attack', 'spDefense'],
        unsupportedMoves: [{ moveId: 99, name: 'Unreviewed Move' }],
    };
    const english = render(result);
    match(english, /my-strength-estimated[^>]*>Estimated/);
    match(english, /Estimated stats: Attack, Sp. Defense/);
    match(english, /current species and level with 15 IVs, 0 EVs, and the known nature/);
    match(english, /These are estimates, not recorded values/);
    match(english, /Effects not included in the score: Unreviewed Move/);
    const czech = render(result, 'cs');
    match(czech, /Bojová síla/);
    match(czech, /my-strength-estimated[^>]*>Odhad/);
    match(czech, /Odhadnuté statistiky: Útok, Spec. obrana/);
    match(czech, /<dt>Statistiky<\/dt>/);
    match(czech, /24,5 b\./);
});

void test('unknown moves and conflicting records never display an overall numeric score', () => {
    for (const [status, reason, label, explanation] of [
        ['incomplete', 'unknown-moves', 'Incomplete', 'Record the current moves'],
        ['conflict', 'conflict', 'Conflicting records', 'Resolve the conflicting records'],
    ] as const) {
        const html = render({
            ...available,
            status,
            reason,
            value: null,
            parts: { stats: 30, moves: null, typing: 8.25 },
        });
        match(html, new RegExp(label));
        match(html, new RegExp(explanation));
        doesNotMatch(html, /<strong>|\/100/);
        match(html, /<dt>Moves<\/dt><dd>Unknown<\/dd>/);
    }
});

void test('loading hides stale values and unavailable data offers an explicit retry', () => {
    const loading = render(available, 'en', true);
    match(loading, /aria-busy="true"/);
    match(loading, /Calculating…/);
    doesNotMatch(loading, /<strong>|<dl|\/100/);
    const unavailable: BattleStrengthResult = {
        ...available,
        status: 'unavailable',
        reason: 'missing-reference',
        value: null,
        parts: { stats: null, moves: null, typing: null },
    };
    const html = render(unavailable, 'en', false, () => {});
    match(html, /Unavailable/);
    match(html, /Some species, move, or type data is unavailable/);
    match(html, /<button type="button"[^>]*>Retry calculation<\/button>/);
    doesNotMatch(html, /<strong>|<dl|\/100/);
});

void test('incomplete scores offer retry for missing reference data but not unknown moves', () => {
    const incomplete: BattleStrengthResult = {
        ...available,
        status: 'incomplete',
        reason: 'missing-reference',
        value: null,
        parts: { stats: 30, moves: null, typing: 8.25 },
    };
    match(
        render(incomplete, 'en', false, () => {}),
        /<button type="button"[^>]*>Retry calculation<\/button>/,
    );
    doesNotMatch(
        render({ ...incomplete, reason: 'unknown-moves' }, 'en', false, () => {}),
        /<button|Retry calculation/,
    );
});

void test('compact strength shows only its number while naming the score and estimates accessibly', () => {
    const result = { ...available, estimatedStats: ['attack'] as const };
    for (const [language, label] of [
        ['en', 'Battle strength: 63/100, estimated'],
        ['cs', 'Bojová síla: 63/100, odhad'],
    ] as const) {
        const html = render(result, language, false, undefined, true);
        match(html, /<details class="my-strength my-strength-compact"/);
        match(
            html,
            new RegExp(
                `<summary[^>]*aria-label="${label}" title="${label}"><strong aria-hidden="true">63</strong></summary>`,
            ),
        );
        doesNotMatch(html, /<summary[^>]*(?:role=|tabindex=|aria-expanded=)/);
        match(html, /<dl class="my-strength-parts">/);
        doesNotMatch(html, /my-strength-scale|my-strength-estimated/);
    }
});

void test('compact loading and unavailable scores show a dash and keep their explanatory disclosure', () => {
    const loading = render(available, 'en', true, undefined, true);
    match(loading, /aria-busy="true"/);
    match(loading, /aria-label="Battle strength: Calculating…"/);
    match(loading, /<strong aria-hidden="true">—<\/strong><\/summary>/);
    doesNotMatch(loading, />63<|<dl/);
    for (const [status, reason, label] of [
        ['incomplete', 'unknown-moves', 'Incomplete'],
        ['conflict', 'conflict', 'Conflicting records'],
        ['unavailable', 'missing-reference', 'Unavailable'],
    ] as const) {
        const html = render(
            { ...available, status, reason, value: null },
            'en',
            false,
            () => {},
            true,
        );
        match(html, new RegExp(`aria-label="Battle strength: ${label}"`));
        match(html, /<strong aria-hidden="true">—<\/strong><\/summary>/);
        match(html, /my-strength-breakdown/);
        if (status === 'unavailable') match(html, /Retry calculation/);
    }
});
