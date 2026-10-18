import type { KnownMove, Move, TypeEffectivenessChart } from '@pokemon-emerald-ex-dex/shared';

import { getMoveEffectiveness } from './damageSimulation.js';

export type RecordedMoveMatchups =
    | { status: 'available'; moves: readonly { move: Move; multiplier: number }[] }
    | { status: 'unknown-moves' | 'no-damaging-moves' | 'missing-data' | 'unsupported' };

/** Compare only recorded damaging moves, never attacks inferred from the species' typing. */
export function getRecordedMoveMatchups(
    moves: readonly KnownMove[] | null,
    moveDetails: ReadonlyMap<number, Move>,
    defendingTypeIds: readonly number[],
    chart: TypeEffectivenessChart | undefined,
): RecordedMoveMatchups {
    if (moves === null) return { status: 'unknown-moves' };
    const details: Move[] = [];
    for (const moveId of new Set(moves.map((move) => move.moveId))) {
        const move = moveDetails.get(moveId);
        // Resolve the complete moveset before making any recommendation.
        if (!move || move.moveId !== moveId) return { status: 'missing-data' };
        details.push(move);
    }

    const matchups: { move: Move; multiplier: number }[] = [];
    for (const move of details) {
        const matchup = getMoveEffectiveness(move, defendingTypeIds, chart);
        if (matchup.status === 'not-applicable') continue;
        // An unmodeled attack could change which move is best; do not guess.
        if (matchup.status !== 'available') return { status: matchup.status };
        matchups.push({ move, multiplier: matchup.multiplier });
    }
    return matchups.length
        ? { status: 'available', moves: matchups }
        : { status: 'no-damaging-moves' };
}
