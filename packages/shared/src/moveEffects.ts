import type { Move } from './dex.js';

export type MoveEffectStatus =
    | 'poison'
    | 'bad-poison'
    | 'burn'
    | 'paralysis'
    | 'sleep'
    | 'freeze'
    | 'frostbite'
    | 'drowsy'
    | 'confusion'
    | 'flinch';
export type MoveEffectStat =
    'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed' | 'accuracy' | 'evasion';
export type MoveEffectTarget = 'self' | 'target' | 'allies' | 'all';
export type MoveEffectLikelihood = 'guaranteed' | 'possible' | 'conditional';

interface MoveEffectBase {
    target: MoveEffectTarget;
    /** Guaranteed means on successful use, subject to immunities and other battle rules. */
    likelihood: MoveEffectLikelihood;
}

export type MoveEffect = MoveEffectBase &
    (
        | { kind: 'status'; status: MoveEffectStatus }
        | { kind: 'stat'; stat: MoveEffectStat; direction: 'up' | 'down' }
        | { kind: 'heal' | 'drain' | 'recoil' }
    );

function status(
    value: MoveEffectStatus,
    likelihood: MoveEffectLikelihood = 'guaranteed',
    target: MoveEffectTarget = 'target',
): MoveEffect {
    return { kind: 'status', status: value, target, likelihood };
}

function stat(
    value: MoveEffectStat,
    direction: 'up' | 'down',
    target: MoveEffectTarget = direction === 'up' ? 'self' : 'target',
    likelihood: MoveEffectLikelihood = 'guaranteed',
): MoveEffect {
    return { kind: 'stat', stat: value, direction, target, likelihood };
}

function hp(
    kind: 'heal' | 'drain' | 'recoil',
    likelihood: MoveEffectLikelihood = 'guaranteed',
    target: MoveEffectTarget = 'self',
): MoveEffect {
    return { kind, target, likelihood };
}

const battleStats: readonly MoveEffectStat[] = [
    'attack',
    'defense',
    'spAttack',
    'spDefense',
    'speed',
];
function boostAll(likelihood: MoveEffectLikelihood = 'guaranteed'): MoveEffect[] {
    return battleStats.map((value) => stat(value, 'up', 'self', likelihood));
}

// Audited Emerald EX 1.0.4 engine families. Generic or mixed families (especially 0 and 1)
// deliberately have no fallback. See docs/move-effects.md for evidence and limits.
const effectRules: Readonly<Record<number, readonly MoveEffect[]>> = {
    2: [status('sleep')],
    3: [hp('drain')],
    5: [hp('drain', 'conditional')],
    7: [stat('attack', 'up')],
    8: [stat('defense', 'up')],
    13: [stat('evasion', 'up')],
    14: [stat('spAttack', 'up')],
    15: [stat('attack', 'down')],
    16: [stat('defense', 'down')],
    18: [stat('spAttack', 'down')],
    20: [stat('accuracy', 'down')],
    27: [hp('heal')],
    28: [status('bad-poison')],
    30: [status('sleep', 'guaranteed', 'self'), hp('heal')],
    36: [hp('recoil', 'conditional')],
    39: [status('confusion')],
    40: [stat('attack', 'up')],
    41: [stat('defense', 'up')],
    42: [stat('speed', 'up')],
    43: [stat('spAttack', 'up')],
    44: [stat('spDefense', 'up')],
    48: [stat('attack', 'down')],
    49: [stat('defense', 'down')],
    50: [stat('speed', 'down')],
    51: [stat('spAttack', 'down')],
    52: [stat('spDefense', 'down')],
    54: [stat('evasion', 'down')],
    56: [status('poison')],
    57: [status('paralysis')],
    60: [stat('attack', 'up', 'self', 'conditional')],
    63: [hp('drain', 'conditional')],
    84: [stat('evasion', 'up')],
    86: [hp('heal', 'conditional', 'allies')],
    94: [status('confusion'), stat('attack', 'up', 'target')],
    98: [hp('heal', 'possible', 'target')],
    104: [stat('spAttack', 'down', 'target', 'conditional')],
    105: [hp('heal')],
    106: [hp('heal')],
    107: [hp('heal')],
    111: [stat('attack', 'up', 'self', 'conditional')],
    112: [stat('attack', 'up')],
    122: [stat('defense', 'up')],
    123: [hp('heal')],
    128: [hp('heal', 'conditional')],
    132: [status('confusion'), stat('spAttack', 'up', 'target')],
    133: [status('burn')],
    145: [hp('heal', 'conditional', 'allies')],
    147: [hp('heal')],
    152: [status('sleep', 'conditional')],
    165: [stat('attack', 'down'), stat('defense', 'down')],
    166: [stat('defense', 'up'), stat('spDefense', 'up')],
    167: [stat('attack', 'up'), stat('defense', 'up')],
    169: [stat('spAttack', 'up'), stat('spDefense', 'up')],
    170: [stat('attack', 'up'), stat('speed', 'up')],
    189: [stat('speed', 'down')],
    192: [hp('heal')],
    195: [stat('speed', 'up', 'allies')],
    197: [hp('heal')],
    202: [status('poison', 'conditional')],
    211: [stat('speed', 'down', 'target', 'conditional')],
    217: [hp('heal', 'guaranteed', 'target')],
    220: [status('freeze', 'possible')],
    223: [hp('heal', 'conditional', 'all')],
    226: [stat('attack', 'up'), stat('accuracy', 'up')],
    227: [stat('attack', 'up'), stat('spAttack', 'up')],
    230: [stat('spAttack', 'up'), stat('spDefense', 'up'), stat('speed', 'up')],
    231: [stat('attack', 'up'), stat('defense', 'up'), stat('accuracy', 'up')],
    // Growth's exported description confirms only Special Attack; no inferred Attack badge.
    235: [stat('spAttack', 'up')],
    237: [
        stat('attack', 'up'),
        stat('spAttack', 'up'),
        stat('speed', 'up'),
        stat('defense', 'down', 'self'),
        stat('spDefense', 'down', 'self'),
    ],
    238: [stat('attack', 'up'), stat('speed', 'up')],
    239: [stat('defense', 'up')],
    240: [stat('attack', 'down'), stat('spAttack', 'down')],
    241: [
        stat('attack', 'down', 'target', 'conditional'),
        stat('spAttack', 'down', 'target', 'conditional'),
        stat('speed', 'down', 'target', 'conditional'),
    ],
    242: [status('poison'), stat('speed', 'down')],
    246: [stat('speed', 'up')],
    248: [stat('evasion', 'down')],
    249: [hp('heal', 'conditional', 'target')],
    255: [stat('attack', 'up', 'all', 'conditional'), stat('spAttack', 'up', 'all', 'conditional')],
    256: [stat('defense', 'up', 'all', 'conditional')],
    262: [stat('spDefense', 'up', 'target')],
    265: [stat('attack', 'down'), stat('spAttack', 'down')],
    270: [
        stat('defense', 'up', 'allies', 'conditional'),
        stat('spDefense', 'up', 'allies', 'conditional'),
    ],
    271: [
        stat('attack', 'up', 'allies', 'conditional'),
        stat('spAttack', 'up', 'allies', 'conditional'),
    ],
    272: [hp('heal'), stat('attack', 'down')],
    274: [hp('heal', 'conditional')],
    276: [hp('heal')],
    277: [
        stat('spAttack', 'up', 'self', 'conditional'),
        stat('spDefense', 'up', 'self', 'conditional'),
        stat('speed', 'up', 'self', 'conditional'),
    ],
    280: [status('sleep', 'possible')],
    283: [hp('heal', 'guaranteed', 'allies')],
    284: [stat('attack', 'up', 'allies'), stat('defense', 'up', 'allies')],
    288: [stat('attack', 'up', 'target'), stat('spAttack', 'up', 'target')],
    290: [hp('recoil')],
    291: [stat('defense', 'up', 'self', 'conditional')],
    292: [stat('defense', 'down')],
    295: [hp('drain', 'conditional')],
    300: [stat('speed', 'up')],
    302: [status('poison', 'possible')],
    304: boostAll(),
    305: [stat('speed', 'down')],
    307: [stat('defense', 'down'), stat('spDefense', 'down')],
    308: boostAll(),
    313: [status('burn', 'conditional')],
    315: [hp('recoil')],
    318: [status('sleep')],
    319: [stat('attack', 'up'), stat('defense', 'up'), stat('speed', 'up')],
    321: [stat('attack', 'up')],
    338: [stat('attack', 'up'), stat('spAttack', 'up'), stat('speed', 'up')],
    341: [status('freeze', 'possible')],
    344: [status('flinch', 'conditional')],
    347: [stat('attack', 'up'), stat('speed', 'up')],
};

interface MoveRule {
    effectId: number;
    effects: readonly MoveEffect[];
}
const moveRules = new Map<number, MoveRule>();
function moves(ids: readonly number[], effects: readonly MoveEffect[], effectId = 1): void {
    for (const id of ids) moveRules.set(id, { effectId, effects });
}

// Secondary-effect records are absent from the export. These IDs are explicitly audited
// against their descriptions; text is never parsed at runtime to invent an effect.
moves([40, 123, 124, 188, 342, 398, 440, 441, 482], [status('poison', 'possible')]);
moves([305, 847], [status('bad-poison', 'possible')]);
moves([7, 52, 53, 126, 172, 221, 257, 299, 503, 551, 592, 708, 743], [status('burn', 'possible')]);
moves([9, 34, 84, 85, 122, 209, 395, 435, 550, 677], [status('paralysis', 'possible')]);
moves([8, 58, 181, 749], [status('freeze', 'possible')]);
moves([60, 93, 146, 324, 352, 431, 718], [status('confusion', 'possible')]);
moves(
    [
        23, 29, 44, 125, 157, 158, 302, 310, 326, 399, 403, 407, 428, 442, 531, 537, 556, 670, 678,
        689, 750, 764,
    ],
    [status('flinch', 'possible')],
);
moves([192, 609, 681], [status('paralysis')]);
moves([517, 682], [status('burn')]);
moves([223, 448], [status('confusion')]);
moves([794], [status('poison')]);
moves([422], [status('paralysis', 'possible'), status('flinch', 'possible')]);
moves([423], [status('frostbite', 'possible'), status('flinch', 'possible')]);
moves([424], [status('burn', 'possible'), status('flinch', 'possible')]);
moves(
    [755],
    [status('paralysis', 'possible'), status('poison', 'possible'), status('drowsy', 'possible')],
);
moves([37, 80, 200, 761], [status('confusion', 'conditional', 'self')]);
moves([735], [status('burn', 'conditional')]);
moves([842], [status('confusion', 'conditional')]);

moves(
    [51, 94, 247, 295, 405, 411, 412, 414, 430, 465],
    [stat('spDefense', 'down', 'target', 'possible')],
);
moves([61, 132, 145], [stat('speed', 'down', 'target', 'possible')]);
moves([62, 583, 769], [stat('attack', 'down', 'target', 'possible')]);
moves([231, 242, 249, 306, 534, 662, 664], [stat('defense', 'down', 'target', 'possible')]);
moves([296, 585], [stat('spAttack', 'down', 'target', 'possible')]);
moves([190, 330, 426, 429, 536, 539], [stat('accuracy', 'down', 'target', 'possible')]);
moves([189], [stat('accuracy', 'down')]);
moves([196, 317, 341, 490, 527, 549, 706, 810, 831], [stat('speed', 'down')]);
moves([491, 715, 783], [stat('spDefense', 'down')]);
moves([522, 555, 595, 717, 734], [stat('spAttack', 'down')]);
moves([642, 651, 712, 812], [stat('attack', 'down')]);
moves([643, 751], [stat('defense', 'down')]);
moves([771], [stat('defense', 'down', 'target', 'possible'), status('flinch', 'possible')]);

moves([232, 309], [stat('attack', 'up', 'self', 'possible')]);
moves([451, 552], [stat('spAttack', 'up', 'self', 'possible')]);
moves([756], [stat('defense', 'up', 'self', 'possible')]);
moves([246, 466], boostAll('possible'));
moves([612], [stat('attack', 'up')]);
moves([488, 768, 800, 811], [stat('speed', 'up')]);
moves([760, 799], [stat('spAttack', 'up')]);
moves([315, 354, 434, 437, 659, 802], [stat('spAttack', 'down', 'self')]);
moves([359, 628, 787], [stat('speed', 'down', 'self')]);
moves([370, 620, 766, 816], [stat('defense', 'down', 'self'), stat('spDefense', 'down', 'self')]);
moves([654], [stat('defense', 'down', 'self')]);
moves(
    [557],
    [
        stat('defense', 'down', 'self'),
        stat('spDefense', 'down', 'self'),
        stat('speed', 'down', 'self'),
    ],
);
moves([36, 38, 66, 344, 413, 452, 457, 528, 543, 617, 762], [hp('recoil')]);
moves([394], [status('burn', 'possible'), hp('recoil')]);

// Exceptions within other heterogeneous engine families replace that family's badges.
moves([591], [stat('defense', 'up', 'self', 'possible')], 0);
moves([786], [stat('attack', 'up', 'target'), stat('defense', 'down')], 0);
moves([830], [hp('drain'), status('burn', 'possible')], 3);
moves([727], [stat('speed', 'up'), stat('defense', 'down', 'self')], 25);
moves([781], [hp('recoil', 'conditional'), status('confusion', 'possible')], 36);
moves([553], [status('paralysis', 'possible')], 58);
moves([554], [status('burn', 'possible')], 58);
moves([728], [stat('spAttack', 'up')], 58);
moves([588], [stat('attack', 'down', 'target', 'conditional')], 87);
moves([624], [status('poison', 'conditional')], 87);
moves([720], [stat('defense', 'down', 'target', 'conditional')], 87);
moves([780], [stat('speed', 'down', 'target', 'conditional')], 87);
moves([836], [status('burn', 'conditional')], 87);
moves([87], [status('paralysis', 'possible')], 118);
moves([542], [status('confusion', 'possible')], 118);
moves([340], [status('paralysis', 'possible')], 121);
moves([252], [status('flinch', 'conditional')], 124);
moves([767], [status('poison', 'possible')], 137);
moves([772], [status('burn', 'possible')], 137);
moves([774], [stat('speed', 'down', 'target', 'possible')], 342);
moves([775], [status('paralysis', 'possible')], 342);
moves([776], [status('burn', 'possible')], 342);

/** Conservative effect badges for the audited Emerald EX 1.0.4 move catalog. */
export function getMoveEffects(
    move: Pick<Move, 'moveId' | 'effectId' | 'targetId' | 'categoryId'>,
): MoveEffect[] {
    const override = moveRules.get(move.moveId);
    const effects = override
        ? override.effectId === move.effectId
            ? override.effects
            : []
        : (effectRules[move.effectId] ?? []);
    return effects.map((effect) => ({ ...effect }));
}
