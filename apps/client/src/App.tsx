import { useEffect, useState, useSyncExternalStore } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { DexSort } from './dex.js';
import { fetchCatalog, fetchSpecies } from './api.js';
import { DexFooter } from './DexFooter.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { TypeBadges } from './TypeBadges.js';
import { SpeciesPage } from './SpeciesPage.js';
import { AbilitiesPage } from './AbilitiesPage.js';
import { ItemsPage } from './ItemsPage.js';
import { PokemonFilterSheet, sortOptions } from './PokemonFilterSheet.js';
import { PokemonResults } from './PokemonResults.js';
import { navigationSnapshot, parseRoute, subscribeToNavigation } from './navigation.js';

const pageSize = 40;

export function App() {
    const hash = useSyncExternalStore(subscribeToNavigation, navigationSnapshot, () => '');
    const route = parseRoute(hash);
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [hash]);
    const [query, setQuery] = useState('');
    const [type, setType] = useState('');
    const [sort, setSort] = useState<DexSort>('id');
    const [page, setPage] = useState(0);
    const catalog = useQuery({
        queryKey: ['catalog'],
        queryFn: ({ signal }) => fetchCatalog(signal),
    });
    const parameters = { q: query.trim(), type, sort, page: page + 1, pageSize };
    const species = useQuery({
        queryKey: ['species', parameters],
        queryFn: ({ signal }) => fetchSpecies(parameters, signal),
        enabled: catalog.isSuccess && route.kind === 'dex',
        placeholderData: keepPreviousData,
    });
    const dexMetadata = catalog.data?.dataset;
    const pokemonTypes = catalog.data?.types ?? [];
    const results = species.data?.data ?? [];
    const total = species.data?.meta.total ?? 0;
    const pageCount = species.data?.meta.totalPages ?? 0;
    const displayedPage = (species.data?.meta.page ?? 1) - 1;
    const failed = catalog.isError || species.isError;
    const loading = catalog.isPending || species.isPending;
    const selectedType = pokemonTypes.find((entry) => entry.name === type);
    const sortLabel = sortOptions.find((option) => option.value === sort)?.label;

    function resetFilters() {
        setQuery('');
        setType('');
        setSort('id');
        setPage(0);
    }

    function changeType(value: string) {
        setType(value);
        setPage(0);
    }

    if (route.kind === 'abilities' || route.kind === 'ability') {
        return (
            <AbilitiesPage
                key={route.kind === 'ability' ? route.id : 'abilities'}
                abilityId={route.kind === 'ability' ? route.id : undefined}
                version={dexMetadata?.version ?? '…'}
            />
        );
    }
    if (route.kind === 'items' || route.kind === 'item') {
        return (
            <ItemsPage
                key={route.kind === 'item' ? route.id : 'items'}
                itemId={route.kind === 'item' ? route.id : undefined}
                version={dexMetadata?.version ?? '…'}
            />
        );
    }
    if (route.kind === 'species') {
        return (
            <SpeciesPage
                speciesId={route.id}
                version={dexMetadata?.version ?? '…'}
                datasetId={dexMetadata?.datasetId}
            />
        );
    }
    if (route.kind === 'not-found') {
        return (
            <main className="mx-auto max-w-7xl px-5 py-12">
                <h1 className="text-3xl font-semibold">Page not found</h1>
                <a className="species-link mt-5 inline-block" href="#/">
                    ← Back to dex
                </a>
                <DexFooter />
            </main>
        );
    }

    return (
        <div className="min-h-screen">
            <DexHeader version={dexMetadata?.version ?? '…'} />
            <main className="dex-browse-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
                <div className="dex-browse-heading">
                    <div>
                        <p className="eyebrow">Hoenn field reference</p>
                        <h1>Pokédex</h1>
                    </div>
                    <span className="dex-species-count">
                        <strong>
                            {dexMetadata?.speciesFormCount.toLocaleString('en-US') ?? '…'}
                        </strong>
                        <span>species & forms</span>
                    </span>
                </div>
                <div className="dex-browse-toolbar">
                    <label className="dex-search-label">
                        <span className="sr-only">Find a Pokémon by name or species ID</span>
                        <span className="dex-search-field">
                            <svg
                                viewBox="0 0 24 24"
                                width="20"
                                height="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                aria-hidden="true"
                            >
                                <circle cx="10.5" cy="10.5" r="6.5" />
                                <path d="m16 16 4.5 4.5" />
                            </svg>
                            <input
                                className="filter-input"
                                type="search"
                                maxLength={100}
                                placeholder="Search name or #0001"
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setPage(0);
                                }}
                            />
                        </span>
                    </label>
                    <PokemonFilterSheet
                        types={pokemonTypes}
                        selectedType={type}
                        sort={sort}
                        resultCount={failed || loading ? undefined : total}
                        updating={species.isFetching}
                        onTypeChange={changeType}
                        onSortChange={(value) => {
                            setSort(value);
                            setPage(0);
                        }}
                        onReset={resetFilters}
                    />
                </div>
                {selectedType && (
                    <div className="dex-active-filters">
                        <button
                            className="active-filter-chip"
                            aria-label={`Remove ${type} filter`}
                            onClick={() => changeType('')}
                        >
                            <TypeBadges types={[type]} iconFiles={[selectedType.iconFile]} />
                            <span aria-hidden="true">×</span>
                        </button>
                    </div>
                )}
                <div className="dex-browse-summary">
                    <p role="status">
                        {failed
                            ? 'Dex unavailable'
                            : loading
                              ? 'Loading species…'
                              : species.isFetching
                                ? 'Updating results…'
                                : `${total.toLocaleString('en-US')} results`}
                    </p>
                    <span>{sortLabel}</span>
                </div>
                {failed ? (
                    <div className="dex-list px-6 py-16 text-center" role="alert">
                        <h2 className="text-xl font-semibold">Couldn’t load the dex</h2>
                        <p className="mt-2 text-sm text-stone-600">
                            Check that the server is running, then try again.
                        </p>
                        <button
                            className="page-button mt-5"
                            onClick={() => {
                                void catalog.refetch();
                                void species.refetch();
                            }}
                        >
                            Try again
                        </button>
                    </div>
                ) : loading ? (
                    <div className="dex-list px-6 py-16 text-center" role="status">
                        Loading the dex…
                    </div>
                ) : results.length > 0 ? (
                    <section
                        className="dex-results dex-list"
                        aria-label="Pokémon"
                        aria-busy={species.isFetching}
                    >
                        <PokemonResults
                            entries={results}
                            datasetId={dexMetadata?.datasetId}
                            sort={sort}
                        />
                        <nav
                            className="dex-pagination flex flex-wrap items-center justify-between gap-3 border-t p-4"
                            aria-label="Results pages"
                        >
                            <span className="text-xs text-stone-600">
                                {displayedPage * pageSize + 1}–
                                {Math.min((displayedPage + 1) * pageSize, total)} of {total}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    className="page-button"
                                    disabled={page === 0 || species.isFetching}
                                    onClick={() => setPage(page - 1)}
                                >
                                    Previous
                                </button>
                                <span className="text-xs tabular-nums">
                                    {displayedPage + 1} / {pageCount}
                                </span>
                                <button
                                    className="page-button"
                                    disabled={page + 1 >= pageCount || species.isFetching}
                                    onClick={() => setPage(page + 1)}
                                >
                                    Next
                                </button>
                            </div>
                        </nav>
                    </section>
                ) : (
                    <div className="dex-list px-6 py-16 text-center">
                        <h2 className="text-xl font-semibold">No Pokémon found</h2>
                        <p className="mt-2 text-sm text-stone-600">
                            Try another name, species ID, or type.
                        </p>
                        <button className="page-button mt-5" onClick={resetFilters}>
                            Reset filters
                        </button>
                    </div>
                )}
                <DexFooter />
            </main>
            <DexNavigation active="pokemon" />
        </div>
    );
}
