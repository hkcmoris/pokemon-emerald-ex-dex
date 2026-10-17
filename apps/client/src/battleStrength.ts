import {
    getNatureStatEffect,
    getTypeDefenses,
    statKeys,
    type BaseStats,
    type Move,
    type OwnedPokemon,
    type Pokemon,
    type StatObservation,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { calculateMovePower } from './collectionMovePower.js';
import { getCurrentStats } from './collectionStats.js';

export interface BattleStrengthInput {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    species?: Pokemon;
    moves?: readonly Move[];
    chart?: TypeEffectivenessChart;
    stateConflict?: boolean;
    observationConflict?: boolean;
    natureConflict?: boolean;
}

export interface BattleStrengthResult {
    status: 'available' | 'incomplete' | 'unavailable' | 'conflict';
    value: number | null;
    /** Point contributions to the total, before rounding. */
    parts: { stats: number | null; moves: number | null; typing: number | null };
    estimatedStats: readonly (keyof BaseStats)[];
    unsupportedMoves: readonly { moveId: number; name: string }[];
    reason: 'unknown-moves' | 'missing-reference' | 'conflict' | null;
}

type UtilityRole = 'healing' | 'setup' | 'control' | 'protection';
interface UtilityRule {
    effectId: number;
    targetId: number;
    role: UtilityRole;
    value: number;
    attackStat?: 'attack' | 'spAttack';
}

// Explicit ROM IDs/effects/targets, audited against the committed 1.0.4 learnset export.
// These are role values, not sums of move-effect badges. See docs/battle-strength-score.md.
const utilityRules: Readonly<Record<number, UtilityRule>> = {
    14: { effectId: 40, targetId: 16, role: 'setup', value: 0.1, attackStat: 'attack' },
    45: { effectId: 15, targetId: 8, role: 'control', value: 0.04 },
    79: { effectId: 2, targetId: 0, role: 'control', value: 0.1 },
    86: { effectId: 57, targetId: 0, role: 'control', value: 0.1 },
    92: { effectId: 28, targetId: 0, role: 'control', value: 0.1 },
    95: { effectId: 2, targetId: 0, role: 'control', value: 0.1 },
    97: { effectId: 42, targetId: 16, role: 'setup', value: 0.07 },
    105: { effectId: 27, targetId: 16, role: 'healing', value: 0.12 },
    113: { effectId: 29, targetId: 16, role: 'protection', value: 0.06 },
    115: { effectId: 55, targetId: 16, role: 'protection', value: 0.06 },
    135: { effectId: 123, targetId: 16, role: 'healing', value: 0.12 },
    147: { effectId: 2, targetId: 0, role: 'control', value: 0.1 },
    156: { effectId: 30, targetId: 16, role: 'healing', value: 0.08 },
    182: { effectId: 87, targetId: 16, role: 'protection', value: 0.04 },
    184: { effectId: 50, targetId: 0, role: 'control', value: 0.06 },
    197: { effectId: 87, targetId: 16, role: 'protection', value: 0.04 },
    204: { effectId: 48, targetId: 0, role: 'control', value: 0.06 },
    208: { effectId: 123, targetId: 16, role: 'healing', value: 0.12 },
    261: { effectId: 133, targetId: 0, role: 'control', value: 0.1 },
    303: { effectId: 27, targetId: 16, role: 'healing', value: 0.12 },
    334: { effectId: 41, targetId: 16, role: 'setup', value: 0.07 },
    339: { effectId: 167, targetId: 16, role: 'setup', value: 0.1, attackStat: 'attack' },
    347: { effectId: 169, targetId: 16, role: 'setup', value: 0.1, attackStat: 'spAttack' },
    349: { effectId: 170, targetId: 16, role: 'setup', value: 0.1, attackStat: 'attack' },
    355: { effectId: 192, targetId: 16, role: 'healing', value: 0.12 },
    417: { effectId: 43, targetId: 16, role: 'setup', value: 0.1, attackStat: 'spAttack' },
    483: { effectId: 230, targetId: 16, role: 'setup', value: 0.1, attackStat: 'spAttack' },
};

// These audited families cannot be compared as one ordinary, freely usable attack.
const unsupportedAttackEffects = new Set([
    4, 5, 25, 58, 93, 95, 117, 121, 125, 136, 155, 236, 273, 315, 322,
]);
const unsupportedAttackIds = new Set([
    // Recharge attacks share generic effect 1 with ordinary attacks.
    63, 307, 308, 338, 416, 439, 459, 665, 722, 723,
    // Nonstandard type matchups and conditional repeated use.
    485, 560, 573, 614, 804, 805, 819,
]);

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function emptyResult(
    status: 'unavailable' | 'conflict',
    reason: 'missing-reference' | 'conflict',
): BattleStrengthResult {
    return {
        status,
        value: null,
        parts: { stats: null, moves: null, typing: null },
        estimatedStats: [],
        unsupportedMoves: [],
        reason,
    };
}

function hasContradictoryMeasurements(
    pokemon: OwnedPokemon,
    observations: readonly StatObservation[],
): boolean {
    const current = observations.filter(
        (entry) =>
            !entry.deleted &&
            entry.pokemonId === pokemon.id &&
            entry.speciesId === pokemon.state.speciesId &&
            entry.formEpoch === pokemon.state.formEpoch &&
            entry.level === pokemon.state.level,
    );
    const latestTime = Math.max(...current.map((entry) => Date.parse(entry.recordedAt)));
    const latest = current.filter((entry) => Date.parse(entry.recordedAt) === latestTime);
    return statKeys.some(
        (key) =>
            new Set(latest.map((entry) => entry.stats[key]).filter((value) => value !== undefined))
                .size > 1,
    );
}

function estimateStat(pokemon: OwnedPokemon, species: Pokemon, key: keyof BaseStats): number {
    if (key === 'hp' && species.speciesId === 292) return 1;
    const scaled = Math.floor(((2 * species.stats[key] + 15) * pokemon.state.level) / 100);
    if (key === 'hp') return scaled + pokemon.state.level + 10;
    const effect = getNatureStatEffect(pokemon.natureId, key);
    const nature = effect === 'increased' ? 110 : effect === 'decreased' ? 90 : 100;
    return Math.floor(((scaled + 5) * nature) / 100);
}

function accuracyFactor(move: Move): number {
    // ROM zero means no normal accuracy check; special move logic is excluded separately.
    return move.accuracy === 0 ? 1 : move.accuracy / 100;
}

/** Fixed version-1 comparison heuristic, not a win probability or battle simulation. */
export function calculateBattleStrength(input: BattleStrengthInput): BattleStrengthResult {
    const { pokemon, observations, species, chart } = input;
    if (
        input.stateConflict ||
        input.observationConflict ||
        hasContradictoryMeasurements(pokemon, observations)
    )
        return emptyResult('conflict', 'conflict');
    if (
        !species ||
        species.speciesId !== pokemon.state.speciesId ||
        !chart ||
        !Number.isInteger(pokemon.state.level) ||
        pokemon.state.level < 1 ||
        pokemon.state.level > 100
    )
        return emptyResult('unavailable', 'missing-reference');
    const defenses = getTypeDefenses(species.typeIds, chart);
    if (!defenses) return emptyResult('unavailable', 'missing-reference');

    const recorded = getCurrentStats(pokemon, observations);
    const estimatedStats = statKeys.filter((key) => recorded[key] === undefined);
    if (input.natureConflict && estimatedStats.some((key) => key !== 'hp'))
        return emptyResult('conflict', 'conflict');
    const stats: BaseStats = { hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 };
    for (const key of statKeys) {
        if (
            recorded[key] === undefined &&
            (!Number.isSafeInteger(species.stats[key]) || species.stats[key] < 1)
        )
            return emptyResult('unavailable', 'missing-reference');
        stats[key] = recorded[key] ?? estimateStat(pokemon, species, key);
        if (!Number.isSafeInteger(stats[key]) || stats[key] < 1)
            return emptyResult('unavailable', 'missing-reference');
    }

    const references = new Map(input.moves?.map((move) => [move.moveId, move]));
    const equipped = [...new Map(pokemon.state.moves?.map((move) => [move.moveId, move])).values()];
    const bodyPress = equipped.some((move) => move.moveId === 704)
        ? references.get(704)
        : undefined;
    const usesDefense =
        bodyPress?.categoryId === 0 && bodyPress.effectId === 281 && bodyPress.power > 1;
    const offense = Math.max(stats.attack, stats.spAttack, usesDefense ? stats.defense : 0);
    const harmonicDefense =
        (2 * stats.defense * stats.spDefense) / (stats.defense + stats.spDefense);
    const bulk = Math.sqrt(stats.hp * harmonicDefense);
    const strength = clamp((0.45 * offense + 0.4 * bulk + 0.15 * stats.speed) / 300);
    // Neutral typing is 0.5; each type has equal weight. Immunity is better than 1/4 resistance.
    const severity = defenses.reduce(
        (sum, type) => sum + (type.multiplier === 0 ? 3 : -Math.log2(type.multiplier)),
        0,
    );
    const typing = clamp(0.5 + severity / (2 * chart.types.length));
    const parts: BattleStrengthResult['parts'] = {
        stats: 50 * strength,
        moves: null,
        typing: 15 * strength * typing,
    };
    const unsupportedMoves: { moveId: number; name: string }[] = [];
    let missingMoves = pokemon.state.moves === null;
    const attacks: {
        move: Move;
        expectedPower: number;
        stat: 'attack' | 'spAttack' | 'defense';
    }[] = [];
    const utilities: { move: Move; rule: UtilityRule }[] = [];
    for (const known of equipped) {
        const move = references.get(known.moveId);
        if (!move) {
            missingMoves = true;
            continue;
        }
        if (
            !Number.isInteger(move.accuracy) ||
            move.accuracy < 0 ||
            move.accuracy > 100 ||
            !chart.types.some((type) => type.typeId === move.typeId)
        )
            return emptyResult('unavailable', 'missing-reference');
        if (move.categoryId === 2) {
            const rule = utilityRules[move.moveId];
            if (
                rule &&
                rule.effectId === move.effectId &&
                rule.targetId === move.targetId &&
                move.power === 0
            )
                utilities.push({ move, rule });
            else unsupportedMoves.push({ moveId: known.moveId, name: known.name });
            continue;
        }
        const power = calculateMovePower(move, stats, species.typeIds);
        if (
            power.status !== 'available' ||
            unsupportedAttackEffects.has(move.effectId) ||
            unsupportedAttackIds.has(move.moveId)
        ) {
            unsupportedMoves.push({ moveId: known.moveId, name: known.name });
            continue;
        }
        attacks.push({
            move,
            stat: power.stat,
            expectedPower:
                move.power *
                power.stab *
                Math.min(1, power.statValue / offense) *
                accuracyFactor(move),
        });
    }
    if (missingMoves)
        return {
            status: 'incomplete',
            value: null,
            parts,
            estimatedStats,
            unsupportedMoves,
            reason: pokemon.state.moves === null ? 'unknown-moves' : 'missing-reference',
        };

    const matchups = new Map(
        chart.matchups.map((row) => [
            `${row.attackingTypeId}:${row.defendingTypeId}`,
            row.multiplier,
        ]),
    );
    const coverage =
        chart.types.reduce((sum, defender) => {
            let best = 0;
            for (const { move, expectedPower } of attacks) {
                const multiplier =
                    move.moveId === 165 ? 1 : matchups.get(`${move.typeId}:${defender.typeId}`)!;
                best = Math.max(best, expectedPower * multiplier);
            }
            return sum + clamp(best / 180);
        }, 0) / chart.types.length;
    const roles: Record<UtilityRole, number> = { healing: 0, setup: 0, control: 0, protection: 0 };
    for (const { move, rule } of utilities) {
        // Offensive setup needs a supported attack using that stat; no hypothetical future moves.
        const alignment = rule.attackStat
            ? attacks.some((attack) => attack.stat === rule.attackStat)
                ? stats[rule.attackStat] / offense
                : 0
            : 1;
        roles[rule.role] = Math.max(
            roles[rule.role],
            rule.value * alignment * accuracyFactor(move),
        );
    }
    const utility = Math.min(
        0.2,
        Object.values(roles).reduce((sum, value) => sum + value, 0),
    );
    parts.moves = 35 * strength * clamp(0.8 * coverage + utility);
    return {
        status: 'available',
        value: Math.round(parts.stats! + parts.moves + parts.typing!),
        parts,
        estimatedStats,
        unsupportedMoves,
        reason: null,
    };
}
