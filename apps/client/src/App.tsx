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
import { PokemonFilterSheet, getSortOptions } from './PokemonFilterSheet.js';
import { PokemonResults } from './PokemonResults.js';
import { navigationSnapshot, parseRoute, subscribeToNavigation } from './navigation.js';
import { useLanguage } from './language.js';
import { typeDisplayName } from './typeNames.js';

const pageSize = 40;

export function App() {
    const { t, locale, language } = useLanguage();
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
    const selectedTypeName = typeDisplayName(type, language);
    const sortLabel = getSortOptions(t).find((option) => option.value === sort)?.label;

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
            <div className="min-h-screen">
                <DexHeader version={dexMetadata?.version ?? '…'} />
                <main className="mx-auto max-w-7xl px-5 py-12">
                    <h1 className="text-3xl font-semibold">
                        {t('Page not found', 'Stránka nenalezena')}
                    </h1>
                    <a className="species-link mt-5 inline-block" href="#/">
                        ← {t('Back to dex', 'Zpět na Pokédex')}
                    </a>
                    <DexFooter />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            <DexHeader version={dexMetadata?.version ?? '…'} />
            <main className="dex-browse-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
                <div className="dex-browse-heading">
                    <div>
                        <p className="eyebrow">
                            {t('Hoenn field reference', 'Průvodce regionem Hoenn')}
                        </p>
                        <h1>Pokédex</h1>
                    </div>
                    <span className="dex-species-count">
                        <strong>
                            {dexMetadata?.speciesFormCount.toLocaleString(locale) ?? '…'}
                        </strong>
                        <span>{t('species & forms', 'druhů a forem')}</span>
                    </span>
                </div>
                <div className="dex-browse-toolbar">
                    <label className="dex-search-label">
                        <span className="sr-only">
                            {t(
                                'Find a Pokémon by name or species ID',
                                'Najít Pokémona podle názvu nebo ID druhu',
                            )}
                        </span>
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
                                placeholder={t('Search name or #0001', 'Hledat název nebo #0001')}
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
                            aria-label={t(
                                `Remove ${selectedTypeName} filter`,
                                `Odstranit filtr ${selectedTypeName}`,
                            )}
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
                            ? t('Dex unavailable', 'Pokédex není dostupný')
                            : loading
                              ? t('Loading species…', 'Načítání druhů…')
                              : species.isFetching
                                ? t('Updating results…', 'Aktualizace výsledků…')
                                : t(
                                      `${total.toLocaleString(locale)} results`,
                                      `Počet výsledků: ${total.toLocaleString(locale)}`,
                                  )}
                    </p>
                    <span>{sortLabel}</span>
                </div>
                {failed ? (
                    <div className="dex-list px-6 py-16 text-center" role="alert">
                        <h2 className="text-xl font-semibold">
                            {t('Couldn’t load the dex', 'Pokédex se nepodařilo načíst')}
                        </h2>
                        <p className="mt-2 text-sm text-stone-600">
                            {t(
                                'Check that the server is running, then try again.',
                                'Ověřte, že server běží, a zkuste to znovu.',
                            )}
                        </p>
                        <button
                            className="page-button mt-5"
                            onClick={() => {
                                void catalog.refetch();
                                void species.refetch();
                            }}
                        >
                            {t('Try again', 'Zkusit znovu')}
                        </button>
                    </div>
                ) : loading ? (
                    <div className="dex-list px-6 py-16 text-center" role="status">
                        {t('Loading the dex…', 'Načítání Pokédexu…')}
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
                            aria-label={t('Results pages', 'Stránky výsledků')}
                        >
                            <span className="text-xs text-stone-600">
                                {displayedPage * pageSize + 1}–
                                {Math.min((displayedPage + 1) * pageSize, total)} {t('of', 'z')}{' '}
                                {total}
                            </span>
                            <div className="flex items-center gap-3">
                                <button
                                    className="page-button"
                                    disabled={page === 0 || species.isFetching}
                                    onClick={() => setPage(page - 1)}
                                >
                                    {t('Previous', 'Předchozí')}
                                </button>
                                <span className="text-xs tabular-nums">
                                    {displayedPage + 1} / {pageCount}
                                </span>
                                <button
                                    className="page-button"
                                    disabled={page + 1 >= pageCount || species.isFetching}
                                    onClick={() => setPage(page + 1)}
                                >
                                    {t('Next', 'Další')}
                                </button>
                            </div>
                        </nav>
                    </section>
                ) : (
                    <div className="dex-list px-6 py-16 text-center">
                        <h2 className="text-xl font-semibold">
                            {t('No Pokémon found', 'Žádný Pokémon nenalezen')}
                        </h2>
                        <p className="mt-2 text-sm text-stone-600">
                            {t(
                                'Try another name, species ID, or type.',
                                'Zkuste jiný název, ID druhu nebo typ.',
                            )}
                        </p>
                        <button className="page-button mt-5" onClick={resetFilters}>
                            {t('Reset filters', 'Obnovit filtry')}
                        </button>
                    </div>
                )}
                <DexFooter />
            </main>
            <DexNavigation active="pokemon" />
        </div>
    );
}
