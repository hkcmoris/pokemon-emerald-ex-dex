import { useInfiniteQuery } from '@tanstack/react-query';
import type { PageResponse, Pokemon, SpeciesQuery } from '@pokemon-emerald-ex-dex/shared';

import { fetchSpecies } from './api.js';

export type DexBrowseFilters = Pick<SpeciesQuery, 'q' | 'type' | 'sort'>;

export const dexBrowsePageSize = 40;

export function previousBrowsePage(page: PageResponse<Pokemon>): number | undefined {
    return page.meta.page > 1 ? page.meta.page - 1 : undefined;
}

export function nextBrowsePage(page: PageResponse<Pokemon>): number | undefined {
    return page.meta.page < page.meta.totalPages ? page.meta.page + 1 : undefined;
}

/** API order is authoritative, including ties when sorting by a stat or name. */
export function orderedBrowseResults(pages: readonly PageResponse<Pokemon>[]): Pokemon[] {
    const seen = new Set<number>();
    return [...pages]
        .sort((left, right) => left.meta.page - right.meta.page)
        .flatMap((page) =>
            page.data.filter((entry) => {
                if (seen.has(entry.speciesId)) return false;
                seen.add(entry.speciesId);
                return true;
            }),
        );
}

export function useDexBrowseResults({
    filters,
    datasetId,
    initialPage,
    initialData,
    enabled = true,
}: {
    filters: DexBrowseFilters;
    datasetId?: string;
    initialPage: number;
    initialData?: PageResponse<Pokemon>;
    enabled?: boolean;
}) {
    const page = Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1;
    const seed =
        initialData?.meta.page === page && initialData.meta.pageSize === dexBrowsePageSize
            ? initialData
            : undefined;
    return useInfiniteQuery({
        queryKey: ['species-browse', datasetId, filters, page],
        initialPageParam: page,
        queryFn: ({ pageParam, signal }) =>
            fetchSpecies({ ...filters, page: pageParam, pageSize: dexBrowsePageSize }, signal),
        getPreviousPageParam: previousBrowsePage,
        getNextPageParam: nextBrowsePage,
        initialData: seed ? { pages: [seed], pageParams: [page] } : undefined,
        staleTime: 60_000,
        enabled,
    });
}
