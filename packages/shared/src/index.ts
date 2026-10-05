export interface PokemonSummary {
    speciesId: number;
    name: string;
    sameNameCount: number;
    moveCount: number;
    machineCount: number;
}
export interface LevelUpMove {
    level: number;
    moveId: number;
    move: string;
}
export interface MachineMove {
    machine: string;
    kind: 'TM' | 'HM';
    number: number;
    moveId: number;
    move: string;
}
export interface Evolution {
    fromSpeciesId: number;
    fromName: string;
    toSpeciesId: number;
    toName: string;
    methodId: number;
    method: string;
    trigger: string;
    level?: number | null;
    conditions: Record<string, unknown>;
    summary: string;
    internalOnly: boolean;
    rawParam: number;
}
export interface PokemonDetail extends PokemonSummary {
    learnset: LevelUpMove[];
    machines: MachineMove[];
    evolutionChain: Evolution[];
}
export interface PokemonList {
    pokemon: PokemonSummary[];
    total: number;
    page: number;
    pageSize: number;
}
export interface DexMetadata {
    game: string;
    version: string;
    speciesCount: number;
    moveCount: number;
    machineCount: number;
    evolutionCount: number;
}
export function normalizeSearch(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[’‘]/g, "'")
        .toLowerCase();
}
