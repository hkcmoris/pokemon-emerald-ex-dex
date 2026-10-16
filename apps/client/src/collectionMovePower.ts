import type { BaseStats, Move } from '@pokemon-emerald-ex-dex/shared';

export type MovePower =
    | {
          status: 'available';
          value: number;
          stat: 'attack' | 'spAttack' | 'defense';
          statValue: number;
          stab: 1 | 1.5;
      }
    | { status: 'missing-data' | 'not-applicable' | 'unsupported' };

// IDs and descriptions come from docs/pokemon_emerald_ex_1.0.4_learnsets.json.
// These moves require a target, battle state, IVs or an item to select their stat/type.
const unsupportedMoveIds = new Set([
    237, // Hidden Power: type depends on IVs.
    311, // Weather Ball: type and power depend on weather.
    449, // Judgment: type depends on the held Plate.
    492, // Foul Play: uses the target's Attack.
    546, // Techno Blast: type depends on the held Drive.
    649, // Revelation Dance: uses the current first type, which can change in battle.
    672, // Multi-Attack: type depends on the held Memory.
    675, // Photon Geyser: category depends on the current offensive stats.
    711, // Aura Wheel: type depends on the battle form.
    729, // Shell Side Arm: category depends on both combatants' stats.
    733, // Terrain Pulse: type and power depend on terrain.
    779, // Tera Blast: type and category depend on Terastallization.
    801, // Raging Bull: type depends on the form.
    832, // Ivy Cudgel: type depends on the held mask.
    834, // Tera Starstorm: type depends on Terastallization/form.
    881, // Light That Burns the Sky: category depends on the current offensive stats.
]);

/** Attacker-side comparison score, not damage in HP: base power × recorded stat × STAB. */
export function calculateMovePower(
    move: Pick<Move, 'moveId' | 'power' | 'categoryId' | 'typeId'> | undefined,
    stats: Partial<BaseStats>,
    typeIds: readonly number[] | undefined,
): MovePower {
    if (!move) return { status: 'missing-data' };
    if (move.categoryId === 2 || move.power <= 0) return { status: 'not-applicable' };
    // The ROM uses 1 as a placeholder for fixed damage, variable power and OHKO moves.
    if (move.power === 1 || unsupportedMoveIds.has(move.moveId)) return { status: 'unsupported' };
    if (move.categoryId !== 0 && move.categoryId !== 1) return { status: 'unsupported' };
    if (
        !Number.isInteger(move.power) ||
        !Number.isInteger(move.typeId) ||
        move.typeId < 0 ||
        !typeIds?.length ||
        typeIds.some((typeId) => !Number.isInteger(typeId) || typeId < 0)
    )
        return { status: 'missing-data' };

    // Upstream mechanics: Body Press uses Defense; Struggle never receives STAB.
    // https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c
    const stat = move.moveId === 704 ? 'defense' : move.categoryId === 0 ? 'attack' : 'spAttack';
    const statValue = stats[stat];
    if (statValue === undefined || !Number.isInteger(statValue) || statValue <= 0)
        return { status: 'missing-data' };

    const stab = move.moveId !== 165 && typeIds.includes(move.typeId) ? 1.5 : 1;
    const value = Math.round(move.power * statValue * stab);
    if (!Number.isSafeInteger(value)) return { status: 'missing-data' };
    return { status: 'available', value, stat, statValue, stab };
}
