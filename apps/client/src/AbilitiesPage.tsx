import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Ability, AbilityFlags } from '@pokemon-emerald-ex-dex/shared';

import { ApiRequestError, fetchAbility, fetchAbilities } from './api.js';
import { DexFooter } from './DexFooter.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { useLanguage } from './language.js';
import { abilityHref } from './navigation.js';

const flagLabels: Readonly<Record<keyof AbilityFlags, readonly [string, string]>> = {
    cantBeCopied: ['Cannot be copied', 'Nelze zkopírovat'],
    cantBeSwapped: ['Cannot be swapped', 'Nelze vyměnit'],
    cantBeTraced: ['Cannot be traced', 'Nelze převzít pomocí Trace'],
    cantBeSuppressed: ['Cannot be suppressed', 'Nelze potlačit'],
    cantBeOverwritten: ['Cannot be overwritten', 'Nelze přepsat'],
    breakable: ['Breakable', 'Lze prolomit'],
    failsOnImposter: ['Fails on Imposter', 'Selže při Imposter'],
};

export function AbilityDetails({ ability }: { ability: Ability }) {
    const { t } = useLanguage();
    return (
        <section
            className="species-section"
            aria-label={t('Ability details', 'Podrobnosti schopnosti')}
        >
            <div className="section-heading">
                <p className="eyebrow">
                    {t('ROM ability', 'Schopnost v ROM')} #
                    {String(ability.abilityId).padStart(3, '0')}
                </p>
                <h2>{ability.name}</h2>
            </div>
            <div className="p-5 sm:p-6">
                <p className="text-sm leading-relaxed">
                    {ability.description || t('No description recorded.', 'Popis není uveden.')}
                </p>
                {ability.abilityId === 0 && (
                    <p className="empty-note mt-3">
                        {t(
                            'Engine “None” entry. Empty species slots are recorded separately.',
                            'Záznam „None“ herního enginu. Prázdné sloty druhů jsou vedeny samostatně.',
                        )}
                    </p>
                )}
                <details className="rule-details mt-5">
                    <summary>{t('ROM mechanics', 'Mechaniky ROM')}</summary>
                    <dl className="rom-fields mt-3">
                        <div>
                            <dt>{t('Ability ID', 'ID schopnosti')}</dt>
                            <dd>{ability.abilityId}</dd>
                        </div>
                        <div>
                            <dt>{t('AI rating', 'Hodnocení AI')}</dt>
                            <dd>{ability.aiRating}</dd>
                        </div>
                        {(Object.keys(flagLabels) as (keyof AbilityFlags)[]).map((key) => (
                            <div key={key}>
                                <dt>{t(...flagLabels[key])}</dt>
                                <dd>{ability.flags[key] ? t('Yes', 'Ano') : t('No', 'Ne')}</dd>
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
    const { t, locale } = useLanguage();
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
                    ? {
                          backHref: '#/abilities',
                          backLabel: t('All abilities', 'Všechny schopnosti'),
                      }
                    : {})}
            />
            <main className="dex-browse-main mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-8">
                <div className="catalog-heading">
                    <div>
                        <p className="eyebrow">{t('Battle instincts', 'Bojové instinkty')}</p>
                        <h1>
                            {detail.data?.name ??
                                (abilityId === undefined
                                    ? t('Abilities', 'Schopnosti')
                                    : t('Ability details', 'Podrobnosti schopnosti'))}
                        </h1>
                    </div>
                </div>
                {abilityId === undefined && (
                    <div className="mb-5 grid gap-3 sm:grid-cols-1">
                        <label className="filter-label">
                            {t('Find an ability', 'Najít schopnost')}
                            <input
                                className="filter-input"
                                type="search"
                                maxLength={100}
                                placeholder={t('Name or ability ID', 'Název nebo ID schopnosti')}
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
                            {notFound
                                ? t('Ability not found', 'Schopnost nebyla nalezena')
                                : t('Couldn’t load abilities', 'Schopnosti se nepodařilo načíst')}
                        </h2>
                        {!notFound && (
                            <button
                                className="page-button mt-4"
                                onClick={() => {
                                    void active.refetch();
                                }}
                            >
                                {t('Try again', 'Zkusit znovu')}
                            </button>
                        )}
                    </section>
                ) : active.isPending ? (
                    <p role="status">{t('Loading abilities…', 'Načítání schopností…')}</p>
                ) : abilityId !== undefined && detail.data ? (
                    <AbilityDetails ability={detail.data} />
                ) : (
                    <>
                        <p className="mb-4 text-sm text-stone-600" role="status">
                            {t(
                                `${abilities.data?.meta.total.toLocaleString(locale)} matching abilities`,
                                `Nalezené schopnosti: ${abilities.data?.meta.total.toLocaleString(locale)}`,
                            )}
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
                            <p className="empty-note">
                                {t('No matching abilities.', 'Žádné odpovídající schopnosti.')}
                            </p>
                        )}
                        <div className="mt-5 flex items-center justify-between gap-3">
                            <button
                                className="page-button"
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                            >
                                {t('Previous', 'Předchozí')}
                            </button>
                            <p className="text-xs text-stone-600">
                                {t('Page', 'Strana')} {page} {t('of', 'z')}{' '}
                                {Math.max(1, abilities.data?.meta.totalPages ?? 1)}
                            </p>
                            <button
                                className="page-button"
                                disabled={page >= (abilities.data?.meta.totalPages ?? 0)}
                                onClick={() => setPage(page + 1)}
                            >
                                {t('Next', 'Další')}
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
