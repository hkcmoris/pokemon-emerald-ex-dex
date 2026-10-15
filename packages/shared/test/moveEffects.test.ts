import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Move } from '../src/dex.js';
import { getMoveEffects, type MoveEffect, type MoveEffectStatus } from '../src/moveEffects.js';

const catalog = (
    JSON.parse(
        readFileSync(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
            'utf8',
        ),
    ) as { moves: Move[] }
).moves;
const byId = new Map(catalog.map((move) => [move.moveId, move]));
function effects(id: number): MoveEffect[] {
    const move = byId.get(id);
    if (!move) throw new Error(`Missing audited move ${id}`);
    return getMoveEffects(move);
}
function statuses(id: number): MoveEffectStatus[] {
    return effects(id).flatMap((effect) => (effect.kind === 'status' ? [effect.status] : []));
}

void test('status badges use the exported engine families and audited secondary move IDs', () => {
    for (const [id, expected] of [
        [77, ['poison']],
        [92, ['bad-poison']],
        [305, ['bad-poison']],
        [261, ['burn']],
        [53, ['burn']],
        [86, ['paralysis']],
        [85, ['paralysis']],
        [79, ['sleep']],
        [547, ['sleep']],
        [58, ['freeze']],
        [573, ['freeze']],
        [109, ['confusion']],
        [93, ['confusion']],
        [44, ['flinch']],
        [422, ['paralysis', 'flinch']],
        [423, ['frostbite', 'flinch']],
        [424, ['burn', 'flinch']],
        [755, ['paralysis', 'poison', 'drowsy']],
        [767, ['poison']],
        [772, ['burn']],
        [830, ['burn']],
    ] as const)
        deepStrictEqual(statuses(id), expected, byId.get(id)?.name);
    strictEqual(effects(85)[0].likelihood, 'possible');
    strictEqual(effects(86)[0].likelihood, 'guaranteed');
    strictEqual(effects(192)[0].likelihood, 'guaranteed');
    strictEqual(effects(517)[0].likelihood, 'guaranteed');
});

void test('self-inflicted and conditional effects retain their recipient and qualification', () => {
    for (const id of [37, 80, 200, 761])
        deepStrictEqual(effects(id), [
            { kind: 'status', status: 'confusion', target: 'self', likelihood: 'conditional' },
        ]);
    deepStrictEqual(effects(156), [
        { kind: 'status', status: 'sleep', target: 'self', likelihood: 'guaranteed' },
        { kind: 'heal', target: 'self', likelihood: 'guaranteed' },
    ]);
    for (const id of [252, 281, 390, 624, 653, 735, 836, 842, 846]) {
        strictEqual(
            effects(id).some((effect) => effect.kind === 'status'),
            true,
        );
        strictEqual(
            effects(id).every((effect) => effect.likelihood === 'conditional'),
            true,
        );
    }
    strictEqual(effects(445)[0].likelihood, 'conditional');
    strictEqual(
        effects(599).every((effect) => effect.likelihood === 'conditional'),
        true,
    );
});

void test('mixed stat changes distinguish self boosts, self penalties, and target boosts', () => {
    deepStrictEqual(effects(635), [
        { kind: 'status', status: 'poison', target: 'target', likelihood: 'guaranteed' },
        {
            kind: 'stat',
            stat: 'speed',
            direction: 'down',
            target: 'target',
            likelihood: 'guaranteed',
        },
    ]);
    for (const [id, boosted] of [
        [207, 'attack'],
        [260, 'spAttack'],
    ] as const) {
        deepStrictEqual(
            effects(id).find((effect) => effect.kind === 'stat'),
            {
                kind: 'stat',
                stat: boosted,
                direction: 'up',
                target: 'target',
                likelihood: 'guaranteed',
            },
        );
    }
    deepStrictEqual(
        effects(504)
            .filter((effect) => effect.kind === 'stat')
            .map((effect) => [effect.stat, effect.direction, effect.target]),
        [
            ['attack', 'up', 'self'],
            ['spAttack', 'up', 'self'],
            ['speed', 'up', 'self'],
            ['defense', 'down', 'self'],
            ['spDefense', 'down', 'self'],
        ],
    );
    for (const id of [315, 354, 370, 434, 437, 557, 620, 628, 654, 659, 766, 787, 802, 816]) {
        strictEqual(
            effects(id).every(
                (effect) =>
                    effect.kind === 'stat' &&
                    effect.direction === 'down' &&
                    effect.target === 'self',
            ),
            true,
            byId.get(id)?.name,
        );
    }
    strictEqual(
        effects(669).every(
            (effect) =>
                effect.kind === 'stat' && effect.direction === 'down' && effect.target === 'target',
        ),
        true,
    );
    strictEqual(effects(488)[0].target, 'self');
    strictEqual(effects(488)[0].likelihood, 'guaranteed');
});

void test('accuracy and evasion badges describe stat changes, not ordinary hit chance or critical hits', () => {
    for (const [id, expectedStat, expectedDirection] of [
        [28, 'accuracy', 'down'],
        [148, 'accuracy', 'down'],
        [189, 'accuracy', 'down'],
        [104, 'evasion', 'up'],
        [107, 'evasion', 'up'],
        [230, 'evasion', 'down'],
        [432, 'evasion', 'down'],
        [468, 'accuracy', 'up'],
        [489, 'accuracy', 'up'],
    ] as const)
        strictEqual(
            effects(id).some(
                (effect) =>
                    effect.kind === 'stat' &&
                    effect.stat === expectedStat &&
                    effect.direction === expectedDirection,
            ),
            true,
        );
    strictEqual(effects(330)[0].likelihood, 'possible');
    for (const id of [116, 129, 170, 199, 264, 636, 647, 841]) {
        deepStrictEqual(effects(id), [], byId.get(id)?.name);
    }
    strictEqual(
        effects(246).some(
            (effect) => effect.kind === 'stat' && ['accuracy', 'evasion'].includes(effect.stat),
        ),
        false,
    );
});

void test('HP effects are separate from status cures and preserve self risk and ally healing', () => {
    deepStrictEqual(effects(394), [
        { kind: 'status', status: 'burn', target: 'target', likelihood: 'possible' },
        { kind: 'recoil', target: 'self', likelihood: 'guaranteed' },
    ]);
    strictEqual(effects(26)[0].likelihood, 'conditional');
    strictEqual(effects(202)[0].kind, 'drain');
    strictEqual(effects(138)[0].kind, 'drain');
    deepStrictEqual(statuses(138), []);
    strictEqual(effects(505)[0].target, 'target');
    strictEqual(effects(719)[0].target, 'allies');
    strictEqual(effects(580)[0].target, 'all');
    strictEqual(
        effects(739).every((effect) => effect.target === 'allies'),
        true,
    );
    deepStrictEqual(statuses(648), []);
    strictEqual(effects(648)[0].kind, 'heal');
});

void test('status words, vague descriptions, generic effects, and resets never create false badges', () => {
    for (const id of [
        0, 1, 6, 113, 114, 161, 173, 174, 193, 214, 215, 219, 253, 262, 263, 265, 268, 270, 276,
        287, 290, 312, 318, 358, 367, 375, 377, 384, 385, 388, 391, 499, 506, 510, 519, 576, 604,
        627, 645, 666, 687, 778, 784, 845,
    ])
        deepStrictEqual(effects(id), [], byId.get(id)?.name);
    deepStrictEqual(
        getMoveEffects({ moveId: 53, effectId: 65535, targetId: 0, categoryId: 1 }),
        [],
    );
    deepStrictEqual(
        getMoveEffects({ moveId: 65535, effectId: 65535, targetId: 0, categoryId: 1 }),
        [],
    );
    deepStrictEqual(getMoveEffects({ moveId: 65535, effectId: 1, targetId: 0, categoryId: 1 }), []);
});
