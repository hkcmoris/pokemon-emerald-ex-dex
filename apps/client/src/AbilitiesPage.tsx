import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Ability, AbilityFlags } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchAbility, fetchAbilities } from './api.js';
import { DexFooter } from './DexFooter.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { abilityHref } from './navigation.js';

const flagLabels: Readonly<Record<keyof AbilityFlags, string>> = {
    cantBeCopied: 'Cannot be copied',
    cantBeSwapped: 'Cannot be swapped',
    cantBeTraced: 'Cannot be traced',
    cantBeSuppressed: 'Cannot be suppressed',
    cantBeOverwritten: 'Cannot be overwritten',
    breakable: 'Breakable',
    failsOnImposter: 'Fails on Imposter',
};

export function AbilityDetails({ ability }: { ability: Ability }) {
    return (
        <section className="species-section" aria-label="Ability details">
            <div className="section-heading">
                <p className="eyebrow">ROM ability #{String(ability.abilityId).padStart(3, '0')}</p>
                <h2>{ability.name}</h2>
            </div>
            <div className="p-5 sm:p-6">
                <p className="text-sm leading-relaxed">
                    {ability.description || 'No description recorded.'}
                </p>
                {ability.abilityId === 0 && (
                    <p className="empty-note mt-3">
                        Engine “None” entry. Empty species slots are recorded separately.
                    </p>
                )}
                <details className="rule-details mt-5">
                    <summary>ROM mechanics</summary>
                    <dl className="rom-fields mt-3">
                        <div>
                            <dt>Ability ID</dt>
                            <dd>{ability.abilityId}</dd>
                        </div>
                        <div>
                            <dt>AI rating</dt>
                            <dd>{ability.aiRating}</dd>
                        </div>
                        {(Object.keys(flagLabels) as (keyof AbilityFlags)[]).map((key) => (
                            <div key={key}>
                                <dt>{flagLabels[key]}</dt>
                                <dd>{ability.flags[key] ? 'Yes' : 'No'}</dd>
                            </div>
                        ))}
                    </dl>
                </details>
            </div>
        </section>
    );
}

export function AbilitiesPage({
    abilityId,
    version,
}: {
    abilityId: number | undefined;
    version: string;
}) {
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const abilities = useQuery({
        queryKey: ['abilities', q.trim(), page],
        queryFn: ({ signal }) => fetchAbilities(q.trim(), page, signal),
        enabled: abilityId === undefined,
    });
    const detail = useQuery({
        queryKey: ['ability', abilityId],
        queryFn: ({ signal }) => fetchAbility(abilityId ?? 0, signal),
        enabled: abilityId !== undefined,
    });
    const active = abilityId === undefined ? abilities : detail;
    const failed = active.isError;
    const notFound = detail.error instanceof ApiRequestError && detail.error.status === 404;
    return (
        <div className="min-h-screen">
            <DexHeader
                version={version}
                {...(abilityId !== undefined
                    ? { backHref: '#/abilities', backLabel: 'All abilities' }
                    : {})}
            />
            <main className="dex-browse-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <div className="catalog-heading">
                    <div>
                        <p className="eyebrow">Battle instincts</p>
                        <h1>
                            {detail.data?.name ??
                                (abilityId === undefined ? 'Abilities' : 'Ability details')}
                        </h1>
                    </div>
                </div>
                {abilityId === undefined && (
                    <div className="mb-5 grid gap-3 sm:grid-cols-1">
                        <label className="filter-label">
                            Find an ability
                            <input
                                className="filter-input"
                                type="search"
                                maxLength={100}
                                placeholder="Name or ability ID"
                                value={q}
                                onChange={(event) => {
                                    setQ(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>
                    </div>
                )}
                {failed ? (
                    <section className="species-section p-6" role="alert">
                        <h2 className="text-xl font-semibold">
                            {notFound ? 'Ability not found' : 'Couldn’t load abilities'}
                        </h2>
                        {!notFound && (
                            <button
                                className="page-button mt-4"
                                onClick={() => {
                                    void active.refetch();
                                }}
                            >
                                Try again
                            </button>
                        )}
                    </section>
                ) : active.isPending ? (
                    <p role="status">Loading abilities…</p>
                ) : abilityId !== undefined && detail.data ? (
                    <AbilityDetails ability={detail.data} />
                ) : (
                    <>
                        <p className="mb-4 text-sm text-stone-600" role="status">
                            {abilities.data?.meta.total.toLocaleString('en-US')} matching abilities
                        </p>
                        <ul className="item-catalog">
                            {abilities.data?.data.map((ability) => (
                                <li key={ability.abilityId} className="evolution-node">
                                    <a
                                        className="species-link flex items-center gap-3"
                                        href={abilityHref(ability.abilityId)}
                                    >
                                        <span className="font-semibold">{ability.name}</span>
                                        <span className="ml-auto font-mono text-xs">
                                            #{String(ability.abilityId).padStart(3, '0')}
                                        </span>
                                    </a>
                                    <p className="mt-3 text-sm leading-relaxed">
                                        {ability.description}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        {abilities.data?.data.length === 0 && (
                            <p className="empty-note">No matching abilities.</p>
                        )}
                        <div className="mt-5 flex items-center justify-between gap-3">
                            <button
                                className="page-button"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                Previous
                            </button>
                            <p className="text-xs text-stone-600">
                                Page {page} of {Math.max(1, abilities.data?.meta.totalPages ?? 1)}
                            </p>
                            <button
                                className="page-button"
                                disabled={page >= (abilities.data?.meta.totalPages ?? 0)}
                                onClick={() => setPage(page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
                <DexFooter context="abilities" />
            </main>
            <DexNavigation active="abilities" />
        </div>
    );
}
