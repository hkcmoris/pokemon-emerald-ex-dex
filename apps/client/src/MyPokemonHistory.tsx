import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';
import {
    interpolateStats,
    getNatureStatEffect,
    type BaseStats,
    type OwnedPokemon,
    type SpeciesDetails,
    type StatObservation,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage, type Translate } from './language.js';
import { NatureStat } from './NatureStat.js';
import { getCurrentStats, predictStats } from './collectionStats.js';
import {
    clearObservationDraft,
    getObservationDraft,
    observationDraftKey,
    runObservationDraftSave,
    setObservationDraft,
    useObservationDraftSaveCount,
    useObservationDraftSaving,
    useObservationDraftStorageError,
    type ObservationDraft,
} from './observationDrafts.js';

const statKeys: readonly (keyof BaseStats)[] = [
    'hp',
    'attack',
    'defense',
    'spAttack',
    'spDefense',
    'speed',
];

export function statName(key: keyof BaseStats, t: Translate): string {
    const labels: Record<keyof BaseStats, string> = {
        hp: t('HP', 'HP'),
        attack: t('Attack', 'Útok'),
        defense: t('Defense', 'Obrana'),
        spAttack: t('Sp. Attack', 'Spec. útok'),
        spDefense: t('Sp. Defense', 'Spec. obrana'),
        speed: t('Speed', 'Rychlost'),
    };
    return labels[key];
}

function localDateTime(iso: string): string {
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

export type ObservationSaveIntent = 'save' | 'another' | 'next-member';

export function getObservationStages(
    pokemon: OwnedPokemon,
    observations: readonly StatObservation[],
    family: readonly Pick<SpeciesDetails, 'speciesId'>[] = [],
): { speciesId: number; formEpoch: string }[] {
    const stages = new Map<string, { speciesId: number; formEpoch: string }>();
    for (const entry of observations) {
        if (entry.pokemonId === pokemon.id && !entry.deleted)
            stages.set(entry.formEpoch, { speciesId: entry.speciesId, formEpoch: entry.formEpoch });
    }
    stages.set(pokemon.state.formEpoch, {
        speciesId: pokemon.state.speciesId,
        formEpoch: pokemon.state.formEpoch,
    });
    for (const species of family) {
        if (![...stages.values()].some((stage) => stage.speciesId === species.speciesId))
            stages.set(`historical:${pokemon.id}:${species.speciesId}`, {
                speciesId: species.speciesId,
                formEpoch: `historical:${pokemon.id}:${species.speciesId}`,
            });
    }
    return [...stages.values()];
}

export function observedStatValues(draft: ObservationDraft): Partial<BaseStats> {
    const measured: Partial<BaseStats> = {};
    for (const key of statKeys) {
        const value = draft.stats[key];
        if (value !== undefined && value !== '') measured[key] = Number(value);
    }
    return measured;
}

export function latestObservedComparison(
    observations: readonly StatObservation[],
): Partial<BaseStats> {
    const latest = Math.max(...observations.map((entry) => Date.parse(entry.recordedAt)));
    const tied = observations.filter((entry) => Date.parse(entry.recordedAt) === latest);
    const result: Partial<BaseStats> = {};
    for (const key of statKeys) {
        const value = tied[0]?.stats[key];
        if (value !== undefined && tied.every((entry) => entry.stats[key] === value))
            result[key] = value;
    }
    return result;
}

export function ObservationForm({
    pokemon,
    observation,
    observations = [],
    predictionsEnabled = true,
    natureId = pokemon.natureId,
    draftKey: selectedDraftKey,
    family = [],
    allowNextMember = false,
    newObservationId,
    onSaved,
    cancelLabel,
    preserveDraftOnCancel = false,
    onSave,
    onCancel,
}: {
    pokemon: OwnedPokemon;
    observation?: StatObservation;
    observations?: readonly StatObservation[];
    predictionsEnabled?: boolean;
    natureId?: number | null;
    draftKey?: string;
    family?: readonly SpeciesDetails[];
    allowNextMember?: boolean;
    newObservationId?: string;
    onSaved?: (intent: ObservationSaveIntent) => void;
    cancelLabel?: string;
    preserveDraftOnCancel?: boolean;
    onSave: (value: StatObservation, intent: ObservationSaveIntent) => Promise<void>;
    onCancel: () => void;
}) {
    const { t } = useLanguage();
    const draftKey = selectedDraftKey ?? observationDraftKey(pokemon, observation);
    const [draft, setDraft] = useState<ObservationDraft>(
        () =>
            getObservationDraft(draftKey) ?? {
                speciesId: observation?.speciesId ?? pokemon.state.speciesId,
                formEpoch: observation?.formEpoch ?? pokemon.state.formEpoch,
                observationId: observation?.id,
                level: String(observation?.level ?? pokemon.state.level),
                recordedAt: localDateTime(observation?.recordedAt ?? new Date().toISOString()),
                stats: Object.fromEntries(
                    Object.entries(observation?.stats ?? {}).map(([key, value]) => [
                        key,
                        String(value),
                    ]),
                ),
            },
    );
    const { level, recordedAt, stats } = draft;
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                const form = formRef.current;
                if (!form) return;
                const toolbar = form
                    .closest('.my-pokemon-workspace')
                    ?.querySelector('.my-workspace-toolbar');
                const visibleTop = (toolbar?.getBoundingClientRect().bottom ?? 0) + 12;
                const top = form.getBoundingClientRect().top;
                if (toolbar && Math.abs(top - visibleTop) > 32)
                    window.scrollBy({ top: top - visibleTop, behavior: 'auto' });
            });
        });
        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
        };
    }, []);
    const saveIntent = useRef<ObservationSaveIntent>('save');
    const ownSave = useRef(false);
    const storageError = useObservationDraftStorageError();
    const stages = getObservationStages(pokemon, observations, family);
    if (!stages.some((stage) => stage.formEpoch === draft.formEpoch))
        stages.push({ speciesId: draft.speciesId, formEpoch: draft.formEpoch });
    const currentForm =
        draft.speciesId === pokemon.state.speciesId && draft.formEpoch === pokemon.state.formEpoch;
    function changeDraft(next: ObservationDraft) {
        setDraft(next);
        setObservationDraft(draftKey, pokemon.id, next);
    }
    const predictionHintId = useId();
    const recordingNatureId =
        !observation && currentForm && Number(level) === pokemon.state.level ? natureId : null;
    const predictions =
        !observation && currentForm && predictionsEnabled
            ? predictStats(pokemon, observations, Number(level))
            : {};
    const hasPredictions = statKeys.some((key) => predictions[key] !== undefined);
    const sameLevelStats = getCurrentStats(
        {
            ...pokemon,
            state: {
                ...pokemon.state,
                speciesId: draft.speciesId,
                formEpoch: draft.formEpoch,
                level: Number(level),
            },
        },
        observations.filter((entry) => entry.id !== observation?.id),
    );
    const comparison = latestObservedComparison(
        observations.filter(
            (entry) =>
                !entry.deleted &&
                entry.pokemonId === pokemon.id &&
                entry.formEpoch === draft.formEpoch &&
                entry.speciesId === draft.speciesId &&
                entry.id !== observation?.id &&
                entry.level <= Number(level) &&
                Date.parse(entry.recordedAt) <= new Date(recordedAt).getTime(),
        ),
    );
    const busy = useObservationDraftSaving(draftKey);
    const completedSaves = useObservationDraftSaveCount(draftKey);
    const initialCompletedSaves = useRef(completedSaves);
    useEffect(() => {
        if (completedSaves !== initialCompletedSaves.current) {
            initialCompletedSaves.current = completedSaves;
            // Also close a replacement editor mounted while the original save was pending.
            if (ownSave.current) ownSave.current = false;
            else onCancel();
        }
    }, [completedSaves, onCancel]);
    const [error, setError] = useState<string | null>(null);
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (busy) return;
        const measured = observedStatValues(draft);
        if (Object.keys(measured).length === 0) {
            setError(
                t(
                    'Enter at least one observed stat.',
                    'Zadejte alespoň jednu naměřenou statistiku.',
                ),
            );
            return;
        }
        setError(null);
        const intent = observation ? 'save' : saveIntent.current;
        saveIntent.current = 'save';
        ownSave.current = true;
        try {
            const saved = await runObservationDraftSave(draftKey, () =>
                onSave(
                    {
                        id: observation?.id ?? newObservationId ?? crypto.randomUUID(),
                        pokemonId: pokemon.id,
                        speciesId: draft.speciesId,
                        formEpoch: draft.formEpoch,
                        level: Number(level),
                        recordedAt: new Date(recordedAt).toISOString(),
                        stats: measured,
                        deleted: false,
                    },
                    intent,
                ),
            );
            if (!saved) ownSave.current = false;
            if (saved && intent === 'another') {
                const next: ObservationDraft = {
                    speciesId: draft.speciesId,
                    formEpoch: draft.formEpoch,
                    level: draft.level,
                    recordedAt: localDateTime(new Date().toISOString()),
                    stats: {},
                };
                changeDraft(next);
                window.requestAnimationFrame(() =>
                    formRef.current
                        ?.querySelector<HTMLInputElement>('[data-observed-stat]')
                        ?.focus(),
                );
            }
            if (saved) onSaved?.(intent);
        } catch {
            ownSave.current = false;
            setError(
                t(
                    'Could not save this observation. Try again.',
                    'Záznam se nepodařilo uložit. Zkuste to znovu.',
                ),
            );
        }
    }
    return (
        <form
            className="my-inset my-stack"
            ref={formRef}
            data-stat-observation-form
            onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault();
                    saveIntent.current = 'save';
                    formRef.current?.requestSubmit();
                }
            }}
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <h4>
                {observation
                    ? t('Correct observation', 'Opravit záznam')
                    : t('Record battle stats', 'Zaznamenat bojové statistiky')}
            </h4>
            <p className="my-muted">
                {t(
                    'Enter values shown in the game. Leave unknown stats blank.',
                    'Zadejte hodnoty zobrazené ve hře. Neznámé statistiky nechte prázdné.',
                )}
            </p>
            {!observation && (
                <p className="my-muted">
                    {!currentForm
                        ? t(
                              'This entry belongs to a different form. Saving adds it to history and keeps the current species and level unchanged.',
                              'Záznam patří k jiné formě. Uloží se do historie. Aktuální druh ani úroveň se nezmění.',
                          )
                        : t(
                              'Higher levels update the current level. Older entries stay in history. Drafts are saved on this device, including after reloading.',
                              'Vyšší úroveň aktualizuje aktuální úroveň. Starší záznamy zůstanou v historii. Rozepsané údaje se ukládají v tomto zařízení i po obnovení stránky.',
                          )}
                </p>
            )}
            {hasPredictions && (
                <p className="my-muted" id={predictionHintId}>
                    {t(
                        'Estimates from the last two recorded levels are shown beside the fields. Only values you enter or explicitly copy are saved as observed.',
                        'U polí jsou odhady ze dvou posledních zaznamenaných úrovní. Jako naměřené se uloží jen zadané nebo výslovně zkopírované hodnoty.',
                    )}
                </p>
            )}
            <div className="my-fields">
                {!observation && (
                    <label className="filter-label">
                        {t('Observed form', 'Forma při měření')}
                        <select
                            className="filter-input"
                            disabled={busy}
                            value={draft.formEpoch}
                            onChange={(event) => {
                                const stage = stages.find(
                                    (entry) => entry.formEpoch === event.target.value,
                                );
                                if (stage) changeDraft({ ...draft, ...stage });
                            }}
                        >
                            {stages.map((stage, index) => (
                                <option key={stage.formEpoch} value={stage.formEpoch}>
                                    {family.find((entry) => entry.speciesId === stage.speciesId)
                                        ?.name ?? `#${stage.speciesId}`}{' '}
                                    · {t('Stage', 'Období')} {index + 1}
                                    {stage.formEpoch === pokemon.state.formEpoch
                                        ? t(' (current)', ' (aktuální)')
                                        : ''}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <label className="filter-label">
                    {t('Observed level', 'Úroveň při měření')}
                    <input
                        className="filter-input"
                        type="number"
                        inputMode="numeric"
                        autoFocus
                        min="1"
                        max="100"
                        step="1"
                        required
                        disabled={busy}
                        value={level}
                        onChange={(event) => changeDraft({ ...draft, level: event.target.value })}
                    />
                </label>
                <label className="filter-label">
                    {t('Observed at', 'Datum měření')}
                    <input
                        className="filter-input"
                        type="datetime-local"
                        step="1"
                        required
                        disabled={busy}
                        value={recordedAt}
                        onChange={(event) =>
                            changeDraft({ ...draft, recordedAt: event.target.value })
                        }
                    />
                </label>
            </div>
            {!observation && Object.keys(sameLevelStats).length > 0 && (
                <button
                    className="page-button"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        changeDraft({
                            ...draft,
                            stats: Object.fromEntries(
                                Object.entries(sameLevelStats).map(([key, value]) => [
                                    key,
                                    String(value),
                                ]),
                            ),
                        })
                    }
                >
                    {t(
                        'Use last observed values at this level',
                        'Použít poslední naměřené hodnoty na této úrovni',
                    )}
                </button>
            )}
            <div className="my-stat-inputs">
                {statKeys.map((key) => (
                    <label className="filter-label" key={key}>
                        <NatureStat stat={key} natureId={recordingNatureId}>
                            {statName(key, t)}
                        </NatureStat>
                        {predictions[key] !== undefined && (
                            <small className="my-muted">
                                {t('Estimate', 'Odhad')}: {predictions[key]}
                            </small>
                        )}
                        <input
                            className="filter-input"
                            type="number"
                            min="1"
                            max="65535"
                            step="1"
                            inputMode="numeric"
                            data-observed-stat
                            disabled={busy}
                            value={stats[key] ?? ''}
                            data-nature-effect={
                                getNatureStatEffect(recordingNatureId, key) ?? undefined
                            }
                            aria-label={statName(key, t)}
                            aria-describedby={
                                predictions[key] !== undefined ? predictionHintId : undefined
                            }
                            onChange={(event) =>
                                changeDraft({
                                    ...draft,
                                    stats: { ...stats, [key]: event.target.value },
                                })
                            }
                        />
                        {comparison[key] !== undefined &&
                            stats[key] !== undefined &&
                            stats[key] !== '' && (
                                <small className="my-muted">
                                    {t('Change', 'Změna')}:{' '}
                                    {Number(stats[key]) - comparison[key] > 0 ? '+' : ''}
                                    {Number(stats[key]) - comparison[key]}
                                </small>
                            )}
                    </label>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
            {storageError && (
                <p role="alert">
                    {t(
                        'This draft could not be stored on this device. Keep this page open and save the observation before leaving.',
                        'Rozepsaný záznam se nepodařilo uložit v zařízení. Nechte stránku otevřenou a před odchodem uložte měření.',
                    )}
                </p>
            )}
            <div className="my-actions">
                <button
                    className="my-primary"
                    disabled={busy}
                    type="submit"
                    onClick={() => {
                        saveIntent.current = 'save';
                    }}
                >
                    {observation
                        ? t('Save correction', 'Uložit opravu')
                        : currentForm
                          ? t('Save observation', 'Uložit záznam')
                          : t('Save to history', 'Uložit do historie')}
                </button>
                {!observation && !newObservationId && (
                    <button
                        className="page-button"
                        disabled={busy}
                        type="submit"
                        onClick={() => {
                            saveIntent.current = 'another';
                        }}
                    >
                        {t('Save & add another', 'Uložit a přidat další')}
                    </button>
                )}
                {!observation && allowNextMember && (
                    <button
                        className="page-button"
                        disabled={busy}
                        type="submit"
                        onClick={() => {
                            saveIntent.current = 'next-member';
                        }}
                    >
                        {t('Save & next member', 'Uložit a další člen')}
                    </button>
                )}
                <button
                    className="page-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                        if (!preserveDraftOnCancel) clearObservationDraft(draftKey);
                        onCancel();
                    }}
                >
                    {cancelLabel ?? t('Cancel', 'Zrušit')}
                </button>
            </div>
        </form>
    );
}

export function GrowthTable({
    observations,
    family,
    showEstimates,
    onEdit,
    onDelete,
    newestFirst = false,
}: {
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    showEstimates: boolean;
    onEdit: (observation: StatObservation) => void;
    onDelete: (observation: StatObservation) => void;
    newestFirst?: boolean;
}) {
    const { t, locale } = useLanguage();
    const active = observations.filter((entry) => !entry.deleted);
    const estimates = showEstimates ? interpolateStats(active) : [];
    const epochs = [
        ...new Set(
            active
                .sort((a, b) =>
                    newestFirst
                        ? b.recordedAt.localeCompare(a.recordedAt)
                        : a.recordedAt.localeCompare(b.recordedAt),
                )
                .map((entry) => entry.formEpoch),
        ),
    ];
    if (active.length === 0)
        return (
            <p className="my-muted">
                {t(
                    'No battle stats recorded. Tracking stats is optional.',
                    'Bojové statistiky zatím nejsou zaznamenány. Jejich sledování je volitelné.',
                )}
            </p>
        );
    return (
        <div className="my-stack">
            {epochs.map((epoch, index) => {
                const observed = active.filter((entry) => entry.formEpoch === epoch);
                const speciesId = observed[0].speciesId;
                const species =
                    family.find((entry) => entry.speciesId === speciesId)?.name ?? `#${speciesId}`;
                const rows = [
                    ...observed.map((entry) => ({
                        key: entry.id,
                        level: entry.level,
                        stats: entry.stats,
                        observation: entry,
                        estimated: false,
                    })),
                    ...estimates
                        .filter((entry) => entry.formEpoch === epoch)
                        .map((entry) => ({
                            key: `${epoch}-${entry.level}`,
                            level: entry.level,
                            stats: entry.stats,
                            observation: null,
                            estimated: true,
                        })),
                ].sort((a, b) =>
                    newestFirst
                        ? (b.observation?.recordedAt ?? '').localeCompare(
                              a.observation?.recordedAt ?? '',
                          )
                        : a.level - b.level || Number(a.estimated) - Number(b.estimated),
                );
                return (
                    <div key={epoch}>
                        <h4 className="my-history-heading">
                            {species} · {t('Stage record', 'Období formy')} {index + 1}
                        </h4>
                        <div className="my-table-scroll">
                            <table className="my-history-table">
                                <caption className="sr-only">
                                    {t(
                                        'Observed growth and optional estimates',
                                        'Naměřený růst a volitelné odhady',
                                    )}
                                </caption>
                                <thead>
                                    <tr>
                                        <th>{t('Level', 'Úroveň')}</th>
                                        {statKeys.map((key) => (
                                            <th key={key}>{statName(key, t)}</th>
                                        ))}
                                        <th>{t('Source', 'Zdroj')}</th>
                                        <th>{t('Actions', 'Akce')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.key}
                                            className={row.estimated ? 'my-estimate' : undefined}
                                        >
                                            <th scope="row">{row.level}</th>
                                            {statKeys.map((key) => (
                                                <td key={key}>
                                                    {row.stats[key] === undefined
                                                        ? '—'
                                                        : row.estimated
                                                          ? `≈${Number(row.stats[key].toFixed(1))}`
                                                          : row.stats[key]}
                                                </td>
                                            ))}
                                            <td>
                                                {row.observation ? (
                                                    <>
                                                        <strong>{t('Observed', 'Naměřeno')}</strong>
                                                        <small>
                                                            {new Date(
                                                                row.observation.recordedAt,
                                                            ).toLocaleString(locale)}
                                                        </small>
                                                    </>
                                                ) : (
                                                    t('Estimate', 'Odhad')
                                                )}
                                            </td>
                                            <td>
                                                {row.observation && (
                                                    <div className="my-actions">
                                                        <button
                                                            className="my-text-button"
                                                            type="button"
                                                            onClick={() => {
                                                                if (row.observation)
                                                                    onEdit(row.observation);
                                                            }}
                                                        >
                                                            {t('Correct', 'Opravit')}
                                                        </button>
                                                        <button
                                                            className="my-text-button"
                                                            type="button"
                                                            onClick={() => {
                                                                if (row.observation)
                                                                    onDelete(row.observation);
                                                            }}
                                                        >
                                                            {t('Remove', 'Odstranit')}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function MyPokemonHistory({
    pokemon,
    observations,
    family,
    saveObservation,
    predictionsEnabled = true,
    natureId = pokemon.natureId,
    onRecord,
    recentOnly = false,
}: {
    pokemon: OwnedPokemon;
    observations: readonly StatObservation[];
    family: readonly SpeciesDetails[];
    saveObservation: (observation: StatObservation) => Promise<void>;
    predictionsEnabled?: boolean;
    natureId?: number | null;
    onRecord?: () => void;
    recentOnly?: boolean;
}) {
    const { t } = useLanguage();
    const [editing, setEditing] = useState<StatObservation | 'new' | null>(null);
    const [showEstimates, setShowEstimates] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [removed, setRemoved] = useState<StatObservation | null>(null);
    const visibleObservations = recentOnly
        ? observations
              .filter((entry) => !entry.deleted)
              .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
              .slice(0, 3)
        : observations;
    async function change(observation: StatObservation) {
        setError(null);
        try {
            await saveObservation(observation);
            if (observation.deleted) setRemoved(observation);
            else if (removed?.id === observation.id) setRemoved(null);
        } catch {
            setError(
                t(
                    'Could not update history. Try again.',
                    'Historii se nepodařilo upravit. Zkuste to znovu.',
                ),
            );
        }
    }
    return (
        <section
            className="my-stack"
            aria-label={t('Battle stat history', 'Historie bojových statistik')}
        >
            <div className="my-section-heading">
                <h3>
                    {recentOnly
                        ? t('Recent observations', 'Poslední měření')
                        : t('Growth history', 'Historie růstu')}
                </h3>
                <button
                    className="page-button"
                    type="button"
                    onClick={() => {
                        if (onRecord) onRecord();
                        else setEditing('new');
                    }}
                >
                    {t('Record stats', 'Zapsat statistiky')}
                </button>
            </div>
            {!recentOnly && (
                <p className="my-muted">
                    {t(
                        'Table estimates fill gaps between measurements of the same continuous species/form stage. They are not measured stats. Predictions for a new level appear only in the entry form until you save them.',
                        'Odhady v tabulce vyplňují mezery mezi měřeními ve stejném souvislém období druhu či formy. Nejde o naměřené statistiky. Předpovědi pro novou úroveň se do uložení zobrazují pouze ve formuláři.',
                    )}
                </p>
            )}
            {!recentOnly && (
                <label className="my-check">
                    <input
                        type="checkbox"
                        checked={showEstimates}
                        onChange={(event) => setShowEstimates(event.target.checked)}
                    />
                    {t('Show estimates between observations', 'Zobrazit odhady mezi měřeními')}
                </label>
            )}
            {editing && (
                <ObservationForm
                    key={
                        editing === 'new'
                            ? `new-${pokemon.state.speciesId}-${pokemon.state.formEpoch}`
                            : editing.id
                    }
                    pokemon={pokemon}
                    observation={editing === 'new' ? undefined : editing}
                    natureId={natureId}
                    family={family}
                    observations={observations}
                    predictionsEnabled={predictionsEnabled}
                    onSave={async (entry, intent) => {
                        await saveObservation(entry);
                        if (intent !== 'another') setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                />
            )}
            {error && <p role="alert">{error}</p>}
            {removed && (
                <p role="status">
                    {t('Observation removed.', 'Měření bylo odstraněno.')}{' '}
                    <button
                        className="my-text-button"
                        type="button"
                        onClick={() => {
                            void change({ ...removed, deleted: false });
                        }}
                    >
                        {t('Undo', 'Vrátit zpět')}
                    </button>
                </p>
            )}
            <GrowthTable
                observations={visibleObservations}
                family={family}
                showEstimates={!recentOnly && showEstimates}
                newestFirst={recentOnly}
                onEdit={setEditing}
                onDelete={(entry) => {
                    void change({ ...entry, deleted: true });
                }}
            />
            {!recentOnly && observations.some((entry) => entry.deleted) && (
                <details className="my-details">
                    <summary>{t('Removed observations', 'Odstraněné záznamy')}</summary>
                    {observations
                        .filter((entry) => entry.deleted)
                        .map((entry) => (
                            <div className="my-list-row" key={entry.id}>
                                <span>
                                    {t('Level', 'Úroveň')} {entry.level} ·{' '}
                                    {new Date(entry.recordedAt).toLocaleDateString()}
                                </span>
                                <button
                                    className="page-button"
                                    type="button"
                                    onClick={() => {
                                        void change({ ...entry, deleted: false });
                                    }}
                                >
                                    {t('Restore', 'Obnovit')}
                                </button>
                            </div>
                        ))}
                </details>
            )}
        </section>
    );
}
