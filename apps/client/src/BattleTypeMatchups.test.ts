import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { KnownMove, Move, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { BattleTypeMatchups, getBattleTypeMatchups } from './BattleTypeMatchups.js';
import { LanguageProvider, type Language } from './language.js';

const types = [
    { typeId: 0, name: 'Normal', iconFile: 'normal.png' },
    { typeId: 2, name: 'Flying', iconFile: 'flying.png' },
    { typeId: 3, name: 'Poison', iconFile: 'poison.png' },
    { typeId: 4, name: 'Ground', iconFile: 'ground.png' },
    { typeId: 5, name: 'Rock', iconFile: 'rock.png' },
    { typeId: 6, name: 'Bug', iconFile: 'bug.png' },
    { typeId: 7, name: 'Ghost', iconFile: 'ghost.png' },
    { typeId: 10, name: 'Fire', iconFile: 'fire.png' },
    { typeId: 11, name: 'Water', iconFile: 'water.png' },
    { typeId: 12, name: 'Grass', iconFile: 'grass.png' },
    { typeId: 15, name: 'Ice', iconFile: 'ice.png' },
];
const multipliers = new Map<string, number>([
    ['2:6', 2],
    ['6:2', 0.5],
    ['5:6', 2],
    ['5:2', 2],
    ['12:6', 0.5],
    ['12:3', 0.5],
    ['0:7', 0],
    ['4:12', 0.5],
    ['4:3', 2],
    ['11:10', 2],
    ['15:10', 0.5],
]);
const chart: TypeEffectivenessChart = {
    types,
    matchups: types.flatMap((attacker) =>
        types.map((defender) => ({
            attackingTypeId: attacker.typeId,
            defendingTypeId: defender.typeId,
            multiplier: multipliers.get(`${attacker.typeId}:${defender.typeId}`) ?? 1,
        })),
    ),
};

function move(typeId: number, overrides: Partial<Move> = {}): Move {
    const type = types.find((entry) => entry.typeId === typeId)!;
    return {
        moveId: 1000 + typeId,
        name: `${type.name} hit`,
        typeId,
        type: type.name,
        typeIconFile: type.iconFile,
        categoryId: 0,
        category: 'Physical',
        categoryIconFile: null,
        description: '',
        descriptionCs: null,
        power: 40,
        accuracy: 100,
        pp: 20,
        priority: 0,
        effectId: 0,
        targetId: 0,
        ...overrides,
    };
}

function matchupValues(defendingTypeIds: number[], attackingMoves: Move[]) {
    return getBattleTypeMatchups(
        defendingTypeIds,
        attackingMoves,
        new Map(attackingMoves.map((entry) => [entry.moveId, entry])),
        chart,
    ).map(({ typeId, multiplier }) => ({ typeId, multiplier }));
}

function render(
    defendingTypeIds: readonly number[],
    attackingMoves: readonly KnownMove[] | null,
    details: readonly Move[],
    language: Language = 'en',
    reference: TypeEffectivenessChart | undefined = chart,
): string {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    for (const entry of details) client.setQueryData(['collection-move', entry.moveId], entry);
    try {
        return renderToStaticMarkup(
            createElement(
                QueryClientProvider,
                { client },
                createElement(
                    LanguageProvider,
                    { initialLanguage: language },
                    createElement(BattleTypeMatchups, {
                        defendingTypeIds,
                        attackingMoves,
                        chart: reference,
                        defenderName: 'Slugma',
                    }),
                ),
            ),
        );
    } finally {
        client.clear();
    }
}

void test('Shellder with Icicle Spear and Withdraw shows Ice resistance, never Water effectiveness', () => {
    const icicleSpear = move(15, { moveId: 333, name: 'Icicle Spear', power: 25, effectId: 25 });
    const withdraw = move(11, {
        moveId: 110,
        name: 'Withdraw',
        categoryId: 2,
        category: 'Status',
        power: 0,
    });
    const moves = [icicleSpear, withdraw];
    deepStrictEqual(matchupValues([10], moves), [{ typeId: 15, multiplier: 0.5 }]);
    const html = render([10], moves, moves);
    match(html, /Resistance/);
    match(html, /title="Icicle Spear \(Ice\): ½× damage taken"/);
    match(html, /ice\.png/);
    doesNotMatch(html, /Withdraw|water\.png|Weakness|data-multiplier="2"/);
});

void test('recorded off-type coverage counts and same-type moves share a named badge', () => {
    const water = [move(11, { name: 'Water Gun' }), move(11, { moveId: 57, name: 'Surf' })];
    deepStrictEqual(matchupValues([10], water), [{ typeId: 11, multiplier: 2 }]);
    const html = render([10], water, water);
    match(html, /title="Water Gun, Surf \(Water\): 2× damage taken"/);
    strictEqual((html.match(/data-matchup="weak"/g) ?? []).length, 1);
    match(html, /Based on recorded damaging moves/);
});

void test('both defensive types multiply resistance and immunity, while cancellation stays hidden', () => {
    deepStrictEqual(matchupValues([6, 2], [move(5)]), [{ typeId: 5, multiplier: 4 }]);
    deepStrictEqual(matchupValues([6, 3], [move(12)]), [{ typeId: 12, multiplier: 0.25 }]);
    deepStrictEqual(matchupValues([7, 3], [move(0)]), [{ typeId: 0, multiplier: 0 }]);
    strictEqual(render([12, 3], [move(4)], [move(4)]), '');
    deepStrictEqual(matchupValues([6, 6], [move(2), move(2)]), [{ typeId: 2, multiplier: 2 }]);
});

void test('unknown, empty, status-only or unresolved moves cannot create a type fallback', () => {
    const status = move(11, { categoryId: 2, category: 'Status', power: 0 });
    const water = move(11);
    for (const moves of [null, [], [status]]) strictEqual(render([10], moves, [status]), '');
    strictEqual(render([10], [water], []), '');
    strictEqual(render([10], [water, move(15)], [water]), '');
    strictEqual(render([999], [water], [water]), '');
    strictEqual(render([], [water], [water]), '');
    strictEqual(
        render([10], [water], [water], 'en', { ...chart, matchups: chart.matchups.slice(1) }),
        '',
    );
    const unsupported = move(11, { moveId: 311, name: 'Weather Ball' });
    strictEqual(render([10], [water, unsupported], [water, unsupported]), '');
});

void test('battle hints localize category and type names and retain move names for identification', () => {
    const grass = move(12, { name: 'Vine Whip' });
    const resistance = render([6, 3], [grass], [grass], 'cs');
    match(resistance, /Odolnost/);
    match(resistance, /Vine Whip \(Travní\)/);
    match(resistance, /¼×/);
    doesNotMatch(resistance, /Resistance|>Grass</);
    match(render([7], [move(0)], [move(0)], 'cs'), /Imunita/);
    match(render([6], [move(2)], [move(2)], 'cs'), /Slabina/);
});
