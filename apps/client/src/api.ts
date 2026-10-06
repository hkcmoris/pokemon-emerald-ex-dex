import type {
    ApiResponse,
    DexDataset,
    PageResponse,
    Pokemon,
    PokemonType,
    SpeciesQuery,
} from '@pokemon-emerald-ex-dex/shared';

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`/api/v1/${path}`, { signal });
    if (!response.ok) {
        throw new Error(`The dex API returned HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
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
