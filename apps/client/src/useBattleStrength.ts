import { useQueries, useQuery } from '@tanstack/react-query';
import type {
    CollectionConflict,
    CollectionDocument,
    OwnedPokemon,
} from '@pokemon-emerald-ex-dex/shared';

import { calculateBattleStrength, type BattleStrengthResult } from './battleStrength.js';
import { loadCollectionMove, loadCollectionSpecies } from './collectionSpecies.js';
import { loadCollectionTypeEffectiveness } from './collectionTypeEffectiveness.js';

export interface OwnedBattleStrength {
    result: BattleStrengthResult;
    loading: boolean;
    retry: () => void;
}

/** Card badges and collection ordering consume the same derived scores. */
export function useBattleStrength(
    pokemon: readonly OwnedPokemon[],
    document: CollectionDocument,
    conflicts: readonly CollectionConflict[],
    datasetId?: string,
): ReadonlyMap<string, OwnedBattleStrength> {
    const speciesIds = [...new Set(pokemon.map((entry) => entry.state.speciesId))];
    const moveIds = [
        ...new Set(pokemon.flatMap((entry) => entry.state.moves?.map((move) => move.moveId) ?? [])),
    ];
    const speciesQueries = useQueries({
        queries: speciesIds.map((id) => ({
            queryKey: ['collection-species', id],
            queryFn: () => loadCollectionSpecies(id),
            // Let the IndexedDB-first loader run even on an offline page reload.
            networkMode: 'offlineFirst' as const,
            staleTime: Infinity,
        })),
    });
    const speciesById = new Map(speciesIds.map((id, index) => [id, speciesQueries[index]]));
    const referenceMoves = new Map(
        speciesQueries.flatMap((query) =>
            query.data
                ? [...query.data.learnset, ...query.data.machines].map(
                      (move) => [move.moveId, move] as const,
                  )
                : [],
        ),
    );
    const moveQueries = useQueries({
        queries: moveIds.map((id) => ({
            queryKey: ['collection-move', id],
            queryFn: () => loadCollectionMove(id),
            // Cached species can supply the move even when move-index has never been written.
            enabled:
                !referenceMoves.has(id) &&
                pokemon
                    .filter((entry) => entry.state.moves?.some((move) => move.moveId === id))
                    .every((entry) => !speciesById.get(entry.state.speciesId)?.isFetching),
            networkMode: 'offlineFirst' as const,
            staleTime: Infinity,
        })),
    });
    const chart = useQuery({
        queryKey: ['collection-type-effectiveness', datasetId],
        queryFn: () => {
            if (!datasetId) throw new Error('Dataset unavailable');
            return loadCollectionTypeEffectiveness(datasetId);
        },
        enabled: Boolean(datasetId && pokemon.length),
        networkMode: 'offlineFirst',
        staleTime: Infinity,
    });
    const movesById = new Map(moveIds.map((id, index) => [id, moveQueries[index]]));
    const observations = Object.values(document.observations);

    return new Map(
        pokemon.map((entry) => {
            const species = speciesById.get(entry.state.speciesId);
            const moves =
                entry.state.moves?.map((move) => ({
                    reference: referenceMoves.get(move.moveId),
                    query: movesById.get(move.moveId),
                })) ?? [];
            const ownConflicts = conflicts.filter(
                (conflict) => conflict.entity === 'pokemon' && conflict.entityId === entry.id,
            );
            const result = calculateBattleStrength({
                pokemon: entry,
                observations: observations.filter(
                    (observation) => observation.pokemonId === entry.id,
                ),
                species: species?.data,
                moves: moves.flatMap(({ reference, query }) => {
                    const move = reference ?? query?.data;
                    return move ? [move] : [];
                }),
                chart: chart.data,
                stateConflict: ownConflicts.some((conflict) =>
                    ['state', 'deleted', '$entity'].includes(conflict.field),
                ),
                natureConflict: ownConflicts.some((conflict) => conflict.field === 'natureId'),
                observationConflict: conflicts.some(
                    (conflict) =>
                        conflict.entity === 'observations' &&
                        document.observations[conflict.entityId]?.pokemonId === entry.id,
                ),
            });
            return [
                entry.id,
                {
                    result,
                    loading:
                        result.status !== 'conflict' &&
                        (Boolean(species?.isFetching && !species.data) ||
                            (chart.isFetching && !chart.data) ||
                            moves.some(
                                ({ reference, query }) =>
                                    !reference && query?.isFetching && !query.data,
                            )),
                    retry: () => {
                        if (species && !species.data) void species.refetch();
                        if (datasetId && !chart.data) void chart.refetch();
                        for (const { reference, query } of moves)
                            if (!reference && query && !query.data) void query.refetch();
                    },
                },
            ];
        }),
    );
}
