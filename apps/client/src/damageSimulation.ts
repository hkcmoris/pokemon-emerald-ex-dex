import {
    getTypeDefenses,
    type BaseStats,
    type Move,
    type Pokemon,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { calculateMovePower, getMovePowerSupport } from './collectionMovePower.js';

export interface DamageSimulationInput {
    move?: Move;
    abilityId?: number;
    attackerSpeciesId?: number;
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
          hits: { min: number; max: number };
          perHit: readonly { min: number; max: number }[];
          appliedAbility: 'skill-link' | null;
      }
    | { status: 'missing-data' | 'not-applicable' | 'unsupported' };

const statKeys = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'] as const;
// ROM identifiers verified in docs/pokemon_emerald_ex_1.0.4_learnsets.json.
const shedinjaSpeciesId = 292;
const physicalDefenseMoveIds = new Set([473, 540, 548]); // Psyshock, Psystrike, Secret Sword.
// ROM IDs differ from the National ability/move indexes. Keep these tied to the
// audited 1.0.4 exports, including their expected raw move effect IDs.
const skillLinkAbilityId = 92;
const battleBondAbilityId = 210;
const ashGreninjaSpeciesId = 1113;
const variableHitMoveIds = new Set([
    3, 4, 31, 42, 131, 140, 154, 198, 292, 331, 333, 350, 541, 594, 727,
]);
const doubleHitMoveIds = new Set([24, 41, 155, 458, 530, 544, 689, 697, 742, 814, 839]);

interface MoveHitPlan {
    min: number;
    powers: readonly number[];
    appliedAbility: 'skill-link' | null;
}

/** Hit-count ranges are conditional on the first hit landing, never expected damage. */
function getMoveHitPlan(
    move: Move,
    abilityId: number | undefined,
    attackerSpeciesId: number | undefined,
): MoveHitPlan | null {
    // Surging Strikes needs guaranteed critical hits; Battle Bond Water Shuriken
    // needs form-dependent power and count. Do not show ordinary-hit totals for them.
    if (
        move.moveId === 746 ||
        (move.moveId === 594 &&
            (abilityId === battleBondAbilityId || attackerSpeciesId === ashGreninjaSpeciesId))
    )
        return null;
    const skillLink = abilityId === skillLinkAbilityId;
    const variable = (min: number, powers: readonly number[]): MoveHitPlan => ({
        min: skillLink ? powers.length : min,
        powers,
        appliedAbility: skillLink ? 'skill-link' : null,
    });
    if (variableHitMoveIds.has(move.moveId)) {
        return move.effectId === 25 ? variable(2, Array<number>(5).fill(move.power)) : null;
    }
    if (doubleHitMoveIds.has(move.moveId) || move.moveId === 793) {
        return move.effectId === 1
            ? {
                  min: move.moveId === 793 ? 3 : 2,
                  powers: Array<number>(move.moveId === 793 ? 3 : 2).fill(move.power),
                  appliedAbility: null,
              }
            : null;
    }
    // Triple Kick and Triple Axel have increasing power and can stop after each
    // accuracy check. Skill Link skips subsequent checks (not the initial one).
    if (move.moveId === 167 || move.moveId === 741) {
        return move.effectId === 81
            ? variable(1, [move.power, move.power * 2, move.power * 3])
            : null;
    }
    if (move.moveId === 788) {
        return move.effectId === 330 ? variable(1, Array<number>(10).fill(move.power)) : null;
    }
    // A new/changed member of a multi-hit effect family needs an explicit audit.
    if ([25, 81, 330].includes(move.effectId)) return null;
    return { min: 1, powers: [move.power], appliedAbility: null };
}
const unusualEffectivenessMoveIds = new Set([
    485, // Synchronoise: fails unless the combatants share a type.
    560, // Flying Press: combines two attacking types.
    573, // Freeze-Dry: overrides the Water matchup.
    614, // Thousand Arrows: overrides Flying immunity.
    804, // Collision Course: additional damage when super-effective.
    805, // Electro Drift: additional damage when super-effective.
]);

export type MoveEffectiveness =
    | { status: 'available'; multiplier: number }
    | { status: 'missing-data' | 'not-applicable' | 'unsupported' };

/** Ordinary damaging moves only; no weakness claim for unmodeled mechanics. */
export function getMoveEffectiveness(
    move: Move | undefined,
    defendingTypeIds: readonly number[] | undefined,
    chart: TypeEffectivenessChart | undefined,
): MoveEffectiveness {
    const support = getMovePowerSupport(move);
    if (support !== 'supported') return { status: support };
    if (!move) return { status: 'missing-data' };
    if (unusualEffectivenessMoveIds.has(move.moveId)) return { status: 'unsupported' };
    if (!chart || !defendingTypeIds?.length) return { status: 'missing-data' };
    const defenses = getTypeDefenses(defendingTypeIds, chart);
    const matchup = defenses?.find((type) => type.typeId === move.typeId);
    if (!matchup) return { status: 'missing-data' };
    // Struggle ignores all type matchups, including Ghost immunity.
    return { status: 'available', multiplier: move.moveId === 165 ? 1 : matchup.multiplier };
}

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
 * Total HP damage across the move's possible hits, conditional on its first hit landing.
 * Each hit is rounded independently before summing; Skill Link fixes the hit count.
 * Uses upstream integer base damage, random roll, STAB and combined type effectiveness.
 * https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9477-L9504
 * https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9770-L9820
 */
export function simulateMoveDamage(input: DamageSimulationInput): DamageSimulation {
    const { move, level, stats, typeIds, enemyStats, enemyTypeIds, chart } = input;
    const power = calculateMovePower(move, stats, typeIds);
    if (power.status !== 'available') return { status: power.status };
    if (!move) return { status: 'missing-data' };
    const hitPlan = getMoveHitPlan(move, input.abilityId, input.attackerSpeciesId);
    if (!hitPlan) return { status: 'unsupported' };
    const matchup = getMoveEffectiveness(move, enemyTypeIds, chart);
    if (matchup.status !== 'available') return { status: matchup.status };
    if (!isValidLevel(level) || !chart) return { status: 'missing-data' };
    const knownTypes = new Set(chart.types.map((type) => type.typeId));
    if (typeIds?.some((typeId) => !knownTypes.has(typeId))) return { status: 'missing-data' };

    const defenseStat =
        move.categoryId === 0 || physicalDefenseMoveIds.has(move.moveId) ? 'defense' : 'spDefense';
    const defense = enemyStats[defenseStat];
    if (!isPositiveInteger(defense)) return { status: 'missing-data' };

    const effectiveness = matchup.multiplier;
    const rollDamage = (baseDamage: number, roll: number): number => {
        if (effectiveness === 0) return 0;
        const randomized = Math.floor((baseDamage * roll) / 100);
        const withStab = roundHalfDown(randomized * power.stab);
        return Math.max(1, roundHalfDown(withStab * effectiveness));
    };
    const perHit: { min: number; max: number }[] = [];
    for (const hitPower of hitPlan.powers) {
        const numerator = (Math.floor((2 * level) / 5) + 2) * hitPower * power.statValue;
        if (!Number.isSafeInteger(numerator)) return { status: 'missing-data' };
        const baseDamage = Math.floor(Math.floor(numerator / defense) / 50) + 2;
        if (!Number.isSafeInteger(baseDamage * 100)) return { status: 'missing-data' };
        perHit.push({ min: rollDamage(baseDamage, 85), max: rollDamage(baseDamage, 100) });
    }
    const min = perHit.slice(0, hitPlan.min).reduce((sum, hit) => sum + hit.min, 0);
    const max = perHit.reduce((sum, hit) => sum + hit.max, 0);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) return { status: 'missing-data' };
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
        hits: { min: hitPlan.min, max: perHit.length },
        perHit,
        appliedAbility: hitPlan.appliedAbility,
    };
}
