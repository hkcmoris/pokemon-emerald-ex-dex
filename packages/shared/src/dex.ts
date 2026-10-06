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

export interface SpeciesQuery {
    q: string;
    type: string;
    sort: DexSort;
    page: number;
    pageSize: number;
}

export interface ApiResponse<T> {
    data: T;
}

export interface PageResponse<T> extends ApiResponse<T[]> {
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

export interface DexDataset {
    datasetId: string;
    game: string;
    version: string;
    speciesFormCount: number;
}

export interface PokemonType {
    typeId: number;
    name: string;
}

export interface SpeciesType extends PokemonType {
    slot: number;
}

export interface Move {
    moveId: number;
    name: string;
    description: string;
    typeId: number;
    type: string;
    categoryId: number;
    category: string;
    power: number;
    accuracy: number;
    pp: number;
    priority: number;
    effectId: number;
    targetId: number;
}

export interface LearnsetEntry extends Move {
    entryOrder: number;
    level: number;
}

export interface Evolution {
    edgeOrder: number;
    fromSpeciesId: number;
    toSpeciesId: number;
    toName: string;
    methodId: number;
    method: string;
    trigger: string;
    level: number | null;
    conditions: Readonly<Record<string, unknown>>;
    summary: string;
    rawParam: number;
}

export interface Machine {
    machine: string;
    kind: 'TM' | 'HM';
    number: number;
    moveId: number;
    name: string;
}

export interface SpeciesMachine extends Move {
    machine: string;
    kind: 'TM' | 'HM';
    number: number;
}

export interface SpeciesEvolution extends Evolution {
    fromName: string;
    internalOnly: boolean;
}

export interface SpeciesDetails extends Pokemon {
    learnset: LearnsetEntry[];
    machines: SpeciesMachine[];
    evolutionLinks: SpeciesEvolution[];
}
