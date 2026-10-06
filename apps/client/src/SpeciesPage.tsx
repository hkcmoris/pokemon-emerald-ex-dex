import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    LearnsetEntry,
    Pokemon,
    SpeciesEvolution,
    SpeciesMachine,
} from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchSpeciesDetails } from './api.js';
import { DexFooter } from './DexFooter.js';
import { statLabels } from './dex.js';
import { speciesHref } from './navigation.js';
import { TypeBadges } from './TypeBadges.js';

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
                                    <TypeBadges types={[move.type]} />
                                </div>
                            </th>
                            <td className="align-top text-xs">{move.category}</td>
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

function EvolutionRules({
    links,
    speciesId,
}: {
    links: readonly SpeciesEvolution[];
    speciesId: number;
}) {
    return (
        <ul className="evolution-rules">
            {links.map((link) => {
                const outgoing = link.fromSpeciesId === speciesId;
                const relatedId = outgoing ? link.toSpeciesId : link.fromSpeciesId;
                return (
                    <li key={link.edgeOrder}>
                        {link.internalOnly && (
                            <p className="mb-1 text-xs text-stone-600">
                                {outgoing ? 'Changes to' : 'Changes from'}
                            </p>
                        )}
                        <a className="species-link" href={speciesHref(relatedId)}>
                            {outgoing ? link.toName : link.fromName}{' '}
                            <span className="font-mono text-xs font-normal">
                                #{String(relatedId).padStart(4, '0')}
                            </span>
                        </a>
                        <p className="mt-2 text-sm leading-relaxed">{link.summary}</p>
                        <details className="rule-details mt-3">
                            <summary>Rule details</summary>
                            <dl className="rom-fields mt-3">
                                <div>
                                    <dt>Method</dt>
                                    <dd>{link.method.replaceAll('_', ' ')}</dd>
                                </div>
                                <div>
                                    <dt>Trigger</dt>
                                    <dd>{link.trigger.replaceAll('_', ' ')}</dd>
                                </div>
                                <div>
                                    <dt>Level</dt>
                                    <dd>{link.level ?? 'No level requirement'}</dd>
                                </div>
                                <div>
                                    <dt>ROM method ID</dt>
                                    <dd>{link.methodId}</dd>
                                </div>
                                <div>
                                    <dt>Raw parameter</dt>
                                    <dd>{link.rawParam}</dd>
                                </div>
                                <div>
                                    <dt>Rule order</dt>
                                    <dd>{link.edgeOrder}</dd>
                                </div>
                            </dl>
                            {Object.keys(link.conditions).length > 0 && (
                                <div className="mt-3">
                                    <p className="text-xs font-semibold">Full conditions</p>
                                    <pre className="condition-data mt-2">
                                        {JSON.stringify(link.conditions, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </details>
                    </li>
                );
            })}
        </ul>
    );
}

function StatsPanel({ entry, version }: { entry: Pokemon; version: string }) {
    return (
        <aside className="detail-panel" aria-labelledby="stats-title">
            <p className="eyebrow">Base stats</p>
            <div className="stat-total mt-5 flex items-end justify-between border-b pb-5">
                <h2 id="stats-title" className="text-sm font-medium">
                    Base stat total
                </h2>
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
                Emerald EX {version} base stats. Bars use a 0–255 scale. These are not calculated
                battle stats.
            </p>
            <dl className="rom-fields mt-6 border-t border-stone-300 pt-5">
                <div>
                    <dt>Species / form ID</dt>
                    <dd>{entry.speciesId}</dd>
                </div>
                {entry.types.map((type, index) => (
                    <div key={type}>
                        <dt>{index === 0 ? 'Primary' : 'Secondary'} type</dt>
                        <dd>
                            {type} · ID {entry.typeIds[index]}
                        </dd>
                    </div>
                ))}
            </dl>
        </aside>
    );
}

export function SpeciesPage({ speciesId, version }: { speciesId: number; version: string }) {
    const heading = useRef<HTMLHeadingElement>(null);
    const details = useQuery({
        queryKey: ['species-details', speciesId],
        queryFn: ({ signal }) => fetchSpeciesDetails(speciesId, signal),
        retry: (count, error) =>
            !(error instanceof ApiRequestError && error.status === 404) && count < 1,
    });
    useEffect(() => {
        if (details.isSuccess) heading.current?.focus();
    }, [details.isSuccess]);
    const entry = details.data;
    const missing = details.error instanceof ApiRequestError && details.error.status === 404;
    const incoming =
        entry?.evolutionLinks.filter(
            (link) => !link.internalOnly && link.toSpeciesId === speciesId,
        ) ?? [];
    const outgoing =
        entry?.evolutionLinks.filter(
            (link) => !link.internalOnly && link.fromSpeciesId === speciesId,
        ) ?? [];
    const internal = entry?.evolutionLinks.filter((link) => link.internalOnly) ?? [];
    const tms = entry?.machines.filter((move) => move.kind === 'TM') ?? [];
    const hms = entry?.machines.filter((move) => move.kind === 'HM') ?? [];

    return (
        <div className="min-h-screen">
            <header className="dex-header">
                <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
                    <div className="flex items-center justify-between gap-4">
                        <a href="#/" className="back-link">
                            ← Back to dex
                        </a>
                        <span className="version-tag">EX / {version}</span>
                    </div>
                    <p className="eyebrow mt-8">
                        Species / form {String(speciesId).padStart(4, '0')}
                    </p>
                    <h1
                        ref={heading}
                        tabIndex={-1}
                        className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl"
                    >
                        {entry?.name ?? (missing ? 'Species not found' : 'Species details')}
                    </h1>
                    {entry && (
                        <div className="mt-5">
                            <TypeBadges types={entry.types} />
                        </div>
                    )}
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
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
                        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                            <StatsPanel entry={entry} version={version} />
                            <div className="min-w-0 space-y-6">
                                <section
                                    className="species-section"
                                    aria-labelledby="evolution-title"
                                >
                                    <div className="section-heading">
                                        <p className="eyebrow">Species relationships</p>
                                        <h2 id="evolution-title">Evolution</h2>
                                    </div>
                                    <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
                                        <div>
                                            <h3 className="mb-4 text-sm font-semibold">
                                                Evolves from
                                            </h3>
                                            {incoming.length ? (
                                                <EvolutionRules
                                                    links={incoming}
                                                    speciesId={speciesId}
                                                />
                                            ) : (
                                                <p className="empty-note">
                                                    No pre-evolution recorded.
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="mb-4 text-sm font-semibold">
                                                Evolves into
                                            </h3>
                                            {outgoing.length ? (
                                                <EvolutionRules
                                                    links={outgoing}
                                                    speciesId={speciesId}
                                                />
                                            ) : (
                                                <p className="empty-note">
                                                    No further evolution recorded.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {internal.length > 0 && (
                                        <details className="internal-routes">
                                            <summary>
                                                Internal form changes{' '}
                                                <span className="count-label">
                                                    {internal.length}
                                                </span>
                                            </summary>
                                            <p className="mb-4 mt-3 text-xs leading-relaxed text-stone-600">
                                                These are internal form-routing markers, rather than
                                                ordinary player-triggered evolutions.
                                            </p>
                                            <EvolutionRules
                                                links={internal}
                                                speciesId={speciesId}
                                            />
                                        </details>
                                    )}
                                </section>
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
