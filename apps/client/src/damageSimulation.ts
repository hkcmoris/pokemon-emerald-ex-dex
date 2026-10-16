import {
    getTypeDefenses,
    type BaseStats,
    type Move,
    type Pokemon,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { calculateMovePower } from './collectionMovePower.js';

export interface DamageSimulationInput {
    move?: Move;
    level: number;
    stats: Partial<BaseStats>;
    typeIds: readonly number[] | undefined;
    enemyStats: Partial<BaseStats>;
    enemyTypeIds: readonly number[] | undefined;
    chart: TypeEffectivenessChart | undefined;
}

export type DamageSimulation =
    | {
          status: 'available';
          min: number;
          max: number;
          minPercent: number | null;
          maxPercent: number | null;
          effectiveness: number;
          stab: 1 | 1.5;
          attackStat: 'attack' | 'spAttack' | 'defense';
          defenseStat: 'defense' | 'spDefense';
      }
    | { status: 'missing-data' | 'not-applicable' | 'unsupported' };

const statKeys = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const;
// ROM identifiers verified in docs/pokemon_emerald_ex_1.0.4_learnsets.json.
const shedinjaSpeciesId = 292;
const physicalDefenseMoveIds = new Set([473, 540, 548]); // Psyshock, Psystrike, Secret Sword.
const unusualEffectivenessMoveIds = new Set([
    485, // Synchronoise: fails unless the combatants share a type.
    560, // Flying Press: combines two attacking types.
    573, // Freeze-Dry: overrides the Water matchup.
    614, // Thousand Arrows: overrides Flying immunity.
    804, // Collision Course: additional damage when super-effective.
    805, // Electro Drift: additional damage when super-effective.
]);

function isPositiveInteger(value: number | undefined): value is number {
    return value !== undefined && Number.isSafeInteger(value) && value > 0;
}

function isValidLevel(level: number): boolean {
    return Number.isInteger(level) && level >= 1 && level <= 100;
}

/** Neutral nature, 31 IVs and 0 EVs; these are assumptions, never collection measurements. */
export function estimateEnemyStats(
    species: Pick<Pokemon, 'speciesId' | 'name' | 'stats'>,
    level: number,
): BaseStats | null {
    if (!isValidLevel(level)) return null;
    for (const key of statKeys) {
        const base = species.stats[key];
        if (!isPositiveInteger(base) || !Number.isSafeInteger((2 * base + 31) * level)) return null;
    }
    // https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/pokemon.c#L1473-L1528
    const stat = (base: number): number => Math.floor(((2 * base + 31) * level) / 100) + 5;
    return {
        hp:
            species.speciesId === shedinjaSpeciesId
                ? 1
                : Math.floor(((2 * species.stats.hp + 31) * level) / 100) + level + 10,
        attack: stat(species.stats.attack),
        defense: stat(species.stats.defense),
        spAttack: stat(species.stats.spAttack),
        spDefense: stat(species.stats.spDefense),
        speed: stat(species.stats.speed),
    };
}

// The engine rounds modifiers to nearest, with exact halves rounded down.
// All supported modifiers here are exact binary fractions (1/4, 1/2, 1, 3/2, 2, 4).
function roundHalfDown(value: number): number {
    return Math.ceil(value - 0.5);
}

/**
 * One-hit HP damage at the listed base power, with no battle-state modifiers.
 * Uses upstream integer base damage, random roll, STAB and combined type effectiveness.
 * https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9477-L9504
 * https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9770-L9820
 */
export function simulateMoveDamage(input: DamageSimulationInput): DamageSimulation {
    const { move, level, stats, typeIds, enemyStats, enemyTypeIds, chart } = input;
    const power = calculateMovePower(move, stats, typeIds);
    if (power.status !== 'available') return { status: power.status };
    if (!move) return { status: 'missing-data' };
    if (unusualEffectivenessMoveIds.has(move.moveId)) return { status: 'unsupported' };
    if (!isValidLevel(level) || !chart || !enemyTypeIds?.length) return { status: 'missing-data' };

    const defenses = getTypeDefenses(enemyTypeIds, chart);
    if (!defenses) return { status: 'missing-data' };
    const matchup = defenses.find((type) => type.typeId === move.typeId);
    const knownTypes = new Set(chart.types.map((type) => type.typeId));
    if (!matchup || typeIds?.some((typeId) => !knownTypes.has(typeId)))
        return { status: 'missing-data' };

    const defenseStat =
        move.categoryId === 0 || physicalDefenseMoveIds.has(move.moveId) ? 'defense' : 'spDefense';
    const defense = enemyStats[defenseStat];
    if (!isPositiveInteger(defense)) return { status: 'missing-data' };

    // Struggle ignores all type matchups, including Ghost immunity.
    const effectiveness = move.moveId === 165 ? 1 : matchup.multiplier;
    const numerator = (Math.floor((2 * level) / 5) + 2) * move.power * power.statValue;
    if (!Number.isSafeInteger(numerator)) return { status: 'missing-data' };
    const baseDamage = Math.floor(Math.floor(numerator / defense) / 50) + 2;
    if (!Number.isSafeInteger(baseDamage * 100)) return { status: 'missing-data' };

    const rollDamage = (roll: number): number => {
        if (effectiveness === 0) return 0;
        const randomized = Math.floor((baseDamage * roll) / 100);
        const withStab = roundHalfDown(randomized * power.stab);
        return Math.max(1, roundHalfDown(withStab * effectiveness));
    };
    const min = rollDamage(85);
    const max = rollDamage(100);
    return {
        status: 'available',
        min,
        max,
        minPercent: isPositiveInteger(enemyStats.hp) ? (min * 100) / enemyStats.hp : null,
        maxPercent: isPositiveInteger(enemyStats.hp) ? (max * 100) / enemyStats.hp : null,
        effectiveness,
        stab: power.stab,
        attackStat: power.stat,
        defenseStat,
    };
}
