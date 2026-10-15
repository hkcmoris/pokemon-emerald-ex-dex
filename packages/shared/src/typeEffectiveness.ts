import type { PokemonType } from './dex.js';

export interface TypeMatchup {
    attackingTypeId: number;
    defendingTypeId: number;
    multiplier: number;
}

export interface TypeEffectivenessChart {
    types: PokemonType[];
    matchups: TypeMatchup[];
}

export interface TypeDefense extends PokemonType {
    multiplier: number;
}

/** A chart must explicitly include neutral matchups; missing rows are never treated as neutral. */
export function isTypeEffectivenessChart(value: unknown): value is TypeEffectivenessChart {
    if (typeof value !== 'object' || value === null) return false;
    const { types, matchups } = value as Partial<TypeEffectivenessChart>;
    if (!Array.isArray(types) || !Array.isArray(matchups) || types.length === 0) return false;
    const typeIds = new Set<number>();
    for (const type of types) {
        if (
            !type ||
            !Number.isSafeInteger(type.typeId) ||
            type.typeId < 0 ||
            typeof type.name !== 'string' ||
            !(type.iconFile === null || typeof type.iconFile === 'string') ||
            typeIds.has(type.typeId)
        )
            return false;
        typeIds.add(type.typeId);
    }
    if (matchups.length !== types.length * types.length) return false;
    const pairs = new Set<string>();
    for (const matchup of matchups) {
        if (
            !matchup ||
            !typeIds.has(matchup.attackingTypeId) ||
            !typeIds.has(matchup.defendingTypeId) ||
            ![0, 0.5, 1, 2].includes(matchup.multiplier)
        )
            return false;
        const key = `${matchup.attackingTypeId}:${matchup.defendingTypeId}`;
        if (pairs.has(key)) return false;
        pairs.add(key);
    }
    return true;
}

/** Incoming damage from each attacking type, based only on the Pokémon's defensive typing. */
export function getTypeDefenses(
    defendingTypeIds: readonly number[],
    chart: TypeEffectivenessChart,
): TypeDefense[] | null {
    if (!isTypeEffectivenessChart(chart)) return null;
    const defenders = [...new Set(defendingTypeIds)];
    const knownTypes = new Set(chart.types.map((type) => type.typeId));
    if (defenders.length === 0 || defenders.some((id) => !knownTypes.has(id))) return null;
    const matchups = new Map(
        chart.matchups.map((matchup) => [
            `${matchup.attackingTypeId}:${matchup.defendingTypeId}`,
            matchup.multiplier,
        ]),
    );
    return chart.types.map((type) => ({
        ...type,
        multiplier: defenders.reduce(
            (damage, defendingTypeId) =>
                damage * matchups.get(`${type.typeId}:${defendingTypeId}`)!,
            1,
        ),
    }));
}
