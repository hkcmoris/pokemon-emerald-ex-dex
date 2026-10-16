import { deepStrictEqual, doesNotMatch, match, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

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
    { typeId: 12, name: 'Grass', iconFile: 'grass.png' },
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

function matchupValues(defendingTypeIds: number[], attackingTypeIds: number[]) {
    return getBattleTypeMatchups(defendingTypeIds, attackingTypeIds, chart)?.map(
        ({ typeId, multiplier }) => ({ typeId, multiplier }),
    );
}

function render(
    defendingTypeIds: number[],
    attackingTypeIds: number[],
    language: Language = 'en',
    reference: TypeEffectivenessChart | undefined = chart,
): string {
    return renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: language },
            createElement(BattleTypeMatchups, {
                defendingTypeIds,
                attackingTypeIds,
                chart: reference,
                defenderName: 'Butterfree',
            }),
        ),
    );
}

void test('battle hints describe incoming damage in each direction and only opposing types', () => {
    deepStrictEqual(matchupValues([6, 3], [2]), [{ typeId: 2, multiplier: 2 }]);
    deepStrictEqual(matchupValues([2], [6, 3]), [{ typeId: 6, multiplier: 0.5 }]);
    // Rock also exploits Bug, but it is not a type of the opposing Pokemon.
    doesNotMatch(render([6, 3], [2]), /Rock|rock\.png|Poison|poison\.png/);
});

void test('dual defensive types multiply weakness, resistance and immunity and can cancel', () => {
    deepStrictEqual(matchupValues([6, 2], [5]), [{ typeId: 5, multiplier: 4 }]);
    deepStrictEqual(matchupValues([6, 3], [12]), [{ typeId: 12, multiplier: 0.25 }]);
    deepStrictEqual(matchupValues([7, 3], [0]), [{ typeId: 0, multiplier: 0 }]);
    deepStrictEqual(matchupValues([12, 3], [4]), []);
});

void test('duplicated mono types do not square damage or duplicate hints', () => {
    deepStrictEqual(matchupValues([6, 6], [2, 2]), [{ typeId: 2, multiplier: 2 }]);
});

void test('missing, partial or unknown type data cannot produce a matchup claim', () => {
    for (const [defenders, attackers, reference] of [
        [[6], [2], undefined],
        [[6], [2], { ...chart, matchups: chart.matchups.slice(1) }],
        [[999], [2], chart],
        [[6], [999], chart],
        [[6], [2, 999], chart],
        [[], [2], chart],
        [[6], [], chart],
    ] as const) {
        strictEqual(getBattleTypeMatchups(defenders, attackers, reference), null);
        strictEqual(
            renderToStaticMarkup(
                createElement(BattleTypeMatchups, {
                    defendingTypeIds: defenders,
                    attackingTypeIds: attackers,
                    chart: reference,
                    defenderName: 'Butterfree',
                }),
            ),
            '',
        );
    }
    strictEqual(render([12, 3], [4]), '');
});

void test('battle hints render readable weakness, resistance and immunity with type icons', () => {
    const weakness = render([6, 3], [2]);
    match(weakness, /Weakness/);
    match(weakness, /flying\.png/);
    match(weakness, /2×|×2/);
    const resistance = render([2], [6]);
    match(resistance, /Resistance/);
    match(resistance, /bug\.png/);
    match(resistance, /½×|0\.5×|×0\.5/);
    const immunity = render([7], [0]);
    match(immunity, /Immune/);
    match(immunity, /0×|×0/);
});

void test('battle hints localize categories and type names in Czech', () => {
    const weakness = render([6, 3], [2], 'cs');
    match(weakness, /Slabost|Slabina/);
    match(weakness, /Létající/);
    doesNotMatch(weakness, /Weakness|>Flying</);
    const resistance = render([6, 3], [12], 'cs');
    match(resistance, /Odolnost/);
    match(resistance, /Travní/);
    match(resistance, /¼×|0[.,]25×|×0[.,]25/);
    const immunity = render([7], [0], 'cs');
    match(immunity, /Imunita/);
});
