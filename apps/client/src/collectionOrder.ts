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
