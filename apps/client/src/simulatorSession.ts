import type { BaseStats, OwnedPokemon, Pokemon } from '@pokemon-emerald-ex-dex/shared';

export interface EnemySetup {
    pokemon: Pokemon | null;
    level: string;
    picking: boolean;
    overrides: Record<'hp' | 'defense' | 'spDefense', string>;
}

export interface AttackerSetup {
    overrides: Record<'attack' | 'spAttack' | 'defense', string>;
    previewIds: number[];
    search: string;
}

const opponents = new Map<string, EnemySetup>();
const attackers = new Map<string, { fingerprint: string; setup: AttackerSetup }>();

export function emptyEnemySetup(): EnemySetup {
    return {
        pokemon: null,
        level: '',
        picking: true,
        overrides: { hp: '', defense: '', spDefense: '' },
    };
}

export function readSimulatorOpponent(dataset: string): EnemySetup {
    return structuredClone(opponents.get(dataset) ?? emptyEnemySetup());
}

export function rememberSimulatorOpponent(dataset: string, setup: EnemySetup): void {
    opponents.set(dataset, structuredClone(setup));
}

export function attackerFingerprint(pokemon: OwnedPokemon, stats: Partial<BaseStats>): string {
    return JSON.stringify([pokemon.state, pokemon.natureId, pokemon.ability, stats]);
}

export function readSimulatorAttacker(key: string, fingerprint: string): AttackerSetup {
    const saved = attackers.get(key);
    return saved?.fingerprint === fingerprint
        ? structuredClone(saved.setup)
        : { overrides: { attack: '', spAttack: '', defense: '' }, previewIds: [], search: '' };
}

export function rememberSimulatorAttacker(
    key: string,
    fingerprint: string,
    setup: AttackerSetup,
): void {
    attackers.set(key, { fingerprint, setup: structuredClone(setup) });
}

export function resetSimulatorSession(dataset: string): void {
    opponents.delete(dataset);
    for (const key of attackers.keys()) if (key.startsWith(`${dataset}:`)) attackers.delete(key);
}
