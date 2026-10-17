import type { KnownMove, Move, OwnedPokemon, SpeciesDetails } from '@pokemon-emerald-ex-dex/shared';

export interface MoveCandidate extends KnownMove {
    reference?: Move;
    group: 'reached' | 'wanted' | 'level' | 'machine' | 'other';
    source?: { species: string; level?: number; machine?: string; currentForm: boolean };
}

const priorities: Record<MoveCandidate['group'], number> = {
    reached: 0,
    wanted: 1,
    level: 2,
    machine: 3,
    other: 4,
};

/** Rank recorded learning opportunities without assuming the player actually learned them. */
export function getMoveCandidates(
    pokemon: OwnedPokemon,
    family: readonly SpeciesDetails[],
    search: readonly Move[] = [],
    previousLevel = pokemon.state.level - 1,
): MoveCandidate[] {
    const wanted = new Set(pokemon.moveWishlist?.moves.map((move) => move.moveId));
    const candidates = new Map<number, MoveCandidate>();
    function add(candidate: MoveCandidate): void {
        const previous = candidates.get(candidate.moveId);
        if (
            !previous ||
            priorities[candidate.group] < priorities[previous.group] ||
            (priorities[candidate.group] === priorities[previous.group] &&
                candidate.source?.currentForm &&
                !previous.source?.currentForm)
        )
            candidates.set(candidate.moveId, candidate);
    }
    for (const species of family) {
        const currentForm = species.speciesId === pokemon.state.speciesId;
        for (const move of species.learnset) {
            const reached =
                currentForm && move.level > previousLevel && move.level <= pokemon.state.level;
            add({
                moveId: move.moveId,
                name: move.name,
                reference: move,
                group: reached
                    ? 'reached'
                    : wanted.has(move.moveId)
                      ? 'wanted'
                      : currentForm && move.level <= pokemon.state.level
                        ? 'level'
                        : 'other',
                source: { species: species.name, level: move.level, currentForm },
            });
        }
        for (const move of species.machines)
            add({
                moveId: move.moveId,
                name: move.name,
                reference: move,
                group: wanted.has(move.moveId) ? 'wanted' : currentForm ? 'machine' : 'other',
                source: { species: species.name, machine: move.machine, currentForm },
            });
    }
    for (const move of pokemon.moveWishlist?.moves ?? []) add({ ...move, group: 'wanted' });
    for (const move of search)
        add({ ...move, reference: move, group: wanted.has(move.moveId) ? 'wanted' : 'other' });
    return [...candidates.values()].sort(
        (left, right) =>
            priorities[left.group] - priorities[right.group] ||
            (right.source?.level ?? -1) - (left.source?.level ?? -1) ||
            left.name.localeCompare(right.name),
    );
}
