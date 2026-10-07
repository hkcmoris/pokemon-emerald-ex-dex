import type { BaseStats } from '@pokemon-emerald-ex-dex/shared';

export type { DexSort, Pokemon } from '@pokemon-emerald-ex-dex/shared';

export const statLabels: ReadonlyArray<{
    key: keyof BaseStats;
    label: string;
    labelCs: string;
    short: string;
}> = [
    { key: 'hp', label: 'HP', labelCs: 'HP', short: 'HP' },
    { key: 'attack', label: 'Attack', labelCs: 'Útok', short: 'Atk' },
    { key: 'defense', label: 'Defense', labelCs: 'Obrana', short: 'Def' },
    { key: 'spAttack', label: 'Sp. Attack', labelCs: 'Speciální útok', short: 'SpA' },
    { key: 'spDefense', label: 'Sp. Defense', labelCs: 'Speciální obrana', short: 'SpD' },
    { key: 'speed', label: 'Speed', labelCs: 'Rychlost', short: 'Spe' },
];
