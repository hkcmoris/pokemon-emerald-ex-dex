import type {
    Ability,
    ApiResponse,
    DexDataset,
    PageResponse,
    Pokemon,
    PokemonType,
    SpeciesQuery,
    SpeciesDetails,
    SpeciesEvolution,
    Item,
    ItemPocket,
} from '@pokemon-emerald-ex-dex/shared';

import { apiUrl } from './apiUrl.js';

export class ApiRequestError extends Error {
    constructor(public readonly status: number) {
        super(`The dex API returned HTTP ${status}`);
    }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(apiUrl(`v1/${path}`), { signal });
    if (!response.ok) {
        throw new ApiRequestError(response.status);
    }
    return response.json() as Promise<T>;
}

export async function fetchSpeciesDetails(
    id: number,
    signal?: AbortSignal,
): Promise<SpeciesDetails> {
    const response = await get<ApiResponse<SpeciesDetails>>(`species/${id}/details`, signal);
    return response.data;
}

export async function fetchSpeciesEvolutions(
    id: number,
    signal?: AbortSignal,
): Promise<SpeciesEvolution[]> {
    const response = await get<ApiResponse<SpeciesEvolution[]>>(`species/${id}/evolution`, signal);
    return response.data;
}

export async function fetchCatalog(signal?: AbortSignal): Promise<{
    dataset: DexDataset;
    types: PokemonType[];
}> {
    const [dataset, types] = await Promise.all([
        get<ApiResponse<DexDataset>>('dataset', signal),
        get<ApiResponse<PokemonType[]>>('types', signal),
    ]);
    return { dataset: dataset.data, types: types.data };
}

export function fetchSpecies(
    query: SpeciesQuery,
    signal?: AbortSignal,
): Promise<PageResponse<Pokemon>> {
    const parameters = new URLSearchParams({
        q: query.q,
        type: query.type,
        sort: query.sort,
        page: String(query.page),
        pageSize: String(query.pageSize),
    });
    return get<PageResponse<Pokemon>>(`species?${parameters}`, signal);
}

export async function fetchItem(id: number, signal?: AbortSignal): Promise<Item> {
    return (await get<ApiResponse<Item>>(`items/${id}`, signal)).data;
}

export async function fetchItemPockets(signal?: AbortSignal): Promise<ItemPocket[]> {
    return (await get<ApiResponse<ItemPocket[]>>('item-pockets', signal)).data;
}

export function fetchItems(
    q: string,
    pocket: string,
    page: number,
    signal?: AbortSignal,
): Promise<PageResponse<Item>> {
    return get<PageResponse<Item>>(
        `items?${new URLSearchParams({ q, pocket, page: String(page), pageSize: '40' })}`,
        signal,
    );
}

export async function fetchAbility(id: number, signal?: AbortSignal): Promise<Ability> {
    return (await get<ApiResponse<Ability>>(`abilities/${id}`, signal)).data;
}

export function fetchAbilities(
    q: string,
    page: number,
    signal?: AbortSignal,
): Promise<PageResponse<Ability>> {
    return get<PageResponse<Ability>>(
        `abilities?${new URLSearchParams({ q, page: String(page), pageSize: '40' })}`,
        signal,
    );
}
