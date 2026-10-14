import type { LearnsetEntry, SpeciesDetails } from './dex.js';

// The engine uses raw level 0 for moves offered on evolution, independently of
// level-1 entries used for other learnset purposes.
// https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/pokemon.c#L5927-L5950
export function getEvolutionMoves(species: SpeciesDetails): LearnsetEntry[] {
    const seen = new Set<number>();
    return species.learnset.filter((move) => {
        if (move.level !== 0 || seen.has(move.moveId)) return false;
        seen.add(move.moveId);
        return true;
    });
}
