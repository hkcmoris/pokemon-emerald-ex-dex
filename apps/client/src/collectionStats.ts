import {
    statKeys,
    type BaseStats,
    type OwnedPokemon,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

/** Read known stats from the latest measurement at the current level and form. */
export function getCurrentStats(
    pokemon: OwnedPokemon,
    observations: readonly StatObservation[],
): Partial<BaseStats> {
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
    const observation = latest[0];
    if (!observation) return {};

    const stats: Partial<BaseStats> = {};
    for (const key of statKeys) {
        const value = observation.stats[key];
        // Each displayed value must agree across tied measurements; never combine partial events.
        if (value !== undefined && latest.every((entry) => entry.stats[key] === value))
            stats[key] = value;
    }
    return stats;
}

/** Total the latest current-level/form measurement only when it contains all six stats. */
export function getCurrentStatTotal(
    pokemon: OwnedPokemon,
    observations: readonly StatObservation[],
): number | null {
    const stats = getCurrentStats(pokemon, observations);
    let total = 0;
    for (const key of statKeys) {
        const value = stats[key];
        if (value === undefined) return null;
        total += value;
    }
    return total;
}
