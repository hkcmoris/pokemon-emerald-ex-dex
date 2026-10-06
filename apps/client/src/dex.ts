import statsTypes from '../../../docs/pokemon_emerald_ex_1.0.4_stats_types.json' with { type: 'json' };

export interface BaseStats {
    hp: number;
    attack: number;
    defense: number;
    spAttack: number;
    spDefense: number;
    speed: number;
}

export interface Pokemon {
    speciesId: number;
    name: string;
    types: readonly string[];
    typeIds: readonly number[];
    stats: BaseStats;
    baseStatTotal: number;
}

export type DexSort = 'id' | 'name' | 'total' | 'speed';

export const dexMetadata = statsTypes.metadata;
export const pokemon: readonly Pokemon[] = statsTypes.species;
export const pokemonTypes = [...new Set(pokemon.flatMap((entry) => entry.types))].sort();

export const statLabels: ReadonlyArray<{ key: keyof BaseStats; label: string; short: string }> = [
    { key: 'hp', label: 'HP', short: 'HP' },
    { key: 'attack', label: 'Attack', short: 'Atk' },
    { key: 'defense', label: 'Defense', short: 'Def' },
    { key: 'spAttack', label: 'Sp. Attack', short: 'SpA' },
    { key: 'spDefense', label: 'Sp. Defense', short: 'SpD' },
    { key: 'speed', label: 'Speed', short: 'Spe' },
];

export function filterPokemon(
    entries: readonly Pokemon[],
    query: string,
    type: string,
    sort: DexSort,
): Pokemon[] {
    const search = query.trim().toLowerCase();
    const id = search.replace(/^#/, '');
    const matches = entries.filter(
        (entry) =>
            (entry.name.toLowerCase().includes(search) ||
                (/^\d+$/.test(id) && entry.speciesId === Number(id))) &&
            (!type || entry.types.includes(type)),
    );

    return matches.sort((a, b) => {
        switch (sort) {
            case 'name':
                return a.name.localeCompare(b.name) || a.speciesId - b.speciesId;
            case 'total':
                return b.baseStatTotal - a.baseStatTotal || a.speciesId - b.speciesId;
            case 'speed':
                return b.stats.speed - a.stats.speed || a.speciesId - b.speciesId;
            default:
                return a.speciesId - b.speciesId;
        }
    });
}
