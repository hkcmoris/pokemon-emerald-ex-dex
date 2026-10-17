import type { KnownMove, OwnedPokemon } from '@pokemon-emerald-ex-dex/shared';

export interface CatchUpChanges {
    moves?: KnownMove[];
    evolutionSpeciesId?: number;
}

/** Apply the recap as one update without overwriting a newer level or form. */
export function applyCatchUpChanges(
    current: OwnedPokemon,
    expected: OwnedPokemon['state'],
    changes: CatchUpChanges,
): OwnedPokemon {
    if (
        current.deleted ||
        current.state.speciesId !== expected.speciesId ||
        current.state.formEpoch !== expected.formEpoch ||
        current.state.level !== expected.level
    )
        throw new Error('The Pokémon changed while this recap was open.');
    const evolved =
        changes.evolutionSpeciesId !== undefined &&
        changes.evolutionSpeciesId !== current.state.speciesId;
    return {
        ...current,
        state: {
            ...current.state,
            ...(changes.moves === undefined ? {} : { moves: changes.moves }),
            ...(evolved
                ? {
                      speciesId: changes.evolutionSpeciesId!,
                      formEpoch: crypto.randomUUID(),
                  }
                : {}),
        },
    };
}
