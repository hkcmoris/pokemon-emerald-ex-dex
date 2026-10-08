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
import { OffensiveStatIndicator } from './OffensiveStatIndicator.js';
import { SpeciesDetailHeader } from './SpeciesDetailHeader.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';
import { speciesHref } from './navigation.js';
import { useLanguage } from './language.js';
import { typeSurfaceStyle } from './theme.js';

type SpeciesMove = LearnsetEntry | SpeciesMachine;

function MoveTable({
    entries,
    acquisition,
}: {
    entries: readonly SpeciesMove[];
    acquisition: 'Level' | 'Machine';
}) {
    const { t } = useLanguage();
    return (
        <table className="move-table w-full text-sm" role="table">
            <caption className="sr-only">
                {acquisition === 'Level'
                    ? t('Level-up moves', 'Útoky získané postupem na vyšší úroveň')
                    : t('Compatible machines', 'Kompatibilní TM / HM')}
                {'. '}
                {t(
                    'Move descriptions are shown below their names. Expand additional data for ROM fields.',
                    'Popisy útoků jsou zobrazené pod názvy. Rozbalením dalších údajů zobrazíte hodnoty z ROM.',
                )}
            </caption>
            <thead role="rowgroup">
                <tr role="row">
                    <th scope="col" role="columnheader">
                        {acquisition === 'Level' ? t('Level', 'Úroveň') : t('Machine', 'TM / HM')}
                    </th>
                    <th scope="col" role="columnheader">
                        {t('Move / Type', 'Útok / typ')}
                    </th>
                    <th scope="col" role="columnheader">
                        {t('Category', 'Kategorie')}
                    </th>
                    <th scope="col" role="columnheader" className="text-right">
                        {t('Power', 'Síla')}
                    </th>
                    <th scope="col" role="columnheader" className="text-right">
                        {t('Accuracy', 'Přesnost')}
                    </th>
                    <th scope="col" role="columnheader" className="text-right">
                        PP
                    </th>
                    <th scope="col" role="columnheader" className="text-right">
                        {t('Priority', 'Priorita')}
                    </th>
                </tr>
            </thead>
            <tbody role="rowgroup">
                {entries.map((move) => (
                    <tr
                        key={'machine' in move ? move.machine : move.entryOrder}
                        role="row"
                        className="move-row type-surface"
                        style={typeSurfaceStyle([move.type])}
                    >
                        <td
                            role="cell"
                            className="move-acquisition align-top font-mono text-xs tabular-nums"
                        >
                            <span className="move-cell-label" aria-hidden="true">
                                {acquisition === 'Level'
                                    ? t('Level', 'Úroveň')
                                    : t('Machine', 'TM / HM')}
                            </span>
                            {'machine' in move ? move.machine : move.level}
                        </td>
                        <th scope="row" role="rowheader" className="move-main text-left align-top">
                            <div className="move-heading">
                                <span className="move-name">{move.name}</span>
                                <TypeBadges types={[move.type]} iconFiles={[move.typeIconFile]} />
                            </div>
                            <p className="move-description">
                                {move.description ||
                                    t('No description recorded.', 'Popis není uveden.')}
                            </p>
                            <details className="move-details">
                                <summary>{t('Additional data', 'Další údaje')}</summary>
                                <dl className="rom-fields mt-3">
                                    <div>
                                        <dt>{t('Move ID', 'ID útoku')}</dt>
                                        <dd>{move.moveId}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Type ID', 'ID typu')}</dt>
                                        <dd>{move.typeId}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Category ID', 'ID kategorie')}</dt>
                                        <dd>{move.categoryId}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Effect ID', 'ID účinku')}</dt>
                                        <dd>{move.effectId}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Target ID', 'ID cíle')}</dt>
                                        <dd>{move.targetId}</dd>
                                    </div>
                                    <div>
                                        <dt>
                                            {t('Raw power / accuracy', 'Síla / přesnost v ROM')}
                                        </dt>
                                        <dd>
                                            {move.power} / {move.accuracy}
                                        </dd>
                                    </div>
                                    {'machine' in move ? (
                                        <div>
                                            <dt>
                                                {t(
                                                    'Machine kind / number',
                                                    'Druh / číslo TM nebo HM',
                                                )}
                                            </dt>
                                            <dd>
                                                {move.kind} / {move.number}
                                            </dd>
                                        </div>
                                    ) : (
                                        <div>
                                            <dt>
                                                {t(
                                                    'Learnset entry order',
                                                    'Pořadí v seznamu útoků',
                                                )}
                                            </dt>
                                            <dd>{move.entryOrder}</dd>
                                        </div>
                                    )}
                                </dl>
                            </details>
                        </th>
                        <td role="cell" className="move-category align-top text-xs">
                            <MoveCategory
                                category={move.category}
                                iconFile={move.categoryIconFile}
                            />
                        </td>
                        <td
                            role="cell"
                            className="move-metric text-right align-top tabular-nums"
                            title={
                                move.power === 0
                                    ? t(
                                          'No fixed base power (ROM value 0)',
                                          'Bez pevné základní síly (hodnota v ROM je 0)',
                                      )
                                    : undefined
                            }
                        >
                            <span className="move-cell-label" aria-hidden="true">
                                {t('Power', 'Síla')}
                            </span>
                            {move.power || '—'}
                        </td>
                        <td
                            role="cell"
                            className="move-metric text-right align-top tabular-nums"
                            title={
                                move.accuracy === 0
                                    ? t(
                                          'No normal percentage accuracy check (ROM value 0)',
                                          'Bez běžné procentní kontroly přesnosti (hodnota v ROM je 0)',
                                      )
                                    : undefined
                            }
                        >
                            <span className="move-cell-label" aria-hidden="true">
                                {t('Accuracy', 'Přesnost')}
                            </span>
                            {move.accuracy ? `${move.accuracy}%` : '—'}
                        </td>
                        <td role="cell" className="move-metric text-right align-top tabular-nums">
                            <span className="move-cell-label" aria-hidden="true">
                                PP
                            </span>
                            {move.pp}
                        </td>
                        <td role="cell" className="move-metric text-right align-top tabular-nums">
                            <span className="move-cell-label" aria-hidden="true">
                                {t('Priority', 'Priorita')}
                            </span>
                            {move.priority > 0 ? `+${move.priority}` : move.priority}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function StatsPanel({ entry, version }: { entry: Pokemon; version: string }) {
    const { t } = useLanguage();
    const highestStat = Math.max(...statLabels.map(({ key }) => entry.stats[key]));
    return (
        <aside className="detail-panel" aria-labelledby="stats-title">
            <div className="stat-total flex items-center justify-between gap-3 border-b pb-3">
                <h2 id="stats-title" className="text-lg font-semibold">
                    {t('Base stats', 'Základní statistiky')}
                </h2>
                <div className="stat-summary">
                    <OffensiveStatIndicator stats={entry.stats} />
                    <div className="stat-total-value">
                        <span className="stat-total-number font-semibold tabular-nums">
                            {entry.baseStatTotal}
                        </span>
                        <span className="stat-total-label">{t('total', 'celkem')}</span>
                    </div>
                </div>
            </div>
            <dl className="stat-list">
                {statLabels.map(({ key, label, labelCs }) => {
                    const isHighest = entry.stats[key] === highestStat;
                    const special = key === 'spAttack' || key === 'spDefense';
                    return (
                        <div key={key} className="stat-row" data-highest={isHighest}>
                            <dt>
                                {special ? (
                                    <abbr
                                        title={t(
                                            key === 'spAttack'
                                                ? 'Special Attack'
                                                : 'Special Defense',
                                            labelCs,
                                        )}
                                    >
                                        {t(label, key === 'spAttack' ? 'Sp. útok' : 'Sp. obrana')}
                                    </abbr>
                                ) : (
                                    t(label, labelCs)
                                )}
                            </dt>
                            <dd className="stat-measure">
                                <span className="stat-value font-mono tabular-nums">
                                    {entry.stats[key]}
                                    {isHighest && (
                                        <span className="sr-only">
                                            {' '}
                                            {t('Highest stat', 'Nejvyšší statistika')}
                                        </span>
                                    )}
                                </span>
                                <div className="stat-track" aria-hidden="true">
                                    <div
                                        className="stat-fill"
                                        style={{ width: `${(entry.stats[key] / 255) * 100}%` }}
                                    />
                                </div>
                            </dd>
                        </div>
                    );
                })}
            </dl>
            <details className="rule-details mt-3 border-t border-stone-300 pt-3">
                <summary>{t('Species data', 'Údaje o druhu')}</summary>
                <p className="mt-3 text-xs leading-relaxed text-stone-600">
                    {t(
                        `Emerald EX ${version} base stats. Bars use a 0–255 scale. These are not calculated battle stats.`,
                        `Základní statistiky v Emerald EX ${version}. Pruhy používají stupnici 0–255. Nejde o vypočtené bojové statistiky.`,
                    )}
                </p>
                <dl className="rom-fields mt-3">
                    <div>
                        <dt>{t('Species / form ID', 'ID druhu / formy')}</dt>
                        <dd>{entry.speciesId}</dd>
                    </div>
                    {entry.types.map((type, index) => (
                        <div key={type}>
                            <dt>
                                {index === 0
                                    ? t('Primary type', 'Primární typ')
                                    : t('Secondary type', 'Sekundární typ')}
                            </dt>
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
    const { t } = useLanguage();
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
            <DexHeader
                version={version}
                backHref="#/"
                backLabel={t('All Pokémon', 'Všichni Pokémoni')}
            />
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
                        {missing
                            ? t('Species not found', 'Druh nebyl nalezen')
                            : t('Species details', 'Detail druhu')}
                    </h1>
                )}
                {details.isPending ? (
                    <div className="dex-list px-6 py-16 text-center" role="status">
                        {t('Loading species details…', 'Načítání detailu druhu…')}
                    </div>
                ) : details.isError ? (
                    <div className="dex-list px-6 py-12 text-center" role="alert">
                        <h2 className="text-xl font-semibold">
                            {missing
                                ? t('No species with this ID', 'Druh s tímto ID neexistuje')
                                : t(
                                      'Couldn’t load species details',
                                      'Detail druhu se nepodařilo načíst',
                                  )}
                        </h2>
                        <p className="mt-2 text-sm text-stone-600">
                            {missing
                                ? t('Choose a species from the dex.', 'Vyberte druh z Pokédexu.')
                                : t(
                                      'Try again when the server is available.',
                                      'Zkuste to znovu, až bude server dostupný.',
                                  )}
                        </p>
                        {!missing && (
                            <button
                                className="page-button mt-5"
                                onClick={() => {
                                    void details.refetch();
                                }}
                            >
                                {t('Try again', 'Zkusit znovu')}
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
                                        <p className="eyebrow">
                                            {t('Species relationships', 'Vztahy mezi druhy')}
                                        </p>
                                        <h2 id="evolution-title">{t('Evolution', 'Evoluce')}</h2>
                                    </div>
                                    <div className="p-5 sm:p-6">
                                        {entry.evolutionBaseSpeciesId !== speciesId && (
                                            <p className="empty-note mb-5">
                                                {t(
                                                    `Evolution family of ${entry.forms?.baseName ?? entry.name}. This species' forms are listed separately below.`,
                                                    `Evoluční řada pro ${entry.forms?.baseName ?? entry.name}. Formy tohoto druhu jsou uvedeny samostatně níže.`,
                                                )}
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
                                                    ? t('Current stage', 'Aktuální stadium')
                                                    : t('Base species', 'Základní druh')
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
                                        <p className="eyebrow">
                                            {t(
                                                'Level-up learnset',
                                                'Útoky získané postupem na vyšší úroveň',
                                            )}
                                        </p>
                                        <h2 id="learnset-title">
                                            {t('Moves learned', 'Naučené útoky')}{' '}
                                            <span className="count-label">
                                                {entry.learnset.length}
                                            </span>
                                        </h2>
                                        <p className="mt-2 text-xs text-stone-600">
                                            {t(
                                                'Expand a move name for its description and complete move data.',
                                                'Rozbalte název útoku pro zobrazení popisu a všech údajů.',
                                            )}
                                        </p>
                                    </div>
                                    {entry.learnset.length ? (
                                        <MoveTable entries={entry.learnset} acquisition="Level" />
                                    ) : (
                                        <p className="empty-note p-6">
                                            {t(
                                                'No level-up moves recorded.',
                                                'Nejsou zaznamenány žádné útoky získané postupem na vyšší úroveň.',
                                            )}
                                        </p>
                                    )}
                                </section>
                                <section
                                    className="species-section"
                                    aria-labelledby="machines-title"
                                >
                                    <div className="section-heading">
                                        <p className="eyebrow">
                                            {t('TM / HM compatibility', 'Kompatibilita s TM / HM')}
                                        </p>
                                        <h2 id="machines-title">
                                            {t('Machine moves', 'Útoky z TM / HM')}{' '}
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
                                            {t(
                                                'No compatible TMs recorded.',
                                                'Nejsou zaznamenány žádné kompatibilní TM.',
                                            )}
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
                                            {t(
                                                'No compatible HMs recorded.',
                                                'Nejsou zaznamenány žádné kompatibilní HM.',
                                            )}
                                        </p>
                                    )}
                                </section>
                                <p className="text-xs leading-relaxed text-stone-600">
                                    {t(
                                        'Move power is base power, not calculated battle damage. A dash means no fixed base power or no normal percentage accuracy check (ROM value 0). Learnset order and level 0 are preserved.',
                                        'Síla útoku je základní hodnota, nikoli vypočtené poškození v boji. Pomlčka znamená, že útok nemá pevnou základní sílu nebo běžnou procentní kontrolu přesnosti (hodnota v ROM je 0). Pořadí útoků i úroveň 0 jsou zachovány.',
                                    )}
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
