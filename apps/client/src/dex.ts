import type { BaseStats } from '@pokemon-emerald-ex-dex/shared';

export type { DexSort, Pokemon } from '@pokemon-emerald-ex-dex/shared';

export const statLabels: ReadonlyArray<{ key: keyof BaseStats; label: string; short: string }> = [
    { key: 'hp', label: 'HP', short: 'HP' },
    { key: 'attack', label: 'Attack', short: 'Atk' },
    { key: 'defense', label: 'Defense', short: 'Def' },
    { key: 'spAttack', label: 'Sp. Attack', short: 'SpA' },
    { key: 'spDefense', label: 'Sp. Defense', short: 'SpD' },
    { key: 'speed', label: 'Speed', short: 'Spe' },
];
