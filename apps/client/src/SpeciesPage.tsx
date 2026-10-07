import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LearnsetEntry, Pokemon, SpeciesMachine } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchSpeciesDetails } from './api.js';
import { EvolutionLine } from './EvolutionLine.js';
import { AbilitiesSection } from './AbilitiesSection.js';
import { FormsSection } from './FormsSection.js';
import { formDisplayName } from './forms.js';
import { DexFooter } from './DexFooter.js';
import { statLabels } from './dex.js';
import { TypeBadges } from './TypeBadges.js';
import { MoveCategory } from './MoveCategory.js';
import { SpeciesDetailHeader } from './SpeciesDetailHeader.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { speciesHref } from './navigation.js';

type SpeciesMove = LearnsetEntry | SpeciesMachine;

function MoveTable({
    entries,
    acquisition,
}: {
    entries: readonly SpeciesMove[];
    acquisition: 'Level' | 'Machine';
}) {
    return (
        <div className="overflow-x-auto">
            <table className="move-table w-full text-sm">
                <caption className="sr-only">
                    {acquisition === 'Level' ? 'Level-up moves' : 'Compatible machines'}. Expand a
                    move name for its description and full data.
                </caption>
                <thead>
                    <tr>
                        <th scope="col">{acquisition}</th>
                        <th scope="col">Move / Type</th>
                        <th scope="col">Category</th>
                        <th scope="col" className="text-right">
                            Power
                        </th>
                        <th scope="col" className="text-right">
                            Accuracy
                        </th>
                        <th scope="col" className="text-right">
                            PP
                        </th>
                        <th scope="col" className="text-right">
                            Priority
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((move) => (
                        <tr key={'machine' in move ? move.machine : move.entryOrder}>
                            <td className="align-top font-mono text-xs tabular-nums">
                                {'machine' in move ? move.machine : move.level}
                            </td>
                            <th scope="row" className="text-left align-top">
                                <details className="move-details">
                                    <summary>{move.name}</summary>
                                    <div className="move-description">
                                        <p>{move.description || 'No description recorded.'}</p>
                                        <dl className="rom-fields mt-3">
                                            <div>
                                                <dt>Move ID</dt>
                                                <dd>{move.moveId}</dd>
                                            </div>
                                            <div>
                                                <dt>Type ID</dt>
                                                <dd>{move.typeId}</dd>
                                            </div>
                                            <div>
                                                <dt>Category ID</dt>
                                                <dd>{move.categoryId}</dd>
                                            </div>
                                            <div>
                                                <dt>Effect ID</dt>
                                                <dd>{move.effectId}</dd>
                                            </div>
                                            <div>
                                                <dt>Target ID</dt>
                                                <dd>{move.targetId}</dd>
                                            </div>
                                            <div>
                                                <dt>Raw power / accuracy</dt>
                                                <dd>
                                                    {move.power} / {move.accuracy}
                                                </dd>
                                            </div>
                                            {'machine' in move ? (
                                                <div>
                                                    <dt>Machine kind / number</dt>
                                                    <dd>
                                                        {move.kind} / {move.number}
                                                    </dd>
                                                </div>
                                            ) : (
                                                <div>
                                                    <dt>Learnset entry order</dt>
                                                    <dd>{move.entryOrder}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    </div>
                                </details>
                                <div className="mt-2">
                                    <TypeBadges
                                        types={[move.type]}
                                        iconFiles={[move.typeIconFile]}
                                    />
                                </div>
                            </th>
                            <td className="align-top text-xs">
                                <MoveCategory
                                    category={move.category}
                                    iconFile={move.categoryIconFile}
                                />
                            </td>
                            <td
                                className="text-right align-top tabular-nums"
                                title={
                                    move.power === 0
                                        ? 'No fixed base power (ROM value 0)'
                                        : undefined
                                }
                            >
                                {move.power || '—'}
                            </td>
                            <td
                                className="text-right align-top tabular-nums"
                                title={
                                    move.accuracy === 0
                                        ? 'No normal percentage accuracy check (ROM value 0)'
                                        : undefined
                                }
                            >
                                {move.accuracy ? `${move.accuracy}%` : '—'}
                            </td>
                            <td className="text-right align-top tabular-nums">{move.pp}</td>
                            <td className="text-right align-top tabular-nums">
                                {move.priority > 0 ? `+${move.priority}` : move.priority}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function StatsPanel({ entry, version }: { entry: Pokemon; version: string }) {
    return (
        <aside className="detail-panel" aria-labelledby="stats-title">
            <div className="stat-total flex items-center justify-between gap-3 border-b pb-4">
                <h2 id="stats-title" className="text-lg font-semibold">
                    Base stats
                </h2>
                <div className="text-right">
                    <span className="text-2xl font-semibold tabular-nums">
                        {entry.baseStatTotal}
                    </span>
                    <span className="ml-2 text-xs text-stone-600">total</span>
                </div>
            </div>
            <dl className="stat-list mt-4 grid gap-3">
                {statLabels.map(({ key, label }) => (
                    <div key={key} className="stat-row">
                        <dt>{label}</dt>
                        <dd className="stat-measure">
                            <span className="font-mono font-semibold tabular-nums">
                                {entry.stats[key]}
                            </span>
                            <div className="stat-track" aria-hidden="true">
                                <div
                                    className="stat-fill"
                                    style={{ width: `${(entry.stats[key] / 255) * 100}%` }}
                                />
                            </div>
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-stone-600">
                Emerald EX {version} base stats. Bars use a 0–255 scale. These are not calculated
                battle stats.
            </p>
            <details className="rule-details mt-4 border-t border-stone-300 pt-4">
                <summary>Species data</summary>
                <dl className="rom-fields mt-3">
                    <div>
                        <dt>Species / form ID</dt>
                        <dd>{entry.speciesId}</dd>
                    </div>
                    {entry.types.map((type, index) => (
                        <div key={type}>
                            <dt>{index === 0 ? 'Primary' : 'Secondary'} type</dt>
                            <dd className="flex items-center gap-2">
                                <TypeBadges
                                    types={[type]}
                                    iconFiles={[entry.typeIconFiles[index] ?? null]}
                                />
                                <span>ID {entry.typeIds[index]}</span>
                            </dd>
                        </div>
                    ))}
                </dl>
            </details>
        </aside>
    );
}

export function SpeciesPage({
    speciesId,
    version,
    datasetId,
}: {
    speciesId: number;
    version: string;
    datasetId: string | undefined;
}) {
    const heading = useRef<HTMLHeadingElement>(null);
    const [shiny, setShiny] = useState(false);
    const details = useQuery({
        queryKey: ['species-details', speciesId],
        queryFn: ({ signal }) => fetchSpeciesDetails(speciesId, signal),
        retry: (count, error) =>
            !(error instanceof ApiRequestError && error.status === 404) && count < 1,
    });
    useEffect(() => {
        if (details.isSuccess) heading.current?.focus();
    }, [details.isSuccess, speciesId]);
    const entry = details.data;
    const evolutionBase = entry?.forms?.members.find(
        (member) => member.speciesId === entry.evolutionBaseSpeciesId,
    );
    const missing = details.error instanceof ApiRequestError && details.error.status === 404;
    const tms = entry?.machines.filter((move) => move.kind === 'TM') ?? [];
    const hms = entry?.machines.filter((move) => move.kind === 'HM') ?? [];

    return (
        <div className="min-h-screen">
            <DexHeader version={version} backHref="#/" backLabel="All Pokémon" />
            <main className="detail-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <DexNavigation active="pokemon" />
                {entry ? (
                    <SpeciesDetailHeader
                        entry={entry}
                        datasetId={datasetId}
                        headingRef={heading}
                        shiny={shiny}
                        onShinyChange={setShiny}
                        onFormChange={(id) => {
                            window.location.hash = speciesHref(id);
                        }}
                    />
                ) : (
                    <h1 className="mb-5 text-2xl font-semibold">
                        {missing ? 'Species not found' : 'Species details'}
                    </h1>
                )}
                {details.isPending ? (
                    <div className="dex-list px-6 py-16 text-center" role="status">
                        Loading species details…
                    </div>
                ) : details.isError ? (
                    <div className="dex-list px-6 py-12 text-center" role="alert">
                        <h2 className="text-xl font-semibold">
                            {missing ? 'No species with this ID' : 'Couldn’t load species details'}
                        </h2>
                        <p className="mt-2 text-sm text-stone-600">
                            {missing
                                ? 'Choose a species from the dex.'
                                : 'Try again when the server is available.'}
                        </p>
                        {!missing && (
                            <button
                                className="page-button mt-5"
                                onClick={() => {
                                    void details.refetch();
                                }}
                            >
                                Try again
                            </button>
                        )}
                    </div>
                ) : (
                    entry && (
                        <div className="detail-content grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                            <StatsPanel entry={entry} version={version} />
                            <div className="min-w-0 space-y-6">
                                <AbilitiesSection slots={entry.abilities} />
                                <section
                                    className="species-section"
                                    aria-labelledby="evolution-title"
                                >
                                    <div className="section-heading">
                                        <p className="eyebrow">Species relationships</p>
                                        <h2 id="evolution-title">Evolution</h2>
                                    </div>
                                    <div className="p-5 sm:p-6">
                                        {entry.evolutionBaseSpeciesId !== speciesId && (
                                            <p className="empty-note mb-5">
                                                Evolution family of{' '}
                                                {entry.forms?.baseName ?? entry.name}. This species'
                                                forms are listed separately below.
                                            </p>
                                        )}
                                        <EvolutionLine
                                            entry={{
                                                speciesId: entry.evolutionBaseSpeciesId,
                                                name:
                                                    entry.evolutionBaseSpeciesId === speciesId
                                                        ? formDisplayName(
                                                              entry.name,
                                                              entry.formInfo,
                                                          )
                                                        : (evolutionBase?.name ?? entry.name),
                                                sprites: evolutionBase
                                                    ? { front: evolutionBase.sprite }
                                                    : entry.sprites,
                                            }}
                                            links={entry.evolutionFamily}
                                            datasetId={datasetId}
                                            currentPageSpeciesId={speciesId}
                                            currentLabel={
                                                entry.evolutionBaseSpeciesId === speciesId
                                                    ? 'Current stage'
                                                    : 'Base species'
                                            }
                                        />
                                    </div>
                                </section>
                                <FormsSection
                                    forms={entry.forms}
                                    changes={entry.formChanges}
                                    speciesId={speciesId}
                                    datasetId={datasetId}
                                />
                                <section
                                    className="species-section"
                                    aria-labelledby="learnset-title"
                                >
                                    <div className="section-heading">
                                        <p className="eyebrow">Level-up learnset</p>
                                        <h2 id="learnset-title">
                                            Moves learned{' '}
                                            <span className="count-label">
                                                {entry.learnset.length}
                                            </span>
                                        </h2>
                                        <p className="mt-2 text-xs text-stone-600">
                                            Expand a move name for its description and complete move
                                            data.
                                        </p>
                                    </div>
                                    {entry.learnset.length ? (
                                        <MoveTable entries={entry.learnset} acquisition="Level" />
                                    ) : (
                                        <p className="empty-note p-6">
                                            No level-up moves recorded.
                                        </p>
                                    )}
                                </section>
                                <section
                                    className="species-section"
                                    aria-labelledby="machines-title"
                                >
                                    <div className="section-heading">
                                        <p className="eyebrow">TM / HM compatibility</p>
                                        <h2 id="machines-title">
                                            Machine moves{' '}
                                            <span className="count-label">
                                                {entry.machines.length}
                                            </span>
                                        </h2>
                                    </div>
                                    <h3 className="machine-heading">
                                        Technical Machines{' '}
                                        <span className="count-label">{tms.length}</span>
                                    </h3>
                                    {tms.length ? (
                                        <MoveTable entries={tms} acquisition="Machine" />
                                    ) : (
                                        <p className="empty-note p-6">
                                            No compatible TMs recorded.
                                        </p>
                                    )}
                                    <h3 className="machine-heading">
                                        Hidden Machines{' '}
                                        <span className="count-label">{hms.length}</span>
                                    </h3>
                                    {hms.length ? (
                                        <MoveTable entries={hms} acquisition="Machine" />
                                    ) : (
                                        <p className="empty-note p-6">
                                            No compatible HMs recorded.
                                        </p>
                                    )}
                                </section>
                                <p className="text-xs leading-relaxed text-stone-600">
                                    Move power is base power, not calculated battle damage. A dash
                                    means no fixed base power or no normal percentage accuracy check
                                    (ROM value 0). Learnset order and level 0 are preserved.
                                </p>
                            </div>
                        </div>
                    )
                )}
                <DexFooter />
            </main>
        </div>
    );
}
