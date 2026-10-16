import type { KnownMove, Move, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

export interface SimulatorMoveOption {
    move: KnownMove;
    reference?: Move;
    levels: number[];
    machines: string[];
    recorded: boolean;
}

/** Preview only the current form's moves, retaining any recorded inherited moves. */
export function getSimulatorMoveOptions(
    species: SpeciesDetails,
    knownMoves: readonly KnownMove[],
): SimulatorMoveOption[] {
    const options = new Map<number, SimulatorMoveOption>();
    function option(move: KnownMove): SimulatorMoveOption {
        let value = options.get(move.moveId);
        if (!value) {
            value = {
                move: { moveId: move.moveId, name: move.name },
                levels: [],
                machines: [],
                recorded: false,
            };
            options.set(move.moveId, value);
        }
        return value;
    }
    for (const move of knownMoves) option(move).recorded = true;
    for (const move of species.learnset) {
        const value = option(move);
        value.reference = move;
        if (!value.levels.includes(move.level)) value.levels.push(move.level);
    }
    for (const move of species.machines) {
        const value = option(move);
        value.reference ??= move;
        if (!value.machines.includes(move.machine)) value.machines.push(move.machine);
    }
    for (const value of options.values()) {
        value.levels.sort((a, b) => a - b);
        value.machines.sort();
    }
    return [...options.values()].sort((a, b) => a.move.name.localeCompare(b.move.name));
}
