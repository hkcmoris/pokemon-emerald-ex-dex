import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';

import { statLabels, type DexSort } from './dex.js';
import { fetchCatalog, fetchSpecies } from './api.js';
import { DexFooter } from './DexFooter.js';
import { TypeBadges } from './TypeBadges.js';
import { SpeciesPage } from './SpeciesPage.js';
import { SpeciesSprite } from './SpeciesSprite.js';
import { ItemsPage } from './ItemsPage.js';
import {
    navigationSnapshot,
    parseRoute,
    speciesHref,
    subscribeToNavigation,
} from './navigation.js';

const pageSize = 40;
const sortOptions: ReadonlyArray<{ value: DexSort; label: string }> = [
    { value: 'id', label: 'Species ID' },
    { value: 'name', label: 'Name A–Z' },
    { value: 'total', label: 'Highest stat total' },
    { value: 'speed', label: 'Highest speed' },
];

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
    });
    const dexMetadata = catalog.data?.dataset;
    const pokemonTypes = catalog.data?.types ?? [];
    const results = species.data?.data ?? [];
    const total = species.data?.meta.total ?? 0;
    const pageCount = species.data?.meta.totalPages ?? 0;
    const currentPage = page;
    const visible = results;
    const failed = catalog.isError || species.isError;
    const loading = catalog.isPending || species.isPending;

    function resetFilters() {
        setQuery('');
        setType('');
        setSort('id');
        setPage(0);
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
                key={route.id}
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
            <header className="dex-header">
                <div className="dex-list-header mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:block sm:px-8 sm:py-14">
                    <div className="contents sm:flex sm:items-center sm:justify-between sm:gap-4">
                        <p className="eyebrow hidden sm:block">Hoenn field reference</p>
                        <span className="version-tag col-start-2 row-start-1">
                            EX / {dexMetadata?.version ?? '…'}
                        </span>
                    </div>
                    <h1 className="col-start-1 row-start-1 text-2xl font-semibold tracking-tight sm:mt-6 sm:text-6xl">
                        Emerald <span className="font-light">EX Dex</span>
                    </h1>
                    <div className="hidden flex-wrap items-center justify-between gap-4 sm:mt-5 sm:flex">
                        <p className="hidden max-w-xl text-sm leading-relaxed text-emerald-100/80 sm:block">
                            Every species. Every form. Explore stats, moves, and evolutions in
                            Pokémon Emerald EX.
                        </p>
                        <p className="text-xs text-emerald-100 sm:text-sm">
                            <strong className="text-sm tabular-nums sm:text-xl">
                                {dexMetadata?.speciesFormCount.toLocaleString('en-US') ?? '…'}
                            </strong>{' '}
                            species & forms
                        </p>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-3 py-3 sm:px-8 sm:py-8">
                <nav className="dex-navigation mb-3" aria-label="Dex sections">
                    <a href="#/" aria-current="page">
                        Pokémon
                    </a>
                    <a href="#/items">Items</a>
                </nav>
                <div className="mb-3 grid grid-cols-2 items-end gap-2 sm:mb-7 sm:grid-cols-[minmax(0,1fr)_180px_210px] sm:gap-4">
                    <label className="filter-label col-span-2 sm:col-span-1">
                        Find a Pokémon
                        <input
                            className="filter-input"
                            type="search"
                            maxLength={100}
                            placeholder="Name or species ID, e.g. Bulbasaur or #0001"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setPage(0);
                            }}
                        />
                    </label>
                    <label className="filter-label">
                        Type
                        <select
                            className="filter-input"
                            value={type}
                            onChange={(event) => {
                                setType(event.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="">All types</option>
                            {pokemonTypes.map(({ typeId, name }) => (
                                <option key={typeId} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="filter-label">
                        Sort by
                        <select
                            className="filter-input"
                            value={sort}
                            onChange={(event) => {
                                const option = sortOptions.find(
                                    (option) => option.value === event.target.value,
                                );
                                if (option) setSort(option.value);
                                setPage(0);
                            }}
                        >
                            {sortOptions.map(({ value, label }) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                    <p className="text-xs text-stone-600 sm:text-sm" role="status">
                        {failed
                            ? 'Dex unavailable'
                            : loading
                              ? 'Loading species…'
                              : `${total.toLocaleString('en-US')} matching species & forms`}
                    </p>
                    <button className="text-button" onClick={resetFilters}>
                        Reset filters
                    </button>
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
                    <div>
                        <section className="dex-list" aria-label="Pokémon results">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <caption className="sr-only">
                                        Pokémon types and base stats. Select a name to view details.
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col">ID</th>
                                            <th scope="col">Pokémon / Types</th>
                                            {statLabels.map(({ key, label, short }) => (
                                                <th scope="col" className="text-right" key={key}>
                                                    <abbr title={label}>{short}</abbr>
                                                </th>
                                            ))}
                                            <th scope="col" className="text-right">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visible.map((entry) => (
                                            <tr key={entry.speciesId}>
                                                <td className="font-mono text-xs text-stone-500">
                                                    {String(entry.speciesId).padStart(4, '0')}
                                                </td>
                                                <th scope="row" className="text-left">
                                                    <div className="flex items-center gap-3">
                                                        <SpeciesSprite
                                                            datasetId={dexMetadata?.datasetId}
                                                            file={entry.sprites?.front ?? null}
                                                            name={entry.name}
                                                        />
                                                        <div>
                                                            <a
                                                                className="pokemon-name"
                                                                href={speciesHref(entry.speciesId)}
                                                            >
                                                                {entry.name}
                                                            </a>
                                                            <TypeBadges
                                                                types={entry.types}
                                                                iconFiles={entry.typeIconFiles}
                                                            />
                                                        </div>
                                                    </div>
                                                </th>
                                                {statLabels.map(({ key }) => (
                                                    <td
                                                        className="text-right tabular-nums"
                                                        key={key}
                                                    >
                                                        {entry.stats[key]}
                                                    </td>
                                                ))}
                                                <td className="text-right font-semibold tabular-nums">
                                                    {entry.baseStatTotal}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <nav
                                className="flex flex-wrap items-center justify-between gap-3 border-t p-4"
                                aria-label="Results pages"
                            >
                                <span className="text-xs text-stone-600">
                                    {currentPage * pageSize + 1}–
                                    {Math.min((currentPage + 1) * pageSize, total)} of {total}
                                </span>
                                <div className="flex items-center gap-3">
                                    <button
                                        className="page-button"
                                        disabled={currentPage === 0 || species.isFetching}
                                        onClick={() => setPage(currentPage - 1)}
                                    >
                                        Previous
                                    </button>
                                    <span className="text-xs tabular-nums">
                                        {currentPage + 1} / {pageCount}
                                    </span>
                                    <button
                                        className="page-button"
                                        disabled={
                                            currentPage + 1 >= pageCount || species.isFetching
                                        }
                                        onClick={() => setPage(currentPage + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </nav>
                        </section>
                    </div>
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
        </div>
    );
}
