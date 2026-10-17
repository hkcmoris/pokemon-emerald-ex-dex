import type { CollectionDocument, StatObservation } from '@pokemon-emerald-ex-dex/shared';

/** Save the measurement and its current level in one collection update. */
export function saveStatObservation(
    document: CollectionDocument,
    observation: StatObservation,
): CollectionDocument {
    const pokemon = document.pokemon[observation.pokemonId];
    const advancesLevel =
        !document.observations[observation.id] &&
        !observation.deleted &&
        pokemon &&
        !pokemon.deleted &&
        pokemon.state.speciesId === observation.speciesId &&
        pokemon.state.formEpoch === observation.formEpoch &&
        observation.level > pokemon.state.level;
    return {
        ...document,
        pokemon: advancesLevel
            ? {
                  ...document.pokemon,
                  [pokemon.id]: {
                      ...pokemon,
                      state: { ...pokemon.state, level: observation.level },
                  },
              }
            : document.pokemon,
        observations: { ...document.observations, [observation.id]: observation },
    };
}
