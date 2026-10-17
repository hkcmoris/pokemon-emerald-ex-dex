import type { OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

/** Show the active lineup first, keeping the remaining collection members in their existing order. */
export function orderCollectionPokemon(
    pokemon: readonly OwnedPokemon[],
    party: readonly string[],
): OwnedPokemon[] {
    return [...pokemon].sort((left, right) => {
        const leftIndex = party.indexOf(left.id);
        const rightIndex = party.indexOf(right.id);
        return (
            (leftIndex === -1 ? party.length : leftIndex) -
            (rightIndex === -1 ? party.length : rightIndex)
        );
    });
}

/** Rank the collection by score, retaining the default order for ties and unavailable scores. */
export function orderCollectionByScore(
    pokemon: readonly OwnedPokemon[],
    party: readonly string[],
    scores: ReadonlyMap<string, number | null>,
): OwnedPokemon[] {
    return orderCollectionPokemon(pokemon, party).sort((left, right) => {
        const leftScore = scores.get(left.id) ?? null;
        const rightScore = scores.get(right.id) ?? null;
        if (leftScore === null) return rightScore === null ? 0 : 1;
        if (rightScore === null) return -1;
        return rightScore - leftScore;
    });
}
