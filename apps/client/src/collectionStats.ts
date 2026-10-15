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

/** Extrapolate a later level from the latest two recorded levels in the current form. */
export function predictStats(
    pokemon: OwnedPokemon,
    observations: readonly StatObservation[],
    targetLevel: number = pokemon.state.level,
): Partial<BaseStats> {
    if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 100) return {};

    const latestByLevel = new Map<number, StatObservation[]>();
    for (const entry of observations) {
        if (
            entry.deleted ||
            entry.pokemonId !== pokemon.id ||
            entry.speciesId !== pokemon.state.speciesId ||
            entry.formEpoch !== pokemon.state.formEpoch
        )
            continue;
        const previous = latestByLevel.get(entry.level);
        const time = Date.parse(entry.recordedAt);
        const previousTime = previous ? Date.parse(previous[0].recordedAt) : -Infinity;
        if (time > previousTime) latestByLevel.set(entry.level, [entry]);
        else if (time === previousTime) previous?.push(entry);
    }

    const [latestLevel, previousLevel] = [...latestByLevel.keys()].sort((a, b) => b - a);
    if (previousLevel === undefined || latestLevel >= targetLevel) return {};
    const latest = latestByLevel.get(latestLevel)!;
    const previous = latestByLevel.get(previousLevel)!;
    // A lower level measured later does not describe chronological level-up growth.
    if (Date.parse(latest[0].recordedAt) < Date.parse(previous[0].recordedAt)) return {};

    const predicted: Partial<BaseStats> = {};
    for (const key of statKeys) {
        const from = previous[0].stats[key];
        const to = latest[0].stats[key];
        // Never bridge missing or conflicting values with an older measurement.
        if (
            from === undefined ||
            to === undefined ||
            !previous.every((entry) => entry.stats[key] === from) ||
            !latest.every((entry) => entry.stats[key] === to) ||
            to < from
        )
            continue;
        const value = Math.round(
            to + ((to - from) * (targetLevel - latestLevel)) / (latestLevel - previousLevel),
        );
        if (Number.isInteger(value) && value >= 1 && value <= 65535) predicted[key] = value;
    }
    return predicted;
}
