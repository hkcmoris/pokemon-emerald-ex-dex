import { doesNotMatch, match } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Move, Pokemon, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { IncomingDamage, type IncomingDamageProps } from './IncomingDamage.js';
import { LanguageProvider } from './language.js';

const typeIds = [0, 10, 11];
const chart: TypeEffectivenessChart = {
    types: typeIds.map((typeId) => ({ typeId, name: String(typeId), iconFile: null })),
    matchups: typeIds.flatMap((attackingTypeId) =>
        typeIds.map((defendingTypeId) => ({
            attackingTypeId,
            defendingTypeId,
            multiplier:
                attackingTypeId === 11
                    ? defendingTypeId === 10
                        ? 2
                        : defendingTypeId === 11
                          ? 0.5
                          : 1
                    : 1,
        })),
    ),
};
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
const enemy: Pokemon = {
    speciesId: 7,
    name: 'Squirtle',
    types: ['Water'],
    typeIds: [11],
    typeIconFiles: [null],
    stats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
    baseStatTotal: 314,
    sprites: null,
};
const props: IncomingDamageProps = {
    moves: [waterGun],
    enemy,
    enemyLevel: 17,
    enemyStats: { attack: 25, spAttack: 31 },
    ownTypeIds: [10],
    ownStats: { hp: 100, defense: 50, spDefense: 30 },
    ownName: 'Flame',
    chart,
};

function render(
    overrides: Partial<IncomingDamageProps> = {},
    options: { reference?: Move | null; error?: boolean; language?: 'en' | 'cs' } = {},
): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, retryOnMount: false, staleTime: Infinity } },
    });
    const reference = options.reference === undefined ? waterGun : options.reference;
    if (reference) client.setQueryData(['collection-move', reference.moveId], reference);
    if (options.error) {
        client
            .getQueryCache()
            .build(client, { queryKey: ['collection-move', waterGun.moveId] })
            .setState({ status: 'error', error: new Error('offline'), fetchStatus: 'idle' });
    }
    try {
        return renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    LanguageProvider,
                    { initialLanguage: options.language ?? 'en' },
                    createElement(IncomingDamage, { ...props, ...overrides }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('incoming damage uses enemy offense and level against the selected member defense and HP', () => {
    const html = render();
    match(html, /<article class="move-display move-display--large[^"]*" data-move-id="55"/);
    match(html, /Squirtle → Flame/);
    match(html, /18–24 HP/);
    match(html, /Total · 1 hit/);
    match(html, /18–24% of Flame’s HP/);
    match(html, /Accuracy<\/span><strong[^>]*>100%<\/strong>/);
    match(html, /PP<\/span><strong>25<\/strong>/);
    match(html, /Type effectiveness 2× · STAB 1\.5×/);
    match(html, /Unspecified enemy stats assume neutral nature/);
    match(html, /Uses your recorded stats or simulator overrides/);
    const changedTarget = render({ ownTypeIds: [11], ownStats: { hp: 50, spDefense: 30 } });
    match(changedTarget, /4–6 HP/);
    match(changedTarget, /8–12% of Flame’s HP/);
    const physical = { ...waterGun, moveId: 33, name: 'Tackle', categoryId: 0, typeId: 0 };
    match(render({ moves: [physical] }, { reference: physical }), /4–5 HP/);
});

void test('incoming multi-hit damage displays a total and per-hit calculation with the enemy ability unknown', () => {
    const doubleSlap: Move = {
        ...waterGun,
        moveId: 3,
        name: 'Double Slap',
        typeId: 0,
        type: 'Normal',
        categoryId: 0,
        category: 'Physical',
        power: 15,
        effectId: 25,
    };
    const html = render({ moves: [doubleSlap] }, { reference: doubleSlap });
    match(html, /Total · 2–5 hits/);
    match(html, /4–15 HP/);
    match(html, /4–15% of Flame’s HP/);
    match(html, /Per hit: 2–3 HP/);
    match(html, /The enemy ability is unknown/);
    doesNotMatch(html, /Per successful hit|Skill Link/);
    match(
        render({ moves: [doubleSlap] }, { reference: doubleSlap, language: 'cs' }),
        /Celkem · 2–5 zásahů/,
    );
});

void test('escalating multi-hit moves expose each hit range instead of presenting an identical per-hit range', () => {
    const tripleAxel: Move = {
        ...waterGun,
        moveId: 741,
        name: 'Triple Axel',
        typeId: 0,
        categoryId: 0,
        power: 20,
        effectId: 81,
    };
    const html = render({ moves: [tripleAxel] }, { reference: tripleAxel });
    match(html, /Total · 1–3 hits/);
    match(html, /2–14 HP/);
    match(html, /Hit 1: 2–3 HP · Hit 2: 4–5 HP · Hit 3: 5–6 HP/);
    doesNotMatch(html, /Per hit:/);
});

void test('incoming estimates label own fallback stats and do not invent missing HP percentages', () => {
    match(
        render({ estimatedOwnStats: true }),
        /Missing own stats are estimated with 31 IVs, 0 EVs and the saved nature \(neutral if unknown\)/,
    );
    const missingHp = render({ ownStats: { spDefense: 30 } });
    match(missingHp, /18–24 HP/);
    match(missingHp, /Your HP is unknown; percentage unavailable/);
    doesNotMatch(missingHp, /% of Flame/);
    const missingDefense = render({ ownStats: { hp: 100 } });
    match(missingDefense, /Required stats or type data missing/);
    doesNotMatch(missingDefense, /[0-9]–[0-9]+ HP/);
    match(render({}, { language: 'cs' }), /Odhad příchozího poškození/);
});

void test('incoming estimates distinguish unrevealed moves, status effects and unsupported mechanics', () => {
    const unknown = render({ moves: [] });
    match(unknown, /No revealed moves yet/);
    match(unknown, /no warning does not mean a safe matchup/);
    doesNotMatch(unknown, /[0-9]–[0-9]+ HP/);
    const status = { ...waterGun, categoryId: 2 };
    match(render({}, { reference: status }), /status effects not modeled/);
    for (const special of [
        { ...waterGun, power: 1 },
        { ...waterGun, moveId: 573, name: 'Freeze-Dry' },
    ]) {
        const html = render({ moves: [special] }, { reference: special });
        match(html, /Special mechanics not modeled/);
        doesNotMatch(html, /[0-9]–[0-9]+ HP/);
    }
});

void test('incoming estimates suppress conflicts and expose reference loading errors with retry', () => {
    const conflict = render({ disabled: true });
    match(conflict, /Resolve the sync conflict/);
    doesNotMatch(conflict, /[0-9]–[0-9]+ HP/);
    match(render({ enemy: null }), /Choose an opponent/);
    match(render({}, { reference: null }), /Loading move data/);
    const error = render({}, { reference: null, error: true });
    match(error, /Move data unavailable/);
    match(error, /Retry move data/);
    doesNotMatch(error, /[0-9]–[0-9]+ HP/);
});
