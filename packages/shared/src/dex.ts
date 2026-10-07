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
    typeIconFiles: readonly (string | null)[];
    stats: BaseStats;
    baseStatTotal: number;
    sprites: SpeciesSprites | null;
}

export interface SpeciesSprites {
    front: string | null;
    shinyFront: string | null;
    frontFrame2: string | null;
    shinyFrontFrame2: string | null;
    back: string | null;
    shinyBack: string | null;
    frontFrameCount: number;
    missingReason: string | null;
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
    iconFile: string | null;
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
    typeIconFile: string | null;
    categoryId: number;
    category: string;
    categoryIconFile: string | null;
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
    items: RuleItem[];
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
    fromSprite: string | null;
    toSprite: string | null;
}

export interface SpeciesDetails extends Pokemon {
    abilities: SpeciesAbilitySlot[];
    learnset: LearnsetEntry[];
    machines: SpeciesMachine[];
    evolutionLinks: SpeciesEvolution[];
    evolutionFamily: SpeciesEvolution[];
    evolutionBaseSpeciesId: number;
    formInfo: SpeciesFormInfo | null;
    forms: SpeciesFormGroup | null;
    formChanges: FormChange[];
}

export interface SpeciesFormInfo {
    formGroupId: number;
    baseSpeciesId: number;
    isBaseForm: boolean;
    formKind: string;
    formLabel: string | null;
}

export interface FormGroupMember {
    speciesId: number;
    name: string;
    formKind: string;
    formLabel: string | null;
    isBaseForm: boolean;
    sprite: string | null;
}

export interface FormChange {
    changeOrder: number;
    sourceSpeciesId: number;
    sourceName: string;
    targetSpeciesId: number | null;
    rawTargetSpeciesId: number;
    targetName: string | null;
    restorePreviousForm: boolean;
    methodId: number;
    method: string;
    formKind: string;
    battleOnly: boolean;
    details: Readonly<Record<string, unknown>>;
    summary: string;
    rawParams: { param1: number; param2: number; param3: number };
    sourceSprite: string | null;
    targetSprite: string | null;
    items: RuleItem[];
}

export interface ItemPocket {
    pocketId: number;
    name: string;
}

export interface Item {
    itemId: number;
    name: string;
    pluralName: string | null;
    description: string;
    price: number;
    pocketId: number;
    pocket: string;
    secondaryId: number;
    holdEffectId: number;
    holdEffectParam: number;
    importance: number;
    notConsumed: boolean;
    itemUseTypeId: number;
    battleUsageId: number;
    flingPower: number;
    iconFile: string | null;
    rom: Readonly<Record<string, unknown>>;
}

export interface RuleItem {
    role: string;
    itemId: number;
    name: string;
    iconFile: string | null;
}

export interface SpeciesFormGroup {
    formGroupId: number;
    baseSpeciesId: number;
    baseName: string;
    members: FormGroupMember[];
    changes: FormChange[];
}

export interface AbilityFlags {
    cantBeCopied: boolean;
    cantBeSwapped: boolean;
    cantBeTraced: boolean;
    cantBeSuppressed: boolean;
    cantBeOverwritten: boolean;
    breakable: boolean;
    failsOnImposter: boolean;
}

export interface Ability {
    abilityId: number;
    name: string;
    description: string;
    aiRating: number;
    flags: AbilityFlags;
}

export interface SpeciesAbilitySlot {
    slot: 1 | 2 | 3;
    kind: 'normal' | 'hidden';
    ability: Ability | null;
}
