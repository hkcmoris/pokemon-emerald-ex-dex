import { useState } from 'react';

import {
    dexMetadata,
    filterPokemon,
    pokemon,
    pokemonTypes,
    statLabels,
    type DexSort,
    type Pokemon,
} from './dex.js';

const pageSize = 40;
const sortOptions: ReadonlyArray<{ value: DexSort; label: string }> = [
    { value: 'id', label: 'Species ID' },
    { value: 'name', label: 'Name A–Z' },
    { value: 'total', label: 'Highest stat total' },
    { value: 'speed', label: 'Highest speed' },
];

function TypeBadges({ types }: { types: readonly string[] }) {
    return (
        <span className="flex flex-wrap gap-1.5">
            {types.map((type) => (
                <span className="type-badge" data-type={type} key={type}>
                    {type}
                </span>
            ))}
        </span>
    );
}

function PokemonDetails({ entry }: { entry: Pokemon }) {
    return (
        <aside className="detail-panel" aria-labelledby="detail-title">
            <p className="eyebrow">Species / form {String(entry.speciesId).padStart(4, '0')}</p>
            <h2 id="detail-title" className="mt-3 text-3xl font-semibold wrap-break-word">
                {entry.name}
            </h2>
            <div className="mt-4">
                <TypeBadges types={entry.types} />
            </div>
            <div className="stat-total mt-8 flex items-end justify-between border-b pb-5">
                <h3 className="text-sm font-medium">Base stat total</h3>
                <span className="text-5xl tracking-tight tabular-nums">{entry.baseStatTotal}</span>
            </div>
            <dl className="mt-6 grid gap-4">
                {statLabels.map(({ key, label }) => (
                    <div key={key}>
                        <div className="mb-1.5 flex justify-between text-sm">
                            <dt>{label}</dt>
                            <dd className="font-semibold tabular-nums">{entry.stats[key]}</dd>
                        </div>
                        <div className="stat-track" aria-hidden="true">
                            <div
                                className="stat-fill"
                                style={{ width: `${(entry.stats[key] / 255) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </dl>
            <p className="mt-7 text-xs leading-relaxed text-stone-600">
                Base stats extracted from Emerald EX {dexMetadata.version}. Bars use a 0–255 scale.
                These are not calculated battle stats.
            </p>
        </aside>
    );
}

export function App() {
    const [query, setQuery] = useState('');
    const [type, setType] = useState('');
    const [sort, setSort] = useState<DexSort>('id');
    const [page, setPage] = useState(0);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const results = filterPokemon(pokemon, query, type, sort);
    const pageCount = Math.ceil(results.length / pageSize);
    const currentPage = Math.min(page, Math.max(0, pageCount - 1));
    const visible = results.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    const selected = results.find((entry) => entry.speciesId === selectedId) ?? results[0];

    function resetFilters() {
        setQuery('');
        setType('');
        setSort('id');
        setPage(0);
    }

    return (
        <div className="min-h-screen">
            <header className="dex-header">
                <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                    <div className="flex items-center justify-between gap-4">
                        <p className="eyebrow">Hoenn field reference</p>
                        <span className="version-tag">EX / {dexMetadata.version}</span>
                    </div>
                    <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
                        Emerald <span className="font-light">EX Dex</span>
                    </h1>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                        <p className="max-w-xl text-sm leading-relaxed text-emerald-100/80">
                            Every species. Every form. Explore the types and base stats of Pokémon
                            Emerald EX.
                        </p>
                        <p className="text-sm text-emerald-100">
                            <strong className="text-xl tabular-nums">
                                {pokemon.length.toLocaleString('en-US')}
                            </strong>{' '}
                            species & forms
                        </p>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
                <div className="mb-7 grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_180px_210px]">
                    <label className="filter-label">
                        Find a Pokémon
                        <input
                            className="filter-input"
                            type="search"
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
                            {pokemonTypes.map((value) => (
                                <option key={value} value={value}>
                                    {value}
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

                <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm text-stone-600" role="status">
                        {results.length.toLocaleString('en-US')} matching species & forms
                    </p>
                    <button className="text-button" onClick={resetFilters}>
                        Reset filters
                    </button>
                </div>

                {selected ? (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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
                                            <tr
                                                className={
                                                    entry.speciesId === selected.speciesId
                                                        ? 'selected-row'
                                                        : ''
                                                }
                                                key={entry.speciesId}
                                            >
                                                <td className="font-mono text-xs text-stone-500">
                                                    {String(entry.speciesId).padStart(4, '0')}
                                                </td>
                                                <th scope="row" className="text-left">
                                                    <button
                                                        className="pokemon-name"
                                                        aria-pressed={
                                                            entry.speciesId === selected.speciesId
                                                        }
                                                        onClick={() =>
                                                            setSelectedId(entry.speciesId)
                                                        }
                                                    >
                                                        {entry.name}
                                                    </button>
                                                    <TypeBadges types={entry.types} />
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
                                    {Math.min((currentPage + 1) * pageSize, results.length)} of{' '}
                                    {results.length}
                                </span>
                                <div className="flex items-center gap-3">
                                    <button
                                        className="page-button"
                                        disabled={currentPage === 0}
                                        onClick={() => setPage(currentPage - 1)}
                                    >
                                        Previous
                                    </button>
                                    <span className="text-xs tabular-nums">
                                        {currentPage + 1} / {pageCount}
                                    </span>
                                    <button
                                        className="page-button"
                                        disabled={currentPage + 1 >= pageCount}
                                        onClick={() => setPage(currentPage + 1)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </nav>
                        </section>
                        <PokemonDetails entry={selected} />
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

                <footer className="mt-8 flex flex-wrap justify-between gap-3 text-xs leading-relaxed text-stone-500">
                    <p>IDs are internal ROM species/form IDs. Forms can share a name.</p>
                    <a href="https://deerflow.tech" target="_blank" rel="noreferrer">
                        Created By Deerflow
                    </a>
                </footer>
            </main>
        </div>
    );
}
