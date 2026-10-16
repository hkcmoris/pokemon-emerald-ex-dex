import type { BaseStats } from './dex.js';

export interface PokemonNature {
    readonly id: number;
    readonly name: string;
    readonly increasedStat: Exclude<keyof BaseStats, 'hp'> | null;
    readonly decreasedStat: Exclude<keyof BaseStats, 'hp'> | null;
}

/** Canonical nature IDs and effects from pokeemerald-expansion's nature stat table. */
export const pokemonNatures: readonly PokemonNature[] = [
    { id: 0, name: 'Hardy', increasedStat: null, decreasedStat: null },
    { id: 1, name: 'Lonely', increasedStat: 'attack', decreasedStat: 'defense' },
    { id: 2, name: 'Brave', increasedStat: 'attack', decreasedStat: 'speed' },
    { id: 3, name: 'Adamant', increasedStat: 'attack', decreasedStat: 'spAttack' },
    { id: 4, name: 'Naughty', increasedStat: 'attack', decreasedStat: 'spDefense' },
    { id: 5, name: 'Bold', increasedStat: 'defense', decreasedStat: 'attack' },
    { id: 6, name: 'Docile', increasedStat: null, decreasedStat: null },
    { id: 7, name: 'Relaxed', increasedStat: 'defense', decreasedStat: 'speed' },
    { id: 8, name: 'Impish', increasedStat: 'defense', decreasedStat: 'spAttack' },
    { id: 9, name: 'Lax', increasedStat: 'defense', decreasedStat: 'spDefense' },
    { id: 10, name: 'Timid', increasedStat: 'speed', decreasedStat: 'attack' },
    { id: 11, name: 'Hasty', increasedStat: 'speed', decreasedStat: 'defense' },
    { id: 12, name: 'Serious', increasedStat: null, decreasedStat: null },
    { id: 13, name: 'Jolly', increasedStat: 'speed', decreasedStat: 'spAttack' },
    { id: 14, name: 'Naive', increasedStat: 'speed', decreasedStat: 'spDefense' },
    { id: 15, name: 'Modest', increasedStat: 'spAttack', decreasedStat: 'attack' },
    { id: 16, name: 'Mild', increasedStat: 'spAttack', decreasedStat: 'defense' },
    { id: 17, name: 'Quiet', increasedStat: 'spAttack', decreasedStat: 'speed' },
    { id: 18, name: 'Bashful', increasedStat: null, decreasedStat: null },
    { id: 19, name: 'Rash', increasedStat: 'spAttack', decreasedStat: 'spDefense' },
    { id: 20, name: 'Calm', increasedStat: 'spDefense', decreasedStat: 'attack' },
    { id: 21, name: 'Gentle', increasedStat: 'spDefense', decreasedStat: 'defense' },
    { id: 22, name: 'Sassy', increasedStat: 'spDefense', decreasedStat: 'speed' },
    { id: 23, name: 'Careful', increasedStat: 'spDefense', decreasedStat: 'spAttack' },
    { id: 24, name: 'Quirky', increasedStat: null, decreasedStat: null },
];

/** Describe the nature's effect; recorded stats already include that effect in game. */
export function getNatureStatEffect(
    natureId: number | null | undefined,
    stat: keyof BaseStats,
): 'increased' | 'decreased' | null {
    const nature = pokemonNatures.find((entry) => entry.id === natureId);
    if (nature?.increasedStat === stat) return 'increased';
    if (nature?.decreasedStat === stat) return 'decreased';
    return null;
}
